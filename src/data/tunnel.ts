/**
 * The university's old low-speed tunnel, as far as PR 0 needs it.
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
} as const

/** The calibration sphere on the sting. */
export const REFERENCE_SPHERE = {
  /** Diameter in metres. */
  diameter: 0.25,
  /**
   * Textbook drag coefficient of a smooth sphere below the drag crisis.
   * A placeholder until the aero model (PR 1) works it out from the Reynolds
   * number, drag crisis included.
   */
  dragCoefficient: 0.47,
} as const
