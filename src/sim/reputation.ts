/**
 * The firm's reputation and correlation score (plan section 9). Both come
 * straight from the record of finished jobs, so a save needs nothing new:
 * replay the record and you have them.
 */
import { PROMISE } from '../data/briefs'
import { CORRELATION, REPUTATION } from '../data/reputation'

/** What a finished job leaves on the record that the firm's name depends on. */
export interface Delivered {
  /** Promised and achieved cut, %. */
  promised: number
  achieved: number
  /** Declared and real CdA on the day, m². */
  predicted: number
  actual: number
}

export type Read = 'good' | 'fair' | 'poor'

/** How close a declared CdA was to the road's, from (declared − real) ÷ real. */
export function readOf(error: number): Read {
  const e = Math.abs(error)
  return e <= PROMISE.goodRead ? 'good' : e <= 2 * PROMISE.goodRead ? 'fair' : 'poor'
}

/** The read error of one job: (declared − real) ÷ real. */
export const readError = (job: Delivered): number => (job.predicted - job.actual) / job.actual

/** How much one delivery moves the firm's reputation. */
export function reputationChange(job: Delivered): number {
  const shortfall = Math.max(0, job.promised - PROMISE.allowance - job.achieved)
  const promise = shortfall === 0 ? REPUTATION.kept : REPUTATION.missed + REPUTATION.perPointShort * shortfall
  return promise + REPUTATION.read[readOf(readError(job))]
}

const clampRep = (x: number) => Math.min(REPUTATION.max, Math.max(REPUTATION.min, x))

/** The firm's reputation after these jobs (oldest first), whole points. */
export function reputationOf(history: readonly Delivered[]): number {
  let rep: number = REPUTATION.start
  for (const job of history) rep = clampRep(rep + reputationChange(job))
  return Math.round(rep)
}

/** The correlation score, 0–100, from the last few jobs' reads; null before the first job. */
export function correlationScore(history: readonly Delivered[]): number | null {
  const recent = history.slice(-CORRELATION.jobs)
  if (recent.length === 0) return null
  const mean = recent.reduce((s, j) => s + Math.abs(readError(j)), 0) / recent.length
  return Math.round(100 * Math.max(0, 1 - mean / CORRELATION.zeroAt))
}
