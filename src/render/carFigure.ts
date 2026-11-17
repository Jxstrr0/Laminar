/**
 * The racing car as a three.js group (PR 9j), drawn from the design at full
 * size. The shell is lofted from the very cross-sections the drag model
 * reads (src/sim/geom/car.ts), so a lower ride height on screen is a lower
 * floor in the sim. The aero parts are drawn in the model shop's teal so
 * they read at a glance: the front wing (a splitter flap on a touring car),
 * the rear wing at its angle and chord, the floor with its rake, the
 * diffuser, the edge seals and the cooling inlets.
 *
 * Built nose along +x, wheels on y = 0, +z to the right, centred on the
 * car's middle, as the truck is. A part the rulebook forbids glows red; a
 * part behind a warning (porpoising, balance, heat) glows amber.
 */
import * as THREE from 'three'
import { MODEL } from './theme'
import { CAR_BODY, CAR_CLASS, type CarDesign } from '../data/car'
import { carLength, carStation, carX, floorAt, carAxis } from '../sim/geom/car'
import type { Highlight } from './riderFigure'

const COLOURS = {
  body: 0xf2f4f6,
  tub: 0xe6ebef,
  dark: 0x2a3a47,
  tyre: MODEL.tyre,
  hub: 0x8c97a1,
  part: MODEL.panel,
  helmet: MODEL.helmet,
  broken: MODEL.broken,
  strain: MODEL.strain,
}

const mat = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide })
const M = {
  body: mat(COLOURS.body, 0.35, 0.05),
  dark: mat(COLOURS.dark, 0.2, 0.3),
  tyre: mat(COLOURS.tyre, 0.9),
  hub: mat(COLOURS.hub, 0.35, 0.5),
  part: mat(COLOURS.part, 0.4, 0.1),
  helmet: mat(COLOURS.helmet, 0.3),
  broken: new THREE.MeshStandardMaterial({ color: COLOURS.broken, emissive: COLOURS.broken, emissiveIntensity: 0.35, roughness: 0.5, side: THREE.DoubleSide }),
  strain: new THREE.MeshStandardMaterial({ color: COLOURS.strain, emissive: COLOURS.strain, emissiveIntensity: 0.25, roughness: 0.6, side: THREE.DoubleSide }),
}

/** Fixed sizes for the drawing only (the sim doesn't read these). */
const DRAW = {
  touring: { track: 0.82, tyre: 0.27, floorHalf: 0.78, wingPosts: 0.45, frontSpan: 1.8, frontChord: 0.28 },
  open: { track: 0.82, tyre: 0.36, floorHalf: 0.7, wingPosts: 0.25, frontSpan: 1.75, frontChord: 0.3 },
  /** Ring points round each lofted section. */
  ring: 20,
}

export interface CarLook {
  broken: Highlight[]
  strained: Highlight[]
}

/** The shell, lofted from the drag model's own sections: a rounded box (touring) or a slim tub (single-seater). */
function shell(design: CarDesign): THREE.Mesh {
  const len = carLength(design)
  const axis = carAxis(design)
  const n = DRAW.ring
  // Higher powers make squarer sections.
  const power = design.class === 'touring' ? 4 : 2.4
  const positions: number[] = []
  const index: number[] = []
  const steps = 40
  for (let i = 0; i <= steps; i++) {
    const s = carStation(design, (len * i) / steps)
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      const c = Math.cos(a)
      const sn = Math.sin(a)
      const shape = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 2 / power)
      const y = sn >= 0 ? axis + s.top * shape(sn) : axis - s.bottom * Math.abs(shape(sn))
      positions.push(carX(design, s.x), y, s.half * shape(c))
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let k = 0; k < n; k++) {
      const a = i * n + k
      const b = i * n + ((k + 1) % n)
      index.push(a, a + n, b, b, a + n, b + n)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, M.body)
}

/** A box between two sim x positions, heights and a centre across. */
function slab(design: CarDesign, x0: number, x1: number, y0: number, y1: number, width: number, z: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.001, x1 - x0), Math.max(0.001, y1 - y0), width), material)
  mesh.position.set(carX(design, (x0 + x1) / 2), (y0 + y1) / 2, z)
  return mesh
}

/**
 * A wing: a thin cambered plate of the given span and chord, its leading
 * edge at sim x, tilted nose-down by the angle (downforce), with endplates.
 */
function wing(design: CarDesign, x: number, y: number, span: number, chord: number, angleDeg: number, material: THREE.Material, plates = true): THREE.Group {
  const g = new THREE.Group()
  const plate = new THREE.Mesh(new THREE.BoxGeometry(chord, Math.max(0.012, chord * 0.08), span), material)
  // Pivot at the leading edge: the trailing edge rises as the angle grows.
  plate.position.set(-chord / 2, 0, 0)
  const pivot = new THREE.Group()
  pivot.add(plate)
  pivot.rotation.z = (-angleDeg * Math.PI) / 180
  pivot.position.set(carX(design, x), y, 0)
  g.add(pivot)
  if (plates) {
    const rise = Math.sin((angleDeg * Math.PI) / 180) * chord
    for (const side of [-1, 1]) {
      const end = new THREE.Mesh(new THREE.BoxGeometry(chord * 1.15, 0.14 + rise, 0.015), material)
      end.position.set(carX(design, x + chord / 2), y + rise / 2, (side * span) / 2)
      g.add(end)
    }
  }
  return g
}

function wheelPair(design: CarDesign, x: number, track: number, width: number, radius: number): THREE.Group {
  const g = new THREE.Group()
  for (const side of [-1, 1]) {
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 28).rotateX(Math.PI / 2), M.tyre)
    tyre.position.set(carX(design, x), radius, side * track)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.01, 16).rotateX(Math.PI / 2), M.hub)
    hub.position.copy(tyre.position)
    g.add(tyre, hub)
  }
  return g
}

