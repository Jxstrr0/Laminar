/**
 * The air the visuals show (plan section 6.7): smoke, tufts and the
 * pressure map read this field. It is cheap maths, not the aero model, but
 * it is driven by the aero model: every wake starts at the separation point
 * the drag result found on that body, and a tuft flails only where the drag
 * result says the flow has left the surface. What the player sees always
 * agrees with the numbers.
 *
 * How it works:
 * - Each ellipsoid is a unit ball stretched along its axes. In the ball's
 *   own coordinates the air goes round it as textbook potential flow round
 *   a sphere (a doublet), and stretching that back keeps the air out of the
 *   ellipsoid exactly and keeps it from piling up anywhere. The pushes of
 *   all the ellipsoids add up; where overlapping parts would still send air
 *   into a surface, it is turned along the surface instead.
 * - Each aero body's surface lines (top, bottom, side) say where the flow
 *   separates. On the ellipsoid that becomes "how far a face turns
 *   downstream before the flow lets go": for a ball, a line that separates
 *   where the body has closed to a fraction e of its widest leaves the
 *   surface where the face points downstream by √(1 − e²). A Kamm-cut tail
 *   that the flow holds on to still sheds a wake the size of the cut.
 * - The wake starts there, the size of the separated section, grows as it
 *   goes downstream and fades out over a few of its widths. The smoke slows
 *   in it, and seeded noise makes it churn.
 *
 * Frame: the rider's (pose coordinates, metres): x forward along the road,
 * y up, z to the rider's right. With no yaw the air moves towards −x. Yaw
 * turns the model on the turntable: positive yaw brings the air in from the
 * rider's left, so it moves towards +z and the wakes swing to the right
 * (the side force pushes the same way, as in src/sim/aero/forces.ts).
 *
 * All maths is + − × ÷ and Math.sqrt, plus src/sim/det.ts, so every phone
 * draws the same smoke for the same design and seed.
 */
import { CP_VIZ, FLOW_FIELD, TUFTS, TURBULENCE, WAKE_VIZ } from '../../data/flowViz'
import { designPose, designShape, type Design } from '../design'
import { shapeDrag, type ShapeDrag } from '../aero/drag'
import type { Flow } from '../aero/flow'
import { detCos, detSin, PI } from '../det'
import { describeShape, type BodyDescriptor, type Line, type ShapeDescriptor } from '../geom/body'
import type { Point } from '../geom/pose'
import { gaussian } from '../noise'
import { clamp01, DEG, interp, smoothstep } from '../num'
import type { Rng } from '../rng'
import { designEllipsoids, type Ellipsoid } from './ellipsoids'

export type LineName = 'top' | 'bottom' | 'side'

/**
 * Where the flow lets go on one ellipsoid, per surface line, as how far a
 * face must turn downstream (the outward normal's component along the air's
 * direction, 0 to 1) before it is separated. 1 or more means never.
 */
export interface SeparationThresholds {
  top: number
  bottom: number
  side: number
}

/** One ellipsoid as the field uses it. */
export interface FieldBody {
  ellipsoid: Ellipsoid
  separation: SeparationThresholds
  /** The aero body's separated section over its widest, per line (0 closed, 1 full width). */
  closure: SeparationThresholds
  /** Where its wake starts, or null if the flow closes cleanly behind it. */
  wakeStart: Point | null
  /** Half-height and half-width of the wake where it starts, m. */
  wakeSize: { up: number; side: number }
  /** Length over which the wake fades out, m. */
  wakeLength: number
}

export interface FlowFieldInput {
  ellipsoids: readonly Ellipsoid[]
  /** The descriptor the drag result was worked out on (any scale: only ratios are used). */
  shape: ShapeDescriptor
  drag: ShapeDrag
  /** Air speed, m/s. */
  speed: number
  /** Turntable yaw, degrees (see the frame note at the top). */
  yawDeg: number
  /** Seed for the wake turbulence. */
  seed?: number
}

