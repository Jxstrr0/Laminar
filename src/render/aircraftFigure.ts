/**
 * The kit plane as a three.js group (PR 10q), drawn from the design at full
 * size, standing on its wheels. The fuselage and the client's pod are
 * lofted from the very cross-sections their outline gives the drag model
 * (src/sim/geom/aircraft.ts). The mods the firm shapes are drawn in the
 * instruments' cobalt so they read at a glance: the cowl, the wheel spats,
 * the wingtips, the strut fairings and the pod. The kit's own parts (cabin,
 * wing, tail, bare struts and wheels) are white and grey.
 *
 * Built nose along +x, +z to the right wing, the wing's middle at x = 0,
 * the ground at y = 0. A part behind a warning (a stall speed over the
 * certified one) glows amber.
 */
import * as THREE from 'three'
import { AIRCRAFT_BODY as B, AIRCRAFT_CLASS, type AircraftDesign } from '../data/aircraft'
import { aircraftLength, aircraftX, cowlFront, fuselageStation, podFullness, podPlace } from '../sim/geom/aircraft'
import { loft, surface } from './planeFigure'
import type { Highlight } from './riderFigure'

const COLOURS = {
  white: 0xf3f5f7,
  grey: 0x8c97a1,
  dark: 0x2a3a47,
  tyre: 0x1e252c,
  glass: 0x3b5266,
  prop: 0x5a6875,
  part: 0x2456e8,
  broken: 0xd2462b,
  strain: 0xe08a00,
}

