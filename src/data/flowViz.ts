/**
 * Tuning for the flow the visuals show (plan section 6.7): the smoke, the
 * tufts and the pressure map. None of this feeds the aero model's numbers;
 * it turns them into air you can watch. Lengths in metres at full scale
 * unless a comment says the number is relative to a body's size.
 */

/**
 * How the drawn figure (src/render/shapeScene.ts) is fitted with ellipsoids.
 * The radii here match the capsules the Shape screen draws, so the smoke
 * flows round the rider you see.
 */
export const ELLIPSOID_FIT = {
  /** Capsule radii the renderer draws, m. */
  torsoRadius: 0.11,
  upperArmRadius: 0.05,
  forearmRadius: 0.045,
  thighRadius: 0.07,
  shinRadius: 0.05,
  /** The head ball is drawn at this fraction of SKELETON.headRadius. */
  headBall: 0.85,
  /** Torso width as drawn: (base + perArm × arm width) / 2 either side, m. */
  torsoWidthBase: 0.3,
  torsoWidthPerArm: 0.25,
  /**
   * A capsule becomes an ellipsoid with the same tips (length × this) and a
   * fatter middle (radius × this), so it covers most of the rounded rod
   * without bulging far past its ends.
   */
  capsuleLength: 1,
  capsuleRadius: 1.15,
  /** The road helmet is drawn this much taller than its listed height. */
  roadHelmetHeight: 1.1,
  /** Frame tubes: a Kamm tube is drawn this much deeper and thinner. */
  kammDeep: 2.2,
  kammThin: 0.75,
}

/** The cheap potential flow round each ellipsoid. */
export const FLOW_FIELD = {
  /**
   * A body's push on the air fades out between these distances, counted in
   * the body's own radii (its ellipsoid stretched to a unit ball), and is
   * exactly zero beyond. At 6 radii the push is already under 0.3 % of the
   * air speed.
   */
  fadeFrom: 6,
  cutoff: 10,
  /**
   * Near a surface, any air still heading into the body (where two
   * ellipsoids overlap and their pushes add up) is turned along it: fully
   * within `guardFull` of the surface, fading out by `guardBand`. Both are
   * fractions of the body's smallest semi-axis.
   */
  guardFull: 0.05,
  guardBand: 0.5,
}

/**
 * The wake behind each separation line: it starts where the flow leaves the
 * body, grows as it goes downstream and fades away.
 */
export const WAKE_VIZ = {
  /**
   * The wake reaches this far upstream of its start (a fraction of the
   * body's half-length along the flow), so it covers the separated patch on
   * the body's back.
   */
  rampIn: 0.6,
  /** Growth of the wake's half-width per metre downstream (both ways). */
  spread: 0.12,
  /** Full strength inside this fraction of the wake's half-width, fading to 0 at its edge. */
  core: 0.45,
  /** The wake fades out over this many of its own starting widths. */
  fadeWidths: 9,
  /** Shortest fade length, m, so a thin tube's wake still shows. */
  minFade: 0.35,
  /** The smoke slows by this fraction of the air speed in the heart of a wake. */
  deficit: 0.55,
}

/** Tufts on the surface. */
export const TUFTS = {
  /** Spacing between tufts, m. */
  spacing: 0.05,
  /** Rings and points per ring are kept between these. */
  minRings: 3,
  minPerRing: 4,
  maxPerEllipsoid: 160,
  /** The flow is sampled this far off the surface, as a fraction of the body's smallest semi-axis. */
  lift: 0.04,
  /**
   * How quickly a tuft goes from steady to flailing past its line's
   * separation point, in units of how far its face turns downstream (0 to 1).
   */
  band: 0.12,
}

/** Seeded turbulence in a wake: what makes the smoke churn and tufts flail. */
export const TURBULENCE = {
  /** Size of an eddy, m. */
  cell: 0.09,
  /** Eddies drift downstream at this fraction of the air speed. */
  convect: 0.6,
  /** How many times a second the eddy pattern changes. */
  evolve: 1.6,
  /** Gust size in the heart of a wake, as a fraction of the air speed. */
  amplitude: 0.35,
}

/** The pressure map's estimate (plan section 6.7). */
export const CP_VIZ = {
  /** Pressure coefficient deep in a separated wake (the base pressure). */
  wakeBase: -0.35,
}
