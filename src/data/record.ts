/**
 * Land-speed record cars (plan sections 4.1, 6.3 and 9, PR 9p). Kelbo
 * chose (16 November 2026) a long, low wheel-driven streamliner first and a
 * jet car later; a tunnel that reads at its own top speed, with drag that
 * grows above about 650 km/h where the air squeezes and the tunnel never
 * sees it; and the record as the mean of a run each way within an hour,
 * where a car whose nose lifts or that wanders aborts with its parachutes
 * (nobody is hurt, but the run doesn't count).
 *
 * What the firm shapes on the streamliner:
 * - The nose cone: its length (a long one cuts pressure drag but adds skin,
 *   and it lets the air squeeze later; it also pulls the side force forward)
 *   and its droop (pointing it down presses the nose onto the salt, with
 *   drag; too little and the nose lifts at speed).
 * - The canopy's height: lower is less drag, but too low and the driver
 *   can't see the line and has to lift.
 * - The tail fin's area: it keeps the car pointing straight (the side force
 *   behind the mass), at a little drag.
 * - The wheel fairings: how much of each wheel they cover. Covered wheels
 *   are far less draggy, but the front ones add side area ahead of the mass.
 *
 * Lengths in metres, areas m², angles degrees, masses kg, powers W.
 */

export type RecordClass = 'streamliner'

export interface RecordDesign {
  sport: 'record'
  /** The client's kind of car: set by the brief, not shaped. */
  class: RecordClass
  /** The nose cone: its length, m, and how far it points down, degrees. */
  nose: { length: number; droop: number }
  /** The canopy's height above the body, m. */
  canopy: number
  /** The tail fin's side area, m². */
  fin: number
  /** How much of each wheel the fairings cover, 0 (open) to 1 (enclosed). */
  fairings: number
}

/** Slider ranges. */
export const RECORD_RANGE = {
  streamliner: {
    length: { min: 1, max: 3.5, step: 0.1 },
    droop: { min: -2, max: 6, step: 0.5 },
    canopy: { min: 0.15, max: 0.45, step: 0.01 },
    fin: { min: 0, max: 1.4, step: 0.05 },
    fairings: { min: 0, max: 1, step: 0.05 },
  },
} as const

/** What each class is, before any aero is shaped. */
export const RECORD_CLASS = {
  streamliner: {
    /** With the driver, kg, and the share of it on the front axle. */
    mass: 2500,
    massFront: 0.45,
    /** The engines at the wheels, W. */
    power: 900_000,
    /** Tyre grip on salt (friction coefficient). All four wheels drive. */
    grip: 0.45,
    /** The body behind the nose cone: its length and height, m; the axles and the mass, m back from where the nose cone joins. */
    body: { length: 8, height: 0.9, frontAxle: 1.4, rearAxle: 7, mass: 3.2 },
    /** The bare body's drag area, m² (no nose cone, canopy, fin or wheels). */
    bodyCdA: 0.06,
    /** Lift at each end of the bare body, m² of lift (a long body near the ground lifts like a wing). */
    lift: { front: 0.2, rear: 0.05 },
  },
} as const

/** How the parts behave. */
export const RECORD_AERO = {
  /** The nose cone's pressure drag (this much m² of drag area for a 1 m nose, falling as 1 ÷ length) and its skin drag per metre, m². */
  nosePressure: 0.09,
  noseSkin: 0.012,
  /** A longer nose lifts more at the front, m² per metre of nose. */
  noseLift: 0.08,
  /** Each degree of droop takes this much front lift away, m², and adds drag as droop² × this, m². */
  droopDown: 0.05,
  droopDrag: 0.0008,
  /** The canopy's drag area per metre of height, m². */
  canopyDrag: 0.09,
  /** The driver can see the line with this much canopy, m; each centimetre lower costs this share of power (the driver lifts). */
  sightNeed: 0.25,
  sightPenalty: 0.012,
  /** The fin's drag area per m² of fin. */
  finDrag: 0.012,
  /** All four wheels open, m² of drag area; enclosed wheels keep this share of it. */
  wheelsOpen: 0.16,
  wheelsCovered: 0.15,
} as const

/**
 * Where the side force acts (PR 9p), for the car pointing a little off the
 * wind: each part's side area times how hard it pushes, and where it sits.
 * The car points straight only if the side force acts behind the mass.
 */
export const RECORD_SIDE = {
  /** A slender nose pushes the car's head off the wind (its own suction): area × this, at this share of its length from the tip. */
  noseArea: 0.45,
  noseGain: 1.6,
  noseAt: 0.6,
  /** The body's side: its area × this, at this share of its length back. */
  bodyGain: 0.5,
  bodyAt: 0.4,
  /** The canopy: its height × this length, m, at this far back along the body. */
  canopyLength: 1.2,
  canopyAt: 2.2,
  /** Each axle's fairings add this side area when fully covering, m². */
  fairingArea: 0.35,
  /** The fin is a wing on its side: its area × this, at this far back along the body. */
  finGain: 3,
  finAt: 7.6,
  /** The driver holds the car straight with the side force at least this share of the car's length behind the mass, plus this much per m/s of crosswind. */
  margin: 0.012,
  perCross: 0.006,
  /** An unstable car starts to wander at this speed, m/s. */
  wanderSpeed: 55,
} as const

/**
 * The air squeezing near the speed of sound (Kelbo, 16 November 2026):
 * above a critical Mach number the drag grows as rise × (how far past the
 * critical Mach, as a share of the way to Mach 1)². A longer nose lets the
 * air squeeze later. The tunnel never runs fast enough to see it.
 */
export const COMPRESSIBILITY = {
  /** Air's ratio of specific heats. */
  gamma: 1.4,
  /** The critical Mach number with a nose of `refNose` m, and how much each metre more raises it. */
  critical: 0.5,
  refNose: 1.5,
  perNose: 0.01,
  rise: 6,
} as const

/** The run (PR 9p): a run-up, the timed kilometre, then the chutes. */
export const RECORD_RUN = {
  /** Worked out every this many metres. */
  step: 5,
  /** The run-up before the timed kilometre, and the timed distance, m. */
  runUp: 8000,
  timed: 1000,
  /** Rolling resistance on salt (share of the load). */
  rolling: 0.015,
  /** The nose goes light (the driver aborts) when the front axle keeps less than this share of its static load. */
  frontKeep: 0.5,
  /** The second run starts within the hour: the wind along the course shifts by this much (standard deviation), m/s. */
  windShift: 0.8,
} as const

/** A client's car as the team runs it now. */
export const STOCK_RECORD: Record<RecordClass, RecordDesign> = {
  streamliner: {
    sport: 'record',
    class: 'streamliner',
    nose: { length: 1.5, droop: 2 },
    canopy: 0.35,
    fin: 0.5,
    fairings: 0.3,
  },
}
