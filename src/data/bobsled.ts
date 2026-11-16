/**
 * The bobsled (plan sections 5 and 9.6, PR 8l). Kelbo chose (16 November
 * 2026) to shape the sled and the crew's tuck, inside a rule box like the
 * cycling federation's, with a two-man sled first and a four-man later.
 *
 * - The sled: its nose and tail lengths (they share the length the rules
 *   allow) and how high the cowling stands over the ice.
 * - The tuck: how low the crew fold behind it, from a loose racing tuck to
 *   the deepest they can hold. Lower is less drag, but a
 *   cramped crew loads slower after the push, and the driver must still see
 *   over the cowling.
 *
 * Lengths in metres, heights above the ice, speeds m/s.
 */

export type Crew = 2 | 4

export interface BobsledDesign {
  sport: 'bobsled'
  /** Two-man or four-man: set by the job, not shaped. */
  crew: Crew
  sled: {
    /** The nose's length ahead of the cockpit, m. A longer nose is finer. */
    nose: number
    /** The tail's taper behind the cockpit, m. A longer tail closes gentler. */
    tail: number
    /** The cowling's top above the ice, m. Higher shelters the crew but is a bigger front. */
    cowl: number
  }
  /** 0: a loose racing tuck; 1: the deepest tuck the crew can fold into. */
  tuck: number
}

export const BOBSLED_RANGE = {
  nose: { min: 0.3, max: 0.9, step: 0.01 },
  tail: { min: 0.1, max: 0.6, step: 0.01 },
  cowl: { min: 0.4, max: 0.66, step: 0.01 },
  tuck: { min: 0, max: 1, step: 0.05 },
} as const

/** A good racing two-man sled: a fair nose and tail, a mid cowling, a firm tuck. */
export const DEFAULT_BOBSLED: BobsledDesign = { sport: 'bobsled', crew: 2, sled: { nose: 0.62, tail: 0.4, cowl: 0.54 }, tuck: 0.6 }

/** A club's old sled: a short blunt nose, a stubby tail, a low cowling, a loose tuck. */
export const CLUB_BOBSLED: BobsledDesign = { sport: 'bobsled', crew: 2, sled: { nose: 0.4, tail: 0.15, cowl: 0.46 }, tuck: 0.2 }

/**
 * The fictional Tarnovian Sliding Federation's rule box (PR 8l): the sled's
 * whole length and its cowling's height. Width is fixed by the runners.
 */
export const SLIDING_RULES = {
  maxLength: { 2: 2.7, 4: 3.8 },
  maxCowl: 0.6,
} as const

/** The parts of a sled the shaper doesn't change. */
export const SLED = {
  /** The cockpit's length between nose and tail, by crew, m. */
  body: { 2: 1.55, 4: 2.45 },
  /** Width across the cowling, m. */
  width: 0.67,
  /** The hull's underside above the ice (runners and axles below it), m. */
  floor: 0.1,
  /** How square the hull's cross-section is (0 round, 1 box). */
  squareness: 0.55,
  /** Paint on composite, m. */
  roughness: 0.00002,
  /** The nose's profile: section grows as (x / nose) ^ this. */
  noseExponent: 0.5,
  /** The tail ends cut off at this share of the full section (the open back). */
  tailCut: 0.45,
  /** Runners, axles and steering gear under the hull, m² of drag area. */
  runnersCdA: 0.06,
  /**
   * The nose meeting the air: a short nose is blunt, and its pressure drag
   * is (noseK ÷ nose)² on the hull's frontal area. Halving the nose's length
   * quadruples it; past about 0.7 m there's little left to win.
   */
  noseK: 0.13,
  /** Sled mass, kg, and the most sled plus crew may weigh (ballast tops it up). */
  mass: { 2: 170, 4: 210 },
  maxTotal: { 2: 390, 4: 630 },
  /** What a new racing shell on the club's runners costs to build, ₽ (shown on the sheet). */
  price: { 2: 360000, 4: 520000 },
} as const

/**
 * The crew in the cockpit. Each sits one behind the other; what shows over
 * the cowling (helmet first, then shoulders) meets the air.
 */
export const BOB_CREW = {
  /** Helmet tops above the ice: in a loose tuck (0), and in the deepest (1), m. */
  sitTop: 0.94,
  tuckTop: 0.74,
  /** The helmet's height and width, then the shoulders' width below it, m. */
  helmetHeight: 0.24,
  helmetWidth: 0.23,
  shoulderWidth: 0.46,
  /** Drag coefficient of what shows. */
  cd: 0.85,
  /** Behind the driver each crew member rides in the one ahead's wake: drag times this. */
  shelter: 0.35,
  /** The driver's eyes sit this far below the helmet's top, m. */
  eyeBelowTop: 0.1,
  /** The driver needs this much clear over the cowling's lip to read the track, m. */
  sightClear: 0.08,
} as const

/**
 * Loading after the push: the crew jump in and fold down. A deep tuck and a
 * tall cowling make it slower, and the sled sheds speed while they do.
 */
export const BOB_LOAD = {
  /** Speed lost loading, m/s: a base, more for the tuck (squared: the last of it is the hardest), more per metre of cowling over `cowlEasy`. */
  base: 0.15,
  perTuck: 0.35,
  cowlEasy: 0.5,
  perCowl: 2,
} as const

/** A driver who can't see enough of the track steers late: time lost in each curve per metre short of clear sight, s. */
export const BOB_BLIND = { perCurvePerMetre: 0.6 } as const

/** Runner friction on ice: least at `bestTemp`, rising either side of it. */
export const BOB_ICE = {
  friction: 0.0055,
  bestTemp: -7,
  perDegree: 0.02,
} as const

/**
 * The desk's guess at a sled (PR 8m): the drag area with a job-wide bias
 * and a small per-design jitter (fractions, standard deviations), then the
 * run on it. A few per cent of drag is tenths of a second down the track,
 * far more than the hundredths a client asks for: that's what the tunnel is for.
 */
export const BOB_DESK = {
  bias: 0.06,
  jitter: 0.02,
}

/** Fixed time step of the run, s. */
export const BOB_STEP = 0.01
