/**
 * The survey drone as a three.js group (PR 10j), drawn from the design at
 * full size. The fuselage and the camera pod are lofted from the very
 * cross-sections their outline gives the drag model (src/sim/geom/plane.ts).
 * The parts the firm shapes are drawn in the instruments' cobalt so they
 * read at a glance: the nose, the tail cone, the tail, the camera pod and
 * the winglets. The wing, the fuselage's middle and the pusher motor are the
 * maker's, in white foam and grey.
 *
 * Built nose along +x, +z to the right, the wing's middle at the origin,
 * the fuselage's axis lifted to its stand height. On the Shape stage it sits
 * on a thin stand. A part behind a warning (a gust stall, a camera that
 * sees the belly) glows amber.
 */
import * as THREE from 'three'
import { PLANE_BODY as B, PLANE_CLASS, type PlaneDesign } from '../data/plane'
import { fuselageStation, planeLength, planeX, podFullness, podPlace, wingFrom } from '../sim/geom/plane'
import type { Highlight } from './riderFigure'

const COLOURS = {
  foam: 0xf3f5f7,
  grey: 0x8c97a1,
  dark: 0x2a3a47,
  prop: 0x5a6875,
  lens: 0x13202b,
  part: 0x2456e8,
  broken: 0xd2462b,
  strain: 0xe08a00,
}

const mat = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide })
const M = {
  foam: mat(COLOURS.foam, 0.8),
  grey: mat(COLOURS.grey, 0.4, 0.4),
  dark: mat(COLOURS.dark, 0.5, 0.2),
  prop: new THREE.MeshStandardMaterial({ color: COLOURS.prop, roughness: 0.5, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  lens: mat(COLOURS.lens, 0.15, 0.5),
  part: mat(COLOURS.part, 0.45, 0.1),
  broken: new THREE.MeshStandardMaterial({ color: COLOURS.broken, emissive: COLOURS.broken, emissiveIntensity: 0.35, roughness: 0.5, side: THREE.DoubleSide }),
  strain: new THREE.MeshStandardMaterial({ color: COLOURS.strain, emissive: COLOURS.strain, emissiveIntensity: 0.25, roughness: 0.6, side: THREE.DoubleSide }),
}

/** Fixed sizes for the drawing only (the sim doesn't read these). */
const DRAW = {
  /** Ring points round each lofted section, and sections per metre of fuselage. */
  ring: 24,
  perMetre: 40,
  /** How square sections are drawn: 1 round, smaller squarer. */
  squarePow: 0.8,
  podPow: 0.5,
  /** The airfoil's points along its chord, and the wing's and the tail's thickness as a share of chord. */
  foilPoints: 14,
  wingThick: 0.12,
  tailThick: 0.09,
  /** A winglet's chord at its root and tip, as a share of the wing's chord. */
  wingletRoot: 0.7,
  wingletTip: 0.4,
  /** The stand: its pole's radius and its foot's radius and height, m, and where it meets the fuselage, as a share of the tail cone. */
  pole: 0.012,
  foot: 0.16,
  footHeight: 0.02,
  standAt: 0.15,
  /** The motor's radius and length, m. */
  motor: 0.025,
  motorLength: 0.08,
}

export interface PlaneLook {
  broken: Highlight[]
  strained: Highlight[]
  /** Leave the stand out (in flight, from a later PR). */
  noStand?: boolean
}

const squarish = (v: number, pow: number) => Math.sign(v) * Math.pow(Math.abs(v), pow)

/** A loft along x through sections (x, top, bottom, half), centred on the axis at height `y0`. */
export function loft(sections: { x: number; top: number; bottom: number; half: number }[], pow: number, material: THREE.Material, closeEnds = true): THREE.Mesh {
  const n = DRAW.ring
  const positions: number[] = []
  const index: number[] = []
  for (const s of sections) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      const sin = Math.sin(a)
      positions.push(s.x, (sin >= 0 ? s.top : s.bottom) * squarish(sin, pow), s.half * squarish(Math.cos(a), pow))
    }
  }
  const steps = sections.length - 1
  for (let i = 0; i < steps; i++) {
    for (let k = 0; k < n; k++) {
      const a = i * n + k
      const c = i * n + ((k + 1) % n)
      index.push(a, a + n, c, c, a + n, c + n)
    }
  }
  if (closeEnds) {
    for (const end of [0, steps]) {
      const centre = positions.length / 3
      positions.push(sections[end]!.x, 0, 0)
      for (let k = 0; k < n; k++) index.push(centre, end * n + k, end * n + ((k + 1) % n))
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, material)
}

/** A symmetric airfoil (the NACA four-digit thickness), leading edge at x = 0 running to −chord, for extruding along its span. */
export function foil(chord: number, thick: number): THREE.Shape {
  const shape = new THREE.Shape()
  const pts: [number, number][] = []
  for (let i = 0; i <= DRAW.foilPoints; i++) {
    const u = (1 - Math.cos((i / DRAW.foilPoints) * Math.PI)) / 2
    const t = 5 * thick * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1036 * u ** 4)
    pts.push([u, t])
  }
  shape.moveTo(0, 0)
  for (const [u, t] of pts) shape.lineTo(-u * chord, t * chord)
  for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(-pts[i]![0] * chord, -pts[i]![1] * chord)
  return shape
}

