/**
 * The shaped speed skater (plan sections 5 and 9.6, PR 8): the crouch, the
 * arms, the hood and the suit, and how each maps onto the bodies the aero
 * model reads. Tuned so the default racing crouch reads near 0.17 m² of CdA
 * and a club skater standing tall near 0.22 m². Skaters have no kit rules.
 */

export type HoodKind = 'cap' | 'hood'
export type SkaterArms = 'back' | 'swing'
export type SkaterFabric = 'smooth' | 'textured'

export interface SkaterDesign {
  sport: 'skating'
  posture: {
    /** Back angle above horizontal, degrees. */
    trunkDeg: number
    /** Knee angle, degrees: 180 is a straight leg, 90 a deep crouch. */
    kneeDeg: number
    /** 0 looking up the ice, 1 head tucked low. */
    headDrop: number
  }
  /** Hands folded on the back, or swinging (more push, more drag). */
  arms: SkaterArms
  hood: HoodKind
  suit: { fabric: SkaterFabric; /** Trip strips down the shins. */ legTrips: boolean }
}

export const SKATER_CHOICES = {
  arms: ['back', 'swing'],
  hood: ['cap', 'hood'],
  fabric: ['smooth', 'textured'],
} as const satisfies {
  arms: readonly SkaterArms[]
  hood: readonly HoodKind[]
  fabric: readonly SkaterFabric[]
}

export const SKATER_RANGE = {
  trunkDeg: { min: 5, max: 50, step: 1 },
  kneeDeg: { min: 90, max: 160, step: 1 },
  headDrop: { min: 0, max: 1, step: 0.05 },
} as const

/** A good racing crouch: low back, knees well bent, hands on the back, hooded suit. */
export const DEFAULT_SKATER: SkaterDesign = {
  sport: 'skating',
  posture: { trunkDeg: 15, kneeDeg: 110, headDrop: 0.4 },
  arms: 'back',
  hood: 'hood',
  suit: { fabric: 'smooth', legTrips: false },
}

/** A club skater standing tall with a swinging arm and a knitted cap. */
export const UPRIGHT_SKATER: SkaterDesign = {
  sport: 'skating',
  posture: { trunkDeg: 40, kneeDeg: 140, headDrop: 0.1 },
  arms: 'swing',
  hood: 'cap',
  suit: { fabric: 'smooth', legTrips: false },
}

/**
 * How low the skater sits: 0 in the deepest crouch, 1 standing tall,
 * from the knee angle.
 */
export const CROUCH = { deepDeg: 90, tallDeg: 160 }

/** The trunk as an oval body; its height and length follow the back angle (through its sine). */
export const SK_TORSO = {
  x: 0.25,
  heightBase: 0.12,
  heightPerSine: 0.56,
  lengthBase: 0.5,
  lengthPerSine: 0.2,
  width: 0.38,
  maxAt: 0.45,
  tailEndBase: 0.55,
  tailEndPerSine: 0.15,
  /** Shelter behind the head, more with the head down. */
  wakeBase: 0.06,
  wakePerHeadDrop: 0.12,
}

export const SK_HEAD = {
  x: 0,
  /** A knitted cap: a rough round head. */
  cap: { length: 0.25, width: 0.19, height: 0.23, roughness: 0.0015 },
  /** A smooth hood pulled over the head: longer, closing onto the back. */
  hood: { length: 0.36, width: 0.19, height: 0.21, maxAt: 0.3, tailEnd: 0.3 },
  /** Shelter a tucked head gets from the shoulders. */
  wakePerHeadDrop: 0.35,
}

/** Arms folded on the back sit in the trunk's wake; swinging ones meet the air. */
export const SK_ARMS = {
  back: { x: 0.45, diameter: 0.1, height: 0.16, wake: 0.45 },
  swing: { x: 0.3, diameter: 0.1, height: 0.3, wake: 0.25 },
  joint: 0.09,
  /** A swinging arm adds push, mostly in the corners: this share of extra power. */
  swingPower: 0.08,
}

/**
 * Legs: frontal height grows as the skater stands taller; shelter behind the
 * trunk is greatest in a deep crouch.
 */
export const SK_LEGS = {
  thigh: { x: 0.85, diameter: 0.16, heightDeep: 0.36, heightTall: 0.46, wakeDeep: 0.12, wakeTall: 0.02 },
  shin: { x: 0.65, diameter: 0.12, heightDeep: 0.2, heightTall: 0.22, wakeDeep: 0, wakeTall: 0 },
  /** The boot and ankle below the shin: stiff, smooth, never tripped. */
  boot: { x: 0.55, diameter: 0.13, height: 0.28 },
}

/** The blades: long, thin and low. */
export const BLADE = { x: 0.4, chord: 0.44, thickness: 0.0012, height: 0.05, tailEnd: 0.9 }

/** Suit fabric roughness (m), and the shin trip strips' height (m) and place (fraction of the depth). */
export const SK_SUIT = {
  smooth: 0.00002,
  textured: 0.00012,
  tripHeight: 0.0003,
  tripAt: 0.2,
}

/** Mass (kg) and price (₽) of each choice, for the readouts. */
export const SKATER_COST = {
  base: { mass: 2.1, price: 0 },
  hood: { cap: { mass: 0.05, price: 1500 }, hood: { mass: 0.08, price: 9000 } },
  suit: { smooth: { mass: 0, price: 22000 }, textured: { mass: 0, price: 38000 } },
  legTrips: { mass: 0, price: 2000 },
} as const

/**
 * The comfort meter for a crouch: a flat back and deep knees are fast but
 * burn the legs. Same scale as the cyclist's: past the limit the skater
 * stands up for the last third.
 */
export const SKATER_COMFORT = {
  trunkEasyDeg: 25,
  trunkPerDeg: 0.025,
  kneeEasyDeg: 115,
  kneePerDeg: 0.03,
  headDropPer: 0.2,
  powerPerStrain: 0.05,
  limit: 1,
}

/** On ice: blade friction in place of rolling resistance, and no drivetrain loss. */
export const ICE = { friction: 0.0045, drivetrain: 1 }
