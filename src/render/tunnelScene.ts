/**
 * The grey tunnel: the university's test section with either the calibration
 * sphere on a sting or your rider model on the yaw turntable, the fan at the
 * far end, and a light smoke rake round the sphere so you can see the air
 * move. Placeholder geometry until the Blender art pass (PR 13).
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
 * and tufts from the flow field. The smoke wand's tip is a cobalt dot: press
 * near it to move it in a plane across the flow upstream of the model; a
 * press anywhere else turns the camera.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { HANDLE_TOUCH } from '../data/handles'
import { FRAME } from '../data/pose'
import { UNIVERSITY_TUNNEL, REFERENCE_SPHERE, REFERENCE_WHEEL } from '../data/tunnel'
import type { FailurePart } from '../sim/failure'
import type { FlowField, Tuft } from '../sim/flow/field'
import type { Tap } from '../sim/flow/taps'
import { createFlowViz, type Instruments } from './flowViz'
import { buildReferenceWheel, buildRider, disposeGroup, type RiderState } from './riderFigure'

/** Scene colours: a bright, clean lab (plan section 11). */
const COLOURS = {
  background: 0xe9edf0,
  wall: 0xf3f5f7,
  floor: 0xc9d0d6,
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
  accent: 0x2456e8,
  /** Separation line: the --sep colour from style.css. */
  separation: 0xd2462b,
  wand: 0x5d6873,
  wandTip: 0x2456e8,
  /** The dark backdrop, for white smoke. */
  darkBackground: 0x1b232b,
  darkWall: 0x2a343e,
  darkFloor: 0x222b33,
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
export type TunnelModel = ({ kind: 'sphere' } | { kind: 'rider'; state: RiderState; scale: number } | { kind: 'wheel'; scale: number }) & {
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

export interface TunnelView {
  /** Draw one frame. speed is the air speed in m/s; dt is real seconds since the last frame. */
  frame(speed: number, dt: number): void
  /** Where the sim says the flow leaves the sphere, in degrees from its nose. */
  setSeparation(deg: number): void
  /** Put the sphere or a rider model in the test section. */
  setModel(model: TunnelModel): void
  /** Turn the turntable, degrees (positive: the nose turns right, so the air arrives from the rider's left). */
  setYaw(deg: number): void
  /** The air round the rider for the smoke and tufts (null: none yet). */
  setFlow(field: FlowField | null, tufts: readonly Tuft[]): void
  /** Which instruments are out, and whether the dark backdrop is up. */
  setInstruments(on: Instruments & { dark: boolean }): void
  /** The pressure taps and their latest scan (an empty list hides them). */
  setTaps(taps: readonly Tap[], cps: readonly number[]): void
  /** Keep the sphere clear of the bottom sheet: pass its height in CSS pixels. */
  setSheetHeight(px: number): void
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
  scene.background = new THREE.Color(COLOURS.background)

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
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c2cb, 1.6))
  const key = new THREE.DirectionalLight(0xffffff, 1.4)
  key.position.set(-1.5, 3, 2)
  scene.add(key)

  const { length: L, width: W, height: H } = UNIVERSITY_TUNNEL.section
  const floorY = -H / 2

  // --- The test section: floor, ceiling and two walls seen from inside.
  // BackSide means a wall only draws when seen from inside the box, so from
  // outside the near wall vanishes and the section reads as a cutaway.
  const wallMat = new THREE.MeshStandardMaterial({ color: COLOURS.wall, roughness: 0.85, side: THREE.BackSide })
  const box = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), wallMat)
  scene.add(box)

  const floorMat = new THREE.MeshStandardMaterial({ color: COLOURS.floor, roughness: 0.9 })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, W), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = floorY + 0.001
  scene.add(floor)

  // Panel seams on the floor, so speed and depth read at a glance.
  const seams = new THREE.GridHelper(L, 16, COLOURS.frame, COLOURS.frame)
  seams.scale.z = W / L
  seams.position.y = floorY + 0.003
  ;(seams.material as THREE.Material).transparent = true
  ;(seams.material as THREE.Material).opacity = 0.35
  scene.add(seams)

  // Turntable under the model (the yaw table arrives in PR 3).
  const turntable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.01, 64),
    new THREE.MeshStandardMaterial({ color: COLOURS.turntable, roughness: 0.6, metalness: 0.1 }),
  )
  turntable.position.y = floorY + 0.006
  // The yaw table turns as one: the disc, a cobalt tick at its upstream edge and the rider model.
  const yawTable = new THREE.Group()
  yawTable.add(turntable)
  const tick = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.004, 0.018), new THREE.MeshBasicMaterial({ color: COLOURS.accent }))
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
    scene.add(strip)
  }

  // Observation windows on the far wall, with frames.
  const frameMat = new THREE.MeshStandardMaterial({ color: COLOURS.frame, roughness: 0.5, metalness: 0.3 })
  const glassMat = new THREE.MeshStandardMaterial({ color: COLOURS.window, roughness: 0.15, metalness: 0.2 })
  for (const x of [-1.6, 0, 1.6]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.02), frameMat)
    frame.position.set(x, 0.05, -W / 2 + 0.011)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), glassMat)
    glass.position.set(x, 0.05, -W / 2 + 0.023)
    scene.add(frame, glass)
  }

  // A cobalt reference stripe along the near wall at sphere height.
  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(L, 0.025),
    new THREE.MeshBasicMaterial({ color: COLOURS.accent }),
  )
  stripe.position.set(0, 0, W / 2 - 0.002)
  stripe.rotation.y = Math.PI
  scene.add(stripe)

  // Flow screens at the upstream end.
  const screen = new THREE.GridHelper(Math.max(W, H), 24, COLOURS.screen, COLOURS.screen)
  screen.rotation.z = Math.PI / 2
  screen.position.x = -L / 2 + 0.02
  scene.add(screen)

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
  scene.add(fan)

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
  const ringMat = new THREE.MeshBasicMaterial({ color: COLOURS.separation, transparent: true, opacity: 0 })
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
    color: 0x6b7885,
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
  let instruments: Instruments & { dark: boolean } = { wand: false, rake: false, tufts: false, taps: false, dark: false }
  const wandTip = new THREE.Vector3(WAND.x, floorY + WAND.startUp, WAND.startZ)
  const wandRod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 8), new THREE.MeshStandardMaterial({ color: COLOURS.wand, roughness: 0.5 }))
  // The tip reads as a handle: a cobalt dot in a white ring, drawn on top.
  const tipRing = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }))
  const tipDot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), new THREE.MeshBasicMaterial({ color: COLOURS.wandTip, depthTest: false, transparent: true }))
  tipRing.renderOrder = 10
  tipDot.renderOrder = 11
  const wand = new THREE.Group()
  wand.add(wandRod, tipRing, tipDot)
  wand.visible = false
  scene.add(wand)
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
  let riderGroup: THREE.Group | null = null
  let modelKind: TunnelModel['kind'] = 'sphere'
  function clearRider() {
    if (!riderGroup) return
    // The instruments outlive the model: take them off before it is thrown away.
    riderGroup.remove(flowViz.group)
    // Off the posts after a break, the model may be loose in the section.
    riderGroup.parent?.remove(riderGroup)
    disposeGroup(riderGroup)
    riderGroup = null
  }
  /** The posts with a rider on them, the reference wheel (null), or nothing for a tare run. */
  function showRider(state: RiderState | null, scale: number, tare: boolean) {
    clearRider()
    clearDebris()
    strain = 0
    const skater = state?.design.sport === 'skating'
    rearIsDisc = state !== null && state.design.sport !== 'skating' && state.design.wheels.rear === 'disc'
    const g = new THREE.Group()
    // Two posts clamp the axles (or a skater's blades) to the balance under the floor.
    const posts = skater ? SKATER_POSTS : [FRAME.rearAxleX, FRAME.frontAxleX]
    const postH = skater ? SKATER_POST_HEIGHT : FRAME.wheelRadius
    for (const axle of posts) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, postH, 12), postMat)
      post.position.set(axle - RIDER_MID_X, postH / 2, 0)
      g.add(post)
    }
    if (!tare) {
      const figure = state ? buildRider(state) : buildReferenceWheel(REFERENCE_WHEEL.spokes)
      figure.position.x = -RIDER_MID_X
      g.add(figure)
    }
    flowViz.group.position.x = -RIDER_MID_X
    g.add(flowViz.group)
    g.scale.setScalar(scale)
    // The rider's forward is +x; the air comes from −x, so turn it round.
    g.rotation.y = Math.PI
    mount.add(g)
    riderGroup = g
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
    if (!animate) {
      // A model that broke before: the part is simply missing (off the posts, the model lies on the floor).
      if (part === 'posts') {
        obj.rotation.z = Math.PI / 2
        obj.position.set(L * 0.3, floorY + 0.05, 0)
      } else obj.visible = false
      return
    }
    // Keep its place in the world as it leaves its parent.
    scene.attach(obj)
    const kick = part === 'posts' ? 0.6 : 1.2
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

  /** Point the camera at the model, keeping it on the observation-window side. */
  function aim(kind: TunnelModel['kind'], scale = 1) {
    const target =
      kind === 'rider'
        ? new THREE.Vector3(0, floorY + RIDER_CENTRE_Y * scale, 0)
        : kind === 'wheel'
          ? new THREE.Vector3(0, floorY + FRAME.wheelRadius * scale, 0)
          : new THREE.Vector3(0, 0, 0)
    const offset = CAMERA_OFFSET[kind].clone().multiplyScalar(kind === 'sphere' ? 1 : scale * 2)
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
      rotor.rotation.x = fanAngle

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
    },
    setInstruments(next) {
      instruments = { ...next }
      flowViz.setInstruments(next)
      wand.visible = next.wand && modelKind === 'rider'
      const dark = next.dark
      ;(scene.background as THREE.Color).setHex(dark ? COLOURS.darkBackground : COLOURS.background)
      wallMat.color.setHex(dark ? COLOURS.darkWall : COLOURS.wall)
      floorMat.color.setHex(dark ? COLOURS.darkFloor : COLOURS.floor)
    },
    setModel(model) {
      const changed = model.kind !== modelKind
      modelKind = model.kind
      const tare = model.tare === true
      sphereRig.visible = model.kind === 'sphere'
      // With the sphere off there is nothing to bend the smoke round.
      for (const part of [sphere, smoke, smokeShadow, wakeSmoke, wakeShadow]) part.visible = !tare
      if (sepRing) sepRing.visible = !tare
      if (model.kind === 'rider') showRider(model.state, model.scale, tare)
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
            ? 'The wind tunnel test section with your rider model on the yaw turntable'
            : model.kind === 'wheel'
              ? 'The wind tunnel test section with the reference wheel held still on the posts'
              : 'The wind tunnel test section with a sphere on a sting',
      )
      if (changed) aim(model.kind, model.kind === 'sphere' ? 1 : model.scale)
    },
    setYaw(deg) {
      yawTable.rotation.y = (-deg * Math.PI) / 180
    },
    setSeparation(deg) {
      if (Number.isFinite(deg)) sepDeg = Math.min(170, Math.max(60, deg))
    },
    setSheetHeight(px) {
      sheetPx = px
      resize()
    },
    dispose() {
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