export interface FlowField {
  readonly speed: number
  readonly yawDeg: number
  /** The free stream's velocity, m/s. */
  readonly freestream: Point
  /** Unit vector the free stream moves along. */
  readonly downstream: Point
  readonly seed: number
  readonly bodies: readonly FieldBody[]
  /** Mean air velocity at p (m/s): flow round the bodies, slowed in the wakes. */
  velocity(p: Point): Point
  /** The flow round the bodies alone, with no wake slowing. */
  potential(p: Point): Point
  /** How deep p sits in a separated wake: 0 clean air, 1 the heart of a wake. */
  wake(p: Point): number
  /** As wake(), leaving out one body's own wake (for tufts sitting in another part's wake). */
  wakeExcept(p: Point, bodyIndex: number): number
  /**
   * A seeded turbulent gust at p and time t (seconds), m/s, already scaled by
   * how deep p is in a wake: zero in clean air. Add it to velocity() to move
   * smoke; the same p, t and seed always give the same gust.
   */
  gust(p: Point, time: number): Point
  /** Pressure coefficient estimate for the pressure map. */
  pressure(p: Point): number
  /**
   * Rough distance from p to the nearest surface, m (negative inside a
   * body). Good near the surface; only a guide further away.
   */
  clearance(p: Point): number
  /** p, moved out to `margin` metres off any surface it is inside or closer than that to. */
  pushOutside(p: Point, margin?: number): Point
}

/** Ratio of a line's radius where the flow leaves it to its widest. */
function closureOf(desc: BodyDescriptor, line: Line, sepX: number): number {
  const crest = line.r[line.crest] as number
  if (!(crest > 0)) return 0
  return clamp01(interp(desc.xs, line.r, sepX) / crest)
}

/** e → √(1 − e²): how far a ball's face turns downstream where it has closed to e. */
const turnFor = (e: number): number => Math.sqrt(Math.max(0, 1 - e * e))

/** Internal, unpacked form of a body for the hot loops. */
interface Prep {
  cx: number
  cy: number
  cz: number
  /** Forward axis (fx, fy, 0); up is (−fy, fx, 0); side is (0, 0, 1). */
  fx: number
  fy: number
  a: number
  b: number
  c: number
  /** The free stream in the unit ball's coordinates. */
  wx: number
  wy: number
  wz: number
  minAxis: number
  wake: null | {
    ox: number
    oy: number
    oz: number
    up: number
    side: number
    ramp: number
    fade: number
  }
}

const NEVER: SeparationThresholds = { top: 1, bottom: 1, side: 1 }

