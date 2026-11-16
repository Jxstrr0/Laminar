/**
 * Defence contracts (plan sections 2 and 9.7; Kelbo, 16 November 2026).
 *
 * Clearance: apply, then wait. Once the firm's reputation and correlation
 * score are high enough it may apply; vetting takes weeks of game time and a
 * fee, then defence briefs reach the board. Going broke, or a run of poor
 * reads, loses it; the firm may apply again after a while.
 *
 * Secrecy: big fees, no fame. Defence jobs count toward the correlation
 * score but never move the firm's public reputation, and never appear on
 * the legacy card.
 */
export const CLEARANCE = {
  /** Open since PR 10ae: the sensor-pod jobs are on the board for a cleared firm. */
  open: true,
  /** What the firm needs before it may apply. */
  minReputation: 60,
  minCorrelation: 70,
  /** The vetting fee, ₽, and how long vetting takes, days. */
  fee: 250_000,
  vettingDays: 42,
  /** This many poor reads in a row (any jobs) loses it. */
  poorRun: 3,
  /** Once lost, the firm may apply again this many days later. */
  reapplyAfter: 180,
}
