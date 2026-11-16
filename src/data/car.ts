/**
 * Racing cars (plan sections 4.1, 6.3 and 9, PR 9i). Kelbo chose (16
 * November 2026) touring cars and open-wheel single-seaters together, a
 * promise in lap time, a balance window that costs the driver time when the
 * car is outside it, and a fictional series rulebook (a minimum ride height
 * and a maximum rear-wing chord) that scrutineers enforce.
 *
 * - The class (touring or open-wheel) is the client's car, not shaped.
 * - Ride height front and rear: lower makes the floor pull harder, until it
 *   stalls under its critical height and the car porpoises. Rake (the rear
 *   higher than the front) adds to the floor and moves its pull forward.
 * - The front wing (a splitter flap on a touring car) and the rear wing's
 *   angle and chord: downforce at each end, with drag, and a stall.
 * - The diffuser's angle, the floor edge's seal, and the cooling inlet.
 *
 * Lengths in metres, angles in degrees, masses kg, powers W.
 */

export type CarClass = 'touring' | 'open'

export interface CarDesign {
  sport: 'car'
  /** The client's kind of car: set by the brief, not shaped. */
  class: CarClass
  /** Static ride height at the front and rear axles, m. */
  ride: { front: number; rear: number }
  /** The front wing's angle (a splitter flap on a touring car), degrees. */
  frontWing: number
  /** The rear wing: its angle, degrees, and its chord front to back, m. */
  rearWing: { angle: number; chord: number }
  /** The diffuser's exit angle, degrees. */
  diffuser: number
  /** How well the floor's edges are sealed (skirts, edge fins), 0 to 1. */
  floorEdge: number
  /** The cooling inlets' size, a share of the class's standard opening. */
  inlet: number
}

/** Slider ranges for each class: a touring car rides higher and its wing is smaller. */
export const CAR_RANGE = {
  touring: {
    front: { min: 0.04, max: 0.14, step: 0.005 },
    rear: { min: 0.04, max: 0.16, step: 0.005 },
    frontWing: { min: 0, max: 20, step: 1 },
    angle: { min: 0, max: 30, step: 1 },
    chord: { min: 0.15, max: 0.4, step: 0.01 },
    diffuser: { min: 4, max: 20, step: 1 },
    floorEdge: { min: 0, max: 1, step: 0.05 },
    inlet: { min: 0.4, max: 1.2, step: 0.05 },
  },
  open: {
    front: { min: 0.015, max: 0.08, step: 0.005 },
    rear: { min: 0.02, max: 0.12, step: 0.005 },
    frontWing: { min: 0, max: 24, step: 1 },
    angle: { min: 0, max: 34, step: 1 },
    chord: { min: 0.2, max: 0.5, step: 0.01 },
    diffuser: { min: 6, max: 22, step: 1 },
    floorEdge: { min: 0, max: 1, step: 0.05 },
    inlet: { min: 0.4, max: 1.2, step: 0.05 },
  },
} as const

/** What each class is, before any aero is shaped. */
export const CAR_CLASS = {
  touring: {
    /** With the driver, kg, and the share of it on the front axle. */
    mass: 1300,
    massFront: 0.55,
    /** The engine at the wheels, W. */
    power: 250_000,
    /** Tyre grip (friction coefficient), and the share of the car's load on the driven wheels. */
    grip: 1.35,
    driven: 0.55,
    wheelbase: 2.7,
    /** The body's drag area with no wings, m², and the frontal area, m². */
    bodyCdA: 0.62,
    frontal: 2.1,
    /** The body alone (no floor, no wings) lifts a little at each end, m² of lift (negative downforce). */
    bodyLift: { front: 0.03, rear: 0.08 },
    /** Springs at each axle (both wheels), N/m: downforce squashes the car toward the road. */
    spring: { front: 120_000, rear: 120_000 },
    /** The splitter flap: its area, m², aspect ratio, lift slope per radian and stall angle, degrees. */
    frontWing: { area: 0.5, aspect: 3, slope: 3.5, stallDeg: 14, height: 0.1 },
    /** The rear wing's span, m. */
    rearSpan: 1.5,
    /** The floor: its pull (m² of downforce at the reference height, a standard diffuser and a full seal). */
    floor: { pull: 0.45, refHeight: 0.08, critHeight: 0.03, refDiffuser: 10, stallDiffuser: 15 },
    /** The balance window: the share of downforce on the front axle the driver can drive. */
    window: { low: 0.36, high: 0.5 },
    /** The engine runs hot below this inlet share. */
    coolNeed: 0.75,
  },
  open: {
    mass: 700,
    massFront: 0.45,
    power: 420_000,
    grip: 1.6,
    driven: 0.6,
    wheelbase: 3.1,
    bodyCdA: 0.5,
    frontal: 1.4,
    bodyLift: { front: 0.05, rear: 0.05 },
    spring: { front: 180_000, rear: 200_000 },
    frontWing: { area: 0.55, aspect: 3.5, slope: 3.6, stallDeg: 17, height: 0.06 },
    rearSpan: 0.95,
    floor: { pull: 1.5, refHeight: 0.04, critHeight: 0.022, refDiffuser: 12, stallDiffuser: 17 },
    window: { low: 0.37, high: 0.48 },
    coolNeed: 0.7,
  },
} as const