/** Build a flow field from fitted ellipsoids, a drag result and the free stream. */
export function flowField(input: FlowFieldInput): FlowField {
  const speed = input.speed
  const beta = input.yawDeg * DEG
  const cosB = detCos(beta)
  const sinB = detSin(beta)
  const sx = -cosB
  const sz = sinB
  // Across the air, level: perpendicular to the free stream (z at no yaw).
  const zx = sinB
  const zz = cosB
  const ux = speed * sx
  const uz = speed * sz
  const seed = (input.seed ?? 0) >>> 0

  const dragById = new Map(input.drag.bodies.map((b) => [b.id, b]))
  const descById = new Map(input.shape.bodies.map((b) => [b.id, b]))

  const bodies: FieldBody[] = []
  const prep: Prep[] = []
  for (const e of input.ellipsoids) {
    const fx = detCos(e.pitchRad)
    const fy = detSin(e.pitchRad)
    const { a, b, c } = e.axes
    // Free stream in ball coordinates: project on each axis, divide by its length.
    const wx = (ux * fx) / a
    const wy = (-ux * fy) / b
    const wz = uz / c

    const d = dragById.get(e.bodyId)
    const desc = descById.get(e.bodyId)
    let closure: SeparationThresholds = { top: 0, bottom: 0, side: 0 }
    let separation = NEVER
    if (d && desc && e.wrap !== 'none') {
      const side = closureOf(desc, desc.lines.side, d.lines.side.separationX)
      closure =
        e.wrap === 'cross'
          ? { top: side, bottom: side, side }
          : {
              top: closureOf(desc, desc.lines.top, d.lines.top.separationX),
              bottom: closureOf(desc, desc.lines.bottom, d.lines.bottom.separationX),
              side,
            }
      separation = { top: turnFor(closure.top), bottom: turnFor(closure.bottom), side: turnFor(closure.side) }
    }

    // Extents of the ellipsoid along the air, up, and across the air.
    const ext = (dx: number, dy: number, dz: number) => {
      const pf = (dx * fx + dy * fy) * a
      const pu = (-dx * fy + dy * fx) * b
      const ps = dz * c
      return Math.sqrt(pf * pf + pu * pu + ps * ps)
    }
    const hS = ext(sx, 0, sz)
    const hY = ext(0, 1, 0)
    const hZ = ext(zx, 0, zz)
    const eUp = e.wrap === 'cross' ? 1 : (closure.top + closure.bottom) / 2
    const eSide = closure.side
    const eStart = e.wrap === 'cross' ? closure.side : Math.max(closure.top, closure.bottom, closure.side)
    const wakeUp = hY * eUp
    const wakeSide = hZ * eSide
    let wake: Prep['wake'] = null
    let wakeStart: Point | null = null
    let wakeLength = 0
    if (e.wrap !== 'none' && wakeUp > 1e-6 && wakeSide > 1e-6) {
      const along = hS * turnFor(eStart)
      wakeStart = { x: e.centre.x + sx * along, y: e.centre.y, z: e.centre.z + sz * along }
      wakeLength = Math.max(WAKE_VIZ.minFade, WAKE_VIZ.fadeWidths * 2 * Math.min(wakeUp, wakeSide))
      wake = {
        ox: wakeStart.x,
        oy: wakeStart.y,
        oz: wakeStart.z,
        up: wakeUp,
        side: wakeSide,
        ramp: WAKE_VIZ.rampIn * hS,
        fade: wakeLength,
      }
    }
    bodies.push({ ellipsoid: e, separation, closure, wakeStart, wakeSize: { up: wake ? wakeUp : 0, side: wake ? wakeSide : 0 }, wakeLength })
    prep.push({ cx: e.centre.x, cy: e.centre.y, cz: e.centre.z, fx, fy, a, b, c, wx, wy, wz, minAxis: Math.min(a, b, c), wake })
  }

  const cut2 = FLOW_FIELD.cutoff * FLOW_FIELD.cutoff

  /** Depth in one body's wake. */
  function wakeOf(k: number, px: number, py: number, pz: number): number {
    const P = prep[k] as Prep
    const w = P.wake
    if (!w) return 0
    const dx = px - w.ox
    const dy = py - w.oy
    const dz = pz - w.oz
    const t = dx * sx + dz * sz
    if (t < -w.ramp || t > w.fade) return 0
    // Inside the body itself there is no air to show.
    const ex = px - P.cx
    const ey = py - P.cy
    const ez = pz - P.cz
    const qx = (ex * P.fx + ey * P.fy) / P.a
    const qy = (-ex * P.fy + ey * P.fx) / P.b
    const qz = ez / P.c
    if (qx * qx + qy * qy + qz * qz < 1) return 0
    const grow = t > 0 ? t * WAKE_VIZ.spread : 0
    const ly = dy / (w.up + grow)
    const lz = (dx * zx + dz * zz) / (w.side + grow)
    const rho2 = ly * ly + lz * lz
    if (rho2 >= 1) return 0
    const profile = 1 - smoothstep(WAKE_VIZ.core, 1, Math.sqrt(rho2))
    const along = t < 0 ? smoothstep(-w.ramp, 0, t) : 1 - smoothstep(0, w.fade, t)
    return profile * along
  }

  function wakeAt(p: Point, skip: number): number {
    let clean = 1
    for (let k = 0; k < prep.length; k++) {
      if (k === skip) continue
      const w = wakeOf(k, p.x, p.y, p.z)
      if (w > 0) clean *= 1 - w
    }
    return 1 - clean
  }

  /** The potential flow, with the surface guard. */
  function potential(p: Point): Point {
    let vx = ux
    let vy = 0
    let vz = uz
    let near = -1
    let nearDist = Infinity
    let nx = 0
    let ny = 0
    let nz = 0
    for (let k = 0; k < prep.length; k++) {
      const P = prep[k] as Prep
      const ex = p.x - P.cx
      const ey = p.y - P.cy
      const ez = p.z - P.cz
      const qx = (ex * P.fx + ey * P.fy) / P.a
      const qy = (-ex * P.fy + ey * P.fx) / P.b
      const qz = ez / P.c
      const r2 = qx * qx + qy * qy + qz * qz
      if (r2 >= cut2) continue
      const r = Math.sqrt(r2)
      let hx = 0
      let hy = 1
      let hz = 0
      if (r > 1e-9) {
        hx = qx / r
        hy = qy / r
        hz = qz / r
      }
      // Doublet round a unit ball: (W − 3(W·q̂)q̂) / 2r³, evaluated at the
      // surface for points inside, faded to nothing far away.
      const rr = r > 1 ? r : 1
      const dot = P.wx * hx + P.wy * hy + P.wz * hz
      const k3 = (1 - smoothstep(FLOW_FIELD.fadeFrom, FLOW_FIELD.cutoff, r)) / (2 * rr * rr * rr)
      const dqx = k3 * (P.wx - 3 * dot * hx) * P.a
      const dqy = k3 * (P.wy - 3 * dot * hy) * P.b
      const dqz = k3 * (P.wz - 3 * dot * hz) * P.c
      vx += dqx * P.fx - dqy * P.fy
      vy += dqx * P.fy + dqy * P.fx
      vz += dqz

      // Distance to the surface ≈ (r − 1) / |∇r|.
      const gx = hx / P.a
      const gy = hy / P.b
      const gz = hz / P.c
      const g = Math.sqrt(gx * gx + gy * gy + gz * gz)
      const dist = g > 0 ? (r - 1) / g : 0
      // Rank by distance in units of the body's band, so a thin tube doesn't hide a nearby torso.
      const rank = dist / (FLOW_FIELD.guardBand * P.minAxis)
      if (rank < nearDist) {
        nearDist = rank
        near = k
        const wxn = gx * P.fx - gy * P.fy
        const wyn = gx * P.fy + gy * P.fx
        nx = wxn / g
        ny = wyn / g
        nz = gz / g
      }
    }
    if (near >= 0 && nearDist < 1) {
      const full = FLOW_FIELD.guardFull / FLOW_FIELD.guardBand
      const weight = nearDist <= full ? 1 : 1 - smoothstep(full, 1, nearDist)
      const vn = vx * nx + vy * ny + vz * nz
      if (vn < 0 && weight > 0) {
        vx -= weight * vn * nx
        vy -= weight * vn * ny
        vz -= weight * vn * nz
      }
    }
    return { x: vx, y: vy, z: vz }
  }

  function velocity(p: Point): Point {
    const v = potential(p)
    const w = wakeAt(p, -1)
    if (w <= 0) return v
    const keep = 1 - WAKE_VIZ.deficit * w
    return { x: v.x * keep, y: v.y * keep, z: v.z * keep }
  }

  const drift: Point = { x: sx * speed * TURBULENCE.convect, y: 0, z: sz * speed * TURBULENCE.convect }

  function clearance(p: Point): number {
    let best = Infinity
    for (const P of prep) {
      const ex = p.x - P.cx
      const ey = p.y - P.cy
      const ez = p.z - P.cz
      const qx = (ex * P.fx + ey * P.fy) / P.a
      const qy = (-ex * P.fy + ey * P.fx) / P.b
      const qz = ez / P.c
      const r = Math.sqrt(qx * qx + qy * qy + qz * qz)
      if (r < 1e-9) {
        best = Math.min(best, -P.minAxis)
        continue
      }
      const gx = qx / r / P.a
      const gy = qy / r / P.b
      const gz = qz / r / P.c
      const g = Math.sqrt(gx * gx + gy * gy + gz * gz)
      const dist = (r - 1) / g
      if (dist < best) best = dist
    }
    return best
  }

  function pushOutside(p: Point, margin = 0): Point {
    let x = p.x
    let y = p.y
    let z = p.z
    for (const P of prep) {
      const ex = x - P.cx
      const ey = y - P.cy
      const ez = z - P.cz
      let qx = (ex * P.fx + ey * P.fy) / P.a
      let qy = (-ex * P.fy + ey * P.fx) / P.b
      let qz = ez / P.c
      let r = Math.sqrt(qx * qx + qy * qy + qz * qz)
      if (r < 1e-9) {
        qx = 0
        qy = 1
        qz = 0
        r = 1e-9
      }
      const hx = qx / r
      const hy = qy / r
      const hz = qz / r
      const g = Math.sqrt((hx / P.a) * (hx / P.a) + (hy / P.b) * (hy / P.b) + (hz / P.c) * (hz / P.c))
      const target = 1 + margin * g
      if (r >= target) continue
      const fx = hx * target * P.a
      const fy = hy * target * P.b
      const fz = hz * target * P.c
      x = P.cx + fx * P.fx - fy * P.fy
      y = P.cy + fx * P.fy + fy * P.fx
      z = P.cz + fz
    }
    return { x, y, z }
  }

  return {
    speed,
    yawDeg: input.yawDeg,
    freestream: { x: ux, y: 0, z: uz },
    downstream: { x: sx, y: 0, z: sz },
    seed,
    bodies,
    velocity,
    potential,
    wake: (p) => wakeAt(p, -1),
    wakeExcept: (p, i) => wakeAt(p, i),
    gust(p, time) {
      const w = wakeAt(p, -1)
      if (w <= 0) return { x: 0, y: 0, z: 0 }
      const n = turbulenceNoise(p, time, seed, TURBULENCE.cell, drift)
      const s = w * TURBULENCE.amplitude * speed
      return { x: n.x * s, y: n.y * s, z: n.z * s }
    },
    pressure(p) {
      if (!(speed > 0)) return 0
      const v = potential(p)
      const cp = 1 - (v.x * v.x + v.y * v.y + v.z * v.z) / (speed * speed)
      const w = wakeAt(p, -1)
      return cp + (CP_VIZ.wakeBase - cp) * w
    },
    clearance,
    pushOutside,
  }
}

