/**
 * The jump replay's 3D view (PR 8j): the hill side-on, its in-run and table,
 * the landing slope with the K line and the hill-size line across it, fir
 * trees down the far side, your jumper and the old setup as a see-through twin
 * beside it. Every position comes from src/sim/jumpReplay.ts; this file only
 * draws them.
 */
import * as THREE from 'three'
import { FLIGHT_ATTITUDE } from '../data/jumper'
import type { Hill } from '../data/hills'
import { JUMP_SCENE as S } from '../data/replay'
import { jumperPose, landedPose, type JumperPose } from '../sim/geom/jumperPose'
import { groundAt, hillSurface, xAtAlong } from '../sim/jumper'
import type { JumpFrame } from '../sim/jumpReplay'
import type { JumperDesign } from '../data/jumper'
import { buildRider, disposeGroup } from './riderFigure'

const COLOURS = {
  sky: 0xdfe8ef,
  snow: 0xf4f7fa,
  far: 0xe3eaf0,
  tree: 0x3d4f5c,
  tick: 0x93a3b1,
  /** The K line in the instruments' cobalt, the hill-size line in the failure red. */
  k: 0x2456e8,
  hs: 0xd2462b,
  markMine: 0x2456e8,
  markOld: 0x5a6875,
  ghost: 0x5a6875,
}

const DEG = Math.PI / 180

export interface JumpView {
  setHill(hill: Hill): void
  setJumpers(mine: JumperDesign, old: JumperDesign): void
  /** Put both jumpers where the flight clock says, and the camera beside yours. */
  place(mine: JumpFrame, old: JumpFrame): void
  /** The readout panel covers this many pixels at the bottom: the picture centres above it. */
  setInset(px: number): void
  render(): void
  dispose(): void
}

