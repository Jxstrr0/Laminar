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
  /** A skater's trunk as drawn: half its width, m. */
  skaterTorsoHalfWidth: 0.19,
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

/**
 * Pressure taps (plan section 7.1): pinholes in the model's skin piped to a
 * scanner. They sit on a coarse lattice over the rider's parts and read the
 * pressure coefficient there, with the scanner's own scatter.
 */
export const TAPS = {
  /** Spacing between taps over the surface, m at full size. */
  spacing: 0.1,
  /** The reading is taken this far off the skin, m at full size (inside the boundary layer's edge). */
  lift: 0.004,
  /** Scanner scatter on each reading, in Cp (standard deviation). */
  noise: 0.02,
  /**
   * The field's attached-flow estimate runs away in the tight gaps between
   * legs and arms, where real air separates long before. Past `knee` a
   * reading eases off, never reaching `floor`, so the order of readings
   * holds but none runs away.
   */
  knee: -1.2,
  floor: -2.5,
}

/**
 * The Cp map's colours (plan section 11): a diverging scale, blue for
 * suction (Cp below 0) through a neutral grey at 0 to orange for pressure,
 * lightness stepping evenly out from the middle. Blue and orange stay apart
 * for every common colour-vision type, and orange keeps clear of the red the
 * lab uses for separation. Equal steps per arm, though the arms cover
 * different Cp ranges.
 */
export const CP_PALETTE = {
  min: -2,
  max: 1,
  suction: ['#376AD6', '#6A96EB', '#A7BFE9'],
  neutral: '#E2E2DE',
  pressure: ['#E3B47D', '#D68125', '#AD5702'],
  /** Legend ticks, Cp. */
  ticks: [-2, -1, 0, 1],
}

/**
 * The tunnel's smoke and tufts as drawn (PR 3d). Positions are in the
 * full-size rider's metres (the drawing scales them down with the model);
 * speeds are how fast the smoke moves on screen in those metres, slowed
 * right down from the real air so you can follow it.
 */
export const SMOKE_VIZ = {
  /** On-screen smoke speed at the fan's top speed, full-size m/s. */
  speedAtTop: 1.6,
  /** Smoke never crawls slower than this while the fan runs. */
  minSpeed: 0.4,
  /** How much the wake's churn adds, as a fraction of the gust the field gives. */
  churn: 1,
  /** Smoke goes no further than this downstream of the bike's middle, m. */
  reach: 1.5,
  /** Nor lives longer than this, s. */
  life: 4,
  /** Distance upstream of the bike's middle the rake and wand start, m. */
  upstream: 1.1,
  /** The rake: nozzles up the rider's centre line, from low to high, m. */
  rake: { low: 0.2, high: 1.5, nozzles: 10, perSecond: 30 },
  /** The wand puffs this many times a second. */
  wandPerSecond: 45,
  /** Most puffs alive at once (all instruments together). */
  maxPuffs: 1200,
}

export const TUFT_VIZ = {
  /** Tuft spacing on the surface, m (wider than the field's default keeps phones quick). */
  spacing: 0.06,
  /** Drawn length of a tuft, m. */
  length: 0.07,
  /** Lifted this far off the surface so it isn't hidden in the body, m. */
  lift: 0.006,
  /** A flailing tuft swings up to this angle either way, degrees. */
  flail: 150,
  /** A steady tuft still trembles this much, degrees, more when buffeted. */
  tremble: 6,
  buffet: 40,
  /** Flailing speed, swings per second. */
  rate: 7,
}
