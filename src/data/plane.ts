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

export const SURVEY_SITES: Record<SurveySite['id'], SurveySite> = {
  /** The Ozimka fields east of Stavren: a farm co-operative's wheat, flat and open to the wind. */
  ozimka: { id: 'ozimka', altitude: 180, temperature: 16, gust: 2 },
}
