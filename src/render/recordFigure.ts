/**
 * The land-speed streamliner as a three.js group (PR 9q), drawn from the
 * design at full size. The body is lofted from the very cross-sections the
 * drag model reads (src/sim/geom/record.ts); the nose cone is drawn bent
 * down by its droop. The parts the firm shapes are drawn in the
 * instruments' cobalt so they read at a glance: the nose cone, the tail fin
 * and the wheel fairings; the canopy is glass.
 *
 * Built nose along +x, wheels on y = 0, +z to the right, centred on the
 * car's middle, as the truck and the racing car are. A part behind a
 * warning (a light nose, a wander, a low canopy) glows amber.
 */
import * as THREE from 'three'
import { RECORD_BODY, RECORD_CLASS, RECORD_SIDE, type RecordDesign } from '../data/record'
import { canopyAt, fullnessAt, recordAxis, recordLength, recordX } from '../sim/geom/record'
import type { Highlight } from './riderFigure'

const COLOURS = {
  body: 0xf2f4f6,
  dark: 0x2a3a47,
  glass: 0x3a5168,
  tyre: 0x1d242b,
  hub: 0x8c97a1,
  part: 0x2456e8,
  chute: 0xe08a00,
  broken: 0xd2462b,
  strain: 0xe08a00,
}

const mat = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide })
const M = {
  body: mat(COLOURS.body, 0.35, 0.05),
  dark: mat(COLOURS.dark, 0.2, 0.3),
  glass: mat(COLOURS.glass, 0.1, 0.4),
  tyre: mat(COLOURS.tyre, 0.9),
  hub: mat(COLOURS.hub, 0.35, 0.5),
  part: mat(COLOURS.part, 0.4, 0.1),
  chute: mat(COLOURS.chute, 0.6),
  broken: new THREE.MeshStandardMaterial({ color: COLOURS.broken, emissive: COLOURS.broken, emissiveIntensity: 0.35, roughness: 0.5, side: THREE.DoubleSide }),
  strain: new THREE.MeshStandardMaterial({ color: COLOURS.strain, emissive: COLOURS.strain, emissiveIntensity: 0.25, roughness: 0.6, side: THREE.DoubleSide }),
}

/** Fixed sizes for the drawing only (the sim doesn't read these). */
const DRAW = {
  /** Ring points round each lofted section, and sections along the body and the nose. */
  ring: 22,
  bodySteps: 36,
  noseSteps: 14,
  tyre: 0.18,
  /** The fin is this many times as tall as its chord, and leans back this share of its chord at the top. */
  finAspect: 1.2,
  finSweep: 0.5,
}

export interface RecordLook {
  broken: Highlight[]
  strained: Highlight[]
}

/**
 * Loft a stretch of the body between two sim x positions. `drop(x)` lowers
 * the section's centre (the nose's droop); the canopy is left off (it's
 * drawn as glass).
 */
function loft(design: RecordDesign, x0: number, x1: number, steps: number, drop: (x: number) => number, material: THREE.Material): THREE.Mesh {
  const b = RECORD_BODY[design.class]
  const half = RECORD_CLASS[design.class].body.height / 2
  const axis = recordAxis(design)
  const n = DRAW.ring
  const positions: number[] = []
  const index: number[] = []
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps
    const f = fullnessAt(design, x)
    const y0 = axis - drop(x)
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      positions.push(recordX(design, x), y0 + half * f * Math.sin(a), b.half * f * Math.cos(a))
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let k = 0; k < n; k++) {
      const a = i * n + k
      const c = i * n + ((k + 1) % n)
      index.push(a, a + n, c, c, a + n, c + n)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, material)
}

