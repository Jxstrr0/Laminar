/**
 * The shaped cyclist (plan section 5): every slider's range and default, the
 * parts you can pick, and how each choice maps onto the bodies the aero model
 * reads. The posture numbers are tuned so the default time-trial design reads
 * close to the PR 1 reference rider (CdA near 0.22 m²) and a sit-up position
 * on drop bars close to the hoods reference (near 0.31 m²).
 */

export type WheelKind = 'spoked' | 'deep' | 'disc'
export type HelmetKind = 'road' | 'aero'
export type BarKind = 'drops' | 'aero'
export type FrameKind = 'round' | 'kamm'
export type FabricKind = 'smooth' | 'textured'

export interface CyclistDesign {
  posture: {
    /** Back angle above horizontal, degrees. */
    torsoDeg: number
    /** 0 looking up the road, 1 head tucked between the shoulders. */
    headDrop: number
    /** Forearm spacing, centre to centre, m. */
    armWidth: number
    /** Hands ahead of the bottom bracket, m. */
    handReach: number
    /** Hands above the saddle, m (negative is below). */
    handHeight: number
  }
  helmet: { kind: HelmetKind; /** Tail length, 0 to 1. */ tail: number; /** Vent area, 0 to 1. */ vents: number }
  suit: { fabric: FabricKind; /** Trip strips on the upper arms. */ armTrips: boolean }
  bars: BarKind
  wheels: { front: WheelKind; rear: WheelKind }
  frame: FrameKind
}

/** Slider ranges and steps for the posture. */
export const POSTURE_RANGE = {
  torsoDeg: { min: 5, max: 50, step: 1 },
  headDrop: { min: 0, max: 1, step: 0.05 },
  armWidth: { min: 0.12, max: 0.45, step: 0.01 },
  handReach: { min: 0.5, max: 0.9, step: 0.01 },
  handHeight: { min: -0.15, max: 0.2, step: 0.01 },
} as const

export const PART_RANGE = {
  tail: { min: 0, max: 1, step: 0.05 },
  vents: { min: 0, max: 1, step: 0.05 },
} as const

/** The starting design: a plain time-trial position on a standard bike. */
export const DEFAULT_CYCLIST: CyclistDesign = {
  posture: { torsoDeg: 15, headDrop: 0.5, armWidth: 0.3, handReach: 0.7, handHeight: 0 },
  helmet: { kind: 'aero', tail: 0.35, vents: 0.1 },
  suit: { fabric: 'smooth', armTrips: false },
  bars: 'aero',
  wheels: { front: 'spoked', rear: 'spoked' },
  frame: 'round',
}

/** A club rider sitting up on drop bars. */
export const SIT_UP_CYCLIST: CyclistDesign = {
  posture: { torsoDeg: 45, headDrop: 0.1, armWidth: 0.42, handReach: 0.6, handHeight: -0.05 },
  helmet: { kind: 'road', tail: 0, vents: 0.8 },
  suit: { fabric: 'smooth', armTrips: false },
  bars: 'drops',
  wheels: { front: 'spoked', rear: 'spoked' },
  frame: 'round',
}

/**
 * Torso as an oval body. Its frontal height and length follow the back
 * angle (through its sine); width follows the arms (narrow arms roll the
 * shoulders in).
 */
export const TORSO = {
  x: 0.4,
  heightBase: 0.094,
  heightPerSine: 0.603,
  lengthBase: 0.69,
  lengthPerSine: 0.268,
  widthBase: 0.3,
  widthPerArm: 0.25,
  maxAt: 0.3,
  tailEndBase: 0.82,
  tailEndPerSine: 0.11,
  /**
   * Shelter behind the forearms and helmet, from a flat back (tuck) to an
   * upright one (sitting up), the extra aero bars give, and the extra a
   * tucked head gives.
   */
  wakeTuck: 0.18,
  wakeUpright: 0.05,
  wakeAeroBars: 0.05,
  wakePerHeadDrop: 0.15,
  /** Forearms held narrow shelter the chest: extra shelter per metre narrower than ARMS.shelterFrom. */
  wakePerNarrowArm: 0.6,
}

/**
 * How "tucked" a posture is: 0 at the tuck angle, 1 at the upright angle,
 * through the back angle's sine. The legs and torso hide behind a flat back
 * and low arms; sitting up exposes them.
 */
export const TUCK = { tuckDeg: 15, uprightDeg: 45, min: -0.3, max: 1.2 }

export const HELMET = {
  x: 0.25,
  road: { length: 0.27, width: 0.21, height: 0.22, ventArea: 0.045 },
  /** Vents act as shallow wells; this depth puts them halfway up the cavity curve. */
  ventDepth: 0.4,
  aero: {
    lengthBase: 0.27,
    lengthPerTail: 0.15,
    width: 0.2,
    height: 0.19,
    maxAt: 0.3,
    tailEndBase: 0.4,
    tailEndPerTail: 0.5,
    ventArea: 0.02,
    /** A long tail sticks up into the wind when the head is held high. */
    tailLift: 0.1,
  },
  /** Shelter a tucked head gets from the shoulders. */
  wakePerHeadDrop: 0.4,
  /** Raised hands shield the face (aero bars only): shelter per metre of hand height. */
  wakePerHandHeight: 3,
}

