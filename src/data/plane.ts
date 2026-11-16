/**
 * Fixed-wing planes (plan sections 4.1, 6 and 9.6, PR 10i). The first is
 * the survey drone: a two-metre electric mapping plane flown mid-career for
 * farms and pipeline companies. Kelbo chose (16 November 2026):
 * - The promise is **range on a charge**: kilometres flown at survey speed
 *   on one battery, on the site's usual day.
 * - The firm shapes the **camera pod**, the **winglets**, the **fuselage's
 *   nose and tail**, and the **tail's size**.
 * - The tunnel's trap is the **small-model wing stall** (a later PR): a
 *   half-size model's wing flies at a lower Reynolds number and stalls early.
 * - In the field, a plane shaped too far **stalls in a gust on a turn**,
 *   spins and lands in the crop. Nobody is hurt; the drone breaks.
 *
 * What each part does:
 * - The camera pod hangs under the belly. Tucked up into the belly it drags
 *   less, but the camera has to see past the belly: the client's rule says
 *   how far up it may go. A fairing round it saves drag for a little weight.
 *   Slid forward it moves the balance forward, steadier in pitch but with a
 *   little more trim drag from the tail holding the nose up.
 * - Winglets turn up at the tips: they cut the induced drag (the drag of
 *   making lift, big on a slow plane) but add their own skin and weight.
 * - The nose: a longer, finer nose drags less, but it weighs more and, like
 *   any body met at an angle, twists the plane nose-up in a gust (it moves
 *   the neutral point forward). The tail cone: the finer it tapers, the less
 *   wake behind the fuselage.
 * - The tail: a smaller one drags less, but it holds the nose less firmly
 *   (less static margin). Too little and a gust on a turn pitches the plane
 *   past the stall.
 *
 * Lengths in metres, areas m², angles degrees, masses kg, forces N, speeds m/s, energies J.
 */

export type PlaneClass = 'survey'

export interface PlaneDesign {
  sport: 'plane'
  /** The client's kind of plane: set by the brief, not shaped. */
  class: PlaneClass
  /** The fuselage: its nose's length, m, and how finely its tail cone tapers, 0 (blunt) to 1 (to a point). */
  fuselage: { nose: number; taper: number }
  /**
   * The camera pod: how far it hangs below the belly, 0 (tucked flush) to 1
   * (on its full mount), how much of it is faired, 0–1, and where it sits
   * along the belly, −1 (aft) to 1 (forward).
   */
  camera: { drop: number; fairing: number; at: number }
  /** The winglets' height, m (0: none). */
  winglets: number
  /** The tail's size, a share of the maker's tail. */
  tail: number
}

/** Slider ranges. */
export const PLANE_RANGE = {
  survey: {
    nose: { min: 0.15, max: 0.45, step: 0.01 },
    taper: { min: 0, max: 1, step: 0.05 },
    drop: { min: 0, max: 1, step: 0.05 },
    fairing: { min: 0, max: 1, step: 0.05 },
    at: { min: -1, max: 1, step: 0.1 },
    winglets: { min: 0, max: 0.2, step: 0.01 },
    tail: { min: 0.6, max: 1.4, step: 0.05 },
  },
}

/** The survey drone as the makers sell it: a short nose, a blunt tail cone, the camera on its full mount, no winglets, the maker's tail. */
export const STOCK_PLANE: Record<PlaneClass, PlaneDesign> = {
  survey: { sport: 'plane', class: 'survey', fuselage: { nose: 0.2, taper: 0.3 }, camera: { drop: 0.7, fairing: 0, at: 0 }, winglets: 0, tail: 1 },
}

export interface PlaneClassSpec {
  /** All-up mass as sold, kg. */
  mass: number
  /** Wing area, m², span, m, and the wing's span efficiency (Oswald) without winglets. */
  wingArea: number
  span: number
  oswald: number
  /** The speed it surveys at, m/s (the camera's overlap sets it), and how far it banks in the turns at each line's end, degrees. */
  survey: number
  bank: number
  /** The battery: its energy, J, the share flown before the reserve, and how much of what's drawn turns into push (motor, prop). */
  battery: number
  usable: number
  propulsive: number
  /** The wing's lift slope, per radian, and the most lift it makes full size before it stalls. */
  liftSlope: number
  clMax: number
  /** The client's rule: the camera hangs at least this far down, or it sees the belly. */
  cameraMinDrop: number
}

