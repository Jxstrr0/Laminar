/**
 * The grey tunnel: the university's test section with either the calibration
 * sphere on a sting or your rider model on the yaw turntable, the fan at the
 * far end, and a light smoke rake round the sphere so you can see the air
 * move. The section itself is a Blender model (art/tunnel/build.py, PR 13b),
 * loaded once the page is up; the code-drawn box stands in until it arrives,
 * or for good if it can't load.
 *
 * The renderer only draws. It reads the air speed and the separation line
 * the sim worked out and never decides anything itself.
 *
 * Axes: the air flows along +x. y is up. The sphere sits at the origin; the
 * rider stands on the turntable below it, facing upstream. Positive yaw
 * turns the rider's nose to its right, so the air arrives from its left (the
 * flow field's convention, src/sim/flow/field.ts).
 *
 * Round the rider, the flow instruments (src/render/flowViz.ts) draw smoke
 * and tufts from the flow field. The smoke wand's tip is a teal dot: press
 * near it to move it in a plane across the flow upstream of the model; a
 * press anywhere else turns the camera.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { HANDLE_TOUCH } from '../data/handles'
import { BOB_TUNNEL } from '../data/bobsled'
import { FLIGHT_ATTITUDE } from '../data/jumper'
import { DRONE_BODY } from '../data/drone'
import { PLANE_BODY } from '../data/plane'
import { planeLength, planeX } from '../sim/geom/plane'
import { AIRCRAFT_BODY } from '../data/aircraft'
import { aircraftLength, aircraftX } from '../sim/geom/aircraft'
import { POD_BODY } from '../data/pod'
import { podLengths } from '../sim/pod'
import { podX, wingBelow } from '../sim/geom/pod'
import { FRAME } from '../data/pose'
import { UNIVERSITY_TUNNEL, REFERENCE_SPHERE, REFERENCE_WHEEL } from '../data/tunnel'
import type { FailurePart } from '../sim/failure'
import type { TunnelId } from '../sim/facility'
import { sledLength } from '../sim/geom/bobsled'
import { TRUCK_TUNNEL } from '../data/truck'
import { doorsAt, truckLength } from '../sim/geom/truck'
import { truckX } from '../sim/geom/truckPose'
import { CAR_BODY } from '../data/car'
import { carLength } from '../sim/geom/car'
import { RECORD_BODY, RECORD_CLASS } from '../data/record'
import { recordLength, recordX } from '../sim/geom/record'
import type { FlowField, Tuft } from '../sim/flow/field'
import type { Tap } from '../sim/flow/taps'
import { createFlowViz, type Instruments } from './flowViz'
import { createCpSurface } from './cpSurface'
import { groundDetail } from './groundDetail'
import { STUDIO_LIGHT } from '../data/skies'
import { studioLight } from './studioLight'
import { onThemeChange, sceneColours } from './theme'
import type { PivGrid } from '../sim/flow/piv'
import { buildReferenceWheel, buildRider, disposeGroup, type RiderState } from './riderFigure'

/** Scene colours: a bright, clean lab (plan section 11). */
/**
 * The lab's fixed colours. The ones that follow the phone's light or dark mode
 * (walls, floor, backdrop, the Dark wall, the lights, the teal marks) live in
 * src/render/theme.ts (Isobar, PR 13h).
 */
const COLOURS = {
  /** A sled's ground board, pale plywood. */
  board: 0xd9c7a3,
  ceilingLight: 0xffffff,
  frame: 0x8c97a1,
  window: 0x9fb4c6,
  sphere: 0xfafbfc,
  sting: 0x5d6873,
  fanRing: 0x6b7680,
  fanBlade: 0x3c4650,
  screen: 0xb7c1c9,
  smoke: 0xffffff,
  turntable: 0xb3bcc4,
  wand: 0x5d6873,
} as const

/** The smoke wand: where its tip starts (from the model's centre, m) and where it may go. */
const WAND = { x: -0.75, startUp: 0.45, startZ: 0.04, minUp: 0.03, maxUp: 0.9, wallGap: 0.12 }

/** How much slower than real life the smoke drifts, so 40 m/s is still visible. */
const SMOKE_TIME_SCALE = 0.08
/**
 * Smoke rake upstream of the sphere: a cross of nozzles, one line up and down
 * and one side to side, so the smoke draws two slices through the flow.
 */
const RAKE = { x: -2.2, perArm: 9, spread: 0.24 }
/** Vertical field of view of the space between the header and the sheet, in degrees. */
const PORTRAIT_FOV = 34
const LANDSCAPE_FOV = 30
/** Room the header takes at the top, CSS pixels: the model is centred below it. */
const HEADER_PX = 64
/** Fan turns per second at top speed (just for looks). */
const FAN_REVS_AT_TOP = 6
/**
 * The wake behind the sphere, in sphere radii: how far the shear layer runs
 * before it straightens out, and how long the churning region is drawn.
 */
const WAKE_RELAX = 0.5
const WAKE_LENGTH = 4
/** Puffs tumbling in the wake. */
const WAKE_PUFFS = 90

/** What stands in the test section. */
/** What a racing car model sits over (PR 9l): the bare floor, the shop's ground board, or your tunnel's rolling road. */
export type CarFloorLook = 'still' | 'board' | 'rolling'

export type TunnelModel = ({ kind: 'sphere' } | { kind: 'rider'; state: RiderState; scale: number; board?: boolean; floor?: CarFloorLook } | { kind: 'wheel'; scale: number }) & {
  /** A tare run: the mount alone, with the model taken off. */
  tare?: boolean
}

/** Where the camera starts, from the model's centre (outside the near glass). */
const CAMERA_OFFSET = {
  sphere: new THREE.Vector3(-0.85, 0.3, 1.65),
  rider: new THREE.Vector3(-1.1, 0.5, 2.1),
  wheel: new THREE.Vector3(-1.1, 0.4, 1.9),
}
/** The rider model's centre, as a height above the floor at full scale, m. */
const RIDER_CENTRE_Y = 0.65
/** The rider bike's middle along its length at full scale (between the tyres' ends), m. */
const RIDER_MID_X = (FRAME.rearAxleX + FRAME.frontAxleX) / 2
/** A skater model stands on two short posts under its blades (full scale, m along and tall). */
const SKATER_POSTS = [-0.1, 0.15]
const SKATER_POST_HEIGHT = 0.02
/** A bobsled model sits on two short posts under its runners (full scale, m along). */
const SLED_POSTS = [-0.7, 0.7]
/** The ground board under a sled: how far it reaches past each end, and its width and thickness (full scale, m). */
const BOARD = { past: 0.5, width: 1.1, thick: 0.02 }
/** A truck's board is the same idea at a truck's size; its posts sit under the steer axle and the trailer's bogie (full scale, m). */
const TRUCK_BOARD = { past: 3, width: 4.2, thick: 0.15 }
const TRUCK_POSTS = { steer: 1.35, bogie: 3.3 }
/** A truck's middle above the road, full scale, m (where the camera looks). */
const TRUCK_CENTRE_Y = 1.9
/** The camera stands this much further back from a truck than from a rider at the same scale. */
const TRUCK_CAMERA = 6
/**
 * A racing car (PR 9l) hangs from a strut through its roof, as in a car
 * tunnel, over the floor, a ground board or a rolling road. Full scale, m:
 * the board's height, reach past each end, width and thickness; the belt's
 * reach and width; the car's middle (where the camera looks) and how much
 * further back the camera stands than for a rider.
 */
const CAR_BOARD = { height: 0.12, past: 0.8, width: 2.6, thick: 0.04 }
const CAR_BELT = { past: 0.6, width: 1.5, stripes: 6 }
const CAR_CENTRE_Y = 0.55
const CAR_CAMERA = 2.6
/**
 * A land-speed car (PR 9s) stands on two slim posts on the turntable, so it
 * can be yawed, over the floor, a ground board or a rolling road (the car's
 * board and belt, longer). Full scale, m: the car's middle and how much
 * further back the camera stands than for a rider.
 */
const RECORD_CENTRE_Y = 0.6
const RECORD_CAMERA = 4
/**
 * A racing quad (PR 10d) is tested full size on a slim sting from behind,
 * pivoting about its frame plate's middle, held at the section's middle
 * height. Metres: the pivot's height, the sting's length back to its strut,
 * and the rod's and strut's radii. The camera stands close: a quad is small.
 */
const DRONE_STING = { y: 0.9, length: 0.3, rod: 0.005, strut: 0.012, knuckle: 0.01 }
const DRONE_CAMERA = 0.22
/**
 * A survey drone's model (PR 10l) is pitched on a sting into its tail cone,
 * pivoting about the wing's middle, held at this height in the section, m,
 * whatever the model's scale. Full-scale metres: how far behind the tail
 * cone's end the strut stands, and the rod's and strut's radii. The camera
 * stands this far back for its size.
 */
