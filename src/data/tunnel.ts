/**
 * The university's old low-speed tunnel.
 *
 * Every tuning number for the tunnel lives here, not in the code. Its hidden
 * quirks (blockage, turbulence, sting interference, static wheels and legs)
 * arrive in PR 4.
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
   * Turbulence intensity of the air in the test section (a fraction). Calm
   * for now; the real, hidden value is one of the quirks in PR 4.
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
