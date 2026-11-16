/**
 * The legacy card (plan section 9.7): a career's story in a few numbers,
 * shown when it ends (retired, or 2040). Everything comes from the career
 * state, so an ended save shows the same card every time.
 */
import { briefTemplate, firmName, firmRecords, firmReputation, type CareerState, type Ending } from './career'
import { correlationScore } from './reputation'
import { recordsHeld } from './records'
import { CAR_JOBS, PROMISE, RECORD_JOBS, SLED_JOBS } from '../data/briefs'

export interface Legacy {
  firm: string
  /** The career's first and last days (career days). */
  fromDay: number
  toDay: number
  /** How it ended (null while it still runs, for a preview). */
  ending: Ending | null
  jobs: number
  /** Promises kept out of `jobs`. */
  kept: number
  reputation: number
  /** Null before the first job. */
  correlation: number | null
  /**
   * The biggest cut delivered: who for, at what event, and how much (% of
   * drag, metres for a ski jump, seconds for a bobsled, % of fuel for a
   * truck, km/h for a land-speed car). A cut in % of drag always beats the others, since they can't be
   * weighed; between the others the first one delivered stands. A career of
   * only jumps (or only sleds, or only trucks) shows its biggest gain.
   */
  best: { client: string; event: string; cut: number; unit: 'pct' | 'm' | 's' | 'fuel' | 'kmh' } | null
  /** Fees the clients paid in all, ₽. */
  earned: number
  /** Cash at the end, ₽. */
  money: number
  ownTunnel: boolean
  /** Times the firm went broke. */
  broke: number
  /** Tarnovian records the firm's work holds at the end (PR 11a). */
  records: number
}

export function legacyOf(state: CareerState): Legacy {
  let best: Legacy['best'] = null
  // Defence jobs (PR 10x) stay secret: never on the card (their fees are in the firm's earnings, unnamed).
  const shown = state.history.filter((j) => !j.secret)
  for (const job of shown) {
    const b = briefTemplate(job.id)
    if (!b) continue
    const unit = b.event.jump ? 'm' : b.event.sled || b.event.car ? 's' : b.event.truck ? 'fuel' : b.event.record ? 'kmh' : 'pct'
    // A sled's or a car's achieved gain is in points, a tenth of a second each; a record car's, 2 km/h each.
    const cut = unit === 's' ? job.achieved * (b.event.car ? CAR_JOBS.pointSeconds : SLED_JOBS.pointSeconds) : unit === 'kmh' ? job.achieved * RECORD_JOBS.pointKmh : job.achieved
    const beats = !best || (unit === best.unit ? cut > best.cut : unit === 'pct')
    if (beats) best = { client: b.client, event: b.event.name, cut, unit }
  }
  return {
    firm: firmName(state),
    fromDay: 0,
    toDay: state.ended?.day ?? state.day,
    ending: state.ended,
    jobs: shown.length,
    kept: shown.filter((j) => j.achieved >= j.promised - PROMISE.allowance).length,
    reputation: firmReputation(state),
    correlation: correlationScore(state.history),
    best,
    earned: state.history.reduce((sum, j) => sum + j.paid, 0),
    money: state.money,
    ownTunnel: state.facility.ownOrdered !== null,
    broke: state.broke.length,
    records: recordsHeld(firmRecords(state)),
  }
}
