/**
 * Defence clearance (plan section 9.7; Kelbo, 16 November 2026): apply,
 * then wait. Everything here is worked out from the career state, so a save
 * gives the same answers every time.
 */
import { CLEARANCE } from '../data/defence'
import { readOf, readError, type Delivered } from './reputation'

/** Where the firm stands with the ministry. */
export type Clearance =
  /** Never applied. */
  | { status: 'none' }
  /** Applied on `applied`; vetting ends on `ready` (career days). */
  | { status: 'vetting'; applied: number; ready: number }
  /** Cleared since `since`. */
  | { status: 'cleared'; since: number }
  /** Lost on `on`: the firm went broke, or a run of poor reads. */
  | { status: 'lost'; on: number; why: 'broke' | 'reads' }

export const NO_CLEARANCE: Clearance = { status: 'none' }

/** Clearance as of `day`: vetting that has run its time is cleared. */
export function clearanceOn(c: Clearance, day: number): Clearance {
  return c.status === 'vetting' && day >= c.ready ? { status: 'cleared', since: c.ready } : c
}

/** True if the firm is cleared on `day` (defence briefs can reach its board). */
export function isCleared(c: Clearance, day: number): boolean {
  return CLEARANCE.open && clearanceOn(c, day).status === 'cleared'
}

/** True if the last CLEARANCE.poorRun reads on the record were all poor. */
export function poorRun(history: readonly Delivered[]): boolean {
  const n = CLEARANCE.poorRun
  return history.length >= n && history.slice(-n).every((j) => readOf(readError(j)) === 'poor')
}

/**
 * Clearance after a job closes on `day`: vetting may have finished, and a
 * firm that went broke, or whose reads have been poor too long, loses it
 * (vetting or cleared alike).
 */
export function reviewClearance(c: Clearance, day: number, history: readonly Delivered[], wentBroke: boolean): Clearance {
  const now = clearanceOn(c, day)
  if (now.status !== 'vetting' && now.status !== 'cleared') return now
  if (wentBroke) return { status: 'lost', on: day, why: 'broke' }
  if (poorRun(history)) return { status: 'lost', on: day, why: 'reads' }
  return now
}

/** Why the firm can't apply now, or null if it can. */
export type ApplyBlock = 'closed' | 'ended' | 'applied' | 'wait' | 'reputation' | 'correlation' | 'money' | null

export interface ApplyCheck {
  day: number
  money: number
  reputation: number
  /** Null before the first job. */
  correlation: number | null
  clearance: Clearance
  ended: boolean
}

export function applyBlock(s: ApplyCheck): ApplyBlock {
  if (!CLEARANCE.open) return 'closed'
  if (s.ended) return 'ended'
  const c = clearanceOn(s.clearance, s.day)
  if (c.status === 'vetting' || c.status === 'cleared') return 'applied'
  if (c.status === 'lost' && s.day < c.on + CLEARANCE.reapplyAfter) return 'wait'
  if (s.reputation < CLEARANCE.minReputation) return 'reputation'
  if ((s.correlation ?? 0) < CLEARANCE.minCorrelation) return 'correlation'
  if (s.money < CLEARANCE.fee) return 'money'
  return null
}

/** Apply on `day`: vetting starts, ending CLEARANCE.vettingDays later. */
export function applied(day: number): Clearance {
  return { status: 'vetting', applied: day, ready: day + CLEARANCE.vettingDays }
}
