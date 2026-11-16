/**
 * The Shape screen's 3D view: the rider and bike drawn from the design.
 * Limbs come from the pose (src/sim/geom/pose.ts); the helmet's outline is
 * the very cross-section stack the aero model reads, so a longer tail on
 * screen is a longer tail in the sim. Parts that break the rules glow red;
 * the part of the posture that strains the rider most glows amber.
 *
 * Drag handles are cobalt dots drawn on top of everything. A press near one
 * grabs it (the camera stays put), and the screen turns the pull into new
 * design numbers; a press anywhere else turns the camera as before. The rule
 * box is drawn as see-through volumes that go red when a part breaks out.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { HANDLE_TOUCH, type HandleId } from '../data/handles'
import type { Project, ScreenPoint } from '../sim/geom/handles'
import type { Point } from '../sim/geom/pose'
import type { RuleVolume } from '../sim/geom/ruleBox'
import { ball, buildRider, disposeGroup, v3, type Highlight, type RiderState } from './riderFigure'

export type { Highlight } from './riderFigure'

const COLOURS = {
  background: 0xe9edf0,
  floor: 0xd6dce1,
  grid: 0x9aa5ae,
  broken: 0xd2462b,
  handle: 0x2456e8,
  handleRing: 0xffffff,
  rules: 0x2456e8,
}

/** Vertical field of view above the sheet, degrees, at least. */
const PORTRAIT_FOV = 40
/** Tangent of half the horizontal view: wide enough for the whole bike. */
const MIN_HALF_WIDTH = 0.5
/** Room the header takes at the top, CSS pixels: the rider is centred below it. */
const HEADER_PX = 64

export interface ShapeViewState extends RiderState {
  handles: { id: HandleId; point: Point }[]
  /** The handle last touched, drawn larger. */
  selected: HandleId | null
  volumes: RuleVolume[]
}

/** What the screen hears about a handle pull. */
export interface HandleListener {
  begin(id: HandleId): void
  /** The finger wants the dot at `target` (canvas pixels). */
  move(id: HandleId, target: ScreenPoint, project: Project): void
  /** `tapped` when the finger let go without really moving. */
  end(id: HandleId, tapped: boolean): void
}

export interface ShapeView {
  show(state: ShapeViewState): void
  frame(dt: number): void
  setSheetHeight(px: number): void
  setHandleListener(listener: HandleListener): void
  dispose(): void
}


/**
 * The camera looks at this height, m, while the head sits at or below
 * `headY`; a taller figure (a skater standing up) lifts the view by `follow`
 * of the extra height, so the head stays clear of the chips at the top.
 */
const FRAME = { lookY: 0.72, headY: 1.2, follow: 0.7 }

/**
 * A ski jumper is longer than a bike (skis and all, about 3 m nose to tail),
 * so the camera starts further back, looking at the middle of the flight.
 * Riders and skaters get the usual view back when the sport changes.
 */
const VIEWS = {
  usual: { target: { x: 0.1, y: 0.72 }, camera: { x: 1.15, y: 1.05, z: 2.6 } },
  jumper: { target: { x: -0.45, y: 0.85 }, camera: { x: 0.6, y: 2.2, z: 3 } },
  // A sled from ahead and above, so the crew show over the cowling; the four-man is longer.
  sled: { target: { x: 0, y: 0.4 }, camera: { x: 1.9, y: 1.7, z: 2.5 } },
  sled4: { target: { x: -0.2, y: 0.4 }, camera: { x: 2.4, y: 2.1, z: 3.2 } },
}

