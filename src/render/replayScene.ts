/**
 * The race-day replay's 3D view: the course as a road across open country,
 * your design on it with the client's old setup as a see-through twin in
 * the next lane, wind flags along the verge, and a chase camera. Every
 * position comes from src/sim/replay.ts; this file only draws them.
 */
import * as THREE from 'three'
import type { CyclistDesign } from '../data/cyclist'
import type { CourseSegment } from '../data/field'
import { REPLAY_SCENE as S } from '../data/replay'
import { riderPose } from '../sim/geom/pose'
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
}

const DEG = Math.PI / 180

/** Unit vectors for a compass heading: forward along the road, and right of it. */
function axes(heading: number) {
  const h = heading * DEG
  return { fx: Math.sin(h), fz: -Math.cos(h), rx: Math.cos(h), rz: Math.sin(h) }
}

export interface ReplayView {
  /** Lay out the course and the wind (blowing from `windFromDeg`). */
  setCourse(course: readonly CourseSegment[], windFromDeg: number): void
  setRiders(mine: CyclistDesign, old: CyclistDesign): void
  /** Put both riders where the race clock says, and move the camera (dt in seconds). */
  place(mine: TrackPoint, old: TrackPoint, dt: number): void
  /** The readout panel covers this many pixels at the bottom: the picture centres above it. */
  setInset(px: number): void
  render(): void
  dispose(): void
}

export function createReplayView(host: HTMLElement): ReplayView {
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

  const camera = new THREE.PerspectiveCamera(S.camera.fov, 1, 0.1, S.fogFar + 200)
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

  const ghostMat = new THREE.MeshStandardMaterial({ color: COLOURS.ghost, transparent: true, opacity: S.ghostOpacity, depthWrite: false, roughness: 0.8 })
  let mine: THREE.Group | null = null
  let old: THREE.Group | null = null
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

  return {
    setCourse(segs, windFromDeg) {
      clearCourse()
      const downwind = (90 - (windFromDeg + 180)) * DEG
      let x = 0
      let z = 0
      let along = 0
      for (const seg of segs) {
        const { fx, fz, rx, rz } = axes(seg.heading)
        const road = new THREE.Mesh(new THREE.PlaneGeometry(S.roadWidth, seg.length), roadMat)
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
        // Wind flags along the left verge, every so often from the start.
        for (let d = S.flagEvery - (along % S.flagEvery); d < seg.length; d += S.flagEvery) {
          const px = x + fx * d + rx * S.flagSide
          const pz = z + fz * d + rz * S.flagSide
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
        // A cone where the course turns (and at the finish).
        const cone = new THREE.Mesh(coneGeo, coneMat)
        cone.position.set(x, 0.45, z)
        course.add(cone)
      }
    },
    setRiders(mineDesign, oldDesign) {
      for (const g of [mine, old]) {
        if (!g) continue
        scene.remove(g)
        disposeGroup(g)
      }
      mine = buildRider({ design: mineDesign, pose: riderPose(mineDesign), broken: [], strained: [] })
      old = buildRider({ design: oldDesign, pose: riderPose(oldDesign), broken: [], strained: [] })
      old.traverse((o) => {
        if (o instanceof THREE.Mesh) o.material = ghostMat
      })
      scene.add(mine, old)
      camReady = false
    },
    place(me, them, dt) {
      if (!mine || !old) return
      stand(mine, me, S.laneMine)
      stand(old, them, S.laneOld)
      const turn = ((((me.heading - camHeading) % 360) + 540) % 360) - 180
      camHeading = camReady ? camHeading + turn * (1 - Math.exp(-S.cameraEase * dt)) : me.heading
      camReady = true
      const { fx, fz, rx, rz } = axes(camHeading)
      const c = S.camera
      const p = mine.position
      camera.position.set(p.x - fx * c.back + rx * c.side, c.up, p.z - fz * c.back + rz * c.side)
      camera.lookAt(p.x + fx * c.ahead, c.lookUp, p.z + fz * c.ahead)
      // The ground grid follows the camera in whole cells, so it never seems to jump.
      grid.position.x = Math.round(mine.position.x / S.gridCell) * S.gridCell
      grid.position.z = Math.round(mine.position.z / S.gridCell) * S.gridCell
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
      for (const g of [mine, old]) if (g) disposeGroup(g)
      for (const geo of [poleGeo, flagGeo, coneGeo, dashGeo, ground.geometry]) geo.dispose()
      grid.dispose()
      for (const m of [roadMat, dashMat, poleMat, flagMat, coneMat, ghostMat, ground.material as THREE.Material]) m.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
