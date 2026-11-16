/**
 * PIV, particle image velocimetry (PR 10ag). With the upgrade fitted to the
 * firm's own tunnel, a laser sheet and a camera measure the air's speed
 * round the model. This module turns the same flow field the smoke follows
 * into what the PIV shows:
 *
 * - a side sheet down the middle of the model: the air's speed as a share
 *   of the tunnel's, for the colour slice;
 * - a cross slice just behind the tail, which gives the wake's "speed loss"
 *   (how much slower the air is there, on average, than the free stream).
 *
 * The wake's strength comes from the drag the tunnel measured: behind a
 * body, the speed it has taken from the air adds up to half its drag area
 * (the momentum the drag removed), so the mean loss over the slice is
 * dragArea / (2 × slice area). The smoke's field gives the wake its shape;
 * its depth is scaled to match, so the colours and the number always agree,
 * and every slider that changes the drag shows in both. The hint (which
 * slider to change) is src/sim/pivHint.ts.
 *
 * Only + − × ÷ and Math.sqrt, so every phone reads the same numbers for the
 * same design.
 */
import { WAKE_VIZ } from '../../data/flowViz'
import { PIV } from '../../data/piv'
import { detCos, detSin } from '../det'
import { smoothstep } from '../num'
import type { Point } from '../geom/pose'
import type { FieldBody, FlowField } from './field'

/**
 * A grid of samples on a flat slice. Cell (col, row) sits at
 * origin + col·du·colAxis + row·dv·rowAxis; row 0 is the lowest.
 */
export interface PivGrid {
  cols: number
  rows: number
  origin: Point
  colAxis: Point
  rowAxis: Point
  /** Spacing along each axis, m. */
  du: number
  dv: number
  /**
   * Row-major, length cols × rows. On the side sheet: the air's speed over
   * the tunnel's (1 is free stream). On the cross slice: the speed along the
   * stream over the tunnel's. NaN inside the model.
   */
  values: number[]
}

export interface PivReading {
  sheet: PivGrid
  cross: PivGrid
  /** Mean speed the wake takes from the air in the cross slice, 0 to 1 (0.08 is 8 %). */
  loss: number
}

/** How far an ellipsoid reaches along unit direction n from its centre, m (as field.ts's ext()). */
function reach(b: FieldBody, n: Point): number {
  const { a, b: hb, c } = b.ellipsoid.axes
  const fx = detCos(b.ellipsoid.pitchRad)
  const fy = detSin(b.ellipsoid.pitchRad)
  const pf = (n.x * fx + n.y * fy) * a
  const pu = (-n.x * fy + n.y * fx) * hb
  const ps = n.z * c
  return Math.sqrt(pf * pf + pu * pu + ps * ps)
}

const dot = (p: Point, q: Point): number => p.x * q.x + p.y * q.y + p.z * q.z

/** The model's box in the stream's frame: along the stream, up, and across. */
interface Box {
  down: Point
  across: Point
  t0: number
  t1: number
  y0: number
  y1: number
  s0: number
  s1: number
}

/**
 * The model's box. With `skipWing`, the wing a sensor pod hangs under is
 * left out: it's the aircraft's, not what's being tested.
 */
function boxOf(field: FlowField, skipWing = false): Box {
  const down = field.downstream
  const across: Point = { x: down.z, y: 0, z: -down.x }
  const up: Point = { x: 0, y: 1, z: 0 }
  let t0 = Infinity
  let t1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  let s0 = Infinity
  let s1 = -Infinity
  for (const b of field.bodies) {
    if (skipWing && b.ellipsoid.id === 'wing') continue
    const c = b.ellipsoid.centre
    const t = dot(c, down)
    const s = dot(c, across)
    const ht = reach(b, down)
    const hy = reach(b, up)
    const hs = reach(b, across)
    t0 = Math.min(t0, t - ht)
    t1 = Math.max(t1, t + ht)
    y0 = Math.min(y0, c.y - hy)
    y1 = Math.max(y1, c.y + hy)
    s0 = Math.min(s0, s - hs)
    s1 = Math.max(s1, s + hs)
  }
  return { down, across, t0, t1, y0, y1, s0, s1 }
}

const at = (o: Point, u: Point, su: number, v: Point, sv: number): Point => ({
  x: o.x + u.x * su + v.x * sv,
  y: o.y + u.y * su + v.y * sv,
  z: o.z + u.z * su + v.z * sv,
})