export interface RiderFlowOptions {
  seed?: number
  /** A tunnel model's fixed crank angle, so the legs' ellipsoids sit where the model's legs are. */
  crankDeg?: number
}

/**
 * The flow round a full-size rider: the pose, its ellipsoids and the drag
 * result in `flow`, with the turntable at `yawDeg`. For a scale model in the
 * tunnel, build the drag on the model's own shape and flow and call
 * flowField() with scaleEllipsoids() instead.
 */
export function riderFlowField(design: Design, flow: Flow, yawDeg: number, options: RiderFlowOptions = {}): FlowField {
  const pose = designPose(design)
  const ellipsoids = designEllipsoids(design, pose)
  const shape = describeShape(designShape(design))
  const drag = shapeDrag(shape, flow)
  return flowField({ ellipsoids, shape, drag, speed: flow.speed, yawDeg, ...(options.seed !== undefined ? { seed: options.seed } : {}) })
}

/**
 * The air round a tunnel model (PR 3d): the separation and wakes come from
 * the scale model's own shape and drag at tunnel speed (so a small model's
 * laminar flow shows in the smoke), while the field stays in the full-size
 * rider's coordinates. The renderer draws it inside the scaled model, so
 * the two line up. Only ratios of the drag result are read, so mixing the
 * model's scale with full-size ellipsoids is safe.
 */
