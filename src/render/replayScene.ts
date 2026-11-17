/**
 * The race-day replay's 3D view: the course as a road across open country,
 * your design on it with the client's old setup as a see-through twin in
 * the next lane, wind flags along the verge, and a chase camera. Every
 * position comes from src/sim/replay.ts; this file only draws them. A
 * rider the field model says eased off in the gusts rocks now and then;
 * one it says sat up is drawn sitting up. The velodrome is a Blender model
 * (PR 13k, art/velodrome/build.py), loaded the first time a 250 m track
 * race is shown, and so is the Stavren Ice Oval for a 400 m ice race (PR 13x,
 * art/iceoval/build.py); until then, or if it can't load, the boards or the
 * ice are drawn here.
 * A circuit's trackside (PR 13m, art/circuit/build.py) is a kit of Blender
 * pieces stood along whichever lap is raced, copied by instancing; so are the
 * salt flat's camp and course furniture (PR 13n, art/saltflat/build.py) and
 * Belyanka airfield's buildings (PR 13o, art/airfield/build.py).
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OVAL, TRACK } from '../data/briefs'
import { FIELD_TROUBLE, type CourseSegment } from '../data/field'
import { AIRCRAFT_REPLAY, AIRFIELD_KIT, AIRFIELD_SCENE, CAR_REPLAY, CIRCUIT_KIT, LAKE_KIT, MEADOW_KIT, ROAD_KIT, SALT_KIT, SURVEY_KIT, DRONE_REPLAY, DRONE_SCENE, RECORD_SCENE, REPLAY_SCENE as S, SURVEY_SCENE } from '../data/replay'
import { AIRCRAFT_BODY } from '../data/aircraft'
import { SURVEY_PATTERN } from '../data/plane'
import { DRONE_BODY } from '../data/drone'
import { designPose, type Design } from '../sim/design'
import { recordAxis, recordLength } from '../sim/geom/record'
import type { PlanePose } from '../sim/planeReplay'
import { turnAngle, type TrackPoint } from '../sim/replay'
import { buildRider, disposeGroup } from './riderFigure'
import { onThemeChange, sceneColours } from './theme'

const COLOURS = {
  ground: 0xc9d3b8,
  grid: 0xaab59c,
  road: 0x6b737a,
  dash: 0xf5f7f9,
  pole: 0x5a6875,
  flag: 0xe08a00,
  cone: 0xd2462b,
  ghost: 0xffffff,
  boards: 0xc89f6a,
  /** Skated ice, indoors or on the lake. */
  ice: 0xe2edf4,
  /** Snow round the lake, a shade darker than the ice so the loop reads. */
  snow: 0xc3d0da,
  infield: 0xa9b8c6,
  line: 0xffffff,
  markOld: 0x5a6875,
  /** The salt flat (PR 9v): the pan, its cracks, the graded course and its black line, and the chutes. */
  salt: 0xece8de,
  /** The drone club's mown line through the meadow, and its gates (PR 10h). */
  mown: 0xb3bf9e,
  gate: 0xe08a00,
  /** The survey fields (PR 10o): ripe wheat, and its rows. */
  wheat: 0xd9c98c,
  rows: 0x9c8546,
  saltGrid: 0xd6cfbf,
  saltCourse: 0xe2dccd,
  saltLine: 0x1d242b,
  chute: 0xe08a00,
}

const DEG = Math.PI / 180

/** Unit vectors for a compass heading: forward along the road, and right of it. */
/** A fixed hash of a whole number to [0, 1): the roadside's trees vary by place, the same on every phone. */
export function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function axes(heading: number) {
  const h = heading * DEG
  return { fx: Math.sin(h), fz: -Math.cos(h), rx: Math.cos(h), rz: Math.sin(h) }
}

export interface CourseOptions {
  /** Where the wind blows from, degrees, and whether there's any (indoors there isn't). */
  windFromDeg: number
  calm: boolean
  /** On the indoor track: the lap length, m. Only one lap is drawn, and the camera watches from the stands. */
  lap?: number
  /** Raced on ice: the boards or the road are drawn as ice. */
  ice?: boolean
  /** A quad race (PR 10h): a gate over the line at each of these distances, m, and no cones or centre line. */
  gates?: readonly number[]
}

/** A quad as the race clock has it (PR 10h): its lean, radians nose-down, and how far through a tumble's fall it is, 0 (flying) to 1 (on the grass). */
export interface QuadState {
  lean: number
  fall: number
}

export interface ReplayOptions {
  /** Reduced motion: nobody rocks in the gusts (they still sit up). */
  still?: boolean
  /** A truck's fuel run (PR 9h): the wider road, lanes and camera of REPLAY_SCENE.truck. */
  truck?: boolean
  /** A race lap (PR 9o): the circuit's road, lanes and camera of REPLAY_SCENE.car, and no cones but the line. */
  car?: boolean
  /** A record run (PR 9v): the salt flat, the lanes and camera of RECORD_SCENE, and each car's chute. */
  record?: boolean
  /** A quad race (PR 10h): the meadow's mown line, gates and close camera of DRONE_SCENE, the quads flying at gate height. */
  drone?: boolean
  /** A survey flight (PR 10o): the wheat of SURVEY_SCENE with no road, the planes flying their lines over it and a chase camera at their height. */
  survey?: boolean
  /** Test day for a light aircraft (PR 10v): Belyanka's grass and runway with its timing masts, and a camera flying alongside your plane. */
  airfield?: boolean
}

/** A rider as drawn: tucked as designed, and (built the first time it's needed) sitting up. */
interface Figure {
  design: Design
  ghost: boolean
  tucked: THREE.Group
  sitting: THREE.Group | null
  /** A record car's chute, behind its tail, shown once it's out. */
  chute: THREE.Group | null
  /** A record car's shock lines on the salt from its nose, shown past Mach 1 (PR 9z+). */
  shock: THREE.Group | null
}

/** The same rider sitting up (a skater standing taller): back up to the trouble table's angle, head up. */
function sitUp(design: Design): Design {
  if (design.sport === 'skijump' || design.sport === 'bobsled' || design.sport === 'truck' || design.sport === 'car' || design.sport === 'record' || design.sport === 'drone' || design.sport === 'plane' || design.sport === 'aircraft' || design.sport === 'pod') return design
  if (design.sport === 'skating') {
    const p = design.posture
    return { ...design, posture: { trunkDeg: Math.max(p.trunkDeg, S.trouble.sitUpTorso), kneeDeg: Math.max(p.kneeDeg, S.trouble.standKnee), headDrop: 0 } }
  }
  const p = design.posture
  return { ...design, posture: { ...p, torsoDeg: Math.max(p.torsoDeg, S.trouble.sitUpTorso), headDrop: 0 } }
}

export interface ReplayView {
  /** Lay out the course and the wind (blowing from `windFromDeg`). */
  setCourse(course: readonly CourseSegment[], opts: CourseOptions): void
  setRiders(mine: Design, old: Design): void
  /** A record car's Mach number now, yours and the old car's (PR 9z+): past 1, its shock trails across the salt from its nose. */
  setMach(mine: number, old: number): void
  /** Each quad's lean and fall now (PR 10h), for the next `place`. */
  setQuads(mine: QuadState, old: QuadState): void
  /** Each plane's height, bank, pitch and spin now (PR 10o), for the next `place`. */
  setPlanes(mine: PlanePose, old: PlanePose): void
  /** Show or hide each plane (PR 10v: their plane sits out the stall check). */
  setShown(mine: boolean, old: boolean): void
  /** Put both riders where the race clock says, and move the camera (dt in seconds). */
  place(mine: TrackPoint, old: TrackPoint, dt: number): void
  /** The readout panel covers this many pixels at the bottom: the picture centres above it. */
  setInset(px: number): void
  render(): void
  dispose(): void
}

