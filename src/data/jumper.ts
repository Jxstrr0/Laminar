/**
 * The ski jumper (plan sections 5, 6.4 and 8, PR 8c): body lean, ski
 * V-angle and how baggy the suit is. In flight the jumper is a wing:
 * skis and body each make lift at their angle of attack, and where that
 * lift acts decides whether the jumper holds the attitude or pitches
 * forward. There are no suit rules (Kelbo, 16 November 2026): bagginess
 * only trades lift against stability.
 *
 * Lengths are metres, angles degrees. Along the jumper, x runs forward from
 * the hips (the centre of mass) towards the ski tips.
 */

export interface JumperDesign {
  sport: 'skijump'
  posture: {
    /** Angle between the body and the skis in flight, degrees: small is flat over the skis. */
    leanDeg: number
    /** Angle between the two skis, degrees (the V). */
    vAngleDeg: number
  }
  /** 0 is a skin-tight suit, 1 the baggiest: more lift, less stability. */
  suit: { bagginess: number }
}

export const JUMPER_RANGE = {
  leanDeg: { min: 6, max: 26, step: 1 },
  vAngleDeg: { min: 10, max: 45, step: 1 },
  bagginess: { min: 0, max: 1, step: 0.05 },
} as const

/** A sound modern flight: fairly flat, a wide V, a suit with a little room in it. */
export const DEFAULT_JUMPER: JumperDesign = {
  sport: 'skijump',
  posture: { leanDeg: 12, vAngleDeg: 34 },
  suit: { bagginess: 0.2 },
}

/** An old-school flight: upright over narrow skis in a tight suit. */
export const CLUB_JUMPER: JumperDesign = {
  sport: 'skijump',
  posture: { leanDeg: 24, vAngleDeg: 20 },
  suit: { bagginess: 0.1 },
}

/**
 * The body in flight as a low, wide plate. Its lift comes mostly from the
 * vortices off its edges (strong on stubby shapes), so it keeps lifting at
 * high angles where a long wing would stall.
 */
export const JUMP_BODY = {
  /** Head to feet, and shoulder width. */
  length: 1.75,
  width: 0.42,
  /** A baggy suit adds this much width at the arms and legs (bagginess 1). */
  bagWidth: 0.16,
  /** The head sits this far ahead of the hips along the body. */
  headAhead: 0.82,
  /** Where its lift acts, as a fraction of its length back from the head; a baggy suit fills at the chest and moves it forward. */
  cpFromHead: 0.47,
  cpPerBag: -0.09,
  /**
   * Lying flatter than `flatFrom` degrees of lean, the chest catches the air
   * ahead of the hips: the lift moves forward this much (fraction of the
   * length) per degree flatter, and the jumper is less steady.
   */
  flatFrom: 20,
  cpPerFlat: 0.0065,
  /** Potential-lift factor per unit of aspect ratio, and the vortex-lift factor. */
  kpPerAspect: 1.57,
  kv: 1.6,
  /** Extra vortex lift from a baggy suit (× (1 + this × bagginess)). */
  kvPerBag: 0.35,
  /** Friction and leakage drag of the body plate, per m² of it. */
  cd0: 0.12,
  /** Hips to boots along the body. */
  hipToBoot: 0.95,
}

/** The skis: two long, narrow plates spread in a V. */
export const JUMP_SKIS = {
  length: 2.5,
  width: 0.115,
  /** How far the tips reach ahead of the boots. */
  tipAhead: 1.45,
  /** Where their lift acts, as a fraction of their length back from the tips, and how far it moves aft per degree of angle of attack. */
  cpFromTip: 0.36,
  cpPerDeg: 0.004,
  /** Spread wide, the tips do more of the lifting: the lift moves forward this much (fraction of the length) × sin of half the V. */
  cpPerSpread: 0.6,
  /** Lift factors: a wider V gives more potential lift (× sin of half the V). */
  kpBase: 0.25,
  kpPerSpread: 1.2,
  kv: 1.0,
  cd0: 0.08,
}

/** The jumper's angle of attack through the flight: a ramp from the take-off to the held angle. */
export const FLIGHT_ATTITUDE = {
  /** Skis' angle to the air at take-off, and the angle the jumper settles at, degrees. */
  start: 12,
  hold: 34,
  /** Seconds to settle. */
  ramp: 0.7,
  /** Late in a long flight the angle creeps up by this much per second past the ramp (the skis rise as the jumper floats), degrees. */
  creepPerSecond: 0.8,
}

/**
 * Pitch stability (plan section 6.4): the static margin is how far the
 * lift's neutral point sits behind the hips, as a fraction of the body's
 * length. Below the floor the jumper can't hold the attitude and pitches
 * forward late in the flight: a shorter jump and a wobbly landing.
 */
export const PITCH = {
  /** The margin the promise needs at every point of the flight (the "pitch-stability floor"). */
  floor: 0.02,
  /** Angle step for the margin's slope, degrees. */
  step: 1,
  /**
   * Below zero the jumper pitches forward: the skis' angle falls this fast,
   * degrees a second, to this low, and the lift goes with it.
   */
  collapseRate: 25,
  collapseAlpha: 5,
  /** Between zero and the floor the landing wobbles: this many metres lost per point (0.01) below the floor. */
  wobblePerPoint: 2,
}

/** Small parts the air sees as bluff bodies: helmet and boots (the body and skis are the plates above). */
export const JUMP_PARTS = {
  helmet: { length: 0.28, width: 0.21, height: 0.24, roughness: 0.00005 },
  boot: { diameter: 0.13, height: 0.3 },
}

/**
 * The desk estimate for a jumper (PR 8d): the reference jump's distance with
 * a job-wide bias and a little jitter per design, like the cyclist's DESK
 * (whose analyst levels and error bars it shares), as fractions of the distance.
 */
export const JUMP_DESK = {
  bias: 0.03,
  jitter: 0.01,
}

/** Mass (kg) and price (₽) of the kit, for the readouts. */
export const JUMPER_COST = {
  base: { mass: 7.5, price: 0 },
  /** A tailored suit costs more the roomier it's cut. */
  suit: { mass: 0.6, price: 18000, pricePerBag: 14000 },
} as const

/**
 * The jumper in the tunnel (PR 8e): the model sits on a sting that pitches
 * it through the flight's angles, and the balance reads lift, drag and the
 * pitch moment about the hips. A forecast flies the reference jump on what
 * the balance read, joining the angles measured with straight lines.
 */
export const JUMP_TUNNEL = {
  /** The sting's pitch dial, degrees (the skis' angle to the air). */
  pitch: { min: 6, max: 44, step: 1 },
  /** How fast the sting pitches, degrees per second, and where it starts. */
  rate: 6,
  start: 30,
  /** Readings within this many degrees count as the same angle. */
  sameAngle: 0.25,
  /**
   * A forecast needs readings across the angles the flight passes through,
   * give or take this many degrees at each end.
   */
  coverSlack: 1,
}