const mat = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide })
const M = {
  white: mat(COLOURS.white, 0.5),
  grey: mat(COLOURS.grey, 0.4, 0.4),
  dark: mat(COLOURS.dark, 0.5, 0.2),
  tyre: mat(COLOURS.tyre, 0.9),
  glass: mat(COLOURS.glass, 0.15, 0.3),
  prop: new THREE.MeshStandardMaterial({ color: COLOURS.prop, roughness: 0.5, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  part: mat(COLOURS.part, 0.45, 0.1),
  broken: new THREE.MeshStandardMaterial({ color: COLOURS.broken, emissive: COLOURS.broken, emissiveIntensity: 0.35, roughness: 0.5, side: THREE.DoubleSide }),
  strain: new THREE.MeshStandardMaterial({ color: COLOURS.strain, emissive: COLOURS.strain, emissiveIntensity: 0.25, roughness: 0.6, side: THREE.DoubleSide }),
}

/** Fixed sizes for the drawing only (the sim doesn't read these). */
const DRAW = {
  /** Sections per metre of fuselage, and how square its sections are drawn (1 round, smaller squarer). */
  perMetre: 12,
  squarePow: 0.7,
  podPow: 0.6,
  tailThick: 0.1,
  /** A spat's shortest, as a share of a full one, and how far above the axle it sits, m. */
  spatMin: 0.35,
  spatLift: 0.08,
  /** A main leg's width and thickness, m, and the nose leg's radius, m. */
  legWidth: 0.08,
  legThick: 0.025,
  noseLeg: 0.03,
  /** The inlets on the cowl's front: their radius on the kit's loose cowl, m, and how far out from the middle, as a share of the front's half-width. */
  inlet: 0.13,
  inletOut: 0.55,
  /** The windscreen: how far back from the cowl it reaches, m. */
  screen: 0.6,
  /** A square tip's thickness, m (a rounded one is the tip cap). */
  squareTip: 0.04,
  /** A tunnel model's prop blades: thickness along the axis and chord, m. */
  bladeThick: 0.03,
  blade: 0.12,
}

export interface AircraftLook {
  broken: Highlight[]
  strained: Highlight[]
  /**
   * How the prop is drawn (PR 10s): a faint disc as it flies (the default),
   * or two blades on a tunnel model, still or driven. Driven blades are
   * named 'prop-rotor' for the tunnel scene to turn.
   */
  props?: 'disc' | 'stopped' | 'spinning'
}

/** A rod or flattened rod from `a` to `b`: `w` across the flow (its chord along x), `d` thick, turned `toe` radians about its own length. */
function rod(a: THREE.Vector3, b: THREE.Vector3, w: number, d: number, material: THREE.Material, toe = 0): THREE.Mesh {
  const dir = b.clone().sub(a)
  const len = dir.length()
  const geo = new THREE.CylinderGeometry(1, 1, len, 16)
  geo.scale(w / 2, 1, d / 2)
  geo.rotateY(toe)
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  return mesh
}

export function buildAircraft(design: AircraftDesign, look: AircraftLook): THREE.Group {
  const g = new THREE.Group()
  const tint = (h: Highlight, base: THREE.Material) => (look.broken.includes(h) ? M.broken : look.strained.includes(h) ? M.strain : base)
  const c = AIRCRAFT_CLASS[design.class]
  const len = aircraftLength()
  const ax = B.axis

  // The fuselage: the spinner, the cowl (shaped, cobalt), the cabin and the tail cone.
  const sections = (from: number, to: number) => {
    const n = Math.max(2, Math.ceil((to - from) * DRAW.perMetre))
    const out = []
    for (let i = 0; i <= n; i++) {
      const x = from + ((to - from) * i) / n
      const s = fuselageStation(design, x)
      out.push({ x: aircraftX(x), top: s.top, bottom: s.bottom, half: s.half })
    }
    return out
  }
  const lift = (m: THREE.Mesh) => {
    m.position.y = ax
    g.add(m)
    return m
  }
  lift(loft(sections(0, B.spinner.length), 1, M.grey, false))
  lift(loft(sections(B.spinner.length, B.cowl), DRAW.squarePow, tint('nose', M.part)))
  lift(loft(sections(B.cowl, len), DRAW.squarePow, M.white))

  // The cooling inlets either side of the spinner: big on the kit's cowl, small on a tight one.
  const front = cowlFront(design)
  const inletR = DRAW.inlet * (1 - 0.6 * design.cowling)
  for (const side of [1, -1]) {
    const inlet = new THREE.Mesh(new THREE.CircleGeometry(inletR, 20).rotateY(Math.PI / 2), M.dark)
    inlet.position.set(aircraftX(B.spinner.length) + 0.005, ax - 0.04, side * B.half * front * DRAW.inletOut)
    g.add(inlet)
  }
  // The prop: a faint disc behind the spinner as it flies or turns, two blades on a tunnel model.
  const props = look.props ?? 'disc'
  const propX = aircraftX(B.spinner.length * 0.8)
  if (props !== 'stopped') {
    const prop = new THREE.Mesh(new THREE.CircleGeometry(B.prop, 40).rotateY(Math.PI / 2), M.prop)
    prop.position.set(propX, ax, 0)
    g.add(prop)
  }
  if (props !== 'disc') {
    const blades = new THREE.Group()
    blades.name = props === 'spinning' ? 'prop-rotor' : 'prop-blades'
    blades.position.set(propX, ax, 0)
    blades.rotation.x = 0.4
    blades.add(new THREE.Mesh(new THREE.BoxGeometry(DRAW.bladeThick, DRAW.blade, B.prop * 2), M.grey))
    g.add(blades)
  }

  // The windscreen: a dark pane sloping from the cowl's top up to the wing.
  const wingY = ax + B.halfHeight
  const screenFrom = new THREE.Vector3(aircraftX(B.cowl), ax + B.halfHeight * 0.9, 0)
  const screenTo = new THREE.Vector3(aircraftX(B.wingFrom), wingY, 0)
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(screenFrom.distanceTo(screenTo), B.half * 1.7), M.glass)
  pane.position.copy(screenFrom).add(screenTo).multiplyScalar(0.5)
  pane.rotation.set(Math.PI / 2, Math.atan2(screenTo.y - screenFrom.y, screenFrom.x - screenTo.x), 0, 'YXZ')
  pane.position.y += 0.01
  g.add(pane)

  // The wing on top of the cabin, each half out to its tip cap.
  const lead = aircraftX(B.wingFrom)
  const halfSpan = c.span / 2 - B.tipCap
  const thick = B.chord * B.wingThick
  for (const side of [1, -1]) {
    const w = surface(B.chord, halfSpan, B.wingThick, M.white)
    if (side < 0) w.scale.z = -1
    w.position.set(lead, wingY, 0)
    g.add(w)
    // The tip: the kit's rounded cap, or squared off (cobalt, the mod).
    const square = design.wingtips
    const capLength = B.tipCap * (1 - square) + DRAW.squareTip * square
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI), square > 0.05 ? tint('wingtips', M.part) : M.white)
    cap.scale.set(B.chord / 2, thick / 2, capLength)
    cap.rotation.y = side > 0 ? 0 : Math.PI
    cap.position.set(lead - B.chord / 2, wingY, side * halfSpan)
    g.add(cap)
  }

  // The struts, cabin to wing: the faired share from the root up (cobalt), toed into the swirl; the rest a bare tube.
  const S = B.strut
  const toe = (design.struts.toe * Math.PI) / 180
  for (const side of [1, -1]) {
    const root = new THREE.Vector3(aircraftX(S.rootX), ax - S.rootDrop, side * S.rootOut)
    const top = new THREE.Vector3(aircraftX(S.topX), wingY - thick / 2, side * S.topOut)
    const f = design.struts.fairing
    const mid = root.clone().lerp(top, f)
    if (f > 0.02) g.add(rod(root, mid, B.fairChord, B.fairThick, tint('struts', M.part), toe))
    if (f < 0.98) g.add(rod(mid, top, B.tube * 2, B.tube * 2, M.grey))
  }

  // The wheels, their legs and any spats.
  const W = B.wheel
  const wheelAt = (x: number, z: number) => {
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(W.radius, W.radius, W.width, 24).rotateX(Math.PI / 2), M.tyre)
    tyre.position.set(x, W.radius, z)
    g.add(tyre)
    if (design.spats >= 0.05) {
      const k = DRAW.spatMin + (1 - DRAW.spatMin) * design.spats
      const spat = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), tint('spats', M.part))
      spat.scale.set((B.spat.length * k) / 2, B.spat.halfHeight * (0.6 + 0.4 * design.spats), B.spat.half)
      spat.position.set(x - 0.05, W.radius + DRAW.spatLift, z)
      g.add(spat)
    }
  }
  const noseX = aircraftX(W.noseX)
  wheelAt(noseX, 0)
  g.add(rod(new THREE.Vector3(noseX, W.radius, 0), new THREE.Vector3(noseX, ax - B.halfHeight * cowlFront(design), 0), DRAW.noseLeg * 2, DRAW.noseLeg * 2, M.grey))
  const mainX = aircraftX(W.mainX)
  for (const side of [1, -1]) {
    wheelAt(mainX, side * W.mainOut)
    g.add(rod(new THREE.Vector3(mainX, W.radius, side * (W.mainOut - W.width)), new THREE.Vector3(mainX, ax - B.halfHeight * 0.85, side * B.half * 0.6), DRAW.legWidth, DRAW.legThick, M.grey))
  }

  // The tail at the cone's end.
  const tailEnd = aircraftX(len)
  for (const side of [1, -1]) {
    const tp = surface(B.tailChord, B.tailSpan / 2, DRAW.tailThick, M.white, B.tailChord * 0.75)
    if (side < 0) tp.scale.z = -1
    tp.position.set(tailEnd + B.tailChord * 0.9, ax, 0)
    g.add(tp)
  }
  const fin = surface(B.finChord, B.finHeight, DRAW.tailThick, M.white, B.finChord * 0.55)
  fin.rotation.x = -Math.PI / 2
  fin.position.set(tailEnd + B.finChord * 0.95, ax, 0)
  g.add(fin)

  // The client's pod under the right wing, on its pylon.
  const pod = podPlace(design)
  const podFront = aircraftX(pod.x - pod.length / 2)
  const r = B.pod.radius
  const podSections = []
  for (let i = 0; i <= 20; i++) {
    const x = (pod.length * i) / 20
    const f = podFullness(design, x)
    podSections.push({ x: podFront - x, top: r * f, bottom: r * f, half: r * f })
  }
  const podY = wingY - thick / 2 - B.pod.pylon - r
  const podMesh = loft(podSections, DRAW.podPow + (1 - DRAW.podPow) * design.pod.fairing, tint('pod', M.part))
  podMesh.position.set(0, podY, B.pod.out)
  g.add(podMesh)
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(pod.length * 0.4, B.pod.pylon + 0.04, 0.03), M.grey)
  pylon.position.set(aircraftX(pod.x), podY + r + B.pod.pylon / 2 - 0.02, B.pod.out)
  g.add(pylon)
  return g
}
