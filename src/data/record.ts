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
 * The jet car (PR 9w) is the last class: pushed by a jet engine rather than
 * driven through its wheels, chasing the sound barrier, and through it
 * (Kelbo, 16 November 2026: "through the sound barrier"). On top of the
 * streamliner's parts the firm shapes its waist (Kelbo: "a waist (area
 * rule)"): pinching the body where the engine sits lets the air squeeze
 * later and less, but pinch past the engine's room and it loses thrust.
 * Right at Mach 1 the shock under the nose lifts it: droop that held the
 * nose down below the barrier may not hold it there. The tunnel sees
 * neither.
 *
 * Lengths in metres, areas m², angles degrees, masses kg, powers W, thrust N.
 */

export type RecordClass = 'streamliner' | 'jet'

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
  /** How far the body is pinched where the engine sits, 0 (straight) to 1 (the most). Only a jet car has one; a streamliner's stays 0. */
  waist: number
}

/** Slider ranges. */
export const RECORD_RANGE = {
  streamliner: {
    length: { min: 1, max: 3.5, step: 0.1 },
    droop: { min: -2, max: 6, step: 0.5 },
    canopy: { min: 0.15, max: 0.45, step: 0.01 },
    fin: { min: 0, max: 1.4, step: 0.05 },
    fairings: { min: 0, max: 1, step: 0.05 },
    waist: { min: 0, max: 0, step: 0.05 },
  },
  jet: {
    length: { min: 2, max: 5, step: 0.1 },
    droop: { min: -2, max: 6, step: 0.5 },
    canopy: { min: 0.15, max: 0.45, step: 0.01 },
    fin: { min: 0, max: 3, step: 0.05 },
    fairings: { min: 0, max: 1, step: 0.05 },
    waist: { min: 0, max: 1, step: 0.05 },
  },
} as const

/** What a class of record car is, before any aero is shaped. */
export interface RecordClassSpec {
  /** With the driver, kg, and the share of it on the front axle. */
  mass: number
  massFront: number
  /** Engines at the wheels, W, with the tyres' grip on salt (all four drive); or a jet's thrust, N (the wheels only roll). One of power and thrust is 0. */
  power: number
  grip: number
  thrust: number
  /** The body behind the nose cone: its length and height, m; the axles and the mass, m back from where the nose cone joins. */
  body: { length: number; height: number; frontAxle: number; rearAxle: number; mass: number }
  /** The bare body's drag area, m² (no nose cone, canopy, fin or wheels). */
  bodyCdA: number
  /** Lift at each end of the bare body, m² of lift (a long body near the ground lifts like a wing). */
  lift: { front: number; rear: number }
}

export const RECORD_CLASS: Record<RecordClass, RecordClassSpec> = {
  streamliner: {
    mass: 2500,
    massFront: 0.45,
    power: 900_000,
    grip: 0.45,
    thrust: 0,
    body: { length: 8, height: 0.9, frontAxle: 1.4, rearAxle: 7, mass: 3.2 },
    bodyCdA: 0.06,
    lift: { front: 0.2, rear: 0.05 },
  },
  /**
   * The jet car (PR 9w): a long tube round one jet engine, the driver ahead
   * of it, on solid wheels. Heavy, so the nose is harder to lift, but the
   * air pushes far harder at its speeds. The body is shaped to sit down.
   */
  jet: {
    mass: 7500,
    massFront: 0.42,
    power: 0,
    grip: 0,
    thrust: 81_000,
    body: { length: 12, height: 1.3, frontAxle: 1.6, rearAxle: 10.5, mass: 6.2 },
    bodyCdA: 0.42,
    lift: { front: -0.1, rear: 0.05 },
  },
}

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
  /** The canopy: its height × this length, m, at this far back along the body (each class's own `at`). */
  canopyLength: 1.2,
  /** Each axle's fairings add this side area when fully covering, m². */
  fairingArea: 0.35,
  /** The fin is a wing on its side: its area × this, at this far back along the body (each class's own `at`). */
  finGain: 3,
  /** Where the canopy and the fin push, m back from where the nose cone joins. */
  at: {
    streamliner: { canopy: 2.2, fin: 7.6 },
    jet: { canopy: 2, fin: 11.4 },
  },
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
 *
 * The jet car (PR 9w) goes further. Its waist (the area rule) lets the air
 * squeeze later and cuts how high the drag climbs; past Mach 1 the drag
 * eases off a little from its peak. Near Mach 1 a shock forms under the
 * nose and lifts it.
 */