export function buildRecord(design: RecordDesign, look: RecordLook): THREE.Group {
  const g = new THREE.Group()
  const tint = (h: Highlight, base: THREE.Material) => (look.broken.includes(h) ? M.broken : look.strained.includes(h) ? M.strain : base)
  const b = RECORD_BODY[design.class]
  const body = RECORD_CLASS[design.class].body
  const n = design.nose.length
  const len = recordLength(design)
  const axis = recordAxis(design)
  const half = body.height / 2

  // The nose cone, bent down by its droop (its tip lowest), then the body behind it.
  const slope = Math.tan((design.nose.droop * Math.PI) / 180)
  g.add(loft(design, 0, n, DRAW.noseSteps, (x) => slope * (n - x), tint('nose', M.part)))
  g.add(loft(design, n, len, DRAW.bodySteps, () => 0, M.body))
  // A dark seam where the nose cone meets the body.
  const seam = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 6, 32).rotateY(Math.PI / 2), M.dark)
  seam.scale.set(1, half, b.half)
  seam.position.set(recordX(design, n), axis, 0)
  g.add(seam)

  // The canopy: a glass blister over the driver, as tall as it's set.
  if (design.canopy > 0.005) {
    const from = n + b.canopyFrom
    const to = n + b.canopyTo
    const positions: number[] = []
    const index: number[] = []
    const steps = 16
    const ring = 12
    for (let i = 0; i <= steps; i++) {
      const x = from + ((to - from) * i) / steps
      const h = canopyAt(design, x)
      for (let k = 0; k <= ring; k++) {
        const a = (k / ring) * Math.PI
        positions.push(recordX(design, x), axis + half - 0.01 + h * Math.sin(a), b.half * 0.45 * Math.cos(a) * Math.min(1, h / Math.max(design.canopy * 0.4, 0.001)))
      }
    }
    for (let i = 0; i < steps; i++) {
      for (let k = 0; k < ring; k++) {
        const a = i * (ring + 1) + k
        index.push(a, a + ring + 1, a + 1, a + 1, a + ring + 1, a + ring + 2)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setIndex(index)
    geo.computeVertexNormals()
    g.add(new THREE.Mesh(geo, tint('canopy', M.glass)))
  }

  // The tail fin: a swept plate standing on the body, its side area as set.
  if (design.fin > 0.01) {
    const height = Math.sqrt(design.fin * DRAW.finAspect)
    const chord = design.fin / height
    const mid = n + RECORD_SIDE.at[design.class].fin
    const base = axis + half * fullnessAt(design, mid) - 0.02
    const x0 = recordX(design, mid - chord / 2)
    const x1 = recordX(design, mid + chord / 2)
    const sweep = chord * DRAW.finSweep
    const tip = chord * 0.55
    const shape = new THREE.Shape()
    // In the drawing, +x is forward: the leading edge is at x0.
    shape.moveTo(x0, base)
    shape.lineTo(x1, base)
    shape.lineTo(x1 - sweep * 0.2, base + height)
    shape.lineTo(x1 - sweep * 0.2 + tip, base + height)
    shape.closePath()
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }), tint('fin', M.part))
    fin.position.z = -0.02
    g.add(fin)
  }

  // The wheels, poking out of the body's sides, and the fairings over them (from the top down, as much as they cover).
  for (const axle of [body.frontAxle, body.rearAxle]) {
    for (const side of [-1, 1]) {
      const x = recordX(design, n + axle)
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(b.wheel, b.wheel, DRAW.tyre, 28).rotateX(Math.PI / 2), M.tyre)
      tyre.position.set(x, b.wheel, side * b.track)
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(b.wheel * 0.5, b.wheel * 0.5, DRAW.tyre + 0.01, 16).rotateX(Math.PI / 2), M.hub)
      hub.position.copy(tyre.position)
      g.add(tyre, hub)
      if (design.fairings >= 0.05) {
        const cover = Math.PI * (0.3 + 0.62 * design.fairings)
        const pod = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, cover), tint('fairings', M.part))
        pod.scale.set(b.wheel * 1.5, b.wheel * 1.12, DRAW.tyre * 0.95)
        pod.position.set(x, b.wheel, side * b.track)
        g.add(pod)
      }
    }
  }

  // The parachute canister at the tail, in its warning orange.
  const can = new THREE.Mesh(new THREE.CylinderGeometry(b.tailHalf * 0.7, b.tailHalf * 0.7, 0.3, 16).rotateZ(Math.PI / 2), M.chute)
  can.position.set(recordX(design, len + 0.1), axis + 0.05, 0)
  g.add(can)
  return g
}
