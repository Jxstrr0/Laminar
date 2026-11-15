/**
 * The desk estimate: what the analyst can say about a design before any
 * model is built. Truth plus a seeded error, shown with error bars.
 */
import { DESK } from '../data/cyclist'
import type { ShapeSpec } from './geom/body'
import { gaussian } from './noise'
import { hashString, Rng } from './rng'
import { truth, type EventSpec } from './views'

export interface DeskEstimate {
  /** Wind-averaged CdA, m², best guess. */
  value: number
  low: number
  high: number
}

/**
 * @param jobSeed seeds the job-wide bias
 * @param designKey a stable string for the design (seeds the small jitter)
 * @param analystLevel 0 for none; each level narrows the spread
 */
export function deskEstimate(spec: ShapeSpec, event: EventSpec, jobSeed: number, designKey: string, analystLevel = 0): DeskEstimate {
  const real = truth(spec, event).windAveragedCdA
  const narrow = Math.max(DESK.floor, 1 - DESK.perLevel * analystLevel)
  const bias = DESK.bias * narrow * gaussian(new Rng(jobSeed).fork('desk-bias'))
  const jitter = DESK.jitter * narrow * gaussian(new Rng(jobSeed ^ hashString(designKey)).fork('desk-jitter'))
  const value = real * (1 + bias + jitter)
  const spread = Math.sqrt(DESK.bias * DESK.bias + DESK.jitter * DESK.jitter) * narrow * DESK.bars
  return { value, low: value * (1 - spread), high: value * (1 + spread) }
}