export const COMPRESSIBILITY = {
  /** Air's ratio of specific heats. */
  gamma: 1.4,
  /**
   * For each class: the critical Mach number with a nose of `refNose` m and
   * no waist, how much each metre more of nose and the whole waist raise
   * it, the drag's climb by Mach 1, and the share of that climb the whole
   * waist takes away. With `fineness`, the climb also shrinks as the
   * square of how much longer than `refNose` the nose is (a slender car
   * makes weaker shocks).
   */
  classes: {
    streamliner: { critical: 0.5, refNose: 1.5, perNose: 0.01, perWaist: 0, rise: 6, waistCut: 0, fineness: false },
    jet: { critical: 0.7, refNose: 3, perNose: 0.03, perWaist: 0.1, rise: 2.9, waistCut: 0.6, fineness: true },
  },
  /** Past Mach 1 the drag's climb eases off by this share per 0.1 of Mach, down to `floor` of it. */
  supersonic: { fall: 0.15, floor: 0.6 },
  /** The shock under the nose: this much front lift, m², at Mach 1, gone by `width` of Mach either side. */
  shock: { lift: 0.12, width: 0.06 },
  /** A waist past `room` of the most pinch crowds the engine: each share more of pinch loses `thrust` of the thrust. */
  waist: { room: 0.6, thrust: 0.5 },
} as const

/** The run (PR 9p): a run-up, the timed kilometre, then the chutes. */
export const RECORD_RUN = {
  /** Worked out every this many metres. */
  step: 5,
  /** The run-up before the timed kilometre for each class (a jet car takes far longer to reach its speed), and the timed distance, m. */
  runUp: { streamliner: 8000, jet: 14000 },
  timed: 1000,
  /** Rolling resistance on salt (share of the load). */
  rolling: 0.015,
  /** The nose goes light (the driver aborts) when the front axle keeps less than this share of its static load. */
  frontKeep: 0.5,
  /** The second run starts within the hour: the wind along the course shifts by this much (standard deviation), m/s. */
  windShift: 0.8,
} as const

/**
 * The streamliner's shell as drawn and as the drag model's outline reads it
 * (PR 9q), m: the body's half-width, its height and how high its floor
 * rides, where the canopy sits along the body (from where the nose cone
 * joins), how long the tail tapers, and the wheels.
 */
export const RECORD_BODY = {
  streamliner: { half: 0.55, ride: 0.12, canopyFrom: 1.6, canopyTo: 3, taper: 2.2, tailHalf: 0.18, wheel: 0.38, track: 0.62 },
  /** The jet car: a wider tube ending in the engine's nozzle. */
  jet: { half: 0.7, ride: 0.15, canopyFrom: 1.2, canopyTo: 2.8, taper: 2.5, tailHalf: 0.45, wheel: 0.45, track: 0.8 },
} as const

/**
 * The desk's guess at a record car (PR 9q): a job-wide bias and a design's
 * jitter on its drag, and a bias on its lift (the nose's lift near the
 * salt is hard to guess on paper), as shares of the truth. The desk checks
 * the nose with a moderate headwind blowing.
 */
export const RECORD_DESK = {
  dragBias: 0.04,
  liftBias: 0.1,
  jitter: 0.015,
  headwind: 2.5,
  /** The sheet warns while the nose keeps less than this share of its weight at the desk's top speed. */
  liftWarn: 0.62,
}

/**
 * The streamliner in the tunnel (PR 9r). A scale model on the turntable,
 * read at the tunnel's own top speed; the forecast scales the readings up
 * to the salt. Kelbo (16 November 2026): no high-speed tunnel, so the air
 * squeezing near the speed of sound is never seen, and learning that
 * correction is the skill.
 *
 * - The floor under the model: a still floor grows a slow layer of air that
 *   the real salt (rushing under the car) never has, and the nose's lift
 *   reads low there; a ground board helps; a rolling road reads true.
 * - Wheels standing still read a little draggy, less the more the fairings
 *   cover them, until a rolling road spins them.
 * - The turntable yaws the model to read the side force and where it acts.
 *   At small yaw the side force is tiny and its centre hard to place; the
 *   forecast only trusts readings at `minYaw` or more.
 */
export const RECORD_TUNNEL = {
  floor: {
    still: { lift: 0.85 },
    board: { lift: 0.94 },
    rolling: { lift: 1 },
  },
  /** Open wheels standing still read this much extra drag area, full scale, m²; faired, `wheelsCovered` of it. */
  staticWheels: 0.03,
  /** How far off the side force's centre reads, full scale, m, per unit of balance noise at 1° of yaw (less at more yaw): 0.6 m at 1° in the university tunnel. */
  centreNoise: 60,
  /** The forecast needs readings at this much yaw or more to place the side force, degrees. */
  minYaw: 2,
  /** Readings within this much yaw of straight count as straight ahead, degrees. */
  straight: 1,
  /** The speed a model's Reynolds number is matched to in the model shop, m/s (about a record run's top speed, so no tunnel matches it). */
  matchSpeed: 170,
}

/** A client's car as the team runs it now. */
export const STOCK_RECORD: Record<RecordClass, RecordDesign> = {
  streamliner: {
    sport: 'record',
    class: 'streamliner',
    nose: { length: 1.5, droop: 2 },
    canopy: 0.35,
    fin: 0.5,
    fairings: 0.3,
    waist: 0,
  },
  jet: {
    sport: 'record',
    class: 'jet',
    nose: { length: 3, droop: 2 },
    canopy: 0.35,
    fin: 2.2,
    fairings: 0.5,
    waist: 0,
  },
}