export function buildCar(design: CarDesign, look: CarLook): THREE.Group {
  const g = new THREE.Group()
  const tint = (h: Highlight) => (look.broken.includes(h) ? M.broken : look.strained.includes(h) ? M.strain : M.part)
  const b = CAR_BODY[design.class]
  const c = CAR_CLASS[design.class]
  const d = DRAW[design.class]
  const touring = design.class === 'touring'
  const len = carLength(design)

  g.add(shell(design))

  // The floor: a flat plate from just behind the nose to the rear axle, following the ride heights (rake).
  const floorMat = tint('floor')
  const f0 = b.frontAxle - 0.35
  const f1 = b.rearAxle
  const v = (x: number, y: number, z: number) => new THREE.Vector3(carX(design, x), y, z)
  const quad = (p: THREE.Vector3[], material: THREE.Material) => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([p[0]!, p[1]!, p[2]!, p[0]!, p[2]!, p[3]!].flatMap((q) => [q.x, q.y, q.z]), 3))
    geo.computeVertexNormals()
    return new THREE.Mesh(geo, material)
  }
  const h = d.floorHalf
  const y0 = floorAt(design, f0)
  const y1 = floorAt(design, f1)
  g.add(quad([v(f0, y0, -h), v(f0, y0, h), v(f1, y1, h), v(f1, y1, -h)], floorMat))
  // The diffuser: the floor kicks up behind the rear axle at its angle.
  const run = Math.min(len - f1, 0.9)
  const kick = Math.tan((design.diffuser * Math.PI) / 180) * run
  g.add(quad([v(f1, y1, -h), v(f1, y1, h), v(f1 + run, y1 + kick, h), v(f1 + run, y1 + kick, -h)], floorMat))
  // Edge seals: fins down the floor's sides, deeper the better the seal.
  if (design.floorEdge > 0.01) {
    const depth = 0.01 + design.floorEdge * 0.035
    for (const side of [-1, 1]) g.add(quad([v(f0 + 0.3, y0 + 0.3 * ((y1 - y0) / (f1 - f0)), side * h), v(f1, y1, side * h), v(f1, y1 - depth, side * h), v(f0 + 0.3, y0 - depth, side * h)], floorMat))
  }

  // Cooling inlets: dark mouths on each side, as tall as their size.
  const inletMat = look.strained.includes('inlet') ? M.strain : M.dark
  const inletH = 0.08 + design.inlet * 0.14
  if (touring) {
    // A grille in the nose.
    const grille = slab(design, 0.02, 0.08, 0.28, 0.28 + inletH, 1.1, 0, inletMat)
    g.add(grille)
  } else {
    // Sidepods either side of the tub, with their inlets facing forward.
    const podFrom = b.frontAxle + 0.95
    const podTo = b.rearAxle - 0.5
    const podTop = floorAt(design, podFrom) + 0.42
    for (const side of [-1, 1]) {
      g.add(slab(design, podFrom, podTo, floorAt(design, podFrom) + 0.02, podTop, 0.42, side * 0.52, M.body))
      g.add(slab(design, podFrom - 0.01, podFrom + 0.02, podTop - inletH - 0.04, podTop - 0.04, 0.3, side * 0.52, inletMat))
    }
    // The driver's helmet in the cockpit, and the airbox above it.
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12), M.helmet)
    helmet.position.set(carX(design, len * 0.43), b.roof - 0.12, 0)
    g.add(helmet)
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.152, 18, 12, -0.6, 1.2, 1.1, 0.5), M.dark)
    visor.position.copy(helmet.position)
    g.add(visor)
  }

  if (touring) {
    // Glass: the windscreen and side windows as a dark band round the cabin.
    const g0 = len * b.roofFrom
    const g1 = len * b.roofTo
    const glass = slab(design, g0 + 0.15, g1 - 0.1, b.roof - 0.38, b.roof - 0.06, b.width * 0.86, 0, M.dark)
    g.add(glass)
  }

  // The front wing: a splitter with a flap under a touring car's nose, a full wing ahead of a single-seater's wheels.
  const fwMat = tint('front-wing')
  if (touring) {
    const sy = design.ride.front + 0.02
    g.add(quad([v(0, sy, -0.9), v(0, sy, 0.9), v(0.6, sy, 0.9), v(0.6, sy, -0.9)], fwMat))
    g.add(wing(design, -0.02, sy + 0.03, d.frontSpan, d.frontChord * 0.6, design.frontWing, fwMat, false))
  } else {
    const wy = c.frontWing.height + design.ride.front * 0.5
    g.add(wing(design, 0.05, wy, d.frontSpan, d.frontChord, design.frontWing, fwMat))
  }

  // The rear wing on its posts, at its angle and chord.
  const rwMat = tint('rear-wing')
  const rx = len - design.rearWing.chord - (touring ? 0.05 : 0.0)
  const ry = touring ? 1.12 + (design.ride.rear - 0.1) : 0.9 + design.ride.rear
  g.add(wing(design, rx, ry, c.rearSpan, design.rearWing.chord, design.rearWing.angle, rwMat))
  for (const side of [-1, 1]) g.add(slab(design, rx + 0.05, rx + 0.12, ry - (touring ? d.wingPosts : 0.45), ry, 0.03, side * 0.25, M.dark))

  // Wheels: inside the arches on a touring car, out in the air on a single-seater.
  g.add(wheelPair(design, b.frontAxle, d.track, d.tyre, b.wheel), wheelPair(design, b.rearAxle, d.track, d.tyre + (touring ? 0 : 0.06), b.wheel))
  return g
}
