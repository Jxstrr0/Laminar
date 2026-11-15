/**
 * The university's old low-speed tunnel.
 *
 * Every tuning number for the tunnel lives here, not in the code. Its hidden
 * quirks (blockage, turbulence, sting interference, static wheels and legs)
 * arrive in PR 4.
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
} as const

/**
 * The calibration sphere on the sting. Its drag comes from the aero model
 * (src/sim/aero/drag.ts), drag crisis included: at 25 cm it goes through the
 * crisis near 20 m/s, right in the middle of the fan's range.
 */
export const REFERENCE_SPHERE = {
  /** Diameter in metres. */
  diameter: 0.25,
} as const
