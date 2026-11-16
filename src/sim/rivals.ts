/**
 * The rival firms' public records (plan section 9.5): reputation and
 * correlation score, worked out from the career's seed and the week, so a
 * save needs nothing new and every phone shows the same numbers.
 */
import { CORRELATION } from '../data/reputation'
import { RIVALS, RIVAL_WEEK_DAYS, type RivalId } from '../data/rivals'
import { Rng } from './rng'

export interface RivalRecord {
  reputation: number
  /** 0–100, from the read errors of its last few jobs. */
  correlation: number
}

/** A rival's record in the week holding `day` of the career with this seed. */
export function rivalRecord(seed: number, firm: RivalId, day: number): RivalRecord {
  const r = RIVALS[firm]
  const week = Math.floor(day / RIVAL_WEEK_DAYS)
  const drift = new Rng(seed).fork(`rival-rep-${firm}-${week}`).range(-r.drift, r.drift)
  // One job a week: the last few weeks' read errors make the score.
  let total = 0
  for (let k = 0; k < CORRELATION.jobs; k++) {
    total += new Rng(seed).fork(`rival-read-${firm}-${week - k}`).range(r.readError.min, r.readError.max)
  }
  const correlation = Math.round(100 * Math.max(0, 1 - total / CORRELATION.jobs / CORRELATION.zeroAt))
  return { reputation: Math.round(r.reputation + drift), correlation }
}
