/**
 * The balance bot (plan section 14, PR 14c): a headless player that plays
 * whole careers so the economy can be checked across many seeds. These are
 * its habits, not game rules: nothing here changes how the game plays.
 * `npm run balance` prints its report; docs/BALANCE.md explains it.
 */
export const BOT = {
  /**
   * Practice days per brief: the bot shapes its design against this many
   * made-up event days (never the real one), as a careful player's tunnel
   * work would. More is steadier and slower.
   */
  practiceDays: 3,
  /** Designs tried with about half the knobs set at random, before the nudging (gates like a stall check need two parts changed at once). */
  scouts: 40,
  /** Rounds of nudging every slider; each round halves the nudge. */
  shapeRounds: 4,
  /** The first nudge, as a share of a slider's range. */
  firstNudge: 0.25,
  /** Design parts the bot leaves as the client has them (the client's kit, not the shape). */
  fixed: ['sport', 'class', 'crew', 'trailerTop'] as readonly string[],
  /** The bid: promise the worst practice day less this many points, at this share of the way through the fee range. */
  margin: 0.5,
  priceShare: 0.5,
  /** A brief whose promise would come out under this many points isn't worth bidding for. */
  minPromise: 1,
  /** The tunnel work charged on every job: this many runs of this length at this air speed, m/s. */
  runs: 8,
  runSeconds: 240,
  runSpeed: 30,
  /** Build your own tunnel once the cash would still hold this much after paying for it, ₽. */
  reserve: 300_000,
  /** Apply for defence clearance once allowed. */
  clearance: true,
  /** Stop a career that runs this many steps (jobs, bids and waits) without ending: a guard, never reached in play. */
  maxSteps: 5000,
  /** Seeds `npm run balance` plays by default. */
  seeds: 8,
}
