/**
 * Tuning numbers for the aero model (plan section 6). Real physics where it is
 * cheap, game-tuned values where the real thing would need CFD. The tests in
 * tests/aeroDrag.test.ts hold these to reference numbers (a sphere's drag
 * crisis, flat-plate friction, a cylinder's drag), so change them with care.
 */

/** Where a boundary layer turns from laminar to turbulent (section 6.2). */
export const TRANSITION = {
  /**
   * Reynolds number, based on the distance run from the stagnation point, at
   * which a smooth surface in perfectly calm air goes turbulent. Lower than a
   * flat plate's textbook 5 × 10⁵ because curved noses speed the flow up;
   * picked so a smooth sphere's drag crisis lands near Re 3.5 × 10⁵.
   */
  reynolds: 2.8e5,
  /** Turbulence intensity cuts that number: divide by (1 + this × Tu in %). */
  turbulencePerPercent: 0.6,
  /**
   * Roughness makes transition early. Its own Reynolds number (ρVk/μ) above
   * this value trips the layer straight away; below it, it helps a little.
   */
  roughnessReynolds: 250,
  /** A trip strip works once its height's Reynolds number passes this. */
  tripReynolds: 300,
  /**
   * The crisis isn't a cliff: the layer counts as turbulent over a band of
   * ± this fraction around the transition point.
   */
  band: 0.22,
} as const

/** Flat-plate skin friction (section 6.2). Real correlations. */
export const FRICTION = {
  /** Laminar (Blasius): Cf = laminar / √Re. */
  laminar: 1.328,
  /** Turbulent (Prandtl): Cf = turbulent / Re^0.2. */
  turbulent: 0.074,
  turbulentExponent: 0.2,
  /**
   * Supervelocity form factor for streamlined bodies, applied to friction:
   * 1 + a / f^1.5 + b / f³ for fineness ratio f (Hoerner, Raymer), capped.
   */
  formA: 1.5,
  formB: 7,
  formMax: 1.5,
} as const

/** Where attached flow tears off the back of a body (section 6.2). */
export const SEPARATION = {
  /**
   * Degrees a laminar layer can turn back towards the axis past the widest
   * point before it separates. (A real smooth sphere lets go a little before
   * its widest point, near 80° from the nose; the wake pressures below are
   * tuned so the drag comes out right with this simpler rule.)
   */
  laminarTurnDeg: 10,
  /** Turbulent layers hold on much longer: about 115° round a sphere. */
  turbulentTurnDeg: 25,
} as const

/**
 * Wake (pressure) drag behind the separation line. The wake's area times how
 * far its pressure drops below the free stream. Laminar separation leaves a
 * wide, low-pressure wake; turbulent separation a narrower, milder one. Long
 * flat wakes (behind a cylinder across the flow) drop further than round
 * ones (behind a sphere).
 */
export const WAKE = {
  /** Base pressure drop (as −Cp) for a round wake. */
  laminarRound: 0.46,
  turbulentRound: 0.19,
  /** And for a very long, flat wake (a cylinder across the flow). */
  laminarFlat: 1.17,
  turbulentFlat: 0.32,
  /**
   * How quickly a wake counts as "flat" as its width-to-height ratio grows:
   * flatness = (ratio − 1) / (ratio − 1 + this).
   */
  flatnessHalf: 5,
} as const

/**
 * Flow separating at a sharp front corner (a box-nosed truck) and the extra
 * drag it costs. Rounding the corner to about a tenth of the body's height
 * cures most of it (Hoerner).
 */
export const FOREBODY = {
  /** Extra drag coefficient on the frontal area when every corner is sharp. */
  sharpCornerCd: 0.45,
  /** The window, as a fraction of the body's height, that a corner is judged over. */
  window: 0.08,
  /** Turning in that window below this many degrees does no harm. */
  safeTurnDeg: 20,
} as const

/** Junction kinds: where two parts meet and their wakes interfere. */
export type JunctionKind = 'generic' | 'strut' | 'wheel-frame' | 'arm-torso' | 'pod-wing' | 'mirror-cab'

