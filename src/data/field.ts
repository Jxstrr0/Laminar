/**
 * The real world (plan sections 6.8 and 8.3): air at an event, the reference
 * rider, and the reference time-trial course. Every number the field model
 * uses lives here.
 */

/** Standard atmosphere and constants. */
export const ATMOSPHERE = {
  /** Sea-level pressure, Pa. */
  seaLevelPressure: 101325,
  /** Pressure falls with height as (1 − lapse × h) ^ exponent (h in metres). */
  lapse: 2.25577e-5,
  exponent: 5.25588,
  /** Specific gas constant of dry air, J/(kg·K). */
  gasConstant: 287.05,
  /** 0 °C in kelvin. */
  kelvin: 273.15,
  /** Sutherland's law for viscosity: μ = ref × (T/Tref)^1.5 × (Tref + S)/(T + S). */
  viscosityRef: 1.716e-5,
  temperatureRef: 273.15,
  sutherland: 110.4,
  /** Gravity, m/s². */
  gravity: 9.81,
} as const

/** Turbulence intensity of open air as a rider sees it (a fraction). */
export const FIELD_TURBULENCE = 0.015

/** The reference rider's engine and machine. */
export const REFERENCE_RIDER = {
  /** Power held for a 40 km time trial, W. */
  power: 300,
  /** Rider plus bike, kg. */
  mass: 80,
  /** Rolling resistance coefficient of good tyres on smooth tarmac. */
  rollingResistance: 0.004,
  /** Fraction of the rider's power that reaches the road. */
  drivetrain: 0.975,
} as const

/** A course segment: length (m), gradient (rise over run) and heading (degrees, 0 is north). */
export interface CourseSegment {
  length: number
  gradient: number
  heading: number
}

/** The reference course: 40 km out and back on flat roads. */
export const REFERENCE_COURSE: CourseSegment[] = [
  { length: 20000, gradient: 0, heading: 0 },
  { length: 20000, gradient: 0, heading: 180 },
]

/** The reference event's typical day, and how much each thing varies from day to day. */
export const REFERENCE_EVENT = {
  /** Air temperature, °C, and its day-to-day spread (standard deviation). */
  temperature: 18,
  temperatureSpread: 4,
  /** Altitude, m. */
  altitude: 250,
  /** Mean wind speed, m/s, and its spread. */
  windSpeed: 3,
  windSpread: 1.5,
  /** The rider's power on the day varies by this fraction (standard deviation). */
  powerSpread: 0.02,
  /** Speed the rider is expected to hold, m/s (for weighting the yaw curve). */
  riderSpeed: 12.5,
} as const

/** Yaw curves are worked out from −max to +max in steps of this, degrees. */
export const YAW_CURVE = { max: 30, step: 2.5 } as const
