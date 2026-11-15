/**
 * The university's old low-speed tunnel.
 *
 * Every tuning number for the tunnel lives here, not in the code. Its hidden
 * quirks (blockage, turbulent air, the mount's own drag) are drawn from
 * UNIVERSITY_QUIRKS below; static wheels and legs come next.
 *
 * Axes in the test section: the air flows along +x, y is up, and the model's
 * centre sits on the turntable at the origin.
 */
export const UNIVERSITY_TUNNEL = {
  /** Test section, in metres: length along the flow, width, height. */
  section: { length: 8, width: 2.4, height: 1.8 },
  /** Fastest the fan can push the air, in m/s. */
  topSpeed: 40,
  /** How fast the fan can change speed, in m/s per second (it can't jump). */
  rampRate: 6,
  /** The fan slider moves in steps of this many m/s. */
  sliderStep: 0.5,
  /**
   * Turbulence intensity of perfectly calm air (a fraction). The real value
   * is a hidden quirk (UNIVERSITY_QUIRKS); this is what a reading uses with
   * no quirks given, as in the sim's own tests.
   */
  turbulence: 0,
  /**
   * The balance's scatter: each reading's forces wobble by this fraction
   * (standard deviation). Repeat runs and average to beat it.
   */
  balanceNoise: 0.01,
  /** The yaw turntable: range and steps in degrees, and how fast it turns (degrees per second). */
  turntable: { min: -20, max: 20, step: 1, rate: 6 },
  /**
   * The balance readout on screen settles over about this many seconds (an
   * exponential average), so the noise shows as a gentle wobble, not flicker.
   */
  displaySettle: 0.6,
  /** Below this air speed (m/s) the balance reads nothing worth showing. */
  readFrom: 1,
} as const

/**
 * What a run costs (plan section 7.1). Runs cost money, never days. Power is
 * billed by the energy the fan uses, and fan power grows with the cube of air
 * speed, so holding top speed is what costs. The university also charges a
 * small fee per run.
 */
export const TUNNEL_BILLING = {
  /** Fee per run, ₽. */
  perRun: 500,
  /** Power price, ₽ per kWh of fan energy (the university's research rate). */
  perKWh: 2000,
  /**
   * Fan power as a fraction of the air's kinetic power through the test
   * section (½ρAV³): circuit losses over fan efficiency. About 0.35 for an
   * old closed-return tunnel.
   */
  powerFactor: 0.35,
}

/** How runs are recorded (plan section 7.1): from fan-up to fan-down, every sample kept. */
export const RUN_RECORDING = {
  /** A run starts once the air passes this speed, m/s. */
  startAbove: 0.5,
  /** And ends when it has slowed back below this, m/s. */
  endBelow: 0.05,
  /** The balance is sampled this often, seconds of tunnel time. */
  sampleEvery: 0.25,
}

/**
 * The calibration sphere on the sting. Its drag comes from the aero model
 * (src/sim/aero/drag.ts), drag crisis included: at 25 cm it goes through the
 * crisis near 20 m/s, right in the middle of the fan's range.
 */
export const REFERENCE_SPHERE = {
  /** Diameter in metres. */
  diameter: 0.25,
} as const

/**
 * Reading runs side by side (plan section 7.3). Readings taken at rest are
 * grouped by yaw; a group's noise band is ±z standard errors of its mean.
 * A change counts as real only when it is bigger than the combined band.
 */
export const RUN_STATS = {
  /** Standard errors either side of a mean: 2 is about 95 % confidence. */
  z: 2,
  /** Fewer settled readings than this at a yaw and the group isn't trusted. */
  minSamples: 4,
  /** Yaw angles closer than this (degrees) count as the same setting. */
  yawTolerance: 0.5,
  /** Air speeds closer than this (m/s) count as the same setting. */
  speedTolerance: 0.25,
}

/**
 * The university tunnel's hidden quirks (plan section 7.2), drawn once per
 * career from these ranges. The player never sees the numbers: tare runs
 * and calibration runs with the sphere are how they find them out.
 */
export const UNIVERSITY_QUIRKS = {
  /**
   * Blockage: the air squeezes past the model, so readings come out high by
   * the factor (1 + k × model frontal area ÷ test-section area)². This is k.
   */
  blockage: { min: 0.8, max: 1.3 },
  /** Turbulence intensity of the test-section air (a fraction): an old tunnel with tired screens. */
  turbulence: { min: 0.008, max: 0.018 },
  /**
   * The mount's own drag area at model size, m², read along with the model:
   * the sphere's sting, and the two posts that clamp a rider model's axles.
   */
  mount: {
    sting: { min: 0.0025, max: 0.0035 },
    posts: { min: 0.003, max: 0.0045 },
  },
} as const

/** The tunnel's seed until careers arrive (PR 5 seeds it from the save). */
export const DEMO_TUNNEL_SEED = 2010

/**
 * Calibration with the sphere (plan section 7.2): compare its readings with
 * the book (a smooth sphere in calm air, from the aero model) to find the
 * drag crisis and the blockage.
 */
export const CALIBRATION = {
  /** The readings must span at least this much Cd to show a drag crisis. */
  minDrop: 0.12,
  /** Readings below this fraction of the crisis Reynolds number count as before the crisis. */
  subcritical: 0.7,
  /** Settled readings needed before the crisis to trust a blockage figure. */
  minSubReadings: 8,
  /** The book curve: air speeds from, to and step, m/s. */
  book: { from: 1, to: 40, step: 0.25 },
}
