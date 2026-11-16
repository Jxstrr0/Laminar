/**
 * The firm's name (plan section 9, Kelbo's call of 16 November 2026):
 * reputation brings bigger clients onto the board and counts a little when
 * a bid is close. It's built job by job from kept promises and close reads.
 * The correlation score is the public measure of how well your tunnel's
 * numbers match the road.
 */
export const REPUTATION = {
  /** A new firm's reputation, and the limits it stays inside. */
  start: 20,
  min: 0,
  max: 100,
  /** Each delivery: a kept promise adds `kept`; a missed one costs `missed` plus `perPointShort` for each point short. */
  kept: 6,
  missed: -4,
  perPointShort: -2,
  /** How close the declared CdA was (PROMISE.goodRead sets the bands). */
  read: { good: 4, fair: 1, poor: -4 },
  /** In a sealed bid, each reputation point counts as this many promised points. */
  bidPerPoint: 0.02,
  /** The rival firm's reputation (the named rivals bring their own in PR 7b). */
  rival: 40,
}

/** The correlation score: the mean read error over the last `jobs` jobs; `zeroAt` scores 0 and a perfect read 100. */
export const CORRELATION = {
  jobs: 5,
  zeroAt: 0.1,
}