export function modelFlowField(design: Design, modelShape: ShapeDescriptor, flow: Flow, yawDeg: number, options: RiderFlowOptions = {}): FlowField {
  const ellipsoids = designEllipsoids(design, designPose(design, options.crankDeg))
  const drag = shapeDrag(modelShape, flow)
  return flowField({ ellipsoids, shape: modelShape, drag, speed: flow.speed, yawDeg, ...(options.seed !== undefined ? { seed: options.seed } : {}) })
}

// --- Tufts -----------------------------------------------------------------

export interface Tuft {
  ellipsoidId: string
  bodyId: string
  /** Index into field.bodies. */
  bodyIndex: number
  /** Which aero line this tuft reads (the main one, where lines blend). */
  line: LineName
  point: Point
  /** Outward surface normal (unit). */
  normal: Point
  /** Which way the attached flow combs it, along the surface (unit). */
  direction: Point
  /** True past its line's separation point: draw it flailing. */
  separated: boolean
  /** 0 steady to 1 flailing, smooth across the separation point. */
  strength: number
  /** How deep it sits in another part's wake (0 to 1): buffeting on attached tufts. */
  buffet: number
}

export interface TuftOptions {
  /** Spacing between tufts, m (scale it with the model). */
  spacing?: number
  /** Which parts carry tufts (default: the rider only). */
  parts?: readonly Ellipsoid['part'][]
}

/**
 * Tufts over each ellipsoid's surface, on a ring-by-ring lattice about its
 * forward axis. Tufts that fall inside another part (the shoulder inside the
 * upper arm) are left out. Each tuft reads its body's separation line: top,
 * bottom or side, blended by which way its face points.
 */
