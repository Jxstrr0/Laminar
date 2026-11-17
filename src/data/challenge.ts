/**
 * Challenge codes (PR 11h; Kelbo, 16 November 2026: "Same brief, beat the
 * CdA"). A `LAMD1:` code carries a delivered design, its brief and the
 * career's seed; it opens a practice copy of that job outside the career,
 * and the goal is a lower CdA on the day than the sender's.
 */
import type { Sport } from './sport'

export const DESIGN_CODE_PREFIX = 'LAMD1:'

export const CHALLENGE = {
  /** The format inside a design code; a later Laminar may write a newer one. */
  version: 1,
  /** ₽ the practice firm starts with, for tunnel runs and models. */
  money: 1_000_000,
  /** The sports a challenge can be on: the ones judged by CdA on the day. */
  sports: ['cycling', 'skating'] as readonly Sport[],
  /** A CdA this close (m²) counts as a tie, not a win. */
  tie: 0.0005,
} as const