export function createReplayView(host: HTMLElement, opts: ReplayOptions = {}): ReplayView {
  // The road's layout and the chase camera: a rider's, or a truck's.
  // setCourse's own options shadow these, so keep the circuit flag by name.
  const circuit = opts.car === true
  const salt = opts.record === true
  const meadow = opts.drone === true
  const fields = opts.survey === true
  const airfield = opts.airfield === true
  const lay = salt
    ? RECORD_SCENE
    : airfield
      ? { roadWidth: 0, laneMine: AIRFIELD_SCENE.laneMine, laneOld: AIRFIELD_SCENE.laneOld, flagEvery: 1e9, flagSide: 0, camera: { back: 0, up: 0, side: 0, ahead: 0, lookUp: 0, fov: AIRFIELD_SCENE.camera.fov } }
    : fields
      ? { roadWidth: 0, laneMine: SURVEY_SCENE.laneMine, laneOld: SURVEY_SCENE.laneOld, flagEvery: 1e9, flagSide: 0, camera: { ...SURVEY_SCENE.camera, lookUp: 0 } }
    : meadow
      ? DRONE_SCENE
      : circuit
      ? S.car
      : opts.truck
        ? S.truck
        : { roadWidth: S.roadWidth, laneMine: S.laneMine, laneOld: S.laneOld, flagEvery: S.flagEvery, flagSide: S.flagSide, camera: S.camera }
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.className = 'replay-canvas'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.prepend(renderer.domElement)

  const scene = new THREE.Scene()
  // The sky follows the phone's theme (Isobar, PR 13h); the ground and course keep their daylight colours.
  const sky = new THREE.Color(sceneColours().fieldSky)
  scene.background = sky
  const fog = new THREE.Fog(sky.getHex(), S.fogNear, S.fogFar)
  scene.fog = fog
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9480, 2.2))
  const sun = new THREE.DirectionalLight(0xffffff, 1.6)
  sun.position.set(30, 60, 20)
  scene.add(sun)

  const camera = new THREE.PerspectiveCamera(lay.camera.fov, 1, 0.1, S.fogFar + 200)
  // Everything flat on the ground (grass, grid, road, dashes) is drawn first, in that order,
  // without writing depth: a phone's depth buffer can't tell layers a few millimetres apart.
  const flat = (o: THREE.Mesh | THREE.LineSegments, order: number) => {
    o.renderOrder = order
    const m = o.material as THREE.Material
    m.depthWrite = false
    return o
  }
  // Over the wheat (PR 10o) the camera is high: the ground and its rows reach to the fog.
  const groundSize = fields || airfield ? S.fogFar * 2 : S.gridSize
  const ground = flat(new THREE.Mesh(new THREE.PlaneGeometry(groundSize * 2, groundSize * 2), new THREE.MeshLambertMaterial({ color: salt ? COLOURS.salt : fields ? COLOURS.wheat : COLOURS.ground })), -4)
  ground.rotation.x = -Math.PI / 2
  const gridColour = salt ? COLOURS.saltGrid : fields ? COLOURS.rows : COLOURS.grid
  const gridCell = fields ? SURVEY_SCENE.rows : S.gridCell
  const grid = flat(new THREE.GridHelper(groundSize, Math.round(groundSize / gridCell), gridColour, gridColour), -3)
  scene.add(ground, grid)

  const course = new THREE.Group()
  scene.add(course)
  const roadMat = new THREE.MeshLambertMaterial({ color: salt ? COLOURS.saltCourse : COLOURS.road, depthWrite: false })
  const dashMat = new THREE.MeshLambertMaterial({ color: salt ? COLOURS.saltLine : COLOURS.dash, depthWrite: false })
  // One centre-line dash, lying flat and pointing along the road (local −z). On the salt the black line is nearly unbroken and wider.
  const dashGeo = new THREE.PlaneGeometry(salt ? 0.3 : 0.15, salt ? S.dashEvery * 0.9 : S.dashEvery / 2)
  dashGeo.rotateX(-Math.PI / 2)
  const poleMat = new THREE.MeshLambertMaterial({ color: COLOURS.pole })
  const flagMat = new THREE.MeshLambertMaterial({ color: COLOURS.flag, side: THREE.DoubleSide })
  const coneMat = new THREE.MeshLambertMaterial({ color: COLOURS.cone })
  const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, S.flagHeight, 6)
  // A flag is a long thin cone lying flat, its point downwind.
  const flagGeo = new THREE.ConeGeometry(0.35, 1.4, 8)
  flagGeo.rotateZ(-Math.PI / 2)
  flagGeo.translate(0.7, 0, 0)
  const coneGeo = new THREE.ConeGeometry(0.4, 0.9, 12)

  const boardsMat = new THREE.MeshLambertMaterial({ color: COLOURS.boards, depthWrite: false })
  const lineMat = new THREE.MeshLambertMaterial({ color: COLOURS.line, depthWrite: false })
  // On the track, a coloured ring under each rider keeps them easy to find in the wide shot.
  const ringGeo = new THREE.RingGeometry(S.track.marker * 0.75, S.track.marker, 24)
  ringGeo.rotateX(-Math.PI / 2)
  const ringMine = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: sceneColours().mine, depthWrite: false }))
  // The phone switched between light and dark: a new sky and your ring's blue, nothing else.
  const stopTheme = onThemeChange((next) => {
    sky.setHex(next.fieldSky)
    fog.color.setHex(next.fieldSky)
    ;(ringMine.material as THREE.MeshBasicMaterial).color.setHex(next.mine)
  })
  const ringOld = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COLOURS.markOld, depthWrite: false }))
  // Drawn after the riders and the hall's boards or ice (PR 13k, 13x), a few centimetres up, so the boards never hide them.
  ringMine.renderOrder = ringOld.renderOrder = 1
  ringMine.position.y = ringOld.position.y = 0.05
  ringMine.visible = ringOld.visible = false
  scene.add(ringMine, ringOld)
  /** The fixed broadcast camera on the track, or null for the chase camera. */
  let broadcast: { at: THREE.Vector3; look: THREE.Vector3 } | null = null
  // On the salt the twin is slate: white would vanish on it.
  const ghostMat = new THREE.MeshStandardMaterial({
    color: salt ? COLOURS.markOld : COLOURS.ghost,
    transparent: true,
    opacity: salt ? RECORD_SCENE.ghostOpacity : meadow ? DRONE_SCENE.ghostOpacity : fields ? SURVEY_SCENE.ghostOpacity : airfield ? AIRFIELD_SCENE.ghostOpacity : S.ghostOpacity,
    depthWrite: false,
    roughness: 0.8,
  })
  let mine: Figure | null = null
  let old: Figure | null = null
  /** Seconds of replay so far, for the gusts' rhythm. */
  let clock = 0
  /** The quads' lean and fall, set before each `place` (PR 10h). */
  let quadMine: QuadState = { lean: 0, fall: 0 }
  let quadOld: QuadState = { lean: 0, fall: 0 }
  /** The planes' height, bank, pitch and spin, set before each `place` (PR 10o). */
  const level: PlanePose = { height: SURVEY_SCENE.flyHeight, bank: 0, pitch: 0, spin: 0 }
  let planeMine: PlanePose = level
  let planeOld: PlanePose = level

  function build(design: Design, ghost: boolean): THREE.Group {
    const g = buildRider({ design, pose: designPose(design), broken: [], strained: [], noStand: true })
    // Heading first, then the roll about the rider's own forward line.
    g.rotation.order = 'YXZ'
    // A plane (PR 10o) banks and pitches about its own fuselage, not its stage stand's foot: bring its axis down to the group's origin.
    if (design.sport === 'plane') for (const child of g.children) child.position.y = 0
    // So does a kit plane (PR 10v), built standing on its wheels with its axis above them.
    if (design.sport === 'aircraft') for (const child of g.children) child.position.y -= AIRCRAFT_BODY.axis
    if (ghost)
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) o.material = ghostMat
      })
    scene.add(g)
    return g
  }

  const chuteMat = new THREE.MeshLambertMaterial({ color: COLOURS.chute, side: THREE.DoubleSide })
  const chuteLineMat = new THREE.LineBasicMaterial({ color: COLOURS.pole })
  const chuteGeo = new THREE.SphereGeometry(RECORD_SCENE.chute.radius, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2)
  // The dome's open side faces forward, toward the car (the car is built facing +x).
  chuteGeo.rotateZ(Math.PI / 2)

  /** A record car's chute on its lines, behind the tail. */
  function buildChute(design: Design, ghost: boolean): THREE.Group {
    const g = new THREE.Group()
    if (design.sport !== 'record') return g
    const tail = -recordLength(design) / 2
    const axis = recordAxis(design)
    const c = RECORD_SCENE.chute
    const dome = new THREE.Mesh(chuteGeo, ghost ? ghostMat : chuteMat)
    dome.position.set(tail - c.line, axis, 0)
    // Four lines from the tail to the canopy's rim.
    const pts: number[] = []
    for (const [y, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) pts.push(tail, axis, 0, tail - c.line, axis + y * c.radius, z * c.radius)
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    g.add(dome, new THREE.LineSegments(lineGeo, chuteLineMat))
    g.visible = false
    return g
  }

  // A shock line: a thin strip flat on the salt, from the origin back along −x for 1 m. Scaled per frame.
  const shockGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(-0.5, 0, 0)
  const shockMat = new THREE.MeshBasicMaterial({ color: COLOURS.pole, transparent: true, opacity: RECORD_SCENE.shock.opacity, depthWrite: false, side: THREE.DoubleSide })

  /** A record car's shock: two lines on the salt from under its nose; hidden until it passes Mach 1. */
  function buildShock(design: Design): THREE.Group | null {
    if (design.sport !== 'record') return null
    const g = new THREE.Group()
    const c = RECORD_SCENE.shock
    for (let k = 0; k < 2; k++) {
      const line = new THREE.Mesh(shockGeo, shockMat)
      line.scale.set(c.length, 1, c.width)
      g.add(line)
    }
    g.position.set(recordLength(design) / 2, 0.03, 0)
    g.visible = false
    return g
  }

  function figure(design: Design, ghost: boolean): Figure {
    const tucked = build(design, ghost)
    const chute = design.sport === 'record' ? buildChute(design, ghost) : null
    if (chute) tucked.add(chute)
    const shock = buildShock(design)
    if (shock) tucked.add(shock)
    return { design, ghost, tucked, sitting: null, chute, shock }
  }

  /** Show a figure's shock for this Mach number: the V narrows the faster it goes. */
  function showMach(f: Figure | null, mach: number) {
    if (!f?.shock) return
    f.shock.visible = mach > 1
    if (mach <= 1) return
    const angle = Math.min(RECORD_SCENE.shock.maxDeg * DEG, Math.asin(1 / mach))
    f.shock.children[0]!.rotation.y = angle
    f.shock.children[1]!.rotation.y = -angle
  }

  function dropFigure(f: Figure | null) {
    if (!f) return
    // The chute's dome shares one geometry and its materials: keep them for the next car.
    // So do the shock lines.
    if (f.shock) f.tucked.remove(f.shock)
    if (f.chute) {
      f.tucked.remove(f.chute)
      for (const o of f.chute.children) if (o instanceof THREE.LineSegments) o.geometry.dispose()
    }
    for (const g of [f.tucked, f.sitting]) {
      if (!g) continue
      scene.remove(g)
      disposeGroup(g)
    }
  }

  /** Roll, degrees, for a rider who gave up `eased` of their power in the gusts: a rock now and then. */
  function rollFor(eased: number, phase: number): number {
    if (opts.still || eased <= 0) return 0
    const T = S.trouble
    const u = (clock + phase) % T.every
    if (u >= T.lasts) return 0
    const k = T.rollFloor + (1 - T.rollFloor) * Math.min(1, eased / FIELD_TROUBLE.ease.max)
    // Two rocks per gust, swelling and dying away.
    return T.rollDeg * k * Math.sin((4 * Math.PI * u) / T.lasts) * Math.sin((Math.PI * u) / T.lasts)
  }

  /** Show the figure the race clock calls for and put it in its lane. */
  function pose(f: Figure, at: TrackPoint, lane: number, phase: number): THREE.Group {
    // A record car (PR 9v): the chute once it's out, the nose lifting before a light-nose abort, a swing before a wander.
    if (f.design.sport === 'record') {
      const g = f.tucked
      const R = RECORD_SCENE
      const swing = at.faded === 2 && !opts.still ? Math.sin(2 * Math.PI * R.wander.perSecond * (clock + phase)) : 0
      stand(g, at, lane + R.wander.side * swing)
      g.rotation.y += R.wander.deg * swing * DEG
      g.rotation.x = 0
      g.rotation.z = at.faded === 1 ? R.liftDeg * DEG : 0
      if (f.chute) f.chute.visible = at.eased > 0
      return g
    }
    // A quad (PR 10h) flies at gate height, leaning as the race says; one that tumbled spins down onto the grass.
    if (f.design.sport === 'drone') {
      const g = f.tucked
      const q = f.ghost ? quadOld : quadMine
      stand(g, at, lane)
      const flying = DRONE_SCENE.flyHeight - DRONE_BODY.hover
      // Upside down on the grass, the plate sits about its own height up.
      g.position.y = flying * (1 - q.fall * q.fall) + 2 * DRONE_BODY.hover * q.fall
      g.rotation.x = 0
      g.rotation.z = -q.lean + Math.PI * DRONE_REPLAY.tumble.halfTurns * q.fall
      return g
    }
    // A survey plane (PR 10o) flies its lines at its height, banked into the turns; one that stalled spins down into the wheat.
    if (f.design.sport === 'plane' || f.design.sport === 'aircraft') {
      const g = f.tucked
      const p = f.ghost ? planeOld : planeMine
      stand(g, at, lane)
      // A kit plane's height is its wheels' (PR 10v): parked, it stands on them.
      g.position.y = f.design.sport === 'aircraft' ? p.height + AIRCRAFT_BODY.axis : Math.max(p.height, 0.15)
      g.rotation.y += p.spin
      // Built nose along +x: the bank rolls it about x (right wing down), the pitch about z.
      g.rotation.x = p.bank
      g.rotation.z = p.pitch
      return g
    }
    if (at.faded > 0) f.sitting ??= build(sitUp(f.design), f.ghost)
    const g = at.faded > 0 && f.sitting ? f.sitting : f.tucked
    for (const other of [f.tucked, f.sitting]) if (other) other.visible = other === g
    // A car's `eased` marks porpoising (PR 9o): it bounces on its springs instead of rocking.
    if (f.design.sport === 'car') {
      stand(g, at, lane)
      const b = CAR_REPLAY.bounce
      g.position.y = at.eased > 0 && !opts.still ? b.height * Math.abs(Math.sin(2 * Math.PI * b.perSecond * (clock + phase))) : 0
      g.rotation.x = 0
      return g
    }
    const roll = rollFor(at.eased, phase)
    stand(g, at, lane + (S.trouble.swayM * roll) / S.trouble.rollDeg)
    g.rotation.x = roll * DEG
    return g
  }
  // The camera swings round after a turn at its own pace; along the road it never lags.
  let camHeading = 0
  let camReady = false

  let inset = 0
  function resize() {
    const w = host.clientWidth || 1
    const h = host.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Shift the view up by half the panel, so the rider sits in the open part of the screen.
    camera.setViewOffset(w, h, 0, Math.min(inset, h / 2) / 2, w, h)
    camera.updateProjectionMatrix()
  }
  const watcher = new ResizeObserver(resize)
  watcher.observe(host)
  resize()

  // An indoor hall: the velodrome (PR 13k) for a 250 m track race, the Stavren Ice Oval (PR 13x) for a 400 m ice race.
  // Loaded with the first race that needs it, then kept for the screen's life (a screen shows one race).
  let disposed = false
  let hall: THREE.Object3D | 'loading' | null = null
  let wantHall = false
  /** The code-drawn boards or ice and finish line, hidden while the hall's model stands in for them. */
  const trackPieces: THREE.Object3D[] = []
  function showHall() {
    const ready = hall instanceof THREE.Object3D
    if (hall instanceof THREE.Object3D) hall.visible = wantHall
    for (const p of trackPieces) p.visible = !(ready && wantHall)
  }
  function loadHall(file: string) {
    if (hall !== null) return
    hall = 'loading'
    new GLTFLoader().load(
      `${import.meta.env.BASE_URL}models/${file}`,
      (gltf) => {
        if (disposed) {
          dropModel(gltf.scene)
          return
        }
        hall = gltf.scene
        scene.add(gltf.scene)
        showHall()
      },
      undefined,
      // Offline with an old cache, or missing: the code-drawn boards stay, and the race plays the same.
      () => {
        hall = null
      },
    )
  }
  function dropModel(root: THREE.Object3D) {
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      o.geometry.dispose()
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) (m as THREE.Material).dispose()
    })
  }

  // A venue's kit of Blender pieces (PR 13m: the circuit's; 13n: the salt flat's; 13o: the airfield's; 13v: the drone meadow's; 13w: the survey fields'), loaded with the view and stood along the course once both are in.
  // The open road's (PR 13t) is asked for by setCourse, since a track's lap has none.
  // Until it loads, or if it can't, the course is drawn as before.
  const kitFile = circuit ? 'circuit.glb' : salt ? 'saltflat.glb' : airfield ? 'airfield.glb' : meadow ? 'meadow.glb' : fields ? 'fields.glb' : null
  /** Time trials and truck runs: an open road, unless the course is a track's lap. */
  const roadside = !circuit && !salt && !meadow && !fields && !airfield
  let road = false
  /** An ice marathon's loop on the frozen lake (PR 13y), not a road. */
  let lake = false
  let kit: THREE.Object3D | null = null
  let kitAsked = false
  const kitGroup = new THREE.Group()
  scene.add(kitGroup)
  let kitCourse: readonly CourseSegment[] | null = null
  function loadKit(file: string) {
    if (kitAsked) return
    kitAsked = true
    new GLTFLoader().load(
      `${import.meta.env.BASE_URL}models/${file}`,
      (gltf) => {
        if (disposed) return dropModel(gltf.scene)
        kit = gltf.scene
        kit.updateMatrixWorld(true)
        placeKit()
      },
      undefined,
      () => undefined,
    )
  }
  if (kitFile) loadKit(kitFile)

  /** Copies of one of the kit's pieces at each of these placements, one draw per material. */
  function scatter(name: string, at: readonly THREE.Matrix4[]) {
    const node = kit?.getObjectByName(name)
    if (!node || at.length === 0) return
    const inv = node.matrixWorld.clone().invert()
    node.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      const local = inv.clone().multiply(o.matrixWorld)
      const copies = new THREE.InstancedMesh(o.geometry, o.material, at.length)
      at.forEach((m, i) => copies.setMatrixAt(i, m.clone().multiply(local)))
      copies.computeBoundingSphere()
      kitGroup.add(copies)
    })
  }

  /** A placement `along` metres round the course, `out` metres right of its centre line (left if negative), facing the way it runs (or turned round). */
  function placeAt(segs: readonly CourseSegment[], along: number, out: number, turned = false): THREE.Matrix4 {
    let x = 0
    let z = 0
    let d = along
    let heading = segs[0]?.heading ?? 90
    for (const seg of segs) {
      heading = seg.heading
      const { fx, fz } = axes(seg.heading)
      if (d <= seg.length) {
        x += fx * d
        z += fz * d
        break
      }
      x += fx * seg.length
      z += fz * seg.length
      d -= seg.length
    }
    const { rx, rz } = axes(heading)
    // The pieces are built facing +x, like the riders: turn them to the heading.
    const turn = (90 - heading) * DEG + (turned ? Math.PI : 0)
    return new THREE.Matrix4().compose(new THREE.Vector3(x + rx * out, 0, z + rz * out), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn), new THREE.Vector3(1, 1, 1))
  }

  /** The circuit's trackside along this lap: the start, the pits and stand, a footbridge, barriers, kerbs through the corners and marshals' posts. */
  function placeCircuit(segs: readonly CourseSegment[]) {
    const K = CIRCUIT_KIT
    const total = segs.reduce((sum, seg) => sum + seg.length, 0)
    scatter('GridLine', [placeAt(segs, 0, 0)])
    scatter('StartGantry', [placeAt(segs, 0, 0)])
    scatter('PitBuilding', [placeAt(segs, K.pits.from, -K.pits.out)])
    scatter('Grandstand', [placeAt(segs, K.stand.from, K.stand.out)])
    scatter('Footbridge', [placeAt(segs, K.bridgeAt, 0)])
    const inPits = (d: number) => d > K.pits.from - K.barrier.every && d < K.pits.from + K.pits.length
    const barriers: THREE.Matrix4[] = []
    for (let d = 0; d < total; d += K.barrier.every) {
      barriers.push(placeAt(segs, d, K.barrier.out))
      if (!inPits(d)) barriers.push(placeAt(segs, d, -K.barrier.out))
    }
    scatter('Barrier', barriers)
    const marshals: THREE.Matrix4[] = []
    for (let d = K.marshal.every; d < total - 100; d += K.marshal.every) if (!inPits(d)) marshals.push(placeAt(segs, d, -K.marshal.out))
    scatter('MarshalPost', marshals)
    // Kerbs on the inside of each corner: a piece turning from the one before and into the one after.
    const kerbs: THREE.Matrix4[] = []
    let along = 0
    segs.forEach((seg, i) => {
      const prev = segs[(i - 1 + segs.length) % segs.length]!
      const next = segs[(i + 1) % segs.length]!
      if (turnAngle(prev.heading, seg.heading) > 1e-6 && turnAngle(seg.heading, next.heading) > 1e-6) {
        // Turning right (the heading grows) puts the inside on the right.
        const right = ((next.heading - prev.heading + 540) % 360) - 180 > 0
        for (let d = 0; d < seg.length; d += K.kerb.every) kerbs.push(placeAt(segs, along + d, right ? K.kerb.out : -K.kerb.out))
      }
      along += seg.length
    })
    scatter('Kerb', kerbs)
  }

  /**
   * The salt flat along this run: the camp at the start, the timing hut and
   * lights at the timed kilometre, boards every kilometre, the course's edge
   * posts, the watchers and the recovery truck. The pieces are built facing
   * the course from its left; those on the right are turned round.
   */
  function placeSalt(segs: readonly CourseSegment[]) {
    const K = SALT_KIT
    const total = segs.reduce((sum, seg) => sum + seg.length, 0)
    const timedFrom = segs[0]?.length ?? 0
    const timedTo = timedFrom + (segs[1]?.length ?? 0)
    const side = (along: number, out: number) => placeAt(segs, along, out, out > 0)
    scatter('TeamCamp', [side(K.camp.along, K.camp.out)])
    scatter('TimingHut', [side(timedFrom - K.hut.before, K.hut.out)])
    scatter('TimingPost', [timedFrom, timedTo].flatMap((d) => [side(d, K.posts.out), side(d, -K.posts.out)]))
    const boards: THREE.Matrix4[] = []
    for (let d = K.boards.every; d < total; d += K.boards.every) boards.push(placeAt(segs, d, K.boards.out))
    scatter('KmBoard', boards)
    const markers: THREE.Matrix4[] = []
    for (let d = K.markers.every; d < total; d += K.markers.every) markers.push(placeAt(segs, d, K.markers.out), placeAt(segs, d, -K.markers.out))
    scatter('Marker', markers)
    scatter('ViewingArea', [side((timedFrom + timedTo) / 2, K.viewing.out)])
    scatter('RecoveryTruck', [side(Math.min(total - 50, timedTo + K.recovery.afterTimed), K.recovery.out)])
  }

  /**
   * The open road along this course (PR 13t): trees on both verges, farms,
   * villages and wind turbines set back, kilometre posts and signs, and at
   * the ends a time trial's start house, finish arch and crowd, or a fuel
   * run's truck stop and depot. Nothing lands on the road where the course
   * doubles back, or within ROAD_KIT.clear of a building. The trees vary by
   * a fixed hash of their place, so a course looks the same every time.
   */
  /**
   * Helpers for standing a kit round a course (PR 13t, shared with 13v): its
   * length, the line's half-width, how far a spot is from any leg (so nothing
   * stands on the line where the course passes again), and a list of claimed
   * spots to keep pieces apart.
   */
  function courseTools(segs: readonly CourseSegment[]) {
    const total = segs.reduce((sum, seg) => sum + seg.length, 0)
    const edge = lay.roadWidth / 2
    // Every leg's ends on the ground.
    const legs: [number, number, number, number][] = []
    let lx = 0
    let lz = 0
    for (const seg of segs) {
      const { fx, fz } = axes(seg.heading)
      legs.push([lx, lz, lx + fx * seg.length, lz + fz * seg.length])
      lx += fx * seg.length
      lz += fz * seg.length
    }
    const at = new THREE.Vector3()
    const fromRoad = (m: THREE.Matrix4) => {
      at.setFromMatrixPosition(m)
      let best = Infinity
      for (const [x0, z0, x1, z1] of legs) {
        const dx = x1 - x0
        const dz = z1 - z0
        const t = Math.max(0, Math.min(1, ((at.x - x0) * dx + (at.z - z0) * dz) / (dx * dx + dz * dz || 1)))
        best = Math.min(best, Math.hypot(at.x - x0 - t * dx, at.z - z0 - t * dz))
      }
      return best
    }
    const taken: THREE.Vector3[] = []
    const clear = (m: THREE.Matrix4, r: number) => {
      at.setFromMatrixPosition(m)
      return taken.every((q) => q.distanceTo(at) > r)
    }
    const claim = (m: THREE.Matrix4) => taken.push(new THREE.Vector3().setFromMatrixPosition(m))
    /** A piece facing the line from its left (out < 0), or turned round to face it from the right; out is beyond the edge. */
    const side = (along: number, out: number) => placeAt(segs, along, Math.sign(out) * (edge + Math.abs(out)), out > 0)
    return { total, edge, legs, fromRoad, clear, claim, side }
  }

  function placeRoad(segs: readonly CourseSegment[]) {
    const K = ROAD_KIT
    const { total, edge, fromRoad, clear, claim, side } = courseTools(segs)
    if (opts.truck) {
      const depot = side(K.depot.along, -K.depot.out)
      const shed = side(Math.max(0, total - K.warehouse.before), -K.warehouse.out)
      scatter('FuelDepot', [depot])
      scatter('Warehouse', [shed])
      claim(depot)
      claim(shed)
    } else {
      const start = placeAt(segs, 0, 0)
      // The arch is built for a time trial's road; a wider one stretches it.
      const finish = placeAt(segs, total, 0).multiply(new THREE.Matrix4().makeScale(1, 1, lay.roadWidth / S.roadWidth))
      scatter('FinishArch', [finish])
      claim(finish)
      // An out-and-back course finishes where it started: the ramp would stand in the riders' way home.
      if (clear(start, K.clear)) {
        scatter('StartRamp', [start])
        claim(start)
      }
      // The crowd's pieces run 40 m along from their origin: on the right, turned round, they start 40 m further on.
      const crowd: THREE.Matrix4[] = []
      for (let d = Math.max(0, total - K.crowd.length); d + 40 <= total; d += 40) crowd.push(side(d, -K.crowd.out), side(d + 40, K.crowd.out))
      scatter('FinishCrowd', crowd)
    }
    const buildings = (every: number, most: number, out: number, flip: number, into: THREE.Matrix4[]) => {
      const step = Math.max(every, total / most)
      for (let k = 0; (k + 0.5) * step < total; k++) {
        const o = (k + flip) % 2 === 0 ? -out : out
        const m = side((k + 0.5) * step, o)
        // Closer to another leg than to its own: the course doubles back here.
        if (fromRoad(m) < edge + out - 1) continue
        if (!clear(m, K.clear * 1.5)) continue
        into.push(m)
        claim(m)
      }
    }
    const farms: THREE.Matrix4[] = []
    const villages: THREE.Matrix4[] = []
    buildings(K.farms.every, K.farms.most, K.farms.out, 0, farms)
    buildings(K.villages.every, K.villages.most, K.villages.out, 1, villages)
    scatter('Farm', farms)
    scatter('Village', villages)
    const turbines: THREE.Matrix4[] = []
    const tStep = Math.max(K.turbines.every, total / K.turbines.most)
    for (let k = 0; (k + 0.5) * tStep < total; k++) {
      const m = side((k + 0.5) * tStep, -(K.turbines.out + hash01(k * 7 + 3) * K.turbines.spread))
      if (fromRoad(m) > K.turbines.out * 0.8 && clear(m, K.clear)) turbines.push(m)
    }
    scatter('WindTurbine', turbines)
    const posts: THREE.Matrix4[] = []
    for (let d = K.posts.every; d < total; d += K.posts.every) posts.push(placeAt(segs, d, edge + K.posts.out))
    scatter('KmPost', posts)
    const signs: THREE.Matrix4[] = []
    for (let d = K.signs.every / 2; d < total; d += K.signs.every) {
      const m = placeAt(segs, d, edge + K.signs.out)
      if (clear(m, K.clear)) signs.push(m)
    }
    scatter('Sign', signs)
    // Trees: three kinds, each set back, turned and sized by a hash of its place.
    const kinds: THREE.Matrix4[][] = [[], [], []]
    const step = Math.max(K.trees.every, total / K.trees.most)
    const spin = new THREE.Matrix4()
    const size = new THREE.Matrix4()
    for (const s of [-1, 1])
      for (let k = 0; k * step < total; k++) {
        const n = k * 2 + (s > 0 ? 1 : 0)
        const along = (k + 0.2 + hash01(n * 3) * 0.6) * step
        if (along >= total) break
        const out = K.trees.out + hash01(n * 3 + 1) * K.trees.spread
        const m = placeAt(segs, along, s * (edge + out))
        if (fromRoad(m) < edge + 2 || !clear(m, K.clear)) continue
        const r = hash01(n * 3 + 2)
        const sc = 1 - K.treeScale + 2 * K.treeScale * r
        m.multiply(spin.makeRotationY(r * Math.PI * 2)).multiply(size.makeScale(sc, sc, sc))
        kinds[Math.floor(hash01(n * 5 + 7) * 3)]!.push(m)
      }
    scatter('TreeRound', kinds[0]!)
    scatter('TreePine', kinds[1]!)
    scatter('TreeBirch', kinds[2]!)
  }

  /** Belyanka round its runway: the field side, the threshold bars at each end, edge lights and the windsock. */
  function placeAirfield() {
    const K = AIRFIELD_KIT
    const W = AIRFIELD_SCENE.runway
    const at = (x: number, z: number, turned = false) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turned ? Math.PI : 0), new THREE.Vector3(1, 1, 1))
    scatter('Buildings', [at(K.buildings.from, -K.buildings.out)])
    scatter('Threshold', [at(W.from, 0), at(W.to, 0, true)])
    const lights: THREE.Matrix4[] = []
    for (let x = W.from; x <= W.to; x += K.lights.every) lights.push(at(x, K.lights.out), at(x, -K.lights.out))
    scatter('RunwayLight', lights)
    scatter('Windsock', [at(K.windsock.at, -K.windsock.out)])
  }

  /**
   * The Lugovoy meadow (PR 13v): the pilots' tent and timing tower at the
   * start, launch pads on the line, spectators and the club hut on the left,
   * hay bales round the outside of every turn, bunting along the long
   * straights and a ring of trees round the field. The line and gates stay
   * in code.
   */
  function placeMeadow(segs: readonly CourseSegment[]) {
    const K = MEADOW_KIT
    const { edge, legs, fromRoad, clear, claim, side } = courseTools(segs)
    scatter('StartPads', [placeAt(segs, 0, 0)])
    const stand = (name: string, m: THREE.Matrix4) => {
      scatter(name, [m])
      claim(m)
    }
    stand('PilotTent', side(K.tent.along, -K.tent.out))
    stand('TimingTower', side(K.tower.along, K.tower.out))
    stand('Spectators', side(K.crowd.along, -K.crowd.out))
    stand('ClubHut', side(K.hut.along, -K.hut.out))
    // Bales on the outside of each turn, and bunting along the long straights' left. A corner's pieces each
    // turn the same way from both neighbours; a straight's don't (a short one between two opposite turns turns both ways).
    const bales: THREE.Matrix4[] = []
    const flags: THREE.Matrix4[] = []
    const turnOf = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180
    let along = 0
    segs.forEach((seg, i) => {
      const into = turnOf(segs[(i + segs.length - 1) % segs.length]!.heading, seg.heading)
      const out = turnOf(seg.heading, segs[(i + 1) % segs.length]!.heading)
      const turn = Math.sign(into) === Math.sign(out) && Math.abs(into) > 0.5 && Math.abs(out) > 0.5 ? into : 0
      if (turn !== 0) {
        // A right turn's outside is on the left (out < 0), and the other way round.
        const sign = turn > 0 ? -1 : 1
        for (let d = along; d < along + seg.length; d += K.bales.every) {
          const m = side(d, sign * K.bales.out)
          if (fromRoad(m) > edge + K.bales.out - 0.5 && clear(m, K.clear)) bales.push(m)
        }
      } else if (seg.length >= K.bunting.min) {
        for (let d = along + K.bunting.margin; d + 12 <= along + seg.length - K.bunting.margin; d += K.bunting.every) {
          const m = side(d, -K.bunting.out)
          if (fromRoad(m) > edge + K.bunting.out - 0.5 && clear(m, K.clear)) flags.push(m)
        }
      }
      along += seg.length
    })
    scatter('HayBale', bales)
    scatter('Bunting', flags)
    // The trees: a ring round the course's middle, beyond its far corners, each turned, sized and chosen by a hash of its place.
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const [x0, z0, x1, z1] of legs) {
      minX = Math.min(minX, x0, x1)
      maxX = Math.max(maxX, x0, x1)
      minZ = Math.min(minZ, z0, z1)
      maxZ = Math.max(maxZ, z0, z1)
    }
    const cx = (minX + maxX) / 2
    const cz = (minZ + maxZ) / 2
    const reach = Math.hypot(maxX - minX, maxZ - minZ) / 2 + K.trees.out
    const kinds: THREE.Matrix4[][] = [[], [], []]
    const up = new THREE.Vector3(0, 1, 0)
    for (let k = 0; k < K.trees.count; k++) {
      const a = ((k + hash01(k * 11 + 1) * 0.6) / K.trees.count) * Math.PI * 2
      const r = reach + hash01(k * 13 + 5) * K.trees.spread
      const size = 1 + hash01(k * 17 + 2) * K.treeScale
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r),
        new THREE.Quaternion().setFromAxisAngle(up, hash01(k * 19 + 7) * Math.PI * 2),
        new THREE.Vector3(size, size, size),
      )
      kinds[Math.floor(hash01(k * 23 + 3) * 3)]!.push(m)
    }
    scatter('TreeRound', kinds[0]!)
    scatter('TreePine', kinds[1]!)
    scatter('TreeBirch', kinds[2]!)
  }

  /**
   * The Ozimka fields (PR 13w): hedges round the field the planes survey,
   * oaks standing in them, the farm track and power line beyond the west
   * hedge, the co-operative's yard and poplars beyond the east one, and a combine, bales or a hay shed in the next fields now and then. The
   * wheat and its rows stay in code.
   */
  function placeFields(segs: readonly CourseSegment[]) {
    const K = SURVEY_KIT
    const { legs } = courseTools(segs)
    const up = new THREE.Vector3(0, 1, 0)
    // A piece at (x, z) on the ground, built along +x and turned to run along this heading (90: east, 180: south).
    const ground = (x: number, z: number, heading: number) =>
      new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(up, (90 - heading) * DEG), new THREE.Vector3(1, 1, 1))
    // The lines run east from x = 0 and stack south (+z) at each turn.
    const west = -K.headland
    const east = SURVEY_PATTERN.line + K.headland
    const north = -K.north
    const south = legs.reduce((most, [, z0, , z1]) => Math.max(most, z0, z1), 0) + K.beyond
    const hedges: THREE.Matrix4[] = []
    const oaks: THREE.Matrix4[] = []
    const hedge = (x: number, z: number, heading: number, k: number) => {
      hedges.push(ground(x, z, heading))
      const { fx, fz } = axes(heading)
      if (hash01(k * 31 + 7) * K.oak < 1) oaks.push(ground(x + (fx * K.hedge) / 2, z + (fz * K.hedge) / 2, hash01(k * 37 + 3) * 360))
    }
    let k = 0
    for (let x = west; x < east; x += K.hedge) hedge(x, north, 90, k++)
    for (let z = north; z < south; z += K.hedge) {
      hedge(west, z, 180, k++)
      hedge(east, z, 180, k++)
    }
    scatter('Hedge', hedges)
    scatter('Oak', oaks)
    // The co-operative's yard beyond the east hedge, its open side to the field.
    const farmFrom = north - K.farm.north
    const farmTo = farmFrom + K.farm.length
    scatter('Farmstead', [ground(east + K.farm.out, farmFrom, 180)])
    // Beyond the west hedge: the track (and its spur along the north hedge into the yard), then the power line.
    const track: THREE.Matrix4[] = []
    const tx = west - K.track
    const tz = north - K.track
    for (let z = tz; z < south; z += K.hedge) track.push(ground(tx, z, 180))
    for (let x = tx; x < east + K.farm.out + K.farm.gate; x += K.hedge) track.push(ground(x, tz, 90))
    scatter('Track', track)
    const power: THREE.Matrix4[] = []
    for (let z = north - K.power.span; z < south; z += K.power.span) power.push(ground(west - K.power.out, z, 180))
    scatter('PowerSpan', power)
    // Beyond the east hedge: the poplars, with gaps, and none in front of the yard.
    const poplars: THREE.Matrix4[] = []
    for (let z = north, i = 0; z < south; z += K.hedge, i++) {
      if (z + K.hedge > farmFrom - K.hedge && z < farmTo + K.hedge) continue
      if (hash01(i * 41 + 9) >= K.poplars.gaps) poplars.push(ground(east + K.poplars.out, z, 180))
    }
    scatter('Poplars', poplars)
    // The next fields, either side: a piece about every K.next.every metres, its kind and distance out by a hash of its place.
    const kinds: Record<string, THREE.Matrix4[]> = { Combine: [], BaleStack: [], HayShed: [] }
    const names = Object.keys(kinds)
    for (let z = north, i = 0; z < south; z += K.next.every, i++) {
      for (const sign of [-1, 1]) {
        const j = i * 2 + (sign > 0 ? 1 : 0)
        const out = K.next.from + hash01(j * 43 + 1) * (K.next.to - K.next.from)
        const x = sign < 0 ? west - out : east + out
        const along = z + hash01(j * 47 + 5) * K.next.every * 0.6
        const name = names[Math.floor(hash01(j * 53 + 2) * names.length)]!
        // A combine works up or down the field; the rest face the hedge (heading 0 faces east, 180 west).
        kinds[name]!.push(ground(x, along, name === 'Combine' ? (hash01(j * 59) < 0.5 ? 0 : 180) : sign < 0 ? 0 : 180))
      }
    }
    for (const name of names) scatter(name, kinds[name]!)
  }

  /**
   * Lake Dolgo (PR 13y): the plough's snowbanks along every side of the loop
   * with spruce branches stuck in them, the start banner, the warming hut and
   * the plough, people near the finish, fishing shacks out on the ice and the
   * shore all round. Placed once, round the first lap; the ice stays in code.
   */
  function placeLake(segs: readonly CourseSegment[]) {
    const K = LAKE_KIT
    // The first lap: up to the first time the course is back where it started.
    let x = 0
    let z = 0
    let n = segs.length
    for (let i = 0; i < segs.length; i++) {
      const { fx, fz } = axes(segs[i]!.heading)
      x += fx * segs[i]!.length
      z += fz * segs[i]!.length
      if (Math.hypot(x, z) < 1) {
        n = i + 1
        break
      }
    }
    const loop = segs.slice(0, n)
    const { total, legs, side } = courseTools(loop)
    // The banks and brooms side by side, each side of the loop, stopping short of the corners.
    const banks: THREE.Matrix4[] = []
    const brooms: THREE.Matrix4[] = []
    let start = 0
    for (const seg of loop) {
      const from = start + K.corner
      const to = start + seg.length - K.corner
      for (let d = from; d + K.bank.every <= to; d += K.bank.every) banks.push(side(d, -K.bank.out), side(d + K.bank.every, K.bank.out))
      for (let d = from + K.broom.every / 2; d <= to; d += K.broom.every) brooms.push(side(d, -K.broom.out), side(d, K.broom.out))
      start += seg.length
    }
    scatter('Snowbank', banks)
    scatter('Broom', brooms)
    // The banner over the finish, at the corner where the loop starts and ends: built along the last side, its pole on the outside.
    scatter('StartBanner', [placeAt(loop, total, 0)])
    scatter('WarmingHut', [side(K.hut.along, -K.hut.out)])
    scatter('Plough', [side(K.plough.along, -K.plough.out)])
    scatter('Crowd', [side(total - K.crowd.before, -K.crowd.out)])
    // Fishing shacks out on the ice, either side, each turned its own way.
    const up = new THREE.Vector3(0, 1, 0)
    const huddles: THREE.Matrix4[] = []
    for (let k = 0; k < K.shacks.count; k++) {
      const out = K.shacks.from + hash01(k * 29 + 3) * (K.shacks.to - K.shacks.from)
      const m = side(hash01(k * 31 + 1) * total, (hash01(k * 37 + 2) < 0.5 ? -1 : 1) * out)
      huddles.push(m.multiply(new THREE.Matrix4().makeRotationY(hash01(k * 41 + 5) * Math.PI * 2)))
    }
    scatter('Shacks', huddles)
    // The shore: a ring round the loop's middle, beyond its far corners, every piece facing the lake.
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const [x0, z0, x1, z1] of legs) {
      minX = Math.min(minX, x0, x1)
      maxX = Math.max(maxX, x0, x1)
      minZ = Math.min(minZ, z0, z1)
      maxZ = Math.max(maxZ, z0, z1)
    }
    const cx = (minX + maxX) / 2
    const cz = (minZ + maxZ) / 2
    const reach = Math.hypot(maxX - minX, maxZ - minZ) / 2 + K.shore.out
    const count = Math.ceil((2 * Math.PI * reach) / K.shore.piece)
    const shore: THREE.Matrix4[] = []
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2
      const px = cx + Math.cos(a) * reach
      const pz = cz + Math.sin(a) * reach
      // A piece faces +z (three.js) as built: turn it to face the middle, and start it half a piece back so it's centred here.
      const turn = Math.atan2(cx - px, cz - pz)
      const q = new THREE.Quaternion().setFromAxisAngle(up, turn)
      const back = new THREE.Vector3(1, 0, 0).applyQuaternion(q).multiplyScalar(-K.shore.piece / 2)
      shore.push(new THREE.Matrix4().compose(new THREE.Vector3(px + back.x, 0, pz + back.z), q, new THREE.Vector3(1, 1, 1)))
    }
    scatter('ShorePines', shore)
  }

  function placeKit() {
    for (const child of [...kitGroup.children]) {
      kitGroup.remove(child)
      if (child instanceof THREE.InstancedMesh) child.dispose()
    }
    if (!kit) return
    // The airfield stands round its fixed runway (the kit-plane replay sets no course); the others along the course.
    if (airfield) placeAirfield()
    if (!kitCourse) return
    if (circuit) placeCircuit(kitCourse)
    if (salt) placeSalt(kitCourse)
    if (road) placeRoad(kitCourse)
    if (lake) placeLake(kitCourse)
    if (meadow) placeMeadow(kitCourse)
    if (fields) placeFields(kitCourse)
  }

  function clearCourse() {
    trackPieces.length = 0
    for (const child of [...course.children]) {
      course.remove(child)
      if (child instanceof THREE.InstancedMesh) child.dispose()
      if (child instanceof THREE.Mesh && child.geometry !== poleGeo && child.geometry !== flagGeo && child.geometry !== coneGeo && child.geometry !== dashGeo) child.geometry.dispose()
    }
  }

  const gateMat = new THREE.MeshLambertMaterial({ color: COLOURS.gate })
  /** A drone gate across the line at (x, z): two posts and two bars, the opening round the quads' flying height. */
  function addGate(x: number, z: number, rx: number, rz: number, heading: number) {
    const G = DRONE_SCENE.gate
    const top = DRONE_SCENE.flyHeight + G.height / 2
    const bottom = DRONE_SCENE.flyHeight - G.height / 2
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(G.bar, top + G.bar, G.bar), gateMat)
      post.position.set(x + (rx * side * (G.width + G.bar)) / 2, (top + G.bar) / 2, z + (rz * side * (G.width + G.bar)) / 2)
      course.add(post)
    }
    for (const y of [bottom, top]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(G.width + G.bar * 2, G.bar, G.bar), gateMat)
      bar.position.set(x, y + G.bar / 2, z)
      // The bar lies across the line: its length along the road's right-hand side.
      bar.rotation.y = -heading * DEG
      course.add(bar)
    }
  }

  /** Stand a rider on the road, `lane` metres right of the centre, facing along it. */
  function stand(group: THREE.Group, at: TrackPoint, lane: number) {
    const { rx, rz } = axes(at.heading)
    group.position.set(at.x + rx * lane, 0, at.z + rz * lane)
    // The rider is built facing +x; turn them to the heading.
    group.rotation.y = (90 - at.heading) * DEG
  }

  /** One lap of the indoor track as boards, a finish line, and the broadcast camera beyond the far bend. */
  function layTrack(segs: readonly CourseSegment[], lap: number) {
    const w = S.track.width
    let x = 0
    let z = 0
    let along = 0
    let minX = 0
    let maxX = 0
    let minZ = 0
    let maxZ = 0
    for (const seg of segs) {
      if (along >= lap - 1e-6) break
      const { fx, fz } = axes(seg.heading)
      // Each piece runs a little long, so the bends have no gaps on the outside.
      const len = seg.length + w * 0.4
      const board = new THREE.Mesh(new THREE.PlaneGeometry(w, len), boardsMat)
      board.renderOrder = -2
      board.rotation.order = 'YXZ'
      board.rotation.y = -seg.heading * DEG
      board.rotation.x = -Math.PI / 2
      // The riders' line is right of centre: lay the boards so it sits on them.
      const { rx, rz } = axes(seg.heading)
      board.position.set(x + (fx * seg.length) / 2 + rx * S.laneMine, 0, z + (fz * seg.length) / 2 + rz * S.laneMine)
      course.add(board)
      trackPieces.push(board)
      x += fx * seg.length
      z += fz * seg.length
      along += seg.length
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
    }
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.3, w), lineMat)
    line.renderOrder = -1
    line.rotation.x = -Math.PI / 2
    line.position.set(0, 0, axes(90).rz * S.laneMine)
    course.add(line)
    trackPieces.push(line)
    const cx = (minX + maxX) / 2
    const cz = (minZ + maxZ) / 2
    const c = S.track.camera
    const k = Math.max(1, lap / S.track.framedLap)
    broadcast = { at: new THREE.Vector3(cx - c.back * k, c.up * k, cz), look: new THREE.Vector3(cx + c.ahead * k, 0, cz) }
  }

  /** Belyanka's runway (PR 10v): the strip and its centre line along x, and a timing mast each side at each marker of the measured course. */
  function layRunway() {
    const W = AIRFIELD_SCENE.runway
    const len = W.to - W.from
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(len, W.width), roadMat)
    strip.renderOrder = -2
    strip.rotation.x = -Math.PI / 2
    strip.position.set((W.from + W.to) / 2, 0, 0)
    course.add(strip)
    const count = Math.floor(len / S.dashEvery)
    const dashes = new THREE.InstancedMesh(dashGeo, dashMat, count)
    dashes.renderOrder = -1
    const m = new THREE.Matrix4().makeRotationY(-Math.PI / 2)
    for (let k = 0; k < count; k++) {
      m.setPosition(W.from + (k + 0.25) * S.dashEvery, 0, 0)
      dashes.setMatrixAt(k, m)
    }
    dashes.computeBoundingSphere()
    course.add(dashes)
    const M = AIRFIELD_SCENE.mast
    for (const x of [0, AIRCRAFT_REPLAY.pass.course])
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, M.height, 8), poleMat)
        pole.position.set(x, M.height / 2, side * M.out)
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, M.boardHeight, M.board), flagMat)
        board.position.set(x, M.height - M.boardHeight / 2, side * M.out)
        course.add(pole, board)
      }
  }
  if (airfield) layRunway()

  return {
    setCourse(segs, opts) {
      clearCourse()
      broadcast = null
      ringMine.visible = ringOld.visible = !!opts.lap
      grid.visible = !opts.lap
      boardsMat.color.setHex(opts.ice ? COLOURS.ice : COLOURS.boards)
      roadMat.color.setHex(salt ? COLOURS.saltCourse : meadow ? COLOURS.mown : opts.ice ? COLOURS.ice : COLOURS.road)
      ;(ground.material as THREE.MeshLambertMaterial).color.setHex(salt ? COLOURS.salt : fields ? COLOURS.wheat : opts.lap ? COLOURS.infield : opts.ice ? COLOURS.snow : COLOURS.ground)
      // The cycling track's 250 m lap is the velodrome; the 400 m ice oval is the Stavren Ice Oval.
      const hallFile = opts.lap === TRACK.lap && !opts.ice ? 'velodrome.glb' : opts.lap === OVAL.lap && opts.ice ? 'iceoval.glb' : null
      wantHall = hallFile !== null
      if (hallFile) loadHall(hallFile)
      if (opts.lap) {
        layTrack(segs, opts.lap)
        showHall()
        return
      }
      showHall()
      kitCourse = segs
      // An open road gets its roadside (PR 13t), asked for the first time it's needed.
      // An ice race that isn't on an oval is Lake Dolgo's loop (PR 13y): snowbanks, not farms.
      lake = roadside && opts.ice === true
      road = roadside && !lake
      if (road) loadKit('road.glb')
      if (lake) loadKit('lake.glb')
      placeKit()
      // Over the wheat there's no road to lay: the rows are the ground's own grid (PR 10o).
      if (fields) return
      const downwind = (90 - (opts.windFromDeg + 180)) * DEG
      const total = segs.reduce((sum, seg) => sum + seg.length, 0)
      let x = 0
      let z = 0
      let along = 0
      for (const seg of segs) {
        const { fx, fz, rx, rz } = axes(seg.heading)
        const road = new THREE.Mesh(new THREE.PlaneGeometry(lay.roadWidth, seg.length), roadMat)
        road.renderOrder = -2
        road.rotation.order = 'YXZ'
        road.rotation.y = -seg.heading * DEG
        road.rotation.x = -Math.PI / 2
        road.position.set(x + (fx * seg.length) / 2, 0, z + (fz * seg.length) / 2)
        course.add(road)
        // The centre line: one instanced dash every few metres.
        const count = meadow ? 0 : Math.floor(seg.length / S.dashEvery)
        const dashes = new THREE.InstancedMesh(dashGeo, dashMat, count)
        dashes.renderOrder = -1
        const m = new THREE.Matrix4().makeRotationY(-seg.heading * DEG)
        for (let k = 0; k < count; k++) {
          const d = (k + 0.25) * S.dashEvery
          m.setPosition(x + fx * d, 0, z + fz * d)
          dashes.setMatrixAt(k, m)
        }
        dashes.computeBoundingSphere()
        course.add(dashes)
        // Wind flags along the left verge, every so often from the start (none in still air).
        for (let d = opts.calm ? seg.length : lay.flagEvery - (along % lay.flagEvery); d < seg.length; d += lay.flagEvery) {
          const px = x + fx * d + rx * lay.flagSide
          const pz = z + fz * d + rz * lay.flagSide
          const pole = new THREE.Mesh(poleGeo, poleMat)
          pole.position.set(px, S.flagHeight / 2, pz)
          const flag = new THREE.Mesh(flagGeo, flagMat)
          flag.position.set(px, S.flagHeight - 0.35, pz)
          flag.rotation.y = downwind
          course.add(pole, flag)
        }
        // A quad race's gate over the line at the start of each straight (PR 10h): a square frame round the flying height.
        if (opts.gates?.some((g) => Math.abs(g - along) < 1e-3)) addGate(x, z, rx, rz, seg.heading)
        x += fx * seg.length
        z += fz * seg.length
        along += seg.length
        // A cone where the course turns (and at the finish). A circuit is drawn in short pieces: only its line gets one.
        if (!meadow && (!circuit || along >= total - 1e-6)) {
          const cone = new THREE.Mesh(coneGeo, coneMat)
          cone.position.set(x, 0.45, z)
          course.add(cone)
        }
      }
    },
    setRiders(mineDesign, oldDesign) {
      dropFigure(mine)
      dropFigure(old)
      mine = figure(mineDesign, false)
      old = figure(oldDesign, true)
      camReady = false
    },
    setPlanes(minePlane, oldPlane) {
      planeMine = minePlane
      planeOld = oldPlane
    },
    setShown(showMine, showOld) {
      if (mine) mine.tucked.visible = showMine
      if (old) old.tucked.visible = showOld
    },
    setQuads(mineQuad, oldQuad) {
      quadMine = mineQuad
      quadOld = oldQuad
    },
    setMach(mineMach, oldMach) {
      showMach(mine, mineMach)
      showMach(old, oldMach)
    },
    place(me, them, dt) {
      if (!mine || !old) return
      clock += Math.min(dt, 0.1)
      const gMine = pose(mine, me, lay.laneMine, 0)
      // The old setup meets its gusts out of step with yours.
      const gOld = pose(old, them, lay.laneOld, S.trouble.every / 2)
      ringMine.position.set(gMine.position.x, 0.05, gMine.position.z)
      ringOld.position.set(gOld.position.x, 0.05, gOld.position.z)
      if (broadcast) {
        if (camera.fov !== S.track.camera.fov) {
          camera.fov = S.track.camera.fov
          camera.updateProjectionMatrix()
        }
        camera.position.copy(broadcast.at)
        camera.lookAt(broadcast.look)
        return
      }
      if (camera.fov !== lay.camera.fov) {
        camera.fov = lay.camera.fov
        camera.updateProjectionMatrix()
      }
      const turn = ((((me.heading - camHeading) % 360) + 540) % 360) - 180
      camHeading = camReady ? camHeading + turn * (1 - Math.exp(-S.cameraEase * dt)) : me.heading
      camReady = true
      const { fx, fz, rx, rz } = axes(camHeading)
      const c = lay.camera
      const p = gMine.position
      // At the airfield (PR 10v): side-on to your plane through the stall check; on the passes, from a camera plane ahead of the pair, looking back.
      if (airfield) {
        const v = AIRFIELD_SCENE.camera
        if (old?.tucked.visible) {
          const y = Math.max(AIRFIELD_SCENE.cameraLow, p.y + v.front.up)
          // On the line midway between the two lanes.
          const mid = lay.laneMine - (lay.laneMine + lay.laneOld) / 2
          camera.position.set(p.x + fx * v.front.ahead - rx * mid, y, p.z + fz * v.front.ahead - rz * mid)
          camera.lookAt(p.x - fx * v.front.lookBack - rx * mid, p.y, p.z - fz * v.front.lookBack - rz * mid)
        } else {
          const y = Math.max(AIRFIELD_SCENE.cameraLow, p.y + v.side.up)
          camera.position.set(p.x + fx * v.side.ahead + rx * v.side.out, y, p.z + fz * v.side.ahead + rz * v.side.out)
          camera.lookAt(p.x, p.y, p.z)
        }
        grid.position.x = Math.round(p.x / S.gridCell) * S.gridCell
        grid.position.z = Math.round(p.z / S.gridCell) * S.gridCell
        ground.position.x = grid.position.x
        ground.position.z = grid.position.z
        return
      }
      // Over the wheat (PR 10o): behind your plane at its own height, sinking with it as it comes down, never into the crop.
      if (fields) {
        const v = SURVEY_SCENE.camera
        const y = Math.max(SURVEY_SCENE.cameraLow, p.y + v.up)
        camera.position.set(p.x - fx * v.back + rx * v.side, y, p.z - fz * v.back + rz * v.side)
        camera.lookAt(p.x + fx * v.ahead, Math.max(0, p.y - v.below), p.z + fz * v.ahead)
        grid.position.x = Math.round(p.x / gridCell) * gridCell
        grid.position.z = Math.round(p.z / gridCell) * gridCell
        ground.position.x = grid.position.x
        ground.position.z = grid.position.z
        return
      }
      // A quad falling from a tumble (PR 10h): the camera sinks with it and looks down at where it lands.
      const fall = meadow ? quadMine.fall : 0
      const sink = meadow ? Math.min(c.up - DRONE_SCENE.cameraLow, DRONE_SCENE.flyHeight - DRONE_BODY.hover - p.y) : 0
      const ahead = c.ahead * (1 - DRONE_SCENE.fallLook.ahead * fall)
      const lookUp = c.lookUp - sink - DRONE_SCENE.fallLook.down * fall
      camera.position.set(p.x - fx * c.back + rx * c.side, c.up - sink, p.z - fz * c.back + rz * c.side)
      camera.lookAt(p.x + fx * ahead, lookUp, p.z + fz * ahead)
      // The ground grid follows the camera in whole cells, so it never seems to jump.
      grid.position.x = Math.round(p.x / S.gridCell) * S.gridCell
      grid.position.z = Math.round(p.z / S.gridCell) * S.gridCell
      ground.position.x = grid.position.x
      ground.position.z = grid.position.z
    },
    setInset(px) {
      if (px === inset) return
      inset = px
      resize()
    },
    render() {
      renderer.render(scene, camera)
    },
    dispose() {
      disposed = true
      if (hall instanceof THREE.Object3D) dropModel(hall)
      kitCourse = null
      placeKit()
      if (kit) dropModel(kit)
      stopTheme()
      watcher.disconnect()
      clearCourse()
      dropFigure(mine)
      dropFigure(old)
      for (const geo of [poleGeo, flagGeo, coneGeo, dashGeo, ringGeo, chuteGeo, shockGeo, ground.geometry]) geo.dispose()
      grid.dispose()
      for (const m of [roadMat, dashMat, poleMat, flagMat, coneMat, ghostMat, boardsMat, lineMat, chuteMat, chuteLineMat, shockMat, gateMat, ringMine.material, ringOld.material, ground.material as THREE.Material])
        m.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