export function tufts(field: FlowField, options: TuftOptions = {}): Tuft[] {
  const spacing = options.spacing ?? TUFTS.spacing
  const parts = options.parts ?? ['rider']
  const s = field.downstream
  const out: Tuft[] = []
  const all = field.bodies

  const tilt = all.map((b) => ({ fx: detCos(b.ellipsoid.pitchRad), fy: detSin(b.ellipsoid.pitchRad) }))
  const insideOther = (p: Point, skip: number): boolean => {
    for (let k = 0; k < all.length; k++) {
      if (k === skip) continue
      const e = (all[k] as FieldBody).ellipsoid
      const { fx, fy } = tilt[k] as { fx: number; fy: number }
      const ex = p.x - e.centre.x
      const ey = p.y - e.centre.y
      const ez = p.z - e.centre.z
      const qx = (ex * fx + ey * fy) / e.axes.a
      const qy = (-ex * fy + ey * fx) / e.axes.b
      const qz = ez / e.axes.c
      if (qx * qx + qy * qy + qz * qz < 1) return true
    }
    return false
  }

  all.forEach((body, index) => {
    const e = body.ellipsoid
    if (!parts.includes(e.part) || e.wrap === 'none') return
    const { a, b, c } = e.axes
    const fx = detCos(e.pitchRad)
    const fy = detSin(e.pitchRad)
    const across = Math.sqrt((b * b + c * c) / 2)
    const meridian = (PI * (a + across)) / 2
    let rings = Math.max(TUFTS.minRings, Math.round(meridian / spacing))
    const perRingAt = (k: number) => {
      const th = (PI * (k + 0.5)) / rings
      return Math.max(TUFTS.minPerRing, Math.round((2 * PI * detSin(th) * across) / spacing))
    }
    // Keep the count under the cap by thinning the rings.
    let total = 0
    for (let k = 0; k < rings; k++) total += perRingAt(k)
    while (total > TUFTS.maxPerEllipsoid && rings > TUFTS.minRings) {
      rings -= 1
      total = 0
      for (let k = 0; k < rings; k++) total += perRingAt(k)
    }
    const lift = TUFTS.lift * Math.min(a, b, c)
    const sep = body.separation
    for (let k = 0; k < rings; k++) {
      const th = (PI * (k + 0.5)) / rings
      const ct = detCos(th)
      const st = detSin(th)
      const n = Math.min(perRingAt(k), TUFTS.maxPerEllipsoid)
      for (let j = 0; j < n; j++) {
        const ph = (2 * PI * (j + (k % 2 === 0 ? 0 : 0.5))) / n
        const qx = ct
        const qy = st * detCos(ph)
        const qz = st * detSin(ph)
        const lf = qx * a
        const lu = qy * b
        const point = {
          x: e.centre.x + lf * fx - lu * fy,
          y: e.centre.y + lf * fy + lu * fx,
          z: e.centre.z + qz * c,
        }
        if (insideOther(point, index)) continue
        // Normal: ∇ of the ellipsoid, (qx/a, qy/b, qz/c) in its own axes.
        const gf = qx / a
        const gu = qy / b
        const gs = qz / c
        const gl = Math.sqrt(gf * gf + gu * gu + gs * gs)
        const normal = { x: (gf * fx - gu * fy) / gl, y: (gf * fy + gu * fx) / gl, z: gs / gl }
        // Which line: the face's up/down and sideways parts in the body's own axes.
        const up = gu / gl
        const sideways = gs / gl
        const wu = up * up
        const ws = sideways * sideways
        const tb = up >= 0 ? sep.top : sep.bottom
        const eps = 1e-6
        const threshold = (wu * tb + ws * sep.side + eps * ((sep.top + sep.bottom) / 2 + sep.side) / 2) / (wu + ws + eps)
        const line: LineName = e.wrap === 'cross' || ws >= wu ? 'side' : up >= 0 ? 'top' : 'bottom'
        const turn = normal.x * s.x + normal.y * s.y + normal.z * s.z
        const half = TUFTS.band / 2
        const strength = threshold >= 1 ? 0 : smoothstep(threshold - half, threshold + half, turn)
        const separated = threshold < 1 && turn > threshold

        const probe = { x: point.x + normal.x * lift, y: point.y + normal.y * lift, z: point.z + normal.z * lift }
        const v = field.potential(probe)
        const vn = v.x * normal.x + v.y * normal.y + v.z * normal.z
        let dx = v.x - vn * normal.x
        let dy = v.y - vn * normal.y
        let dz = v.z - vn * normal.z
        let dl = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dl < 1e-9) {
          // A stagnation point: comb it along the air's direction over the surface.
          const sn = s.x * normal.x + s.y * normal.y + s.z * normal.z
          dx = s.x - sn * normal.x
          dy = s.y - sn * normal.y
          dz = s.z - sn * normal.z
          dl = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (dl < 1e-9) {
            dx = -fx
            dy = -fy
            dz = 0
            dl = 1
          }
        }
        out.push({
          ellipsoidId: e.id,
          bodyId: e.bodyId,
          bodyIndex: index,
          line,
          point,
          normal,
          direction: { x: dx / dl, y: dy / dl, z: dz / dl },
          separated,
          strength,
          buffet: field.wakeExcept(probe, index),
        })
      }
    }
  })
  return out
}