/** One cell's air before the wake is scaled: the flow round the bodies and how deep it sits in a wake. */
interface Cell {
  inside: boolean
  flow: Point
  wake: number
  /** How deep it sits in the thin wake skin friction leaves behind the whole model (see thinWake). */
  thin: number
}

interface Frame {
  origin: Point
  colAxis: Point
  rowAxis: Point
  cols: number
  rows: number
  du: number
  dv: number
}

const UP: Point = { x: 0, y: 1, z: 0 }

/**
 * How deep p sits in the model's wake. The wing a sensor pod hangs under
 * borrows the pod's separation for its smoke, so with `skipWing` its wake
 * is left out of what the PIV measures.
 */
function wakeDepth(field: FlowField, p: Point, skipWing: boolean): number {
  const wing = skipWing ? field.bodies.findIndex((b) => b.ellipsoid.id === 'wing') : -1
  return wing >= 0 ? field.wakeExcept(p, wing) : field.wake(p)
}

/**
 * The thin wake behind the whole model. The smoke only draws wakes where the
 * flow separates, but every body that has drag leaves a wake (skin friction
 * slows the air too): a smooth, faired body's is thin and shallow. This one
 * sits behind the model's box, the size of its front, and grows and fades
 * like the smoke's wakes do. It carries whatever drag the smoke's wakes
 * don't.
 */
function thinWake(box: Box, p: Point): number {
  const dt = dot(p, box.down) - box.t1
  const length = box.t1 - box.t0
  const ramp = PIV.thinRamp * length
  if (dt < -ramp) return 0
  const halfUp = (box.y1 - box.y0) / 2
  const halfSide = (box.s1 - box.s0) / 2
  if (!(halfUp > 0) || !(halfSide > 0)) return 0
  const fade = Math.max(WAKE_VIZ.minFade, WAKE_VIZ.fadeWidths * 2 * Math.min(halfUp, halfSide))
  if (dt > fade) return 0
  const grow = dt > 0 ? dt * WAKE_VIZ.spread : 0
  const ly = (p.y - (box.y0 + halfUp)) / (halfUp + grow)
  const ls = (dot(p, box.across) - (box.s0 + halfSide)) / (halfSide + grow)
  const rho2 = ly * ly + ls * ls
  if (rho2 >= 1) return 0
  const profile = 1 - smoothstep(WAKE_VIZ.core, 1, Math.sqrt(rho2))
  const along = dt < 0 ? smoothstep(-ramp, 0, dt) : 1 - smoothstep(0, fade, dt)
  return profile * along
}

function cells(field: FlowField, f: Frame, model: Box, skipWing: boolean): Cell[] {
  const out: Cell[] = []
  for (let r = 0; r < f.rows; r++) {
    for (let c = 0; c < f.cols; c++) {
      const p = at(f.origin, f.colAxis, c * f.du, f.rowAxis, r * f.dv)
      const inside = field.clearance(p) < 0
      out.push(
        inside
          ? { inside, flow: { x: 0, y: 0, z: 0 }, wake: 0, thin: 0 }
          : { inside, flow: field.potential(p), wake: wakeDepth(field, p, skipWing), thin: thinWake(model, p) },
      )
    }
  }
  return out
}

/** How deep each wake is drawn: the smoke's, times `smoke`, and the thin wake's, times `thin`. */
interface Depth {
  smoke: number
  thin: number
}

/** A cell's air with the wakes at these depths (as field.velocity() at smoke 1, thin 0). */
function air(cell: Cell, depth: Depth): Point {
  const keep = Math.max(0, 1 - WAKE_VIZ.deficit * (cell.wake * depth.smoke + cell.thin * depth.thin))
  return { x: cell.flow.x * keep, y: cell.flow.y * keep, z: cell.flow.z * keep }
}

/** Lowest and highest row heights: the model's height plus the margin, never below the floor. */
function heights(box: Box, size: number): { y0: number; y1: number } {
  return { y0: Math.max(0, box.y0 - PIV.margin * size), y1: box.y1 + PIV.margin * size }
}