export const PLANE_CLASS: Record<PlaneClass, PlaneClassSpec> = {
  survey: {
    mass: 3.6,
    wingArea: 0.55,
    span: 2.1,
    oswald: 0.8,
    survey: 16,
    bank: 35,
    battery: 180 * 3600,
    usable: 0.85,
    propulsive: 0.55,
    liftSlope: 5,
    clMax: 1.3,
    cameraMinDrop: 0.35,
  },
}

/** The aero (gameplay model, tuned to a two-metre electric survey plane). */
export const PLANE_AERO = {
  /** The wing's profile drag coefficient (on the wing area). */
  wingCd0: 0.011,
  /** The fuselage's front, m², and its drag coefficient: `skin`, plus `noseBluff` ÷ nose length (a short nose is blunt), plus `base` × (1 − taper) for the wake behind a blunt tail. */
  bodyFront: 0.012,
  bodySkin: 0.1,
  noseBluff: 0.03,
  bodyBase: 0.18,
  /** The fuselage's skin drag area per metre of nose, m²/m. */
  noseSkin: 0.0015,
  /** The camera pod's front, m², its drag coefficient bare, and the share a full fairing takes off. */
  podFront: 0.006,
  podCd: 0.9,
  podFaired: 0.65,
  /** Tucked flush, this share of the pod still sits in the air. */
  podFlush: 0.25,
  /** The maker's tail: its drag area, m². */
  tailCdA: 0.0022,
  /** The motor, prop hub and the rest, a fixed drag area, m². */
  miscCdA: 0.001,
  /** Winglets raise the span efficiency by this × their height ÷ the span; their own drag area per metre of height, m²/m, and mass per metre, kg/m. */
  wingletGain: 2.5,
  wingletCdA: 0.002,
  wingletMass: 0.3,
  /** A full fairing's weight, kg, and the nose's per metre over the stock length, kg/m. */
  fairingMass: 0.08,
  noseMass: 0.4,
  noseStock: 0.2,
  /**
   * Static margin, a share of the wing's chord: the maker's, what the tail
   * adds per share of its size, what sliding the camera forward adds (per
   * unit of `at`), and what each metre of nose over the stock takes away.
   */
  margin: 0.12,
  tailMargin: 0.25,
  podMargin: 0.03,
  noseMargin: 0.25,
  /** Holding the nose up against a forward balance costs drag: this drag area per unit of margin, m². */
  trimCdA: 0.002,
}

/**
 * A gust on a turn (plan section 7's gust stall): a gust lifts the wing by
 * its speed over the plane's, through the lift slope. A plane held firmly
 * in pitch takes it as it comes; one held loosely (margin under `steady`)
 * pitches up into it, and the lift jump grows by up to `gain` times the
 * shortfall.
 */
export const PLANE_GUST = {
  steady: 0.1,
  gain: 3,
}

export interface SurveySite {
  id: 'ozimka'
  /** Height above the sea, m, a usual survey day's air, °C, and its usual strongest gust, m/s. */
  altitude: number
  temperature: number
  gust: number
}

/**
 * How a survey plane flies its lines (PR 10o): back and forth across the
 * field, each line this long, m, turning round at each end in a half
 * circle banked as the class says (its radius follows from the bank and
 * the survey speed). The first turn comes after the first line.
 */
export const SURVEY_PATTERN = {
  line: 600,
}

export const SURVEY_SITES: Record<SurveySite['id'], SurveySite> = {
  /** The Ozimka fields east of Stavren: a farm co-operative's wheat, flat and open to the wind. */
  ozimka: { id: 'ozimka', altitude: 180, temperature: 16, gust: 2 },
}

/**
 * The survey drone's build, for its outline and its drawing (PR 10j): a
 * slim fuselage, a high wing, a pusher motor on a pylon behind it, a
 * conventional tail at the tail cone's end, and the camera pod under the
 * belly. The aero above uses its own areas; these only place the parts.
 */