export const ARMS = {
  /** Arms narrower than this (m) start tucking the upper arms in behind the forearms. */
  shelterFrom: 0.4,
  /** Extra shelter for the upper arms per metre narrower (aero bars only). */
  upperShelterPerMetre: 1,
  aero: {
    forearm: { x: 0, length: 0.34, width: 0.09, height: 0.09, maxAt: 0.25, tailEnd: 0.6 },
    upper: { x: 0.36, diameter: 0.1, height: 0.26, wake: 0.35 },
    joint: 0.09,
  },
  drops: {
    forearm: { x: 0, diameter: 0.09, height: 0.28, wake: 0 },
    upper: { x: 0.15, diameter: 0.1, height: 0.28, wake: 0.15 },
    joint: 0.1,
  },
}

/** Legs: shelter in a full tuck and sitting upright (blended by the tuck factor). */
export const LEGS = {
  thigh: { x: 0.95, diameter: 0.15, height: 0.4, wakeTuck: 0.4, wakeUpright: 0.1 },
  shin: { x: 0.9, diameter: 0.1, height: 0.44, wakeTuck: 0.2, wakeUpright: 0.03 },
}

/** Skinsuit fabric roughness (m) and trip strip height (m) and place (fraction of the arm's depth). */
export const SUIT = {
  smooth: 0.00002,
  textured: 0.0003,
  tripHeight: 0.0006,
  tripAt: 0.2,
}

export const BIKE = {
  tubes: [
    { id: 'head-tube', x: -0.05, diameter: 0.045, height: 0.55, wake: 0.3 },
    { id: 'seat-tube', x: 0.95, diameter: 0.04, height: 0.5, wake: 0.6 },
  ],
  /** A Kamm-tail tube is this many times longer than it is wide, cut off at this fraction. */
  kammChord: 3,
  kammTailEnd: 0.35,
  tyre: { diameter: 0.025, height: 0.62 },
  wheels: { front: { x: -0.35, wake: 0, spokes: 20 }, rear: { x: 0.95, wake: 0.5, spokes: 24 } },
  wheelDiameter: 0.67,
  forkThickness: 0.03,
  /** Deep rims hide this fraction of the spokes and act as a sail this many chords deep. */
  deepSpokeCover: 0.45,
  deepChord: 0.18,
  discThickness: 0.04,
}

/** Mass (kg) and price (₽) of each choice, for the readouts. */
export const PART_COST = {
  base: { mass: 8.2, price: 0 },
  helmet: { road: { mass: 0.25, price: 9000 }, aero: { mass: 0.42, price: 24000 } },
  wheel: {
    spoked: { mass: 0.75, price: 15000 },
    deep: { mass: 0.85, price: 52000 },
    disc: { mass: 1.05, price: 78000 },
  },
  bars: { drops: { mass: 0.3, price: 6000 }, aero: { mass: 0.65, price: 31000 } },
  frame: { round: { mass: 0, price: 0 }, kamm: { mass: 0.18, price: 120000 } },
  suit: { smooth: { mass: 0, price: 14000 }, textured: { mass: 0, price: 26000 } },
  armTrips: { mass: 0, price: 1500 },
} as const

/**
 * The comfort / power meter. Strain adds up from each part of the posture
 * past its easy point; every unit of strain costs the rider power, and past
 * the rider's limit the position can't be held for a whole event.
 */
export const COMFORT = {
  torsoEasyDeg: 30,
  torsoPerDeg: 0.025,
  headDropPer: 0.25,
  armEasy: 0.38,
  armPerMetre: 1.5,
  reachEasy: 0.72,
  reachPerMetre: 2.5,
  handHighEasy: 0.02,
  handHighPerMetre: 1.6,
  /** Fraction of power lost per unit of strain. */
  powerPerStrain: 0.05,
  /** Strain a typical rider can hold for a whole time trial. */
  riderLimit: 1,
  /** Strain past this fraction of the limit lights the strained part amber. */
  strainWarn: 0.75,
}

/**
 * The desk estimate (plan section 6.8): the truth plus a seeded error. Most
 * of the error is a bias that holds for the whole job (so comparing two
 * designs at the desk is fairer than the absolute number); a little jitters
 * per design. The analyst narrows both; they never vanish.
 */
export const DESK = {
  /** Spread of the job's bias, as a fraction (standard deviation). */
  bias: 0.1,
  /** Spread of the per-design jitter. */
  jitter: 0.03,
  /** Each analyst level shrinks the spread by this fraction. */
  perLevel: 0.2,
  /** Never narrower than this fraction of the starting spread. */
  floor: 0.3,
  /** Error bars are this many standard deviations each side. */
  bars: 1.5,
  /** Job seed the Shape screen uses until briefs arrive (PR 5). */
  demoJobSeed: 1,
}
