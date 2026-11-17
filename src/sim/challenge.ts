/**
 * Challenges (PR 11h): "beat my CdA" on the same brief. The sender's code
 * carries their design, the brief (with its seed, so the event day and the
 * air are the same) and their career's seed (so the tunnel's quirks are
 * too). The receiver gets a practice copy of that one job outside their
 * career, starting from the client's own setup, and tries to beat the
 * sender's CdA on the day. The target is worked out here from the design,
 * so a code can't claim a number its design doesn't make.
 */
import { CHALLENGE } from '../data/challenge'
import type { Design } from '../data/sport'
import { briefTemplate, dayCdA, newCareer, type Brief, type CareerState } from './career'
import { sportOf } from './design'

export interface Challenge {
  /** The job's brief, as the sender had it (its seed sets the event day). */
  brief: Brief
  /** The sender's career seed: the tunnel's quirks. */
  seed: number
  /** The career day the sender took the job on. */
  day: number
  /** The design the sender delivered. */
  design: Design
  /** The sender's firm, for "beat {firm}". */
  firm: string
}

/** Can this brief be a challenge? Only the jobs judged by CdA on the day, never a defence one. */
export function challengeable(id: string): boolean {
  const b = briefTemplate(id)
  return !!b && !b.defence && CHALLENGE.sports.includes(sportOf(b.setup))
}

/** The CdA to beat: the sender's design on the day, m². */
export function challengeTarget(c: Challenge): number {
  return dayCdA(c.brief, c.design)
}

/**
 * The practice copy: a fresh firm on the sender's seed and day, with the
 * job in hand, the client's setup on the bench, money for the tunnel, and
 * the first-job guide off. It never touches the player's own career.
 */
export function challengeCareer(c: Challenge): CareerState {
  const b = briefTemplate(c.brief.id)!
  const base = newCareer(c.seed)
  return {
    ...base,
    day: c.day,
    money: CHALLENGE.money,
    board: [c.brief],
    job: { brief: c.brief, promise: b.target, startDay: c.day, daysLeft: c.brief.days, spent: 0 },
    guide: { off: true, done: [] },
  }
}

export type ChallengeOutcome = 'beat' | 'tie' | 'short'

/** How a CdA on the day did against the target. */
export function challengeOutcome(target: number, mine: number): ChallengeOutcome {
  if (Math.abs(mine - target) <= CHALLENGE.tie) return 'tie'
  return mine < target ? 'beat' : 'short'
}