const PLANE_STING = { height: 0.95, past: 0.25, rod: 0.012, strut: 0.03, knuckle: 0.025 }
const PLANE_CAMERA = 1.6
/**
 * A kit plane's sting (PR 10s): as a survey drone's, into the tail cone, but
 * sized at full scale for a 1:6 or 1:5 model (so the rod reads about 2.5 cm
 * thick in the section). The pivot sits as high as a survey drone's.
 */
const AIRCRAFT_STING = { past: 1.4, rod: 0.15, strut: 0.24, knuckle: 0.22 }
const AIRCRAFT_CAMERA = 6
/**
 * A sensor pod's sting (PR 10ab): into the tail cone's end along the pod's
 * axis, sized at full scale for a 1:2.4 or 1:1.8 model. Its stretch of wing,
 * when fitted, is tied to the side walls by thin rods, off the balance.
 */
const POD_STING = { past: 0.6, rod: 0.05, strut: 0.09, knuckle: 0.08, tether: 0.02 }
const POD_CAMERA = 2.6
/** A powered quad's props are drawn turning this many times a second: slow enough to see as props (real ones blur at hundreds). */
const PROP_REVS = 3
/** How each kind of model on the posts is framed: the height looked at and how far back the camera stands, as for a rider. */
type Framing = 'rider' | 'truck' | 'car' | 'record' | 'drone' | 'plane' | 'aircraft' | 'pod'
const FRAMING: Record<Framing, { y: number; back: number }> = {
  rider: { y: RIDER_CENTRE_Y, back: 1 },
  truck: { y: TRUCK_CENTRE_Y, back: TRUCK_CAMERA },
  car: { y: CAR_CENTRE_Y, back: CAR_CAMERA },
  record: { y: RECORD_CENTRE_Y, back: RECORD_CAMERA },
  drone: { y: DRONE_STING.y, back: DRONE_CAMERA },
  // A plane's height is set whatever its scale (aim reads PLANE_STING).
  plane: { y: 0, back: PLANE_CAMERA },
  aircraft: { y: 0, back: AIRCRAFT_CAMERA },
  pod: { y: 0, back: POD_CAMERA },
}
/**
 * A ski jumper flies on a sting from behind: the model pivots about its hips,
 * held this high above the floor (full scale, m), with the sting this long
 * back to its strut.
 */
const JUMPER_HIPS_Y = 0.85
const JUMPER_STING = 0.9

export interface TunnelView {
  /** Draw one frame. speed is the air speed in m/s; dt is real seconds since the last frame. */
  frame(speed: number, dt: number): void
  /** Where the sim says the flow leaves the sphere, in degrees from its nose. */
  setSeparation(deg: number): void
  /** Put the sphere or a rider model in the test section. */
  setModel(model: TunnelModel): void
  /** Turn the turntable, degrees (positive: the nose turns right, so the air arrives from the rider's left). */
  setYaw(deg: number): void
  /** Pitch a ski jumper on its sting: the skis' angle to the air, degrees. */
  setPitch(deg: number): void
  /** Lower a racing car on its strut: how far below its static ride height, full scale, m. */
  setDrop(metres: number): void
  /** The air round the rider for the smoke and tufts (null: none yet). */
  setFlow(field: FlowField | null, tufts: readonly Tuft[]): void
  /** Which instruments are out, and whether the dark backdrop is up. */
  setInstruments(on: Instruments & { dark: boolean }): void
  /** The pressure taps and their latest scan (an empty list hides them). */
  setTaps(taps: readonly Tap[], cps: readonly number[]): void
  /** The PIV's side sheet (PR 10ah); null hides it. */
  setPiv(grid: PivGrid | null): void
  /** Keep the sphere clear of the bottom sheet: pass its height in CSS pixels. */
  setSheetHeight(px: number): void
  /** Which tunnel's section to draw (PR 13d): the university's or your own. */
  setTunnel(id: TunnelId): void
  /** How hard the rider model buzzes: 0 still, 1 at a part's limit (plan section 8). */
  setStrain(level: number): void
  /** A part lets go: it flies off down the section (animate) or is simply gone (a model that broke earlier). */
  breakPart(part: FailurePart, animate: boolean): void
  dispose(): void
}