export function createJumpView(host: HTMLElement): JumpView {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.className = 'replay-canvas'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.prepend(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COLOURS.sky)
  scene.fog = new THREE.Fog(COLOURS.sky, 60, 420)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a96a3, 2.2))
  const sun = new THREE.DirectionalLight(0xffffff, 1.5)
  sun.position.set(-20, 60, 40)
  scene.add(sun)
  const camera = new THREE.PerspectiveCamera(S.camera.fov, 1, 0.1, 800)

  const hillGroup = new THREE.Group()
  scene.add(hillGroup)
  let surface: ReturnType<typeof hillSurface> | null = null
  const ghostMat = new THREE.MeshStandardMaterial({ color: COLOURS.ghost, transparent: true, opacity: S.ghostOpacity, depthWrite: false, roughness: 0.8 })

  /** A bar lying across the slope at x, tilted with it, for the K and HS lines and the landing marks. */
  function bar(x: number, colour: number, from: number, to: number, thick = S.mark): THREE.Mesh {
    const g = surface ? groundAt(surface, x).y : 0
    const a = surface ? groundAt(surface, x - 0.5).y : 0
    const b = surface ? groundAt(surface, x + 0.5).y : 0
    const m = new THREE.Mesh(new THREE.BoxGeometry(thick, 0.06, to - from), new THREE.MeshLambertMaterial({ color: colour }))
    m.position.set(x, g + 0.03, (from + to) / 2)
    m.rotation.z = Math.atan2(b - a, 1)
    return m
  }

  function setHill(hill: Hill) {
    for (const child of [...hillGroup.children]) {
      hillGroup.remove(child)
      disposeGroup(child)
    }
    const surf = hillSurface(hill)
    surface = surf
    const end = (surf.y.length - 1) * surf.step
    const low = Math.min(...surf.y) - S.base
    // The side profile: in-run down to the table's edge, the drop under it, the landing slope and outrun, then down to the base.
    const td = hill.tableDeg * DEG
    const tableTop = new THREE.Vector2(-S.table * Math.cos(td), S.table * Math.sin(td))
    const id = S.inrun.deg * DEG
    const inrunTop = new THREE.Vector2(tableTop.x - S.inrun.length * Math.cos(id), tableTop.y + S.inrun.length * Math.sin(id))
    const shape = new THREE.Shape()
    shape.moveTo(inrunTop.x, low)
    shape.lineTo(inrunTop.x, inrunTop.y)
    shape.lineTo(tableTop.x, tableTop.y)
    shape.lineTo(0, 0)
    for (let i = 0; i < surf.y.length; i += 4) shape.lineTo(i * surf.step, surf.y[i] as number)
    shape.lineTo(end, surf.y[surf.y.length - 1] as number)
    shape.lineTo(end, low)
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, { depth: S.width, bevelEnabled: false, curveSegments: 1 })
    geo.translate(0, 0, -S.width / 2)
    hillGroup.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: COLOURS.snow })))
    // Snow plain beyond, for depth.
    const plain = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshLambertMaterial({ color: COLOURS.far }))
    plain.rotation.x = -Math.PI / 2
    plain.position.y = low
    hillGroup.add(plain)
    // The K line and the hill-size line right across the slope; a tick every 10 m down each edge.
    const half = S.width / 2
    hillGroup.add(bar(xAtAlong(surf, hill.k), COLOURS.k, -half, half), bar(xAtAlong(surf, hill.hs), COLOURS.hs, -half, half))
    for (let s = 10; s < hill.hs + 20; s += 10) {
      const x = xAtAlong(surf, s)
      hillGroup.add(bar(x, COLOURS.tick, half - 1.2, half), bar(x, COLOURS.tick, -half, -half + 1.2))
    }
    // Fir trees down the far side, where they frame the jump without hiding it.
    const treeGeo = new THREE.ConeGeometry(1.4, 5, 7)
    treeGeo.translate(0, 2.5, 0)
    const treeMat = new THREE.MeshLambertMaterial({ color: COLOURS.tree })
    for (let x = 4; x < end; x += S.treeEvery) {
      const tree = new THREE.Mesh(treeGeo, treeMat)
      tree.position.set(x, groundAt(surf, x).y - 0.5, -(half + S.treeOut))
      hillGroup.add(tree)
    }
  }

  /**
   * A jumper as drawn: the flying figure on a pivot at the hips (so the
   * flight angle turns it about its centre of mass), and the landed one,
   * skis flat, built the first time it touches down.
   */
  interface Jumper {
    design: JumperDesign
    flying: THREE.Group
    landed: THREE.Group | null
    mark: THREE.Mesh | null
    ghost: boolean
    lane: number
  }
  let mine: Jumper | null = null
  let old: Jumper | null = null
  /** The landed pose's hips above its boots' soles, m. */
  const landedHipsUp = (() => {
    const pose = landedPose()
    return (pose.hip[0].y + pose.hip[1].y) / 2 - pose.skis[0].tail.y
  })()

  /** A figure in this pose, its hips at the pivot's origin. */
  function figure(design: JumperDesign, pose: JumperPose, ghost: boolean): THREE.Group {
    const body = buildRider({ design, pose, broken: [], strained: [] })
    const hips = pose.hip
    body.position.set(-(hips[0].x + hips[1].x) / 2, -(hips[0].y + hips[1].y) / 2, -(hips[0].z + hips[1].z) / 2)
    if (ghost)
      body.traverse((o) => {
        if (o instanceof THREE.Mesh) o.material = ghostMat
      })
    const pivot = new THREE.Group()
    pivot.add(body)
    scene.add(pivot)
    return pivot
  }

  function build(design: JumperDesign, ghost: boolean, lane: number): Jumper {
    return { design, flying: figure(design, jumperPose(design), ghost), landed: null, mark: null, ghost, lane }
  }

  function drop(j: Jumper | null) {
    if (!j) return
    for (const g of [j.flying, j.landed, j.mark]) {
      if (!g) continue
      scene.remove(g)
      disposeGroup(g)
    }
  }

  function stand(j: Jumper, f: JumpFrame) {
    // The landed figure is built at touchdown, its skis along the slope there.
    if (f.landed) j.landed ??= figure(j.design, landedPose(f.pitchDeg), j.ghost)
    j.flying.visible = !f.landed
    if (j.landed) j.landed.visible = f.landed
    if (f.landed && j.landed) {
      // Boots on the snow: the hips stand their own height above them (the pose puts them at its hip height).
      j.landed.position.set(f.x, f.y + landedHipsUp, j.lane)
    } else {
      j.flying.position.set(f.x, f.y + S.hipsUp, j.lane)
      // The figure is built with its skis at the flight attitude; turn them to the angle the sim gives.
      j.flying.rotation.z = (f.pitchDeg - FLIGHT_ATTITUDE.hold) * DEG
    }
    // A mark in the snow where the skis touched, in the jumper's own lane.
    if (f.landed && !j.mark) {
      j.mark = bar(f.x, j.ghost ? COLOURS.markOld : COLOURS.markMine, j.lane - 1.2, j.lane + 1.2, 0.5)
      scene.add(j.mark)
    } else if (!f.landed && j.mark) {
      scene.remove(j.mark)
      disposeGroup(j.mark)
      j.mark = null
    }
  }

  /** The camera rides alongside, square to the hill: a jumper at 25 m/s would leave an easing camera metres behind. */
  function aim(f: JumpFrame) {
    const C = S.camera
    const look = new THREE.Vector3(f.x + C.ahead, f.y, 0)
    camera.position.set(look.x, look.y + C.up, C.side)
    camera.lookAt(look)
  }

  let inset = 0
  function resize() {
    const w = host.clientWidth || 1
    const h = host.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Shift the view up by half the panel, so the jumper sits in the open part of the screen.
    camera.setViewOffset(w, h, 0, Math.min(inset, h / 2) / 2, w, h)
    camera.updateProjectionMatrix()
  }
  const watcher = new ResizeObserver(resize)
  watcher.observe(host)
  resize()

  return {
    setHill,
    setJumpers(a, b) {
      drop(mine)
      drop(old)
      mine = build(a, false, S.laneMine)
      old = build(b, true, S.laneOld)
    },
    place(a, b) {
      if (mine) stand(mine, a)
      if (old) stand(old, b)
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
      watcher.disconnect()
      drop(mine)
      drop(old)
      disposeGroup(hillGroup)
      ghostMat.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
