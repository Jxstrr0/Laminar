/**
 * The reference rider and bike: a plain cyclist built from simple bodies, so
 * the aero model can be checked against known cyclist numbers (a time-trial
 * tuck near CdA 0.23 m², riding on the hoods near 0.35 m²). The shaped
 * cyclist with posture morphs replaces this in PR 2.
 *
 * Sizes are metres at full scale. x runs back from the front of the helmet.
 * `wake` is the fraction of dynamic pressure a part loses by sitting behind
 * another (the thighs behind the arms and torso).
 */

export interface RiderPart {
  /** Which builder makes it. */
  kind: 'oval' | 'upright' | 'ellipsoid'
  id: string
  x: number
  /** Length along the flow (oval, ellipsoid) or diameter (upright). */
  length: number
  width: number
  height: number
  /** For ovals: widest point (fraction of length) and cut-off tail. */
  maxAt?: number
  tailEnd?: number
  wake?: number
  /** How many of this part (2 for arms and legs). */
  count?: number
}

export interface RiderPosition {
  parts: RiderPart[]
  /** Arm-to-torso joints: thickness of the arm, m. */
  armJoint: number
}

/** Skin and kit roughness (sand-grain height, m): a smooth skinsuit. */
export const SKINSUIT_ROUGHNESS = 0.00002

/** Time-trial tuck on aero bars. */
export const TT_POSITION: RiderPosition = {
  parts: [
    { kind: 'oval', id: 'helmet', x: 0.25, length: 0.32, width: 0.2, height: 0.19, maxAt: 0.3, tailEnd: 0.15 },
    { kind: 'oval', id: 'torso', x: 0.45, length: 0.62, width: 0.38, height: 0.25, maxAt: 0.3, tailEnd: 0.85, wake: 0.25 },
    { kind: 'oval', id: 'forearm', x: 0, length: 0.34, width: 0.09, height: 0.09, maxAt: 0.25, tailEnd: 0.6, count: 2 },
    { kind: 'upright', id: 'upper-arm', x: 0.36, length: 0.1, width: 0.1, height: 0.26, wake: 0.35, count: 2 },
    { kind: 'upright', id: 'thigh', x: 0.95, length: 0.15, width: 0.15, height: 0.4, wake: 0.4, count: 2 },
    { kind: 'upright', id: 'shin', x: 0.9, length: 0.1, width: 0.1, height: 0.44, wake: 0.15, count: 2 },
  ],
  armJoint: 0.09,
}

/** Sitting up on the brake hoods. */
export const HOODS_POSITION: RiderPosition = {
  parts: [
    { kind: 'ellipsoid', id: 'helmet', x: 0.2, length: 0.27, width: 0.21, height: 0.22 },
    { kind: 'oval', id: 'torso', x: 0.3, length: 0.5, width: 0.44, height: 0.52, maxAt: 0.3, tailEnd: 0.9, wake: 0.1 },
    { kind: 'upright', id: 'forearm', x: 0, length: 0.09, width: 0.09, height: 0.28, count: 2 },
    { kind: 'upright', id: 'upper-arm', x: 0.15, length: 0.1, width: 0.1, height: 0.28, wake: 0.15, count: 2 },
    { kind: 'upright', id: 'thigh', x: 0.85, length: 0.15, width: 0.15, height: 0.4, wake: 0.15, count: 2 },
    { kind: 'upright', id: 'shin', x: 0.85, length: 0.1, width: 0.1, height: 0.44, wake: 0.05, count: 2 },
  ],
  armJoint: 0.1,
}

/** The bike: frame tubes, tyres, wheels. */
export const REFERENCE_BIKE = {
  /** Frame tubes seen from the front, as upright cylinders. */
  tubes: [
    { id: 'head-tube', x: -0.05, diameter: 0.045, height: 0.55, wake: 0.3 },
    { id: 'seat-tube', x: 0.95, diameter: 0.04, height: 0.5, wake: 0.6 },
  ],
  /** A tyre's front edge, seen as a thin upright cylinder. */
  tyre: { diameter: 0.025, height: 0.62 },
  /** Wheels: front and rear positions, disc area for spoke drag, spoke count. */
  wheels: [
    { id: 'front-wheel', x: -0.35, spokes: 20, wake: 0 },
    { id: 'rear-wheel', x: 0.95, spokes: 24, wake: 0.5 },
  ],
  /** Wheel diameter, m. */
  wheelDiameter: 0.67,
  /** Wheel-to-frame joints: fork blade thickness, m. */
  forkThickness: 0.03,
} as const