// --- Seeded turbulence ------------------------------------------------------

/** Integer hash of a lattice point to [−1, 1). Integer maths only, so every engine agrees. */
function hash3(ix: number, iy: number, iz: number, seed: number): number {
  let h = seed ^ Math.imul(ix | 0, 0x8da6b343) ^ Math.imul(iy | 0, 0xd8163841) ^ Math.imul(iz | 0, 0xcb1ab31f)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  h ^= h >>> 15
  return (h >>> 0) / 2147483648 - 1
}

const fade = (t: number) => t * t * (3 - 2 * t)

/** Smooth value noise in 3D, −1 to 1. */
function valueNoise(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const tx = fade(x - ix)
  const ty = fade(y - iy)
  const tz = fade(z - iz)
  const l = (p: number, q: number, t: number) => p + (q - p) * t
  const c000 = hash3(ix, iy, iz, seed)
  const c100 = hash3(ix + 1, iy, iz, seed)
  const c010 = hash3(ix, iy + 1, iz, seed)
  const c110 = hash3(ix + 1, iy + 1, iz, seed)
  const c001 = hash3(ix, iy, iz + 1, seed)
  const c101 = hash3(ix + 1, iy, iz + 1, seed)
  const c011 = hash3(ix, iy + 1, iz + 1, seed)
  const c111 = hash3(ix + 1, iy + 1, iz + 1, seed)
  return l(l(l(c000, c100, tx), l(c010, c110, tx), ty), l(l(c001, c101, tx), l(c011, c111, tx), ty), tz)
}

/**
 * Deterministic turbulence: a smooth random vector field, each part −1 to 1,
 * from position (m) and time (s). Eddies `cell` metres across drift with
 * `drift` (m/s) and the pattern changes TURBULENCE.evolve times a second.
 * The same inputs always give the same vector, on every device.
 */
export function turbulenceNoise(p: Point, time: number, seed: number, cell: number = TURBULENCE.cell, drift: Point = { x: 0, y: 0, z: 0 }): Point {
  const x = (p.x - drift.x * time) / cell
  const y = (p.y - drift.y * time) / cell
  const z = (p.z - drift.z * time) / cell
  const slice = time * TURBULENCE.evolve
  const k = Math.floor(slice)
  const f = fade(slice - k)
  const comp = (axis: number) => {
    const s0 = (seed + Math.imul(axis + 1, 0x9e3779b1) + Math.imul(k, 0x85ebca6b)) | 0
    const s1 = (seed + Math.imul(axis + 1, 0x9e3779b1) + Math.imul(k + 1, 0x85ebca6b)) | 0
    const n0 = valueNoise(x, y, z, s0)
    const n1 = valueNoise(x, y, z, s1)
    return n0 + (n1 - n0) * f
  }
  return { x: comp(0), y: comp(1), z: comp(2) }
}

/** A random jitter vector from a seeded generator: each part a bell-curve draw times `amplitude`. */
export function rngJitter(rng: Rng, amplitude = 1): Point {
  return { x: gaussian(rng) * amplitude, y: gaussian(rng) * amplitude, z: gaussian(rng) * amplitude }
}
