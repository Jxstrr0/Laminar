/**
 * Drag handles: where each dot sits for a design, and how a pull on the
 * screen turns into new design numbers. The screen hands in a `project`
 * function (world point to screen pixels) so this stays pure maths: the
 * same pull gives the same design on every phone.
 *
 * A pull is solved as a small least-squares problem: find the change in the
 * handle's numbers that best moves its dot to where the finger is, damped so
 * tiny movements can't make huge jumps, then clamped to the slider ranges.
 */
import { PART_RANGE, POSTURE_RANGE, type CyclistDesign } from '../../data/cyclist'
import { HANDLE_DRAG, HANDLE_SPOTS, HANDLES, type HandleDef, type HandleId, type HandleParam } from '../../data/handles'
import { clamp } from '../num'
import { riderPose, type Point, type Pose } from './pose'

export interface ScreenPoint {
  x: number
  y: number
}

/** World point to screen pixels. */
export type Project = (p: Point) => ScreenPoint

export const PARAM_RANGE: Record<HandleParam, { min: number; max: number; step: number }> = {
  ...POSTURE_RANGE,
  tail: PART_RANGE.tail,
}

export function getParam(design: CyclistDesign, key: HandleParam): number {
  return key === 'tail' ? design.helmet.tail : design.posture[key]
}

/** The nearest slider step, so a pulled number reads the same as the slider shows it. */
export function snapParam(key: HandleParam, value: number): number {
  const r = PARAM_RANGE[key]
  const steps = Math.round((value - r.min) / r.step)
  return clamp(Number((r.min + steps * r.step).toFixed(6)), r.min, r.max)
}

/** A copy of the design with one number changed, kept inside its range. */
export function withParam(design: CyclistDesign, key: HandleParam, value: number): CyclistDesign {
  const r = PARAM_RANGE[key]
  const v = clamp(value, r.min, r.max)
  if (key === 'tail') return { ...design, helmet: { ...design.helmet, tail: v } }
  return { ...design, posture: { ...design.posture, [key]: v } }
}

export function handleDef(id: HandleId): HandleDef {
  const def = HANDLES.find((h) => h.id === id)
  if (!def) throw new Error(`no handle ${id}`)
  return def
}

/** The handles this design offers (a road helmet has no tail to pull). */
export function availableHandles(design: CyclistDesign): HandleId[] {
  return HANDLES.filter((h) => h.id !== 'tail' || design.helmet.kind === 'aero').map((h) => h.id)
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
}

/** Where a handle's dot sits. */
export function handlePoint(design: CyclistDesign, id: HandleId, pose: Pose = riderPose(design)): Point {
  switch (id) {
    case 'hands':
      return mid(pose.hand[0], pose.hand[1])
    case 'elbowL':
      return pose.elbow[0]
    case 'elbowR':
      return pose.elbow[1]
    case 'back': {
      // Partway up the back, clear of the helmet tail that rests near the shoulders.
      const hip = mid(pose.hip[0], pose.hip[1])
      const sh = mid(pose.shoulder[0], pose.shoulder[1])
      const f = HANDLE_SPOTS.backAlong
      return { x: hip.x + (sh.x - hip.x) * f, y: hip.y + (sh.y - hip.y) * f, z: 0 }
    }
    case 'head':
      return pose.head
    case 'tail':
      return pose.helmetTail
  }
}

/** Solves (A + damping·I) x = b for a small square A by Gaussian elimination. */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length
  const m = a.map((row, i) => [...row, b[i]!])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r
    ;[m[col], m[pivot]] = [m[pivot]!, m[col]!]
    const p = m[col]![col]!
    if (Math.abs(p) < 1e-12) return new Array<number>(n).fill(0)
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = m[r]![col]! / p
      for (let c = col; c <= n; c++) m[r]![c]! -= f * m[col]![c]!
    }
  }
  return m.map((row, i) => row[n]! / row[i]!)
}

/**
 * Pulls a handle so its dot moves towards `target` (screen pixels), changing
 * only that handle's numbers. Numbers the view can't see change (arm width,
 * seen exactly side-on) stay put.
 */
export function dragHandle(design: CyclistDesign, id: HandleId, target: ScreenPoint, project: Project): CyclistDesign {
  const params = handleDef(id).params
  let d = design
  for (let pass = 0; pass < HANDLE_DRAG.iterations; pass++) {
    const here = project(handlePoint(d, id))
    const rx = target.x - here.x
    const ry = target.y - here.y
    // How far the dot moves on screen per whole range of each number.
    const cols: { key: HandleParam; x: number; y: number }[] = []
    for (const key of params) {
      const r = PARAM_RANGE[key]
      const span = r.max - r.min
      const v = getParam(d, key)
      const dir = v + HANDLE_DRAG.probe * span <= r.max ? 1 : -1
      const moved = project(handlePoint(withParam(d, key, v + dir * HANDLE_DRAG.probe * span), id))
      const x = (moved.x - here.x) / (dir * HANDLE_DRAG.probe)
      const y = (moved.y - here.y) / (dir * HANDLE_DRAG.probe)
      if (Math.sqrt(x * x + y * y) >= HANDLE_DRAG.minPxPerRange) cols.push({ key, x, y })
    }
    if (cols.length === 0) return d
    const a = cols.map((ci) => cols.map((cj) => ci.x * cj.x + ci.y * cj.y))
    a.forEach((row, i) => (row[i]! += HANDLE_DRAG.damping))
    const step = solve(
      a,
      cols.map((c) => c.x * rx + c.y * ry),
    )
    cols.forEach((c, i) => {
      const r = PARAM_RANGE[c.key]
      d = withParam(d, c.key, getParam(d, c.key) + step[i]! * (r.max - r.min))
    })
  }
  for (const key of params) d = withParam(d, key, snapParam(key, getParam(d, key)))
  return d
}