/** A surface of `span` along +z from its root, the foil's chord along x (leading edge at x = 0). */
export function surface(chord: number, span: number, thick: number, material: THREE.Material, tipChord = chord): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(foil(chord, thick), { depth: span, bevelEnabled: false, steps: 1 })
  if (tipChord !== chord) {
    // Taper: pull the far end's points back towards the leading edge.
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i)
      const k = 1 + ((tipChord / chord - 1) * z) / span
      pos.setX(i, pos.getX(i) * k)
      pos.setY(i, pos.getY(i) * k)
    }
    geo.computeVertexNormals()
  }
  return new THREE.Mesh(geo, material)
}

export function buildPlane(design: PlaneDesign, look: PlaneLook): THREE.Group {
  const outer = new THREE.Group()
  const g = new THREE.Group()
  outer.add(g)
  g.position.y = B.stand
  const tint = (h: Highlight, base: THREE.Material) => (look.broken.includes(h) ? M.broken : look.strained.includes(h) ? M.strain : base)
  const c = PLANE_CLASS[design.class]
  const len = planeLength(design)
  const nose = design.fuselage.nose
  const conesFrom = nose + B.mid

  // The fuselage in three lofts: the nose and the tail cone (shaped, cobalt) either side of the maker's middle.
  const sections = (from: number, to: number) => {
    const n = Math.max(2, Math.ceil((to - from) * DRAW.perMetre))
    const out = []
    for (let i = 0; i <= n; i++) {
      const x = from + ((to - from) * i) / n
      const s = fuselageStation(design, x)
      out.push({ x: planeX(design, x), top: s.top, bottom: s.bottom, half: s.half })
    }
    return out
  }
  g.add(loft(sections(0, nose), DRAW.squarePow, tint('nose', M.part)))
  g.add(loft(sections(nose, conesFrom), DRAW.squarePow, M.foam, false))
  g.add(loft(sections(conesFrom, len), DRAW.squarePow, tint('boat-tail', M.part)))

  // The wing on top, each half from the fuselage's middle out to its tip, with a little dihedral.
  const wingLead = planeX(design, wingFrom(design))
  const halfSpan = c.span / 2
  const dihedral = (B.dihedral * Math.PI) / 180
  for (const side of [1, -1]) {
    const half = new THREE.Group()
    half.position.set(wingLead, B.halfHeight, 0)
    half.rotation.x = -side * dihedral
    const w = surface(B.chord, halfSpan, DRAW.wingThick, M.foam)
    if (side < 0) w.scale.z = -1
    half.add(w)
    // The winglet turned up at the tip, swept back a little and tapering.
    if (design.winglets >= 0.005) {
      const wl = surface(B.chord * DRAW.wingletRoot, design.winglets, DRAW.tailThick, tint('winglets', M.part), B.chord * DRAW.wingletTip)
      wl.rotation.x = -Math.PI / 2
      wl.position.set(-B.chord * (1 - DRAW.wingletRoot), 0, side * halfSpan)
      half.add(wl)
    }
    g.add(half)
  }

  // The tail at the cone's end: its size grows with the square root of the tail's share (its area with the share).
  const k = Math.sqrt(design.tail)
  const tailChord = B.tailChord * k
  const tailEndX = planeX(design, len)
  const tailMat = tint('fin', M.part)
  for (const side of [1, -1]) {
    const tp = surface(tailChord, (B.tailSpan * k) / 2, DRAW.tailThick, tailMat, tailChord * 0.75)
    if (side < 0) tp.scale.z = -1
    tp.position.set(tailEndX + tailChord * 1.05, 0, 0)
    g.add(tp)
  }
  const fin = surface(B.finChord * k, B.finHeight * k, DRAW.tailThick, tailMat, B.finChord * k * 0.6)
  fin.rotation.x = -Math.PI / 2
  fin.position.set(tailEndX + B.finChord * k * 1.05, 0, 0)
  g.add(fin)

  // The pusher motor on its pylon behind the wing, its prop a faint disc.
  const motorX = wingLead - B.chord - DRAW.motorLength * 0.3
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.05, B.pylon, 0.012), M.grey)
  pylon.position.set(motorX + 0.03, B.halfHeight + B.pylon / 2, 0)
  g.add(pylon)
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(DRAW.motor, DRAW.motor * 0.8, DRAW.motorLength, 16).rotateZ(Math.PI / 2), M.dark)
  motor.position.set(motorX, B.halfHeight + B.pylon, 0)
  g.add(motor)
  const prop = new THREE.Mesh(new THREE.CircleGeometry(B.prop, 32).rotateY(Math.PI / 2), M.prop)
  prop.position.set(motorX - DRAW.motorLength / 2 - 0.01, motor.position.y, 0)
  g.add(prop)

  // The camera pod under the belly, on its mount, its lens looking down.
  const pod = podPlace(design)
  const podFront = planeX(design, pod.x - pod.length / 2)
  const h = B.pod.height / 2
  const w = B.pod.width / 2
  const pn = 14
  const podSections = []
  for (let i = 0; i <= pn; i++) {
    const x = (pod.length * i) / pn
    const f = podFullness(design, x)
    podSections.push({ x: podFront - x, top: h * f, bottom: h * f, half: w * f })
  }
  const podMesh = loft(podSections, DRAW.podPow, tint('pod', M.part))
  podMesh.position.y = (pod.top + pod.bottom) / 2
  g.add(podMesh)
  const lens = new THREE.Mesh(new THREE.CircleGeometry(h * 0.55, 20).rotateX(Math.PI / 2), M.lens)
  lens.position.set(planeX(design, pod.x), pod.bottom - 0.001, 0)
  g.add(lens)
  // On its mount, a short strut from the belly down to the pod's top.
  const gap = -B.halfHeight - pod.top
  if (gap > 0.002) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(B.pod.length * 0.4, gap, 0.012), M.dark)
    strut.position.set(planeX(design, pod.x), pod.top + gap / 2, 0)
    g.add(strut)
  }

  // On the stage, a thin stand from the floor up to the fuselage behind the pod.
  if (!look.noStand) {
    const at = planeX(design, conesFrom + B.cone * DRAW.standAt)
    const bottom = fuselageStation(design, conesFrom + B.cone * DRAW.standAt).bottom
    const tall = B.stand - bottom
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(DRAW.pole, DRAW.pole, tall, 12), M.grey)
    pole.position.set(at, tall / 2, 0)
    outer.add(pole)
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(DRAW.foot, DRAW.foot, DRAW.footHeight, 32), M.dark)
    foot.position.set(at, DRAW.footHeight / 2, 0)
    outer.add(foot)
  }
  return outer
}
