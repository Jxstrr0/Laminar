/**
 * The legacy card (plan section 9.7): a career's story in a few numbers,
 * shown when it ends (retired, or 2040). Everything comes from the career
 * state, so an ended save shows the same card every time.
 */
import { briefTemplate, firmName, firmReputation, type CareerState, type Ending } from './career'
import { correlationScore } from './reputation'
import { PROMISE, SLED_JOBS } from '../data/briefs'

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
   * drag, metres for a ski jump, seconds for a bobsled). A cut in % always
   * beats the others, since they can't be weighed; between metres and
   * seconds the first one delivered stands. A career of only jumps (or only
   * sleds) shows its biggest gain.
   */
  best: { client: string; event: string; cut: number; unit: 'pct' | 'm' | 's' } | null
  /** Fees the clients paid in all, ₽. */
  earned: number
  /** Cash at the end, ₽. */
  money: number
  ownTunnel: boolean
  /** Times the firm went broke. */
  broke: number
}

export function legacyOf(state: CareerState): Legacy {
  let best: Legacy['best'] = null
  for (const job of state.history) {
    const b = briefTemplate(job.id)
    if (!b) continue
    const unit = b.event.jump ? 'm' : b.event.sled ? 's' : 'pct'
    // A sled's achieved gain is in points, a tenth of a second each.
    const cut = unit === 's' ? job.achieved * SLED_JOBS.pointSeconds : job.achieved
    const beats = !best || (unit === best.unit ? cut > best.cut : unit === 'pct')
    if (beats) best = { client: b.client, event: b.event.name, cut, unit }
  }
  return {
    firm: firmName(state),
    fromDay: 0,
    toDay: state.ended?.day ?? state.day,
    ending: state.ended,
    jobs: state.history.length,
    kept: state.history.filter((j) => j.achieved >= j.promised - PROMISE.allowance).length,
    reputation: firmReputation(state),
    correlation: correlationScore(state.history),
    best,
    earned: state.history.reduce((sum, j) => sum + j.paid, 0),
    money: state.money,
    ownTunnel: state.facility.ownOrdered !== null,
    broke: state.broke.length,
  }
}
