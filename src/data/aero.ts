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
