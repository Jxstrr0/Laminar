/**
 * The bobsled replay's 3D view (PR 8q): the ice channel down the mountain,
 * snow banks and fir trees beside it, the finish line, your sled with the
 * client's old one as a see-through ghost in the same channel, and a chase
 * camera behind yours. Every position comes from src/sim/sledReplay.ts; this
 * file only draws them.
 *
 * The sled figure is built nose along +x, its runners on y = 0, with +z to
 * its right. On the track, its +x follows the line's heading and its floor
 * tilts with how far up the curve wall it rides.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { BobsledDesign } from '../data/bobsled'
import { SLED_KIT as K, SLED_SCENE as S } from '../data/replay'
import { bobsledPose } from '../sim/geom/bobsledPose'
import { pointAt, type SledFrame, type TrackLine } from '../sim/sledReplay'
import { buildRider, disposeGroup } from './riderFigure'
import { attachSky } from './sky'
import { sceneColours } from './theme'

const COLOURS = {
  snow: 0xf4f7fa,
  ice: 0xdde9f2,
  lip: 0x93a3b1,
  tree: 0x3d4f5c,
  ghost: 0x5a6875,
}

const DEG = Math.PI / 180
const UP = new THREE.Vector3(0, 1, 0)

export interface SledView {
  /** Lay the channel along the track; `push` is the push zone's length, m, where the start's timing arch stands. */
  setTrack(line: TrackLine, push: number): void
  setSleds(mine: BobsledDesign, old: BobsledDesign): void
  /** Put both sleds where the run clock says, and the camera behind yours. */
  place(mine: SledFrame, old: SledFrame): void
  /** The readout panel covers this many pixels at the bottom: the picture centres above it. */
  setInset(px: number): void
  render(): void
  dispose(): void
}

/** The centre line's frame at s: where it is, which way is forward, right and up. */
function frameOf(line: TrackLine, s: number) {
  const p = pointAt(line, s)
  const at = new THREE.Vector3(p.x, p.y, p.z)
  const forward = new THREE.Vector3(Math.cos(p.heading), -p.grade, Math.sin(p.heading)).normalize()
  // Right of travel, level across the channel.
  const right = new THREE.Vector3(-Math.sin(p.heading), 0, Math.cos(p.heading))
  return { at, forward, right }
}

/** A point on the channel's wall, `deg` round from the bottom (positive: the right wall). */
function wallPoint(at: THREE.Vector3, right: THREE.Vector3, deg: number): THREE.Vector3 {
  const a = deg * DEG
  return at
    .clone()
    .addScaledVector(right, S.trough * Math.sin(a))
    .addScaledVector(UP, S.trough * (1 - Math.cos(a)))
}

/** Where the track's buildings stand (PR 13p): metres from the start, and for those beside it, which side (−1 left, 1 right). */
export interface SledSites {
  arches: number[]
  shades: number[]
  terraces: { s: number; side: -1 | 1 }[]
  masts: { s: number; side: -1 | 1 }[]
}

/**
 * The buildings' places along a track: an arch at the end of the push and
 * at each split, the sun roof's bays, a terrace on the outside of every
 * curve at its middle, and floodlight masts that keep clear of the
 * terraces, the start house and the finish area.
 */
export function sledSites(line: TrackLine, push: number): SledSites {
  const terraces: SledSites['terraces'] = []
  let from = -1
  let sign = 0
  for (let i = 1; i <= line.s.length; i++) {
    const c = i < line.s.length ? Math.sign(line.curve[i]!) : 0
    if (c !== sign) {
      // A curve to the right (toward +z) has its outside on the left.
      // None under the sun roof: its posts and roof would stand in the crowd.
      const mid = (from + line.s[i - 1]!) / 2
      const roofed = mid > K.shade.from - K.terraceClear && mid < K.shade.to + K.terraceClear
      if (sign !== 0 && !roofed) terraces.push({ s: mid, side: sign > 0 ? -1 : 1 })
      from = line.s[i - 1]!
      sign = c
    }
  }
  const shades: number[] = []
  for (let s = K.shade.from; s <= K.shade.to + 1e-6; s += K.shade.every) shades.push(s)
  const masts: SledSites['masts'] = []
  let side: -1 | 1 = -1
  for (let s = K.masts.from; s < line.length - K.treesEndBefore / 2; s += K.masts.every) {
    if (!terraces.some((t) => t.side === side && Math.abs(t.s - s) < K.terraceClear)) masts.push({ s, side })
    side = side === -1 ? 1 : -1
  }
  return { arches: [push, ...K.splits.filter((s) => s > push && s < line.length)], shades, terraces, masts }
}

