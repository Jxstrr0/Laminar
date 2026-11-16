/**
 * A land-speed record job's speed week (plan section 9, PR 9t).
 *
 * - The promise is km/h gained on the two-way mean on the salt's still day
 *   over the team's current car (Kelbo, 16 November 2026: "km/h on their
 *   car"), so it doesn't hang on the week's wind. A car that ends a run
 *   with the chutes out sets no time, and gains nothing.
 * - Record day is the show: one seeded day's air, a run each way for your
 *   car and the old one in it.
 * - The declared number is the new car's two-way mean on the still day.
 *   How good a read it was is judged on drag: the declared speed is turned
 *   back into how much more (or less) drag than the car really has would
 *   run it.
 */
import type { BriefTemplate } from '../data/briefs'
import type { RecordDesign } from '../data/record'
import { SALT_FLATS, type SaltFlat } from '../data/saltFlats'
import { sightLoss, stillDay, twoWay, type RecordAttempt } from './record'

/** A brief's speed week, ready for the runs. */
export interface RecordEvent {
  flat: SaltFlat
}

/** A brief's speed week, or null if it isn't a record brief. */
export function recordEventFrom(b: Pick<BriefTemplate, 'event' | 'setup'>): RecordEvent | null {
  const e = b.event
  if (!e.record || b.setup.sport !== 'record') return null
  return { flat: SALT_FLATS[e.record.flat] }
}

/** The salt between jobs: Lake Sukhoye on its usual day. */
export const PRACTICE_FLAT: RecordEvent = { flat: SALT_FLATS.sukhoye }

/** The attempt on the salt's still day, the one the promise is judged on. */
export function stillAttempt(design: RecordDesign, flat: SaltFlat, opts: Parameters<typeof twoWay>[3] = {}): RecordAttempt {
  return twoWay(design, flat, stillDay(flat), opts)
}

/** The search's bounds on a drag scale, and how many halvings it makes. */
const SEARCH = { low: 0.2, high: 4, steps: 40 }

/**
 * How much of the car's real drag would run this two-way mean on the
 * salt's still day (1: exactly its drag), whatever the nose or the fin do
 * (the driver keeps going). Less drag runs faster, so halving the range
 * finds it. Clamped to the search's bounds for a speed no car could make.
 */
export function dragScaleForSpeed(speed: number, design: RecordDesign, flat: SaltFlat): number {
  let lo = SEARCH.low
  let hi = SEARCH.high
  for (let i = 0; i < SEARCH.steps; i++) {
    const mid = (lo + hi) / 2
    const mean = stillAttempt(design, flat, { trim: { drag: mid, lift: 1 }, chutes: false }).mean ?? 0
    // Too fast with this much drag: it has more.
    if (mean > speed) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** The two-way mean the car would run on the still day if the driver kept going whatever happened, m/s (the speed its drag is worth). */
export function speedIfRun(design: RecordDesign, flat: SaltFlat): number {
  return stillAttempt(design, flat, { chutes: false }).mean ?? 0
}

/** What the low canopy cost on the still day: the share of power given up, and the mean without that loss (null if the car doesn't finish either way). */
export function sightCost(design: RecordDesign, flat: SaltFlat): { share: number; mean: number | null } | null {
  const share = sightLoss(design)
  if (share <= 0) return null
  return { share, mean: stillAttempt(design, flat, { sighted: true }).mean }
}