/** The side sheet: down the middle of the model, from just ahead of the nose to well behind the tail. */
function sheetFrame(box: Box): Frame {
  const { cols, rows } = PIV.sheet
  const length = box.t1 - box.t0
  const tA = box.t0 - PIV.sheetAhead * length
  const tB = box.t1 + PIV.sheetBehind * length
  const { y0, y1 } = heights(box, box.y1 - box.y0)
  const sMid = (box.s0 + box.s1) / 2
  const origin: Point = { x: box.down.x * tA + box.across.x * sMid, y: y0, z: box.down.z * tA + box.across.z * sMid }
  return { origin, colAxis: box.down, rowAxis: UP, cols, rows, du: (tB - tA) / (cols - 1), dv: (y1 - y0) / (rows - 1) }
}

/** The cross slice: across the stream, a little behind the tail. */
function crossFrame(box: Box): Frame {
  const size = Math.max(box.y1 - box.y0, box.s1 - box.s0)
  const t = box.t1 + PIV.behind * size
  const width = box.s1 - box.s0
  const sA = box.s0 - PIV.margin * width
  const sB = box.s1 + PIV.margin * width
  const { y0, y1 } = heights(box, box.y1 - box.y0)
  const { cols, rows } = PIV.cross
  return {
    origin: { x: box.down.x * t + box.across.x * sA, y: y0, z: box.down.z * t + box.across.z * sA },
    colAxis: box.across,
    rowAxis: UP,
    cols,
    rows,
    du: (sB - sA) / (cols - 1),
    dv: (y1 - y0) / (rows - 1),
  }
}

const grid = (f: Frame, values: number[]): PivGrid => ({ cols: f.cols, rows: f.rows, origin: f.origin, colAxis: f.colAxis, rowAxis: f.rowAxis, du: f.du, dv: f.dv, values })

/**
 * The mean speed the wake takes from the air across the cross slice at this
 * depth, 0 to 1: only the wake's slowing, not the air easing round the body.
 */
function lossAt(cross: readonly Cell[], down: Point, U: number, depth: Depth): number {
  let sum = 0
  let n = 0
  for (const c of cross) {
    if (c.inside) continue
    sum += Math.max(0, dot(c.flow, down) - dot(air(c, depth), down)) / U
    n++
  }
  return n > 0 ? sum / n : 0
}

export interface PivOptions {
  /** A sensor pod under its stretch of wing: the wing is the aircraft's, so the PIV leaves it out. */
  skipWing?: boolean
}

/**
 * What the PIV shows for a model in a flow field, given the drag area the
 * tunnel measured (full-size m², the field's own scale). The wake's depth is
 * fitted so the cross slice loses dragArea / (2 × its area) on average.
 */
export function pivReading(field: FlowField, dragArea: number, options: PivOptions = {}): PivReading {
  const skipWing = options.skipWing === true
  const U = field.speed
  const all = boxOf(field)
  const model = boxOf(field, skipWing)
  const cf = crossFrame(model)
  const cross = cells(field, cf, model, skipWing)
  const area = (cf.cols - 1) * cf.du * ((cf.rows - 1) * cf.dv)
  const target = area > 0 ? Math.max(0, dragArea) / (2 * area) : 0
  const depth: Depth = { smoke: 1, thin: 0 }
  if (U > 0) {
    // First the smoke's wakes, within their limits; then the thin wake takes the rest.
    for (let i = 0; i < PIV.fitSteps; i++) {
      const l = lossAt(cross, all.down, U, depth)
      if (!(l > 0)) break
      depth.smoke = Math.min(PIV.depthMax, Math.max(PIV.depthMin, (depth.smoke * target) / l))
    }
    for (let i = 0; i < PIV.fitSteps; i++) {
      const short = target - lossAt(cross, all.down, U, depth)
      if (!(short > 0)) break
      const per = lossAt(cross, all.down, U, { smoke: depth.smoke, thin: depth.thin + 1 }) - lossAt(cross, all.down, U, depth)
      if (!(per > 0)) break
      depth.thin += short / per
    }
  }
  const sf = sheetFrame(all)
  const sheet = cells(field, sf, model, skipWing).map((c) => {
    if (c.inside) return Number.NaN
    if (!(U > 0)) return 1
    const v = air(c, depth)
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) / U
  })
  const crossValues = cross.map((c) => (c.inside ? Number.NaN : U > 0 ? dot(air(c, depth), all.down) / U : 1))
  return { sheet: grid(sf, sheet), cross: grid(cf, crossValues), loss: U > 0 ? lossAt(cross, all.down, U, depth) : 0 }
}