/** How the aero parts behave, the same for both classes. */
export const CAR_AERO = {
  /** The rear wing's lift slope per radian, its camber's lift at zero angle (per m² of wing), and its stall, degrees. */
  rearSlope: 4,
  rearCamber: 0.35,
  rearStallDeg: 24,
  /** Past a stall, each further degree takes this share of a degree's lift away (the wing loses lift, and drag climbs). */
  stallDrop: 1.6,
  stallDrag: 0.012,
  /** Span efficiency for induced drag, and the wings' profile drag per m². */
  efficiency: 0.8,
  profileCd: 0.07,
  /** A front wing gains this share of its pull for each reference height the front sits closer to the road. */
  frontWingGround: 0.4,
  /**
   * The floor's pull grows as (ref + soft) ÷ (height + soft) as the car
   * sits lower: `soft` is a share of the reference height.
   */
  floorSoft: 0.6,
  /** Below the critical height the floor stalls: at the road it keeps this share of its pull at the critical height. */
  floorStallKeep: 0.45,
  /** Each degree of diffuser past the reference adds this share of pull; past its stall each degree takes `diffuserStallDrop` away. */
  diffuserGain: 0.05,
  diffuserStallDrop: 0.12,
  /** An unsealed floor keeps this share of its pull. */
  unsealedShare: 0.55,
  /** Each degree of rake adds this share of floor pull and moves this much of it onto the front axle. */
  rakeGain: 0.08,
  rakeShift: 0.06,
  /** The floor's pull sits this far forward (share on the front axle) with no rake. */
  floorFront: 0.38,
  /** The floor's own drag: this much drag area per m² of its downforce, and a sealed edge's drag, m². */
  floorDrag: 0.05,
  edgeDrag: 0.025,
  /** The cooling inlets at their standard size, m² of drag. */
  coolCdA: 0.08,
  /** The car never sits lower than its skid plank allows, m. */
  plank: 0.005,
  /** The floor also stalls if either end sits under this share of the critical height (its edge is scraping the road). */
  edgeStall: 0.45,
}

/** The lap (PR 9i): the car on the circuit, flat out where it can be. */
export const LAP = {
  /** The lap is worked out every this many metres. */
  step: 4,
  /** Rolling resistance (share of the load). */
  rolling: 0.012,
  /** The car's top speed is capped here, m/s (gearing). */
  topSpeed: 95,
  /** Aero is worked out at these speeds, m/s, and read between them. */
  speeds: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as readonly number[],
  /** Each percentage point of balance outside the window costs this share of grip: the driver lifts. */
  balancePenalty: 0.008,
  /** Each tenth of inlet below what the engine needs costs this share of power: it runs hot and the team turns it down. */
  heatPenalty: 0.06,
  /** Fixed-point passes for a corner's speed and the car's ride heights. */
  passes: 8,
}

/**
 * The fictional Tarnovian Motor Racing Federation's car rulebook (PR 9i):
 * a minimum static ride height at each axle (the skid plank) and a maximum
 * rear-wing chord. Scrutineers make the team raise or trim the car to the
 * limit before it races.
 */
export const CAR_RULES = {
  touring: { minRide: 0.05, maxChord: 0.3 },
  open: { minRide: 0.025, maxChord: 0.38 },
} as const

/** A client's car as the team runs it now: a middling setup. */
export const STOCK_CAR: Record<CarClass, CarDesign> = {
  touring: {
    sport: 'car',
    class: 'touring',
    ride: { front: 0.1, rear: 0.11 },
    frontWing: 7,
    rearWing: { angle: 8, chord: 0.24 },
    diffuser: 8,
    floorEdge: 0.2,
    inlet: 1,
  },
  open: {
    sport: 'car',
    class: 'open',
    ride: { front: 0.045, rear: 0.07 },
    frontWing: 10,
    rearWing: { angle: 14, chord: 0.32 },
    diffuser: 11,
    floorEdge: 0.4,
    inlet: 1,
  },
}
