/**
 * The race-day replay's 3D view: the course as a road across open country,
 * your design on it with the client's old setup as a see-through twin in
 * the next lane, wind flags along the verge, and a chase camera. Every
 * position comes from src/sim/replay.ts; this file only draws them. A
 * rider the field model says eased off in the gusts rocks now and then;
 * one it says sat up is drawn sitting up.
 */
import * as THREE from 'three'
import { FIELD_TROUBLE, type CourseSegment } from '../data/field'
import { CAR_REPLAY, REPLAY_SCENE as S } from '../data/replay'
import { designPose, type Design } from '../sim/design'
import type { TrackPoint } from '../sim/replay'
import { buildRider, disposeGroup } from './riderFigure'

const COLOURS = {
  sky: 0xdfe8ef,
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
  markMine: 0x2456e8,
  markOld: 0x5a6875,
}

const DEG = Math.PI / 180

/** Unit vectors for a compass heading: forward along the road, and right of it. */
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
}

export interface ReplayOptions {
  /** Reduced motion: nobody rocks in the gusts (they still sit up). */
  still?: boolean
  /** A truck's fuel run (PR 9h): the wider road, lanes and camera of REPLAY_SCENE.truck. */
  truck?: boolean
  /** A race lap (PR 9o): the circuit's road, lanes and camera of REPLAY_SCENE.car, and no cones but the line. */
  car?: boolean
}

/** A rider as drawn: tucked as designed, and (built the first time it's needed) sitting up. */
interface Figure {
  design: Design
  ghost: boolean
  tucked: THREE.Group
  sitting: THREE.Group | null
}

/** The same rider sitting up (a skater standing taller): back up to the trouble table's angle, head up. */
function sitUp(design: Design): Design {
  if (design.sport === 'skijump' || design.sport === 'bobsled' || design.sport === 'truck' || design.sport === 'car') return design
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
  const lay = circuit ? S.car : opts.truck ? S.truck : { roadWidth: S.roadWidth, laneMine: S.laneMine, laneOld: S.laneOld, flagEvery: S.flagEvery, flagSide: S.flagSide, camera: S.camera }
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.className = 'replay-canvas'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.prepend(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COLOURS.sky)
  scene.fog = new THREE.Fog(COLOURS.sky, S.fogNear, S.fogFar)
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
  const ground = flat(new THREE.Mesh(new THREE.PlaneGeometry(S.gridSize * 2, S.gridSize * 2), new THREE.MeshLambertMaterial({ color: COLOURS.ground })), -4)
  ground.rotation.x = -Math.PI / 2
  const grid = flat(new THREE.GridHelper(S.gridSize, S.gridSize / S.gridCell, COLOURS.grid, COLOURS.grid), -3)
  scene.add(ground, grid)

  const course = new THREE.Group()
  scene.add(course)
  const roadMat = new THREE.MeshLambertMaterial({ color: COLOURS.road, depthWrite: false })
  const dashMat = new THREE.MeshLambertMaterial({ color: COLOURS.dash, depthWrite: false })
  // One centre-line dash, lying flat and pointing along the road (local −z).
  const dashGeo = new THREE.PlaneGeometry(0.15, S.dashEvery / 2)
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
  const ringMine = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COLOURS.markMine, depthWrite: false }))
  const ringOld = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COLOURS.markOld, depthWrite: false }))
  ringMine.renderOrder = ringOld.renderOrder = -1
  ringMine.position.y = ringOld.position.y = 0.01
  ringMine.visible = ringOld.visible = false
  scene.add(ringMine, ringOld)
  /** The fixed broadcast camera on the track, or null for the chase camera. */
  let broadcast: { at: THREE.Vector3; look: THREE.Vector3 } | null = null
  const ghostMat = new THREE.MeshStandardMaterial({ color: COLOURS.ghost, transparent: true, opacity: S.ghostOpacity, depthWrite: false, roughness: 0.8 })
  let mine: Figure | null = null
  let old: Figure | null = null
  /** Seconds of replay so far, for the gusts' rhythm. */
  let clock = 0

  function build(design: Design, ghost: boolean): THREE.Group {
    const g = buildRider({ design, pose: designPose(design), broken: [], strained: [] })
    // Heading first, then the roll about the rider's own forward line.
    g.rotation.order = 'YXZ'
    if (ghost)
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) o.material = ghostMat
      })
    scene.add(g)
    return g
  }

  function figure(design: Design, ghost: boolean): Figure {
    const tucked = build(design, ghost)
    return { design, ghost, tucked, sitting: null }
  }

  function dropFigure(f: Figure | null) {
    if (!f) return
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

  function clearCourse() {
    for (const child of [...course.children]) {
      course.remove(child)
      if (child instanceof THREE.InstancedMesh) child.dispose()
      if (child instanceof THREE.Mesh && child.geometry !== poleGeo && child.geometry !== flagGeo && child.geometry !== coneGeo && child.geometry !== dashGeo) child.geometry.dispose()
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
    const cx = (minX + maxX) / 2
    const cz = (minZ + maxZ) / 2
    const c = S.track.camera
    const k = Math.max(1, lap / S.track.framedLap)
    broadcast = { at: new THREE.Vector3(cx - c.back * k, c.up * k, cz), look: new THREE.Vector3(cx + c.ahead * k, 0, cz) }
  }

  return {
    setCourse(segs, opts) {
      clearCourse()
      broadcast = null
      ringMine.visible = ringOld.visible = !!opts.lap
      grid.visible = !opts.lap
      boardsMat.color.setHex(opts.ice ? COLOURS.ice : COLOURS.boards)
      roadMat.color.setHex(opts.ice ? COLOURS.ice : COLOURS.road)
      ;(ground.material as THREE.MeshLambertMaterial).color.setHex(opts.lap ? COLOURS.infield : opts.ice ? COLOURS.snow : COLOURS.ground)
      if (opts.lap) {
        layTrack(segs, opts.lap)
        return
      }
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
        const count = Math.floor(seg.length / S.dashEvery)
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
        x += fx * seg.length
        z += fz * seg.length
        along += seg.length
        // A cone where the course turns (and at the finish). A circuit is drawn in short pieces: only its line gets one.
        if (!circuit || along >= total - 1e-6) {
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
    place(me, them, dt) {
      if (!mine || !old) return
      clock += Math.min(dt, 0.1)
      const gMine = pose(mine, me, lay.laneMine, 0)
      // The old setup meets its gusts out of step with yours.
      const gOld = pose(old, them, lay.laneOld, S.trouble.every / 2)
      ringMine.position.set(gMine.position.x, 0.01, gMine.position.z)
      ringOld.position.set(gOld.position.x, 0.01, gOld.position.z)
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
      camera.position.set(p.x - fx * c.back + rx * c.side, c.up, p.z - fz * c.back + rz * c.side)
      camera.lookAt(p.x + fx * c.ahead, c.lookUp, p.z + fz * c.ahead)
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
      watcher.disconnect()
      clearCourse()
      dropFigure(mine)
      dropFigure(old)
      for (const geo of [poleGeo, flagGeo, coneGeo, dashGeo, ringGeo, ground.geometry]) geo.dispose()
      grid.dispose()
      for (const m of [roadMat, dashMat, poleMat, flagMat, coneMat, ghostMat, boardsMat, lineMat, ringMine.material, ringOld.material, ground.material as THREE.Material])
        m.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
