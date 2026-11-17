/**
 * The challenge in play (PR 11i), if this page was opened from a challenge
 * link. Set once at boot; null in a normal career.
 */
import type { Challenge } from '../sim/challenge'

export interface ActiveChallenge {
  challenge: Challenge
  /** The sender's CdA on the day, m², worked out from their design. */
  target: number
}

let active: ActiveChallenge | null = null

export const challengeStore = {
  get: (): ActiveChallenge | null => active,
  set: (c: ActiveChallenge | null): void => {
    active = c
  },
}
