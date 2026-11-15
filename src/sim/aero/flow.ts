/**
 * The free stream a shape sits in: the same type for the hidden truth (a real
 * event), the tunnel (a model at test speed) and the field (plan section 6.8).
 */
export interface Flow {
  /** Air density, kg/m³. */
  density: number
  /** Dynamic viscosity, Pa·s. */
  viscosity: number
  /** Air speed relative to the body, m/s. */
  speed: number
  /** Turbulence intensity as a fraction (0.005 is 0.5 %). */
  turbulence: number
}