export const PLANE_BODY = {
  /** The fuselage's half-width and half-height, m (its front is about bodyFront). */
  half: 0.055,
  halfHeight: 0.065,
  /** The straight middle behind the nose, m, and the tail cone behind it, m. */
  mid: 0.36,
  cone: 0.62,
  /** The tail cone's end as a share of the full body: blunt (taper 0) and to a point (taper 1). */
  endBlunt: 0.7,
  endPoint: 0.08,
  /** The wing's chord, m (its area over its span), how far behind the nose it starts, m, and its dihedral, degrees. */
  chord: 0.26,
  wingFrom: 0.04,
  dihedral: 3,
  wingThick: 0.03,
  /** The maker's tail: the tailplane's span and chord, m, and the fin's height and chord, m (all grow with the square root of the tail's size). */
  tailSpan: 0.62,
  tailChord: 0.15,
  finHeight: 0.22,
  finChord: 0.18,
  /** The camera pod: its length, width and height, m, how far it moves along the belly per unit of `at`, m, and how far its mount drops it on its full mount, m. */
  pod: { length: 0.16, width: 0.09, height: 0.07, slide: 0.12, mount: 0.025 },
  /** A full fairing adds a rounded nose and tail this long, m. */
  fairing: 0.07,
  /** The pusher prop's radius, m, and its pylon's height above the wing, m. */
  prop: 0.15,
  pylon: 0.1,
  /** Where the plane sits on its stand on the Shape stage, m above the floor (drawn only). */
  stand: 1.05,
}

/** The desk's guess at a survey drone (PR 10j): how far off its drag can be, shared by a job and per design. */
export const PLANE_DESK = {
  dragBias: 0.04,
  jitter: 0.012,
  /** Riding out less than this times the site's usual gust on a turn is an amber warning on the sheet. */
  gustClose: 1.15,
}

/**
 * The survey drone in the tunnel (PR 10k). A plane is too big to test full
 * size, so the shop builds it smaller (PLANE_SCALES in model.ts), and a
 * smaller, slower wing flies at a lower Reynolds number. Below `reFull` its
 * boundary layer stays laminar further back and separates early: the wing
 * drags more and stalls sooner, all the way down to `reLow`. That's Kelbo's
 * trap (16 November 2026): a small model run at survey speed says the plane
 * stalls in a gust it rides out. Trip strips on the wing take back most of
 * it (for a little drag of their own); so does a bigger model, or a faster
 * fan, which match the Reynolds number.
 */
export const PLANE_TUNNEL = {
  /** The wing's Reynolds number (on its chord) above which it flies as full size does, and below which it's at its worst. */
  reFull: 250_000,
  reLow: 100_000,
  /** At its worst, the wing's most lift falls by this much, and its own profile drag rises by this share. */
  stallDrop: 0.35,
  bubble: 0.35,
  /** Trip strips take back these shares of the stall's drop and of the extra drag, and add this share to the wing's profile drag. */
  trips: { stall: 0.85, bubble: 0.7, drag: 0.04 },
  /** Past the stall, the lift falls to this share of the most, and the wing's profile drag grows this many times. */
  stalledLift: 0.7,
  stalledDrag: 6,
  /** Past the stall, the lift falls this many times as fast as it grew, down to `stalledLift`. */
  stallFall: 2,
  /** The wing section's thickness, a share of its chord (its edge-on front, for the blockage). */
  wingThickness: 0.12,
  /**
   * The forecast reads the stall only from a reading this far past the
   * point where the lift stopped growing with the angle (its lift short of
   * the straight line by this share).
   */
  stallSeen: 0.08,
  /** The drag fit uses only readings with no more lift than this (where the plane flies its lines and turns, well clear of the stall). */
  dragUpTo: 0.8,
  /** The pitching moment fit uses only readings with at least this much lift (near zero lift the moment is all noise). */
  momentFrom: 0.15,
  /** The pitching moment's noise floor, per unit of balance noise, as a moment coefficient. */
  momentNoise: 0.4,
  /** The speed a plane model's Reynolds number is matched to in the model shop, m/s: survey speed. */
  matchSpeed: 16,
  /** The sting's pitch dial on the Tunnel screen (PR 10l), degrees of the wing's angle of attack, and how fast it turns, degrees per second. */
  pitch: { min: -4, max: 20, step: 1, rate: 4 },
}
