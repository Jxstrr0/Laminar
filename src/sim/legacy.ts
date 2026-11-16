/**
 * The legacy card (plan section 9.7): a career's story in a few numbers,
 * shown when it ends (retired, or 2040). Everything comes from the career
 * state, so an ended save shows the same card every time.
 */
import { briefTemplate, firmName, firmReputation, type CareerState, type Ending } from './career'
import { correlationScore } from './reputation'
import { PROMISE } from '../data/briefs'

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
  /** The biggest cut delivered: who for, at what event, and how much (%). */
  best: { client: string; event: string; cut: number } | null
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
    if (b && (!best || job.achieved > best.cut)) best = { client: b.client, event: b.event.name, cut: job.achieved }
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
