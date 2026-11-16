/**
 * The desk estimate: what the analyst can say about a design before any
 * model is built. Truth plus a seeded error, shown with error bars.
 */
import { DESK } from '../data/cyclist'
import { JUMP_DESK, type JumperDesign } from '../data/jumper'
import { referenceJump, type JumpEvent } from './jumper'
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

/**
 * The desk's guess at a jumper's reference jump, m (PR 8d): the still-air
 * flight on the job's hill, through the job's bias and a design's jitter.
 * `stable` and `minMargin` are the desk's word on the pitch-stability floor
 * over the whole flight (it reads that right: the margin is geometry, not a
 * measurement).
 */
export function jumpDeskEstimate(design: JumperDesign, event: JumpEvent, jobSeed: number, designKey: string, analystLevel = 0): DeskEstimate & { stable: boolean; minMargin: number } {
  const ref = referenceJump(design, event)
  const narrow = Math.max(DESK.floor, 1 - DESK.perLevel * analystLevel)
  const bias = JUMP_DESK.bias * narrow * gaussian(new Rng(jobSeed).fork('desk-bias'))
  const jitter = JUMP_DESK.jitter * narrow * gaussian(new Rng(jobSeed ^ hashString(designKey)).fork('desk-jitter'))
  const value = ref.distance * (1 + bias + jitter)
  const spread = Math.sqrt(JUMP_DESK.bias * JUMP_DESK.bias + JUMP_DESK.jitter * JUMP_DESK.jitter) * narrow * DESK.bars
  return { value, low: value * (1 - spread), high: value * (1 + spread), stable: ref.stable, minMargin: ref.minMargin }
}