export function createTunnelView(host: HTMLElement): TunnelView {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  // Drawing every device pixel on a phone is the biggest cost; two is plenty.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.setAttribute('aria-label', 'The wind tunnel test section with a sphere on a sting')
  renderer.domElement.setAttribute('role', 'img')
  host.prepend(renderer.domElement)

  const scene = new THREE.Scene()
  let theme = sceneColours()
  scene.background = new THREE.Color(theme.background)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 40)
  // Start outside the near wall, looking in as if through the observation glass.
  camera.position.set(-0.85, 0.3, 1.65)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, 0)
  controls.enableDamping = true
  controls.enablePan = false
  // The near wall is never drawn from outside (see the box below), so the
  // camera can back out through it like an observation window. Keep it on
  // that side so the far wall and its windows stay behind the model.
  controls.minDistance = 0.45
  controls.maxDistance = 4
  controls.minAzimuthAngle = -1.25
  controls.maxAzimuthAngle = 1.25
  controls.minPolarAngle = 0.35
  controls.maxPolarAngle = Math.PI - 0.55
  controls.update()

  // --- Light: soft lab light from above, plus one key light for shape.
  const hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, 1.6)
  scene.add(hemi)
  const key = new THREE.DirectionalLight(theme.key, 1.4)
  key.position.set(-1.5, 3, 2)
  scene.add(key)
  const studio = studioLight(renderer, scene, hemi)

  const { length: L, width: W, height: H } = UNIVERSITY_TUNNEL.section
  const floorY = -H / 2

  // --- The test section: floor, ceiling and two walls seen from inside.
  // BackSide means a wall only draws when seen from inside the box, so from
  // outside the near wall vanishes and the section reads as a cutaway.
  // The code-drawn section, until the Blender model loads (or if it never does).
  const standIn = new THREE.Group()
  scene.add(standIn)
  const wallMat = new THREE.MeshStandardMaterial({ color: theme.wall, roughness: 0.85, side: THREE.BackSide })
  const box = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), wallMat)
  standIn.add(box)

  const floorMat = new THREE.MeshStandardMaterial({ color: theme.floor, roughness: 0.9 })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, W), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = floorY + 0.001
  standIn.add(floor)

  // Panel seams on the floor, so speed and depth read at a glance.
  const seams = new THREE.GridHelper(L, 16, COLOURS.frame, COLOURS.frame)
  seams.scale.z = W / L
  seams.position.y = floorY + 0.003
  ;(seams.material as THREE.Material).transparent = true
  ;(seams.material as THREE.Material).opacity = 0.35
  standIn.add(seams)

  // Turntable under the model (the yaw table arrives in PR 3).
  const turntable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.01, 64),
    new THREE.MeshStandardMaterial({ color: COLOURS.turntable, roughness: 0.6, metalness: 0.1 }),
  )
  turntable.position.y = floorY + 0.006
  // The yaw table turns as one: the disc, a teal tick at its upstream edge and the rider model.
  const yawTable = new THREE.Group()
  yawTable.add(turntable)
  const accentMat = new THREE.MeshBasicMaterial({ color: theme.accent })
  const tick = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.004, 0.018), accentMat)
  tick.position.set(-0.48, floorY + 0.013, 0)
  yawTable.add(tick)
  scene.add(yawTable)
  const mount = new THREE.Group()
  mount.position.y = floorY + 0.011
  yawTable.add(mount)

  // Ceiling light strips.
  const lightMat = new THREE.MeshBasicMaterial({ color: COLOURS.ceilingLight })
  for (const z of [-W / 4, W / 4]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(L * 0.8, 0.02, 0.12), lightMat)
    strip.position.set(0, H / 2 - 0.011, z)
    standIn.add(strip)
  }

  // Observation windows on the far wall, with frames.
  const frameMat = new THREE.MeshStandardMaterial({ color: theme.frame, roughness: 0.5, metalness: 0.3 })
  const glassMat = new THREE.MeshStandardMaterial({ color: COLOURS.window, roughness: 0.15, metalness: 0.2 })
  for (const x of [-1.6, 0, 1.6]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.02), frameMat)
    frame.position.set(x, 0.05, -W / 2 + 0.011)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), glassMat)
    glass.position.set(x, 0.05, -W / 2 + 0.023)
    standIn.add(frame, glass)
  }

  // A teal reference stripe along the near wall at sphere height.
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.025), accentMat)
  stripe.position.set(0, 0, W / 2 - 0.002)
  stripe.rotation.y = Math.PI
  scene.add(stripe)

  // Flow screens at the upstream end.
  const screen = new THREE.GridHelper(Math.max(W, H), 24, COLOURS.screen, COLOURS.screen)
  screen.rotation.z = Math.PI / 2
  screen.position.x = -L / 2 + 0.02
  standIn.add(screen)

  // --- The model: a sphere on a sting from behind, down to the floor.
  const r = REFERENCE_SPHERE.diameter / 2
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(r, 48, 32),
    new THREE.MeshStandardMaterial({ color: COLOURS.sphere, roughness: 0.35, metalness: 0.05 }),
  )
  // Everything that belongs to the sphere test, shown or hidden together.
  const sphereRig = new THREE.Group()
  scene.add(sphereRig)
  sphereRig.add(sphere)

  const stingMat = new THREE.MeshStandardMaterial({ color: COLOURS.sting, roughness: 0.4, metalness: 0.6 })
  const stingLen = 0.7
  const sting = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, stingLen, 16), stingMat)
  sting.rotation.z = Math.PI / 2
  sting.position.set(r + stingLen / 2 - 0.01, 0, 0)
  const strutHeight = -floorY
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, strutHeight, 16), stingMat)
  strut.position.set(r + stingLen - 0.01, floorY + strutHeight / 2, 0)
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), stingMat)
  elbow.position.set(r + stingLen - 0.01, 0, 0)
  sphereRig.add(sting, strut, elbow)

  // --- The fan at the downstream end.
  const fan = new THREE.Group()
  fan.position.x = L / 2 - 0.05
  const fanRadius = Math.min(W, H) * 0.45
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(fanRadius, 0.035, 12, 64),
    new THREE.MeshStandardMaterial({ color: COLOURS.fanRing, roughness: 0.5, metalness: 0.4 }),
  )
  ring.rotation.y = Math.PI / 2
  fan.add(ring)
  const rotor = new THREE.Group()
  const bladeMat = new THREE.MeshStandardMaterial({ color: COLOURS.fanBlade, roughness: 0.6, metalness: 0.3 })
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), bladeMat)
  rotor.add(hub)
  for (let i = 0; i < 7; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, fanRadius * 0.85, 0.16), bladeMat)
    blade.position.y = fanRadius * 0.47
    blade.rotation.y = 0.5
    const arm = new THREE.Group()
    arm.rotation.x = (i / 7) * Math.PI * 2
    arm.add(blade)
    rotor.add(arm)
  }
  fan.add(rotor)
  standIn.add(fan)
  /** What spins with the fan: the stand-in's rotor, then the shown model's. */
  let spinner: THREE.Object3D = rotor
  /**
   * The Blender sections (art/tunnel/build.py), one per tunnel, loaded the
   * first time each is wanted. Each keeps its wall, floor and seam materials
   * with their own light colours, so the dark backdrop can darken them and
   * put them back.
   */
  interface Section {
    root: THREE.Object3D
    rotor: THREE.Object3D | null
    /** The materials the theme and the Dark wall recolour, by their name in the model. */
    paint: { mat: THREE.MeshStandardMaterial; role: PaintRole }[]
  }
  type PaintRole = 'Wall' | 'Floor' | 'Seam' | 'Frame' | 'Trim' | 'FanRing'
  const sections = new Map<TunnelId, Section | 'loading'>()
  let shownTunnel: TunnelId = 'university'
  let disposed = false
  /**
   * The walls, floor and seams for the theme and the Dark wall: in light mode
   * the Dark wall is navy, in dark mode near-black (Kelbo), so it always shows.
   */
  const surfaces = () => (instruments.dark ? theme.darkWall : theme)
  const showBackdrop = () => {
    const look = surfaces()
    ;(scene.background as THREE.Color).setHex(look.background)
    wallMat.color.setHex(look.wall)
    floorMat.color.setHex(look.floor)
    for (const s of sections.values()) {
      if (s === 'loading') continue
      for (const p of s.paint) {
        const hex = p.role === 'Wall' ? look.wall : p.role === 'Floor' ? look.floor : p.role === 'Seam' ? look.seam : p.role === 'Frame' ? theme.frame : theme.accent
        p.mat.color.setHex(hex)
      }
    }
  }
  /** Show the shown tunnel's section if it has loaded; until then, the code-drawn box. */
  const showSection = () => {
    let shown: Section | null = null
    for (const [id, s] of sections) {
      if (s === 'loading') continue
      s.root.visible = id === shownTunnel
      if (id === shownTunnel) shown = s
    }
    standIn.visible = shown === null
    spinner = shown?.rotor ?? rotor
  }
  /** Which materials follow the theme: your own tunnel's trim and fan ring wear the theme's teal. */
  const paintRole = (name: string, id: TunnelId): PaintRole | null =>
    name === 'Wall' || name === 'Floor' || name === 'Seam' || name === 'Frame' || name === 'Trim' ? name : name === 'FanRing' && id === 'own' ? 'FanRing' : null
  const loadSection = (id: TunnelId) => {
    if (sections.has(id)) return
    sections.set(id, 'loading')
    new GLTFLoader().load(
      `${import.meta.env.BASE_URL}models/tunnel-${id}.glb`,
      (gltf) => {
        if (disposed) return
        const root = gltf.scene
        const paint: Section['paint'] = []
        root.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return
          const mat = obj.material as THREE.MeshStandardMaterial
          const role = paintRole(mat.name, id)
          if (role && !paint.some((p) => p.mat === mat)) paint.push({ mat, role })
          // Plaster on the walls and concrete on the floor (PR 13ba), over the theme's colours.
          if ((mat.name === 'Wall' || mat.name === 'Floor') && !mat.map) {
            mat.map = groundDetail(mat.name === 'Wall' ? 'wall' : 'floor', renderer)
            mat.needsUpdate = true
          }
          // The pale shell, its seams and the turntable would glare in the studio light; they take only a little of it.
          if (['Wall', 'Floor', 'Seam', 'Turntable'].includes(mat.name) && mat.envMap === null) studio.share(mat, STUDIO_LIGHT.shell)
        })
        sections.set(id, { root, rotor: root.getObjectByName('FanRotor') ?? null, paint })
        scene.add(root)
        showSection()
        showBackdrop()
      },
      undefined,
      // Offline or missing: the stand-in (or the other section) stays, and the game plays the same.
      () => {
        sections.delete(id)
      },
    )
  }
  // Nothing loads until the screen says which tunnel it's in (setTunnel).

  // --- Smoke rake: dashes of smoke that ride the flow around the sphere.
  // A stand-in for the proper smoke and tufts in PR 3, driven by the same speed.

  /**
   * Ideal (potential) flow past a sphere of radius r in a unit stream along
   * +x. It never separates on its own: the paths are bent round a wake below,
   * starting where the aero model says the flow tears off.
   */
  const r3 = r * r * r
  const flowAt = (x: number, y: number, z: number): [number, number, number] => {
    const d2 = x * x + y * y + z * z
    const d = Math.sqrt(d2)
    const k = (1.5 * r3) / (d2 * d2 * d)
    return [1 + r3 / (2 * d2 * d) - k * x * x, -k * x * y, -k * x * z]
  }

  // Each nozzle's path is worked out once, as positions SAMPLE_DT apart in
  // time. A puff then just moves along its path, so puffs bunch up where the
  // air slows in front of the sphere and spread out over its shoulders.
  const SAMPLE_DT = 0.005
  const endX = L / 2 - 0.3
  const paths: Float32Array[] = []
  for (let i = 0; i < RAKE.perArm; i++) {
    const a = ((i / (RAKE.perArm - 1)) * 2 - 1) * RAKE.spread
    // The line straight at the sphere would stall on its nose, so it is left out.
    if (Math.abs(a) < 0.01) continue
    for (const [y0, z0] of [[a, 0], [0, a]] as const) {
      const pts: number[] = []
      let x = RAKE.x, y = y0, z = z0
      while (x < endX && pts.length < 30000) {
        pts.push(x, y, z)
        // Midpoint step: accurate enough for a smooth line.
        const [u1, v1, w1] = flowAt(x, y, z)
        const [u2, v2, w2] = flowAt(x + u1 * SAMPLE_DT * 0.5, y + v1 * SAMPLE_DT * 0.5, z + w1 * SAMPLE_DT * 0.5)
        x += u2 * SAMPLE_DT
        y += v2 * SAMPLE_DT
        z += w2 * SAMPLE_DT
      }
      paths.push(new Float32Array(pts))
    }
  }

  /**
   * The paths as drawn: the ideal ones, held outside the wake. The wake's
   * edge leaves the sphere at the separation line, heading inwards along the
   * surface, and straightens out downstream. A laminar layer lets go early
   * and leaves a wide wake; a turbulent one hangs on and leaves a narrow one.
   */
  const shown = paths.map((p) => p.slice())
  let sepDeg = 100
  let shownSep = NaN
  let wakeStartX = 0
  /** Radius of the wake's edge at x (only meaningful behind the separation line). */
  let wakeRadius = (_x: number) => r
  const applyWake = () => {
    if (Math.abs(sepDeg - shownSep) < 0.25) return
    shownSep = sepDeg
    const th = (sepDeg * Math.PI) / 180
    const xs = -r * Math.cos(th)
    const rs = r * Math.sin(th)
    const inward = th > Math.PI / 2 ? Math.tan(th - Math.PI / 2) : 0
    const relax = WAKE_RELAX * r
    wakeStartX = xs
    wakeRadius = (x: number) => rs - inward * relax * (1 - Math.exp(-(x - xs) / relax))
    for (let k = 0; k < paths.length; k++) {
      const src = paths[k] as Float32Array
      const dst = shown[k] as Float32Array
      for (let i = 0; i < src.length; i += 3) {
        const x = src[i] as number
        const y = src[i + 1] as number
        const z = src[i + 2] as number
        dst[i] = x
        dst[i + 1] = y
        dst[i + 2] = z
        if (x <= xs) continue
        const rho = Math.hypot(y, z)
        const edge = wakeRadius(x)
        if (rho < edge && rho > 1e-6) {
          dst[i + 1] = (y * edge) / rho
          dst[i + 2] = (z * edge) / rho
        }
      }
    }
    placeRing(th)
  }

  // Puffs come in short packets with gaps, so the motion is easy to see.
  const PUFF_GAP = 1 // samples between puffs
  const PACKET = 12 // puffs per packet
  const PACKET_GAP = 14 // empty puff slots after each packet
  const slots = PACKET + PACKET_GAP
  type Puff = { path: number; start: number }
  const puffs: Puff[] = []
  paths.forEach((path, index) => {
    const n = path.length / 3
    for (let j = 0; j * PUFF_GAP < n; j++) {
      if (j % slots < PACKET) puffs.push({ path: index, start: j * PUFF_GAP })
    }
  })
  const smokePos = new Float32Array(puffs.length * 3)
  const smokeGeo = new THREE.BufferGeometry()
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3))

  /** Place every puff `travel` samples along its path, wrapping at the end. */
  const placePuffs = (travel: number) => {
    for (let k = 0; k < puffs.length; k++) {
      const { path: index, start } = puffs[k] as Puff
      const path = shown[index] as Float32Array
      const n = path.length / 3
      let t = (start + travel) % n
      if (t < 0) t += n
      const i0 = Math.floor(t)
      const i1 = i0 + 1 < n ? i0 + 1 : i0
      const f = t - i0
      for (let c = 0; c < 3; c++) {
        const p0 = path[i0 * 3 + c] as number
        const p1 = path[i1 * 3 + c] as number
        smokePos[k * 3 + c] = p0 + (p1 - p0) * f
      }
    }
    smokeGeo.attributes.position!.needsUpdate = true
  }

  // The separation line: a thin ring on the sphere where the flow lets go.
  const ringMat = new THREE.MeshBasicMaterial({ color: theme.sep, transparent: true, opacity: 0 })
  let sepRing: THREE.Mesh | null = null
  function placeRing(th: number) {
    if (sepRing) {
      sphereRig.remove(sepRing)
      sepRing.geometry.dispose()
    }
    sepRing = new THREE.Mesh(new THREE.TorusGeometry(r * Math.sin(th) * 1.004, 0.0022, 6, 72), ringMat)
    sepRing.rotation.y = Math.PI / 2
    sepRing.position.x = -r * Math.cos(th)
    sepRing.visible = sphere.visible
    sphereRig.add(sepRing)
  }

  applyWake()
  placePuffs(0)

  // Round, soft puffs instead of square points.
  const dotCanvas = document.createElement('canvas')
  dotCanvas.width = dotCanvas.height = 32
  const dot = dotCanvas.getContext('2d')
  if (dot) {
    const g = dot.createRadialGradient(16, 16, 0, 16, 16, 16)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.6)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    dot.fillStyle = g
    dot.fillRect(0, 0, 32, 32)
  }
  const dotTexture = new THREE.CanvasTexture(dotCanvas)
  const smokeMat = new THREE.PointsMaterial({
    color: COLOURS.smoke,
    map: dotTexture,
    size: 0.016,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const smoke = new THREE.Points(smokeGeo, smokeMat)
  sphereRig.add(smoke)
  // White smoke on a pale lab is hard to see, so the puffs get a faint grey twin.
  const smokeShadowMat = new THREE.PointsMaterial({
    color: theme.smokeTwin,
    map: dotTexture,
    size: 0.024,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const smokeShadow = new THREE.Points(smokeGeo, smokeShadowMat)
  smokeShadow.renderOrder = -1
  sphereRig.add(smokeShadow)

  // --- Flow instruments round the rider, and the smoke wand.
  const flowViz = createFlowViz(dotTexture)
  // Pressure colour on the model (PR 13i): only while the taps are on, from their latest scan.
  const cpSurface = createCpSurface()
  // The pressure map's colours are data: no studio reflections on them (PR 13ba).
  studio.share(cpSurface.material, 0)
  let scan: { taps: readonly Tap[]; cps: readonly number[] } = { taps: [], cps: [] }
  function paintCp() {
    if (instruments.taps && riderGroup && scan.taps.length > 0) cpSurface.paint(riderGroup, flowViz.group, scan.taps, scan.cps)
    else cpSurface.clear()
  }
  let instruments: Instruments & { dark: boolean } = { wand: false, rake: false, tufts: false, taps: false, dark: false }
  const wandTip = new THREE.Vector3(WAND.x, floorY + WAND.startUp, WAND.startZ)
  const wandRod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 8), new THREE.MeshStandardMaterial({ color: COLOURS.wand, roughness: 0.5 }))
  // The tip reads as a handle: a teal dot in a white ring, drawn on top.
  const tipRing = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }))
  const tipDot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), new THREE.MeshBasicMaterial({ color: theme.accent, depthTest: false, transparent: true }))
  tipRing.renderOrder = 10
  tipDot.renderOrder = 11
  const wand = new THREE.Group()
  wand.add(wandRod, tipRing, tipDot)
  wand.visible = false
  scene.add(wand)

  // The phone switched between light and dark (Isobar, PR 13h): recolour the lab, nothing else.
  const stopTheme = onThemeChange((next) => {
    theme = next
    hemi.color.setHex(next.hemiSky)
    hemi.groundColor.setHex(next.hemiGround)
    key.color.setHex(next.key)
    accentMat.color.setHex(next.accent)
    frameMat.color.setHex(next.frame)
    ringMat.color.setHex(next.sep)
    smokeShadowMat.color.setHex(next.smokeTwin)
    ;(tipDot.material as THREE.MeshBasicMaterial).color.setHex(next.accent)
    flowViz.setTheme(next)
    showBackdrop()
  })
  const placeWand = () => {
    // The rod comes up from the floor to the tip.
    const h = wandTip.y - floorY
    wandRod.scale.y = h
    wandRod.position.set(wandTip.x, floorY + h / 2, wandTip.z)
    tipRing.position.copy(wandTip)
    tipDot.position.copy(wandTip)
  }
  placeWand()
  const tmpLocal = new THREE.Vector3()
  /** The wand's tip in the rider's own coordinates, for the smoke. */
  const wandToRider = () => {
    flowViz.group.updateWorldMatrix(true, false)
    tmpLocal.copy(wandTip)
    flowViz.group.worldToLocal(tmpLocal)
    flowViz.setWandTip({ x: tmpLocal.x, y: tmpLocal.y, z: tmpLocal.z })
  }

  // Puffs churning in the wake: they drift downstream slowly and tumble, so
  // you can see how wide the separated region is.
  type WakePuff = { u: number; angle: number; radius: number; spin: number; wobble: number }
  const wakePuffs: WakePuff[] = []
  for (let i = 0; i < WAKE_PUFFS; i++) {
    wakePuffs.push({
      u: Math.random(),
      angle: Math.random() * Math.PI * 2,
      radius: Math.sqrt(Math.random()) * 0.9,
      spin: (Math.random() - 0.5) * 6,
      wobble: Math.random() * Math.PI * 2,
    })
  }
  const wakePos = new Float32Array(WAKE_PUFFS * 3)
  const wakeGeo = new THREE.BufferGeometry()
  wakeGeo.setAttribute('position', new THREE.BufferAttribute(wakePos, 3))
  const wakeSmoke = new THREE.Points(wakeGeo, smokeMat)
  const wakeShadow = new THREE.Points(wakeGeo, smokeShadowMat)
  wakeShadow.renderOrder = -1
  sphereRig.add(wakeSmoke, wakeShadow)
  let clock = 0
  const placeWake = (advance: number) => {
    const len = WAKE_LENGTH * r
    for (let i = 0; i < WAKE_PUFFS; i++) {
      const p = wakePuffs[i] as WakePuff
      p.u += advance * (0.6 + 0.4 * p.radius)
      if (p.u >= 1) {
        p.u -= 1
        p.angle = Math.random() * Math.PI * 2
      }
      p.angle += p.spin * advance
      const x = wakeStartX + p.u * len
      const edge = Math.max(0.2 * r, wakeRadius(x))
      const rad = edge * Math.min(0.95, p.radius + 0.08 * Math.sin(clock * 9 + p.wobble))
      wakePos[i * 3] = x
      wakePos[i * 3 + 1] = rad * Math.cos(p.angle)
      wakePos[i * 3 + 2] = rad * Math.sin(p.angle)
    }
    wakeGeo.attributes.position!.needsUpdate = true
  }
  placeWake(0)

  /** How far along their paths the puffs have travelled, in samples. */
  let travel = 0
  let fanAngle = 0
  let sheetPx = 0

  const resize = () => {
    const w = host.clientWidth || 1
    const h = host.clientHeight || 1
    renderer.setSize(w, h, false)
    // Shift the picture so the model sits in the middle of the space between
    // the header and the sheet. The camera draws a taller picture and we show
    // part of it; the field of view is set so that space keeps the intended
    // FOV, so a tall sheet on a short phone shrinks the model instead of
    // cropping it.
    const sheet = Math.min(sheetPx, h * 0.6)
    const top = Math.min(HEADER_PX, h * 0.1)
    const above = Math.max(1, h - sheet - top)
    const full = h + sheet - top
    const visibleFov = h > w ? PORTRAIT_FOV : LANDSCAPE_FOV
    const half = (visibleFov * Math.PI) / 360
    camera.fov = (360 / Math.PI) * Math.atan(Math.tan(half) * (full / above))
    camera.aspect = w / full
    camera.setViewOffset(w, full, 0, sheet - top, w, h)
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  // --- The rider model on its mount: scaled, facing upstream, on fork posts.
  const postMat = new THREE.MeshStandardMaterial({ color: COLOURS.sting, roughness: 0.4, metalness: 0.6 })
  /** The sled's ground board: pale plywood, so the sled reads against it. */
  const boardMat = new THREE.MeshStandardMaterial({ color: COLOURS.board, roughness: 0.8 })
  let riderGroup: THREE.Group | null = null
  let modelKind: TunnelModel['kind'] = 'sphere'
  /** What the camera is framed for: a rider, a truck, a racing car or a land-speed car. */
  let framed: Framing = 'rider'
  function clearRider() {
    if (!riderGroup) return
    // The paint borrows the figure's meshes: hand them back before it is thrown away.
    cpSurface.clear()
    // The instruments outlive the model: take them off before it is thrown away.
    riderGroup.remove(flowViz.group)
    // Off the posts after a break, the model may be loose in the section.
    riderGroup.parent?.remove(riderGroup)
    disposeGroup(riderGroup)
    riderGroup = null
    pitchGroup = null
    rotors = []
    noseProps = []
  }
  /** A powered quad's spinning props, turned each frame (PR 10e). */
  let rotors: THREE.Object3D[] = []
  /** A powered kit-plane model's prop, turned about the plane's axis each frame (PR 10s). */
  let noseProps: THREE.Object3D[] = []
  /** The posts with a rider on them, the reference wheel (null), or nothing for a tare run. */
  function showRider(state: RiderState | null, scale: number, tare: boolean, board = false, floor: CarFloorLook = 'still') {
    clearRider()
    dropGroup = null
    belt = null
    clearDebris()
    strain = 0
    const skater = state?.design.sport === 'skating'
    const sled = state?.design.sport === 'bobsled' ? state.design : null
    const truck = state?.design.sport === 'truck' ? state.design : null
    if (state?.design.sport === 'car') {
      showCar(state, scale, tare, floor)
      return
    }
    if (state?.design.sport === 'record') {
      showRecordCar(state, scale, tare, floor)
      return
    }
    if (state?.design.sport === 'skijump') {
      showJumper(state, scale, tare)
      return
    }
    if (state?.design.sport === 'drone') {
      showDrone(state, scale, tare)
      return
    }
    if (state?.design.sport === 'plane') {
      showPlane(state, scale, tare)
      return
    }
    if (state?.design.sport === 'aircraft') {
      showAircraft(state, scale, tare)
      return
    }
    if (state?.design.sport === 'pod') {
      showPod(state, scale, tare)
      return
    }
    pitchGroup = null
    rearIsDisc = state !== null && (state.design.sport === undefined || state.design.sport === 'cycling') && state.design.wheels.rear === 'disc'
    const g = new THREE.Group()
    // Two posts clamp the axles (or a skater's blades) to the balance under the floor.
    // A sled is built with its cockpit's middle at x = 0, not the bike's.
    // A truck is drawn centred on the rig's middle too.
    const midX = sled || truck ? 0 : RIDER_MID_X
    // On a ground board the sled or truck sits that much higher, and the posts reach up through it.
    const lift = board ? (sled ? BOB_TUNNEL.boardHeight : truck ? TRUCK_TUNNEL.boardHeight : 0) : 0
    const posts = truck
      ? [truckX(truck, TRUCK_POSTS.steer), truckX(truck, doorsAt(truck) - TRUCK_POSTS.bogie)]
      : sled
        ? SLED_POSTS
        : skater
          ? SKATER_POSTS
          : [FRAME.rearAxleX, FRAME.frontAxleX]
    const postH = sled || truck ? SKATER_POST_HEIGHT + lift : skater ? SKATER_POST_HEIGHT : FRAME.wheelRadius
    for (const axle of posts) {
      // A truck's posts are drawn as thick as a rider's at its model's size.
      const fat = truck ? 6 : 1
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * fat, 0.04 * fat, postH, 12), postMat)
      post.position.set(axle - midX, postH / 2, 0)
      g.add(post)
    }
    if (sled && board) {
      // The ground board: a plate on legs, longer than the sled, with a sharp front edge.
      const length = sledLength(sled) + 2 * BOARD.past
      const plate = new THREE.Mesh(new THREE.BoxGeometry(length, BOARD.thick, BOARD.width), boardMat)
      plate.position.set((sled.sled.nose - sled.sled.tail) / 2, lift - BOARD.thick / 2, 0)
      g.add(plate)
      for (const end of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, lift, BOARD.width * 0.9), postMat)
        leg.position.set(plate.position.x + end * (length / 2 - 0.1), (lift - BOARD.thick) / 2, 0)
        g.add(leg)
      }
    }
    if (truck && board) {
      const length = truckLength(truck) + 2 * TRUCK_BOARD.past
      const plate = new THREE.Mesh(new THREE.BoxGeometry(length, TRUCK_BOARD.thick, TRUCK_BOARD.width), boardMat)
      plate.position.set(0, lift - TRUCK_BOARD.thick / 2, 0)
      g.add(plate)
      for (const end of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, lift, TRUCK_BOARD.width * 0.9), postMat)
        leg.position.set(end * (length / 2 - 0.6), (lift - TRUCK_BOARD.thick) / 2, 0)
        g.add(leg)
      }
    }
    if (!tare) {
      const figure = state ? buildRider(state) : buildReferenceWheel(REFERENCE_WHEEL.spokes)
      figure.position.set(-midX, lift, 0)
      g.add(figure)
    }
    flowViz.group.position.set(-midX, lift, 0)
    g.add(flowViz.group)
    g.scale.setScalar(scale)
    // The rider's forward is +x; the air comes from −x, so turn it round.
    g.rotation.y = Math.PI
    mount.add(g)
    riderGroup = g
  }
  /** The racing car's body, lowered by the drop (null for anything else), and its rolling road's stripes. */
  let dropGroup: THREE.Group | null = null
  let dropLift = 0
  let dropBy = 0
  let belt: { stripes: THREE.Mesh[]; length: number; scale: number } | null = null
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x2b3640, roughness: 0.9 })
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xb8c2cb })
  /** The car's ground board (on legs) or rolling road (with running stripes) under a model this long, full scale; the height the model then sits at. */
  function carFloorUnder(g: THREE.Group, len: number, scale: number, floor: CarFloorLook): number {
    const lift = floor === 'board' ? CAR_BOARD.height : 0
    if (floor === 'board') {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(len + 2 * CAR_BOARD.past, CAR_BOARD.thick, CAR_BOARD.width), boardMat)
      plate.position.set(0, lift - CAR_BOARD.thick / 2, 0)
      g.add(plate)
      for (const end of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, lift, CAR_BOARD.width * 0.9), postMat)
        leg.position.set(end * (len / 2 + CAR_BOARD.past - 0.2), (lift - CAR_BOARD.thick) / 2, 0)
        g.add(leg)
      }
    }
    if (floor === 'rolling') {
      // The belt, with pale stripes that run back with the air (frame()).
      const length = len + 2 * CAR_BELT.past
      const plate = new THREE.Mesh(new THREE.BoxGeometry(length, 0.01, CAR_BELT.width), beltMat)
      plate.position.set(0, 0.005, 0)
      g.add(plate)
      const stripes: THREE.Mesh[] = []
      for (let i = 0; i < CAR_BELT.stripes; i++) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.25, CAR_BELT.width * 0.9), stripeMat)
        stripe.rotation.x = -Math.PI / 2
        stripe.position.set(-length / 2 + (i * length) / CAR_BELT.stripes, 0.011, 0)
        g.add(stripe)
        stripes.push(stripe)
      }
      belt = { stripes, length, scale }
    }
    return lift
  }
  /** A land-speed car on two slim posts under its body at the axles, over the floor, a ground board or a rolling road (PR 9s). */
  function showRecordCar(state: RiderState, scale: number, tare: boolean, floor: CarFloorLook) {
    rearIsDisc = false
    const car = state.design.sport === 'record' ? state.design : null
    if (!car) return
    const g = new THREE.Group()
    const lift = carFloorUnder(g, recordLength(car), scale, floor)
    // The posts reach up from the balance to the body's underside, between the wheels.
    const ride = RECORD_BODY[car.class].ride
    const body = RECORD_CLASS[car.class].body
    for (const axle of [body.frontAxle, body.rearAxle]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, ride + lift, 12), postMat)
      post.position.set(recordX(car, car.nose.length + axle), (ride + lift) / 2, 0)
      g.add(post)
    }
    if (!tare) {
      const figure = buildRider(state)
      figure.position.y = lift
      g.add(figure)
    }
    flowViz.group.position.set(0, lift, 0)
    g.add(flowViz.group)
    g.scale.setScalar(scale)
    g.rotation.y = Math.PI
    mount.add(g)
    riderGroup = g
  }
  /** A racing car hanging from its strut, over the floor, a ground board or a rolling road. */
  function showCar(state: RiderState, scale: number, tare: boolean, floor: CarFloorLook) {
    rearIsDisc = false
    const car = state.design.sport === 'car' ? state.design : null
    if (!car) return
    const g = new THREE.Group()
    const lift = carFloorUnder(g, carLength(car), scale, floor)
    // The strut: down from the roof of the section into the car's roof (the balance sits above).
    const roof = CAR_BODY[car.class].roof
    const strutLength = UNIVERSITY_TUNNEL.section.height / scale
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, strutLength, 12), postMat)
    strut.position.set(0, lift + roof * 0.85 + strutLength / 2, 0)
    g.add(strut)
    const body = new THREE.Group()
    if (!tare) body.add(buildRider(state))
    g.add(body)
    dropGroup = body
    dropLift = lift
    applyDrop()
    flowViz.group.position.set(0, lift, 0)
    g.add(flowViz.group)
    g.scale.setScalar(scale)
    g.rotation.y = Math.PI
    mount.add(g)
    riderGroup = g
  }
  function applyDrop() {
    if (dropGroup) dropGroup.position.y = dropLift - dropBy
  }
  /** The jumper's pivot: its hips, turned to the sting's pitch (null for anything else). */
  let pitchGroup: THREE.Group | null = null
  /** The pose's own angle: the figure is built at the flight attitude. */
  let pitchBuilt = FLIGHT_ATTITUDE.hold
  let pitchDeg = FLIGHT_ATTITUDE.hold
  /** A ski jumper on its sting: a rod from behind into the hips, a strut down to the floor. */
  function showJumper(state: RiderState, scale: number, tare: boolean) {
    rearIsDisc = false
    const g = new THREE.Group()
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, JUMPER_STING, 12), postMat)
    rod.rotation.z = Math.PI / 2
    rod.position.set(-JUMPER_STING / 2, JUMPER_HIPS_Y, 0)
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, JUMPER_HIPS_Y, 12), postMat)
    strut.position.set(-JUMPER_STING, JUMPER_HIPS_Y / 2, 0)
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), postMat)
    knuckle.position.set(0, JUMPER_HIPS_Y, 0)
    g.add(rod, strut, knuckle)
    const pivot = new THREE.Group()
    pivot.position.set(0, JUMPER_HIPS_Y, 0)
    if (!tare) {
      const figure = buildRider(state)
      const hips = state.pose.hip
      figure.position.set(-(hips[0].x + hips[1].x) / 2, -(hips[0].y + hips[1].y) / 2, 0)
      pivot.add(figure)
    }
    g.add(pivot)
    flowViz.group.position.x = 0
    g.add(flowViz.group)
    g.scale.setScalar(scale)
    g.rotation.y = Math.PI
    mount.add(g)
    riderGroup = g
    pitchGroup = pivot
    pitchBuilt = FLIGHT_ATTITUDE.hold
    pitchSign = 1
    applyPitch()
  }
  /** A quad on its sting (PR 10d): built level, then tipped nose-down by the tilt (setPitch). */
  function showDrone(state: RiderState, scale: number, tare: boolean) {
    rearIsDisc = false
    const S = DRONE_STING
    const g = new THREE.Group()
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(S.rod, S.rod, S.length, 12), postMat)
    rod.rotation.z = Math.PI / 2
    rod.position.set(-S.length / 2, S.y, 0)
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(S.strut, S.strut * 1.3, S.y, 12), postMat)
    strut.position.set(-S.length, S.y / 2, 0)
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(S.knuckle, 16, 12), postMat)
    knuckle.position.set(0, S.y, 0)
    g.add(rod, strut, knuckle)
    const pivot = new THREE.Group()
    pivot.position.set(0, S.y, 0)
    if (!tare) {
      // The quad is drawn with its plate at its hover height: bring the plate's middle to the pivot.
      const figure = buildRider({ ...state, tilt: undefined })
      figure.position.y = -DRONE_BODY.hover
      pivot.add(figure)
      figure.traverse((o) => {
        if (o.name === 'rotor') rotors.push(o)
      })
    }
    g.add(pivot)
    flowViz.group.position.x = 0
    g.add(flowViz.group)
    g.scale.setScalar(scale)
    g.rotation.y = Math.PI
    mount.add(g)
    riderGroup = g
    pitchGroup = pivot
    pitchBuilt = 0
    // Tilt is nose-down: the other way round from a jumper's pitch.
    pitchSign = -1
    applyPitch()
  }
  /**
   * A survey drone on its sting (PR 10l): the rod runs forward into the tail
   * cone's end to a pivot at the wing's middle, the strut down to the floor
   * behind the tail. Built level, then pitched nose-up by the angle of attack
   * (setPitch). Its pivot sits at the same height in the section whatever
   * the model's scale.
   */
  function showPlane(state: RiderState, scale: number, tare: boolean) {
    rearIsDisc = false
    if (state.design.sport !== 'plane') return
    const S = PLANE_STING
    const y = S.height / scale
    const back = -planeX(state.design, planeLength(state.design)) + S.past
    const g = new THREE.Group()
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(S.rod, S.rod, back, 12), postMat)
    rod.rotation.z = Math.PI / 2
    rod.position.set(-back / 2, y, 0)
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(S.strut, S.strut * 1.3, y, 12), postMat)
    strut.position.set(-back, y / 2, 0)
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(S.knuckle, 16, 12), postMat)
    knuckle.position.set(-back, y, 0)
    g.add(rod, strut, knuckle)
    const pivot = new THREE.Group()
    pivot.position.set(0, y, 0)
    if (!tare) {
      // The plane is drawn with its axis at its stand's height: bring the axis to the pivot, and leave the stand out.
      const figure = buildRider({ ...state, noStand: true })
      figure.position.y = -PLANE_BODY.stand
      pivot.add(figure)
    }
    flowViz.group.position.set(0, -PLANE_BODY.stand, 0)
    pivot.add(flowViz.group)
    g.add(pivot)
    g.scale.setScalar(scale)
    g.rotation.y = Math.PI
    mount.add(g)
    riderGroup = g
    pitchGroup = pivot
    pitchBuilt = 0
    // The angle of attack is nose-up, as a jumper's pitch is.
    pitchSign = 1
    applyPitch()
  }
  /**
   * A kit plane on its sting (PR 10s): as a survey drone, the rod into the
   * tail cone's end, the pivot at the wing's middle on the fuselage's axis.
   * The model keeps its wheels on, as the shop builds it.
   */
  function showAircraft(state: RiderState, scale: number, tare: boolean) {
    rearIsDisc = false
    if (state.design.sport !== 'aircraft') return
    const S = AIRCRAFT_STING
    const y = PLANE_STING.height / scale
    const back = -aircraftX(aircraftLength()) + S.past
    const g = new THREE.Group()
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(S.rod, S.rod, back, 12), postMat)
    rod.rotation.z = Math.PI / 2
    rod.position.set(-back / 2, y, 0)
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(S.strut, S.strut * 1.3, y, 12), postMat)
    strut.position.set(-back, y / 2, 0)
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(S.knuckle, 16, 12), postMat)
    knuckle.position.set(-back, y, 0)
    g.add(rod, strut, knuckle)
    const pivot = new THREE.Group()
    pivot.position.set(0, y, 0)
    if (!tare) {
      // The plane is drawn standing on its wheels: bring its axis to the pivot.
      const figure = buildRider(state)
      figure.position.y = -AIRCRAFT_BODY.axis
      pivot.add(figure)
      figure.traverse((o) => {
        if (o.name === 'prop-rotor') noseProps.push(o)
      })
    }
    flowViz.group.position.set(0, -AIRCRAFT_BODY.axis, 0)
    pivot.add(flowViz.group)
    g.add(pivot)
    g.scale.setScalar(scale)
    g.rotation.y = Math.PI
    mount.add(g)
    riderGroup = g
    pitchGroup = pivot
    pitchBuilt = 0
    pitchSign = 1
    applyPitch()
  }
  /**
   * A sensor pod on its sting (PR 10ab): the rod into the tail cone's end,
   * the pivot at the pod's middle on its axis. Its stretch of wing, if the
   * shop built one, hangs above on its pylon, tied to the side walls.
   */
  function showPod(state: RiderState, scale: number, tare: boolean) {
    rearIsDisc = false
    if (state.design.sport !== 'pod') return
    const design = state.design
    const S = POD_STING
    const y = PLANE_STING.height / scale
    const back = -podX(design, podLengths(design).total) + S.past
    const g = new THREE.Group()
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(S.rod, S.rod, back, 12), postMat)
    rod.rotation.z = Math.PI / 2
    rod.position.set(-back / 2, y, 0)
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(S.strut, S.strut * 1.3, y, 12), postMat)
    strut.position.set(-back, y / 2, 0)
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(S.knuckle, 16, 12), postMat)
    knuckle.position.set(-back, y, 0)
    g.add(rod, strut, knuckle)
    const pivot = new THREE.Group()
    pivot.position.set(0, y, 0)
    if (!tare) {
      const figure = buildRider(state)
      figure.position.y = -POD_BODY.axis
      pivot.add(figure)
      if (state.noWing !== true) {
        // Thin rods from the wing's ends out to the side walls: the wing is off the balance.
        const wall = UNIVERSITY_TUNNEL.section.width / 2 / scale
        const end = POD_BODY.wingSpan / 2
        const wy = wingBelow(design) + POD_BODY.chord * POD_BODY.wingThick * 0.5
        for (const side of [1, -1]) {
          const tether = new THREE.Mesh(new THREE.CylinderGeometry(S.tether / scale, S.tether / scale, wall - end, 8), postMat)
          tether.rotation.x = Math.PI / 2
          tether.position.set(0, wy, side * (end + (wall - end) / 2))
          pivot.add(tether)
        }
      }
    }
    flowViz.group.position.set(0, -POD_BODY.axis, 0)
    pivot.add(flowViz.group)
    g.add(pivot)
    g.scale.setScalar(scale)
    g.rotation.y = Math.PI
    mount.add(g)
    riderGroup = g
    pitchGroup = pivot
    pitchBuilt = 0
    pitchSign = 1
    applyPitch()
  }
  /** +1 turns the pitch group nose-up with the dial (a jumper), −1 nose-down (a quad's tilt). */
  let pitchSign = 1
  function applyPitch() {
    if (pitchGroup) pitchGroup.rotation.z = (pitchSign * (pitchDeg - pitchBuilt) * Math.PI) / 180
  }
  // --- Breaks (plan section 8). A warning buzzes the model on its posts; a
  // break throws a part (or, off the posts, the whole model) down the section,
  // where it bounces on the floor and comes to rest against the screens.
  let strain = 0
  let buzz = 0
  interface Debris { obj: THREE.Object3D; v: THREE.Vector3; spin: THREE.Vector3; still: boolean }
  let debris: Debris[] = []
  function clearDebris() {
    for (const d of debris) {
      d.obj.parent?.remove(d.obj)
      disposeGroup(d.obj)
    }
    debris = []
  }
  /** Which object a broken part is. */
  function partObject(part: FailurePart): THREE.Object3D | null {
    if (!riderGroup) return null
    if (part === 'posts') return riderGroup
    // Off a broken sting the jumper leaves its knuckle; the sting stays.
    if (part === 'sting') return pitchGroup
    if (part === 'disc') {
      const rear = riderGroup.getObjectByName('wheel-rear')
      return rearIsDisc ? (rear ?? null) : (riderGroup.getObjectByName('wheel-front') ?? null)
    }
    return riderGroup.getObjectByName('helmet') ?? null
  }
  let rearIsDisc = true
  function breakPart(part: FailurePart, animate: boolean) {
    const obj = partObject(part)
    if (!obj) return
    strain = 0
    // The loose jumper no longer turns with the sting's pitch.
    if (part === 'sting') pitchGroup = null
    if (!animate) {
      // A model that broke before: the part is simply missing (off the posts, the model lies on the floor).
      if (part === 'posts') {
        obj.rotation.z = Math.PI / 2
        obj.position.set(L * 0.3, floorY + 0.05, 0)
      } else if (part === 'sting') {
        // The jumper lies on the floor against the screens, as debris (so a new model clears it).
        scene.attach(obj)
        obj.rotation.set(0, Math.PI, 0)
        obj.position.set(L * 0.3, floorY + 0.06, 0)
        debris.push({ obj, v: new THREE.Vector3(), spin: new THREE.Vector3(), still: true })
      } else obj.visible = false
      return
    }
    // Keep its place in the world as it leaves its parent.
    scene.attach(obj)
    const kick = part === 'posts' || part === 'sting' ? 0.6 : 1.2
    debris.push({ obj, v: new THREE.Vector3(1.5, kick, (Math.random() - 0.5) * 0.6), spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, 3 + Math.random() * 6), still: false })
  }
  /** Fly the debris: blown downstream, pulled down, bouncing on the floor, stopped by the screens. */
  function stepDebris(speed: number, step: number) {
    for (const d of debris) {
      if (d.still) continue
      d.v.x += speed * 0.25 * step
      d.v.y -= 9.8 * step
      d.obj.position.addScaledVector(d.v, step)
      d.obj.rotation.x += d.spin.x * step
      d.obj.rotation.y += d.spin.y * step
      d.obj.rotation.z += d.spin.z * step
      const end = L / 2 - 0.1
      if (d.obj.position.x > end) {
        d.obj.position.x = end
        d.v.x = -0.2 * Math.abs(d.v.x)
      }
      const floor = floorY + 0.04
      if (d.obj.position.y < floor) {
        d.obj.position.y = floor
        d.v.y = Math.abs(d.v.y) * 0.3
        d.v.x *= 0.5
        d.v.z *= 0.5
        d.spin.multiplyScalar(0.5)
        if (d.v.y < 0.2 && speed < 1) d.still = true
      }
    }
  }

  /** Point the camera at the model, keeping it on the observation-window side. A truck is framed from further back. */
  function aim(kind: TunnelModel['kind'], scale = 1, framing: Framing = 'rider') {
    const frame = FRAMING[framing]
    const target =
      kind === 'rider'
        ? new THREE.Vector3(0, floorY + (framing === 'plane' || framing === 'aircraft' || framing === 'pod' ? PLANE_STING.height : frame.y * scale), 0)
        : kind === 'wheel'
          ? new THREE.Vector3(0, floorY + FRAME.wheelRadius * scale, 0)
          : new THREE.Vector3(0, 0, 0)
    const offset = CAMERA_OFFSET[kind].clone().multiplyScalar(kind === 'sphere' ? 1 : scale * 2 * frame.back)
    controls.target.copy(target)
    camera.position.copy(target).add(offset)
    controls.update()
  }

  // --- The wand: press near its tip to move it across the flow; anything else orbits.
  const canvas = renderer.domElement
  let dragging: number | null = null
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const wandPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -WAND.x)
  const hit = new THREE.Vector3()
  const tipOnScreen = () => {
    const v = wandTip.clone().project(camera)
    return { x: ((v.x + 1) / 2) * canvas.clientWidth, y: ((1 - v.y) / 2) * canvas.clientHeight }
  }
  const local = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const nearTip = (at: { x: number; y: number }) => {
    if (!wand.visible) return false
    const s = tipOnScreen()
    return Math.hypot(s.x - at.x, s.y - at.y) <= HANDLE_TOUCH.hitPx
  }
  host.addEventListener(
    'pointerdown',
    (e) => {
      if (e.target !== canvas || !e.isPrimary || dragging !== null || !nearTip(local(e))) return
      e.stopPropagation()
      e.preventDefault()
      canvas.setPointerCapture(e.pointerId)
      dragging = e.pointerId
    },
    { capture: true },
  )
  canvas.addEventListener('pointermove', (e) => {
    const at = local(e)
    if (dragging === null) {
      if (e.pointerType === 'mouse' && e.buttons === 0) canvas.style.cursor = nearTip(at) ? 'grab' : ''
      return
    }
    if (e.pointerId !== dragging) return
    canvas.style.cursor = 'grabbing'
    ndc.set((at.x / canvas.clientWidth) * 2 - 1, -(at.y / canvas.clientHeight) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    if (!ray.ray.intersectPlane(wandPlane, hit)) return
    wandTip.set(
      WAND.x,
      Math.min(floorY + WAND.maxUp, Math.max(floorY + WAND.minUp, hit.y)),
      Math.min(W / 2 - WAND.wallGap, Math.max(-W / 2 + WAND.wallGap, hit.z)),
    )
    placeWand()
  })
  const letGo = (e: PointerEvent) => {
    if (dragging === null || e.pointerId !== dragging) return
    dragging = null
    canvas.style.cursor = ''
  }
  canvas.addEventListener('pointerup', letGo)
  canvas.addEventListener('pointercancel', letGo)

  return {
    frame(speed, dt) {
      const step = Math.min(dt, 0.1)
      const top = UNIVERSITY_TUNNEL.topSpeed

      fanAngle += (speed / top) * FAN_REVS_AT_TOP * Math.PI * 2 * step
      spinner.rotation.x = fanAngle
      // A powered quad's props turn whether or not the fan runs.
      for (const r of rotors) r.rotation.y += PROP_REVS * Math.PI * 2 * step
      for (const r of noseProps) r.rotation.x += PROP_REVS * Math.PI * 2 * step
      // The rolling road runs back under the car at the air's speed (drawn at the model's scale).
      if (belt) {
        const b = belt
        for (const stripe of b.stripes) {
          stripe.position.x -= (speed * step) / b.scale
          if (stripe.position.x < -b.length / 2) stripe.position.x += b.length
        }
      }

      // Smoke fades in as the air starts to move, and drifts with it.
      const visible = Math.min(1, speed / 3)
      smokeMat.opacity = 0.9 * visible
      smokeShadowMat.opacity = 0.45 * visible
      ringMat.opacity = visible
      if (modelKind === 'sphere') applyWake()
      if (speed > 0.05) {
        travel += (speed * SMOKE_TIME_SCALE * step) / SAMPLE_DT
        placePuffs(travel)
        clock += step
        // The wake drifts at about a third of the stream's speed.
        placeWake((0.35 * speed * SMOKE_TIME_SCALE * step) / (WAKE_LENGTH * r))
      }

      if (modelKind === 'rider') {
        wandToRider()
        flowViz.frame(step, speed / top)
      }
      // A warning: the model buzzes on its posts, harder the nearer the limit.
      if (riderGroup && riderGroup.parent === mount) {
        buzz += step
        const a = strain * 0.025
        riderGroup.rotation.x = a * Math.sin(buzz * 53)
        riderGroup.rotation.z = a * 0.6 * Math.sin(buzz * 41)
      }
      if (debris.length) stepDebris(speed, step)

      controls.update()
      renderer.render(scene, camera)
    },
    setStrain(level) {
      strain = Math.min(1, Math.max(0, level))
    },
    breakPart,
    setFlow(field, list) {
      flowViz.setField(field, list)
    },
    setTaps(taps, cps) {
      flowViz.setTaps(taps, cps)
      scan = { taps, cps }
      paintCp()
    },
    setPiv(grid) {
      flowViz.setPiv(grid)
    },
    setInstruments(next) {
      instruments = { ...next }
      flowViz.setInstruments(next)
      paintCp()
      wand.visible = next.wand && modelKind === 'rider'
      showBackdrop()
    },
    setModel(model) {
      // Re-aim when the kind of model changes, or a truck comes on or off the posts (it's ten times a rider's length).
      const sport = model.kind === 'rider' ? model.state.design.sport : undefined
      const framing: Framing = sport === 'truck' || sport === 'car' || sport === 'record' || sport === 'drone' || sport === 'plane' || sport === 'aircraft' || sport === 'pod' ? sport : 'rider'
      const truckOn = framing === 'truck'
      const carOn = framing === 'car'
      const changed = model.kind !== modelKind || framing !== framed
      modelKind = model.kind
      framed = framing
      const tare = model.tare === true
      sphereRig.visible = model.kind === 'sphere'
      // With the sphere off there is nothing to bend the smoke round.
      for (const part of [sphere, smoke, smokeShadow, wakeSmoke, wakeShadow]) part.visible = !tare
      if (sepRing) sepRing.visible = !tare
      if (model.kind === 'rider') showRider(model.state, model.scale, tare, model.board === true, model.floor ?? 'still')
      else if (model.kind === 'wheel') showRider(null, model.scale, tare)
      else clearRider()
      wand.visible = instruments.wand && model.kind === 'rider' && !tare
      flowViz.group.visible = model.kind === 'rider' && !tare
      renderer.domElement.setAttribute(
        'aria-label',
        tare
          ? model.kind === 'sphere'
            ? 'The wind tunnel test section with the empty sting, for a tare run'
            : 'The wind tunnel test section with the empty posts, for a tare run'
          : model.kind === 'rider'
            ? model.state.design.sport === 'skijump'
              ? 'The wind tunnel test section with your ski jumper model on a pitching sting'
              : framing === 'drone'
                ? `The wind tunnel test section with your full-size racing quad on a tilting sting, its props ${model.state.props === 'spinning' ? 'spinning' : 'stopped'}`
              : framing === 'plane'
                ? 'The wind tunnel test section with your survey drone model on a pitching sting'
              : framing === 'pod'
                ? `The wind tunnel test section with your sensor pod model on a sting${model.state.noWing ? ', on its own' : ', under its stretch of wing'}`
              : framing === 'aircraft'
                ? `The wind tunnel test section with your light aircraft model on a pitching sting, its prop ${model.state.props === 'spinning' ? 'driven' : 'stopped'}`
              : model.state.design.sport === 'bobsled'
                ? `The wind tunnel test section with your bobsled model ${model.board ? 'on a ground board' : 'on the bare floor'}`
                : framing === 'record'
                  ? `The wind tunnel test section with your land-speed car model on the yaw turntable, ${model.floor === 'rolling' ? 'over the rolling road' : model.floor === 'board' ? 'on a ground board' : 'on the bare floor'}`
                : carOn
                  ? `The wind tunnel test section with your racing car model hanging from its strut, ${model.floor === 'rolling' ? 'over the rolling road' : model.floor === 'board' ? 'over a ground board' : 'over the bare floor'}`
                  : truckOn
                  ? `The wind tunnel test section with your truck model on the yaw turntable, ${model.board ? 'on a ground board' : 'on the bare floor'}`
                : 'The wind tunnel test section with your rider model on the yaw turntable'
            : model.kind === 'wheel'
              ? 'The wind tunnel test section with the reference wheel held still on the posts'
              : 'The wind tunnel test section with a sphere on a sting',
      )
      if (changed) aim(model.kind, model.kind === 'sphere' ? 1 : model.scale, framing)
    },
    setYaw(deg) {
      yawTable.rotation.y = (-deg * Math.PI) / 180
    },
    setPitch(deg) {
      pitchDeg = deg
      applyPitch()
    },
    setDrop(metres) {
      dropBy = metres
      applyDrop()
    },
    setSeparation(deg) {
      if (Number.isFinite(deg)) sepDeg = Math.min(170, Math.max(60, deg))
    },
    setSheetHeight(px) {
      sheetPx = px
      resize()
    },
    setTunnel(id) {
      shownTunnel = id
      loadSection(id)
      showSection()
    },
    dispose() {
      disposed = true
      stopTheme()
      studio.dispose()
      cpSurface.dispose()
      clearRider()
      clearDebris()
      flowViz.dispose()
      observer.disconnect()
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
