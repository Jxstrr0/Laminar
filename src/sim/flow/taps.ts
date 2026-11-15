/**
 * Pressure taps on a rider model (plan section 7.1). The taps sit on a
 * coarse lattice over the rider's parts, fixed to the model; each reading
 * is the flow field's pressure coefficient just off the skin, plus the
 * scanner's scatter. The field takes its separation and wakes from the aero
 * model, so suction peaks and wake pressure land where the numbers say.
 */
import { TAPS } from '../../data/flowViz'
import { gaussian } from '../noise'
import type { Rng } from '../rng'
import type { Point } from '../geom/pose'
import { tufts, type FlowField } from './field'

export interface Tap {
  /** The aero body it sits on (torso, helmet, thigh-1…). */
  bodyId: string
  point: Point
  /** Outward surface normal (unit). */
  normal: Point
}

/** Where the taps go: the tuft lattice, spaced wider. They depend only on the model's shape and pose. */
export function tapLayout(field: FlowField): Tap[] {
  return tufts(field, { spacing: TAPS.spacing }).map((t) => ({ bodyId: t.bodyId, point: t.point, normal: t.normal }))
}

/** Strong suction eased towards TAPS.floor: unchanged above the knee, smooth through it, never past the floor. */
export function soften(cp: number): number {
  const d = TAPS.knee - cp
  if (d <= 0) return cp
  const room = TAPS.knee - TAPS.floor
  return TAPS.knee - (d * room) / (d + room)
}

/** One scan: each tap's Cp, in layout order. */
export function readTaps(field: FlowField, taps: readonly Tap[], rng: Rng): number[] {
  return taps.map((t) => {
    const probe = { x: t.point.x + t.normal.x * TAPS.lift, y: t.point.y + t.normal.y * TAPS.lift, z: t.point.z + t.normal.z * TAPS.lift }
    return soften(field.pressure(probe)) + TAPS.noise * gaussian(rng)
  })
}

export interface TapExtremes {
  /** Lowest Cp (strongest suction) and where. */
  suction: { cp: number; bodyId: string }
  /** Highest Cp and where. */
  pressure: { cp: number; bodyId: string }
}

/** The scan's strongest suction and highest pressure, for the legend's numbers. */
export function tapExtremes(taps: readonly Tap[], cps: readonly number[]): TapExtremes | null {
  if (taps.length === 0 || cps.length !== taps.length) return null
  let lo = 0
  let hi = 0
  for (let i = 1; i < cps.length; i++) {
    if (cps[i]! < cps[lo]!) lo = i
    if (cps[i]! > cps[hi]!) hi = i
  }
  return { suction: { cp: cps[lo]!, bodyId: taps[lo]!.bodyId }, pressure: { cp: cps[hi]!, bodyId: taps[hi]!.bodyId } }
}