export function createShapeView(host: HTMLElement): ShapeView {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.setAttribute('role', 'img')
  renderer.domElement.setAttribute('aria-label', 'The rider and bike you are shaping')
  host.prepend(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COLOURS.background)
  const camera = new THREE.PerspectiveCamera(PORTRAIT_FOV, 1, 0.05, 30)
  camera.position.set(VIEWS.usual.camera.x, VIEWS.usual.camera.y, VIEWS.usual.camera.z)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(VIEWS.usual.target.x, VIEWS.usual.target.y, 0)
  controls.enableDamping = true
  controls.enablePan = false
  controls.minDistance = 1.2
  controls.maxDistance = 5
  controls.minPolarAngle = 0.2
  controls.maxPolarAngle = Math.PI / 2 - 0.03
  controls.update()

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c2cb, 1.7))
  const key = new THREE.DirectionalLight(0xffffff, 1.5)
  key.position.set(1.5, 3, 2.5)
  scene.add(key)

  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.6, 64), new THREE.MeshStandardMaterial({ color: COLOURS.floor, roughness: 0.95 }))
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)
  const grid = new THREE.GridHelper(5, 20, COLOURS.grid, COLOURS.grid)
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity = 0.3
  grid.position.y = 0.002
  scene.add(grid)

  // --- Materials, shared and reused across rebuilds.
  const M = {
    // Handles and the rule box draw on top, unlit, so they read from any angle.
    handle: new THREE.MeshBasicMaterial({ color: COLOURS.handle, depthTest: false, transparent: true }),
    handleRing: new THREE.MeshBasicMaterial({ color: COLOURS.handleRing, depthTest: false, transparent: true }),
    rules: new THREE.MeshBasicMaterial({ color: COLOURS.rules, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }),
    rulesEdge: new THREE.LineBasicMaterial({ color: COLOURS.rules, transparent: true, opacity: 0.45 }),
    rulesBroken: new THREE.MeshBasicMaterial({ color: COLOURS.broken, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    rulesBrokenEdge: new THREE.LineBasicMaterial({ color: COLOURS.broken, transparent: true, opacity: 0.8 }),
  }

  let figure = new THREE.Group()
  scene.add(figure)
  /** Which view the camera was last set up for. */
  let framed: keyof typeof VIEWS = 'usual'

  function build(state: ShapeViewState): THREE.Group {
    const g = buildRider(state)
    const isBroken = (h: Highlight) => state.broken.includes(h)

    // The rule box: where the hands and the helmet must stay.
    for (const vol of state.volumes) {
      const broken = isBroken(vol.id)
      const box = new THREE.BoxGeometry(vol.size.x, vol.size.y, vol.size.z)
      const solid = new THREE.Mesh(box, broken ? M.rulesBroken : M.rules)
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), broken ? M.rulesBrokenEdge : M.rulesEdge)
      for (const o of [solid, edges]) {
        o.position.copy(v3(vol.centre))
        o.rotation.z = (vol.pitchDeg * Math.PI) / 180
        o.renderOrder = 5
        g.add(o)
      }
    }

    // Drag handles: a cobalt dot in a white ring, on top of everything.
    for (const h of state.handles) {
      const big = h.id === state.selected ? 1.35 : 1
      const ring = ball(v3(h.point), 0.034 * big, M.handleRing)
      ring.renderOrder = 10
      const dot = ball(v3(h.point), 0.024 * big, M.handle)
      dot.renderOrder = 11
      g.add(ring, dot)
    }
    return g
  }

  // --- Handles: grab one with a press near it; anything else orbits.
  const canvas = renderer.domElement
  let handles: ShapeViewState['handles'] = []
  let listener: HandleListener | null = null
  let drag: { id: HandleId; pointer: number; offX: number; offY: number; downX: number; downY: number; moved: boolean } | null = null
  const tmp = new THREE.Vector3()
  /** World point to canvas pixels, through the camera as drawn. */
  const project: Project = (p) => {
    tmp.set(p.x, p.y, p.z).project(camera)
    return { x: ((tmp.x + 1) / 2) * canvas.clientWidth, y: ((1 - tmp.y) / 2) * canvas.clientHeight }
  }
  const local = (e: PointerEvent): ScreenPoint => {
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const nearest = (at: ScreenPoint): { id: HandleId; screen: ScreenPoint } | null => {
    let best: { id: HandleId; screen: ScreenPoint } | null = null
    let bestD = HANDLE_TOUCH.hitPx
    for (const h of handles) {
      const s = project(h.point)
      const d = Math.hypot(s.x - at.x, s.y - at.y)
      if (d <= bestD) {
        bestD = d
        best = { id: h.id, screen: s }
      }
    }
    return best
  }
  // Capture phase on the host runs before the camera controls see the press.
  host.addEventListener(
    'pointerdown',
    (e) => {
      if (!listener || e.target !== canvas || !e.isPrimary || drag) return
      const at = local(e)
      const hit = nearest(at)
      if (!hit) return
      e.stopPropagation()
      e.preventDefault()
      canvas.setPointerCapture(e.pointerId)
      drag = { id: hit.id, pointer: e.pointerId, offX: hit.screen.x - at.x, offY: hit.screen.y - at.y, downX: at.x, downY: at.y, moved: false }
      listener.begin(hit.id)
    },
    { capture: true },
  )
  canvas.addEventListener('pointermove', (e) => {
    const at = local(e)
    if (!drag) {
      // Desktop: show a hand over a handle.
      if (e.pointerType === 'mouse' && e.buttons === 0) canvas.style.cursor = nearest(at) ? 'grab' : ''
      return
    }
    if (e.pointerId !== drag.pointer) return
    if (!drag.moved && Math.hypot(at.x - drag.downX, at.y - drag.downY) < HANDLE_TOUCH.tapPx) return
    drag.moved = true
    canvas.style.cursor = 'grabbing'
    listener?.move(drag.id, { x: at.x + drag.offX, y: at.y + drag.offY }, project)
  })
  const release = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return
    const { id, moved } = drag
    drag = null
    canvas.style.cursor = ''
    resize()
    listener?.end(id, !moved && e.type === 'pointerup')
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)

  let sheetPx = 0
  const resize = () => {
    const w = host.clientWidth || 1
    const h = host.clientHeight || 1
    renderer.setSize(w, h, false)
    // The rider is framed in the space above the sheet: the camera draws a
    // taller picture (window plus sheet), we show its lower part, and the
    // field of view is set so the space above the sheet sees the whole bike.
    const sheet = Math.min(sheetPx, h * 0.7)
    const top = Math.min(HEADER_PX, h * 0.1)
    const above = Math.max(1, h - sheet - top)
    const full = h + sheet - top
    const tanHalf = Math.max(Math.tan((PORTRAIT_FOV * Math.PI) / 360), MIN_HALF_WIDTH / (w / above))
    camera.fov = (360 / Math.PI) * Math.atan(tanHalf * (full / above))
    camera.aspect = w / full
    camera.setViewOffset(w, full, 0, sheet - top, w, h)
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  return {
    show(state) {
      scene.remove(figure)
      disposeGroup(figure)
      figure = build(state)
      scene.add(figure)
      handles = state.handles
      const d = state.design
      const want: keyof typeof VIEWS = d.sport === 'skijump' ? 'jumper' : d.sport === 'bobsled' ? (d.crew === 4 ? 'sled4' : 'sled') : 'usual'
      if (want !== framed) {
        framed = want
        const v = VIEWS[want]
        controls.target.set(v.target.x, v.target.y, 0)
        camera.position.set(v.camera.x, v.camera.y, v.camera.z)
        controls.update()
      }
      if (want !== 'usual') return
      // Keep a tall figure's head in view: the look point and the camera rise together.
      const lookY = FRAME.lookY + Math.max(0, state.pose.head.y - FRAME.headY) * FRAME.follow
      const rise = lookY - controls.target.y
      if (Math.abs(rise) > 0.005) {
        controls.target.y += rise
        camera.position.y += rise
      }
    },
    frame() {
      controls.update()
      renderer.render(scene, camera)
    },
    setSheetHeight(px) {
      sheetPx = px
      // Don't reframe under a finger mid-pull; it catches up on release.
      if (!drag) resize()
    },
    setHandleListener(l) {
      listener = l
    },
    dispose() {
      observer.disconnect()
      disposeGroup(figure)
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