export function createSledView(host: HTMLElement): SledView {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.className = 'replay-canvas'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.prepend(renderer.domElement)

  const scene = new THREE.Scene()
  // The sky follows the phone's theme (Isobar, PR 13h); the track keeps its daylight colours.
  const theme = sceneColours()
  // A photographed winter sky (PR 13az) replaces the flat colour once it has loaded, and lights the venue.
  const fog = new THREE.Fog(theme.fieldSky, 40, 260)
  scene.fog = fog
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a96a3, 2.2)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xffffff, 1.4)
  sun.position.set(-40, 80, 30)
  scene.add(sun)
  const skyDome = attachSky(renderer, scene, fog, hemi, sun, 'winter')
  const camera = new THREE.PerspectiveCamera(S.camera.fov, 1, 0.1, 600)

  const trackGroup = new THREE.Group()
  scene.add(trackGroup)
  let line: TrackLine | null = null
  const ghostMat = new THREE.MeshStandardMaterial({ color: COLOURS.ghost, transparent: true, opacity: S.ghostOpacity, depthWrite: false, roughness: 0.8 })

  /** A strip through rows of points (each row across the track), as one mesh. */
  function strip(rows: THREE.Vector3[][], material: THREE.Material): THREE.Mesh {
    const across = rows[0]!.length
    const pos: number[] = []
    for (const row of rows) for (const p of row) pos.push(p.x, p.y, p.z)
    const index: number[] = []
    for (let i = 0; i < rows.length - 1; i++)
      for (let j = 0; j < across - 1; j++) {
        const a = i * across + j
        const b = a + across
        index.push(a, b, a + 1, a + 1, b, b + 1)
      }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setIndex(index)
    geo.computeVertexNormals()
    return new THREE.Mesh(geo, material)
  }

  function setTrack(next: TrackLine, push: number) {
    for (const child of [...trackGroup.children]) {
      trackGroup.remove(child)
      disposeGroup(child)
    }
    line = next
    sites = sledSites(next, push)
    placeKit()
    const ice: THREE.Vector3[][] = []
    const lipL: THREE.Vector3[][] = []
    const lipR: THREE.Vector3[][] = []
    const bankL: THREE.Vector3[][] = []
    const bankR: THREE.Vector3[][] = []
    const wall = S.wallDeg
    const steps = 12
    for (let s = 0; s <= next.length + 1e-6; s += S.drawEvery) {
      const { at, right } = frameOf(next, Math.min(s, next.length))
      const row: THREE.Vector3[] = []
      for (let k = 0; k <= steps; k++) row.push(wallPoint(at, right, -wall + (2 * wall * k) / steps))
      ice.push(row)
      // A thin lip along each edge, then the snow bank stepping out level from it.
      const topL = wallPoint(at, right, -wall)
      const topR = wallPoint(at, right, wall)
      const lift = UP.clone().multiplyScalar(0.12)
      lipL.push([topL, topL.clone().add(lift)])
      lipR.push([topR.clone().add(lift), topR])
      const edgeL = topL.clone().add(lift)
      const edgeR = topR.clone().add(lift)
      bankL.push([edgeL.clone().addScaledVector(right, -S.bank).addScaledVector(UP, -1.5), edgeL])
      bankR.push([edgeR, edgeR.clone().addScaledVector(right, S.bank).addScaledVector(UP, -1.5)])
    }
    const iceMat = new THREE.MeshStandardMaterial({ color: COLOURS.ice, roughness: 0.25, metalness: 0.05, side: THREE.DoubleSide })
    const lipMat = new THREE.MeshLambertMaterial({ color: COLOURS.lip, side: THREE.DoubleSide })
    const snowMat = new THREE.MeshLambertMaterial({ color: COLOURS.snow, side: THREE.DoubleSide })
    trackGroup.add(strip(ice, iceMat), strip(lipL, lipMat), strip(lipR, lipMat), strip(bankL, snowMat), strip(bankR, snowMat))
    // The finish line across the channel's floor and up its walls.
    const finishRows: THREE.Vector3[][] = []
    for (const s of [next.length - 0.4, next.length]) {
      const { at, right } = frameOf(next, s)
      const row: THREE.Vector3[] = []
      for (let k = 0; k <= steps; k++) row.push(wallPoint(at, right, -wall + (2 * wall * k) / steps).addScaledVector(UP, 0.02))
      finishRows.push(row)
    }
    trackGroup.add(strip(finishRows, new THREE.MeshLambertMaterial({ color: theme.mine, side: THREE.DoubleSide })))
    // Fir trees out beyond the banks, alternating sides.
    const treeGeo = new THREE.ConeGeometry(1.6, 6, 7)
    treeGeo.translate(0, 3, 0)
    const treeMat = new THREE.MeshLambertMaterial({ color: COLOURS.tree })
    let side = 1
    const terraces = sites.terraces
    for (let s = S.treeEvery / 2; s < next.length - K.treesEndBefore; s += S.treeEvery) {
      // No tree where a terrace stands on that side.
      if (terraces.some((t) => t.side === side && Math.abs(t.s - s) < K.terraceClear)) {
        side = -side
        continue
      }
      const { at, right } = frameOf(next, s)
      const tree = new THREE.Mesh(treeGeo, treeMat)
      tree.position.copy(at).addScaledVector(right, side * S.treeOut).addScaledVector(UP, -0.5)
      trackGroup.add(tree)
      side = -side
    }
  }

  /**
   * The track's buildings (PR 13p): Blender pieces, each copied by
   * instancing to every place `sledSites` gives. Until the model loads (or
   * if it can't), the channel and its trees stand alone.
   */
  let sites: SledSites = { arches: [], shades: [], terraces: [], masts: [] }
  let kit: THREE.Object3D | null = null
  let disposed = false
  const kitGroup = new THREE.Group()
  scene.add(kitGroup)
  new GLTFLoader().load(
    `${import.meta.env.BASE_URL}models/bobsled.glb`,
    (gltf) => {
      if (disposed) return dropModel(gltf.scene)
      kit = gltf.scene
      kit.updateMatrixWorld(true)
      placeKit()
    },
    undefined,
    () => undefined,
  )

  function dropModel(root: THREE.Object3D) {
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      o.geometry.dispose()
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) (m as THREE.Material).dispose()
    })
  }

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

  /** A piece on the centre line s metres down, standing level and facing down the track (turned round for the right side); or tilted with the slope. */
  function siteAt(track: TrackLine, s: number, turned = false, tilt = false): THREE.Matrix4 {
    const { at, forward, right } = frameOf(track, s)
    const along = tilt ? forward : new THREE.Vector3(forward.x, 0, forward.z).normalize()
    const out = new THREE.Matrix4()
    if (turned) out.makeBasis(along.clone().negate(), UP, right.clone().negate())
    else out.makeBasis(along, tilt ? new THREE.Vector3().crossVectors(right, along) : UP, right)
    return out.setPosition(at)
  }

  function placeKit() {
    for (const child of [...kitGroup.children]) {
      kitGroup.remove(child)
      if (child instanceof THREE.InstancedMesh) child.dispose()
    }
    if (!kit || !line) return
    const track = line
    scatter('StartHouse', [siteAt(track, 0)])
    scatter('TimingArch', sites.arches.map((s) => siteAt(track, s)))
    scatter('Shade', sites.shades.map((s) => siteAt(track, s, false, true)))
    scatter('Terrace', sites.terraces.map((t) => siteAt(track, t.s, t.side > 0)))
    scatter('LightMast', sites.masts.map((m) => siteAt(track, m.s, m.side > 0)))
    scatter('FinishArch', [siteAt(track, track.length)])
    scatter('FinishArea', [siteAt(track, track.length)])
  }

  /** A sled as drawn: the figure on a pivot at its runners' middle. */
  let mine: THREE.Group | null = null
  let old: THREE.Group | null = null

  function build(design: BobsledDesign, ghost: boolean): THREE.Group {
    const body = buildRider({ design, pose: bobsledPose(design), broken: [], strained: [] })
    if (ghost)
      body.traverse((o) => {
        if (o instanceof THREE.Mesh) o.material = ghostMat
      })
    const pivot = new THREE.Group()
    pivot.add(body)
    scene.add(pivot)
    return pivot
  }

  function drop(g: THREE.Group | null) {
    if (!g) return
    scene.remove(g)
    disposeGroup(g)
  }

  const basis = new THREE.Matrix4()
  /** The sled at its frame: up the wall by its bank, its floor square to the wall there, nose along the track. */
  function put(g: THREE.Group, f: SledFrame) {
    if (!line) return
    const { at, forward, right } = frameOf(line, Math.min(f.s, line.length))
    const a = f.bankDeg * DEG
    g.position.copy(wallPoint(at, right, f.bankDeg))
    // The wall's normal there: up, leaning away from the wall the sled rides.
    const normal = UP.clone().multiplyScalar(Math.cos(a)).addScaledVector(right, -Math.sin(a)).normalize()
    const fwd = forward.clone().addScaledVector(normal, -forward.dot(normal)).normalize()
    const side = new THREE.Vector3().crossVectors(fwd, normal)
    basis.makeBasis(fwd, normal, side)
    g.quaternion.setFromRotationMatrix(basis)
  }

  /**
   * The camera rides behind your sled, following it part of the way up the
   * wall, and looks at the sled with a little of the track ahead, so a tight
   * curve never swings the sled out of the picture.
   */
  function aim(f: SledFrame) {
    if (!line) return
    const C = S.camera
    const s = Math.min(f.s, line.length)
    const here = frameOf(line, s)
    const sled = wallPoint(here.at, here.right, f.bankDeg)
    const behind = frameOf(line, Math.max(0, s - C.back))
    const lateral = S.trough * Math.sin(f.bankDeg * DEG) * C.follow
    camera.position.copy(behind.at).addScaledVector(behind.right, lateral).addScaledVector(UP, C.up)
    const ahead = frameOf(line, Math.min(line.length, s + C.ahead)).at
    camera.lookAt(sled.lerp(ahead, C.lead).addScaledVector(UP, C.lookUp))
  }

  let inset = 0
  function resize() {
    const w = host.clientWidth || 1
    const h = host.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Shift the view up by half the panel, so the sled sits in the open part of the screen.
    camera.setViewOffset(w, h, 0, Math.min(inset, h / 2) / 2, w, h)
    camera.updateProjectionMatrix()
  }
  const watcher = new ResizeObserver(resize)
  watcher.observe(host)
  resize()

  return {
    setTrack,
    setSleds(a, b) {
      drop(mine)
      drop(old)
      mine = build(a, false)
      old = build(b, true)
    },
    place(a, b) {
      if (mine) put(mine, a)
      if (old) put(old, b)
      aim(a)
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
      for (const child of kitGroup.children) if (child instanceof THREE.InstancedMesh) child.dispose()
      if (kit) dropModel(kit)
      watcher.disconnect()
      drop(mine)
      drop(old)
      disposeGroup(trackGroup)
      ghostMat.dispose()
      skyDome.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