/**
 * Interference drag per junction, as ΔCdA = coefficient × thickness² (Hoerner
 * gives this form). A fillet at the joint takes off up to `filletCut` of it.
 */
export const INTERFERENCE: Record<JunctionKind, number> & { filletCut: number } = {
  generic: 0.15,
  strut: 0.12,
  'wheel-frame': 0.4,
  'arm-torso': 0.3,
  'pod-wing': 0.2,
  'mirror-cab': 0.5,
  filletCut: 0.7,
}

/** Cavity kinds: gaps and holes the air churns in. */
export type CavityKind = 'gap' | 'well' | 'spokes'

/**
 * Cavity drag, as ΔCdA = opening area × peak × depth / (depth + half), where
 * depth is the cavity's depth over its opening's width.
 */
export const CAVITY: Record<CavityKind, { peak: number; half: number }> = {
  /** A gap between two bodies (truck cab and trailer). */
  gap: { peak: 0.55, half: 0.6 },
  /** A wheel well or open bay. */
  well: { peak: 0.35, half: 0.4 },
  /** Spinning spokes, per disc area (depth is the spoke count over 32). */
  spokes: { peak: 0.05, half: 0.5 },
}

/** Wings, fins, discs and diffusers (plan section 6.3). */
export const LIFT = {
  /** Endplates raise a wing's effective aspect ratio: × (1 + this × height / span). */
  endplateGain: 1.9,
  /** Span efficiency in the induced-drag formula CL² / (π · AR · e). */
  spanEfficiency: 0.85,
  /** Stall angle (from zero lift) of a 12 %-thick section, degrees. */
  stallDeg: 13,
  /** Each extra 1 % of thickness adds this many degrees before stall. */
  stallPerThickness: 0.35,
  /** Stubby wings stall later: this many degrees ÷ aspect ratio extra (a disc wheel holds on to about 20°). */
  stallLowAspect: 12,
  /** Width of the stall, degrees: soft sections fade over the first, sharp over the second. */
  stallWidthSoft: 9,
  stallWidthSharp: 2,
  /** Past the stall a section acts like a flat plate: CL = this × sin 2α. */
  flatPlateLift: 0.9,
  /** And its drag: CD = this × sin² α. */
  flatPlateDrag: 1.28,
  /** Profile drag thickness factor: × (1 + a·t + b·t⁴), t the thickness ratio. */
  thicknessA: 2,
  thicknessB: 60,
} as const

/**
 * Ground effect (plan section 6.3): a wing near the ground makes more lift or
 * downforce, until it gets so close that the flow under it chokes and the
 * load collapses. That collapse is what makes a car porpoise (PR 9).
 */
export const GROUND = {
  /** Load gain: × (1 + gain / (h/c)) above the critical height. */
  gain: 0.06,
  /** Height over chord where the flow starts to choke. */
  critical: 0.1,
  /** Height over chord where the load has collapsed to `floor` of its peak. */
  collapsed: 0.03,
  floor: 0.35,
  /** Induced drag fades near the ground (Wieselsberger): uses (k·h/b)². */
  inducedK: 16,
} as const

/** Bodies in a crosswind (plan section 6.4). */
export const YAW = {
  /**
   * Side force from a body's side silhouette: area × slope × sin β cos β,
   * scaled up as the body gets longer (a sphere makes none).
   */
  sideSlope: 1.0,
  /** Fineness at which a body counts as fully "long" for side force. */
  longFineness: 3,
  /** Extra drag when side area beyond the frontal area meets the cross flow: × sin² β. */
  crossDrag: 0.6,
  /** Where the side force from a body's length acts, as a fraction of its length from the nose. */
  noseCentre: 0.3,
  /**
   * A long bluff body's drag along its axis climbs in a crosswind: × (cos β +
   * this × sin² β). A rider reads about 5 % more at 10°. Scaled by how long
   * the body is, so a sphere's drag just turns with the wind.
   */
  axialRise: 2,
} as const
