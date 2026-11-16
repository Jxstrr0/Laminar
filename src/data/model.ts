/**
 * Scale models (plan sections 6.5 and 9.3). A model is the design made
 * smaller, with small build errors and a surface finish of its own. The
 * outside model shop builds them to order: scale, finish, accuracy grade
 * and trip strips set the price and the lead time in days.
 */

/** Surface finish: sand-grain roughness height, m (real size on the model). */
export const MODEL_FINISH = {
  printed: 0.00008,
  sanded: 0.00002,
  polished: 0.000004,
} as const

export type ModelFinish = keyof typeof MODEL_FINISH

/** How true to size the shop builds: each part's size is off by `accuracy` (standard deviation). */
export const MODEL_GRADE = {
  standard: { accuracy: 0.01 },
  fine: { accuracy: 0.004 },
} as const

export type ModelGrade = keyof typeof MODEL_GRADE

/** The scales the shop offers for a rider, as the 4 in 1:4. */
export const MODEL_SCALES = [4, 3, 2] as const

/**
 * A truck is ten times a rider's length, so its models are much smaller
 * (PR 9c): at 1:8 the rig is about 2.3 m long and blocks under 4 % of the
 * university tunnel's section.
 */
export const TRUCK_SCALES = [12, 10, 8] as const

/**
 * A racing quad is small enough to test as it is (PR 10d): the shop builds
 * a full-size model, 1:1, so its Reynolds number matches with no fuss.
 */
export const DRONE_SCALES = [1] as const

/**
 * A survey drone's two-metre wing won't go in the tunnel full size (PR 10k):
 * the shop builds it at 1:2.5 (an 84 cm wing) or 1:1.5 (1.4 m). The smaller
 * the model, the lower its wing's Reynolds number at a given speed.
 */
export const PLANE_SCALES = [2.5, 1.5] as const

/**
 * A kit plane's 9.6 m wing (PR 10r): the shop builds it at 1:6 (a 1.6 m
 * wing) or 1:5 (1.9 m, nearly the test section's width).
 */
export const AIRCRAFT_SCALES = [6, 5] as const

export const ALL_SCALES = [...MODEL_SCALES, ...TRUCK_SCALES, ...DRONE_SCALES, ...PLANE_SCALES, ...AIRCRAFT_SCALES] as const

export type ModelScale = (typeof ALL_SCALES)[number]

/**
 * The outside model shop's price list, ₽ and days. A model's price is its
 * scale's base times the finish and grade multipliers, plus trip strips;
 * its days add up the same way.
 */
export const MODEL_SHOP = {
  scale: {
    4: { price: 24000, days: 4 },
    3: { price: 36000, days: 5 },
    2: { price: 52000, days: 7 },
    // A truck model is small but long and full of parts.
    12: { price: 30000, days: 5 },
    10: { price: 38000, days: 6 },
    8: { price: 50000, days: 7 },
    // A full-size quad: a printed pod and arm fairings on a stock frame, motors and props.
    1: { price: 20000, days: 4 },
    // A survey drone's foam-cored wing, fuselage and tail, with the pod and winglets as printed parts.
    2.5: { price: 34000, days: 5 },
    1.5: { price: 58000, days: 8 },
    // A kit plane's wing, cabin and tail, with the spats, cowl, tips, fairings and pod as printed parts.
    6: { price: 62000, days: 8 },
    5: { price: 84000, days: 10 },
  } satisfies Record<ModelScale, { price: number; days: number }>,
  finish: {
    printed: { times: 0.75, days: -1 },
    sanded: { times: 1, days: 0 },
    polished: { times: 1.35, days: 2 },
  } satisfies Record<ModelFinish, { times: number; days: number }>,
  grade: {
    standard: { times: 1, days: 0 },
    fine: { times: 1.5, days: 2 },
  } satisfies Record<ModelGrade, { times: number; days: number }>,
  trips: { price: 3000, days: 1 },
  /** A ground board for a bobsled or truck model: a raised plate with a sharp front edge (PR 8n, BOB_TUNNEL; PR 9c, TRUCK_TUNNEL). */
  board: { price: 4000, days: 1 },
  /** Pressure taps: pinholes over the rider piped to the tunnel's scanner. */
  taps: { price: 8000, days: 2 },
  /**
   * A powered quad model (PR 10e): motors and speed controllers wired down
   * the sting to the tunnel's supply, so its props spin and the balance reads
   * the downwash on the arms. A kit plane's powered model (PR 10r) drives its
   * prop the same way, so its slipstream blows the nose as in flight.
   */
  motors: { price: 15000, days: 2 },
  /** Swapping one bolt-on part (helmet, suit, bars, a wheel, the frame; a truck's fairing, skirts and the like) on a model you have, ₽ (no days). */
  partSwap: 1500,
  /** Prices round to this many rubles. */
  round: 500,
}

/**
 * Trip strips on the model (plan section 6.5). The big parts of a full-size
 * rider (torso, helmet, forearms) go turbulent on the road; a small model's
 * stay laminar. The shop tapes a thin strip near the front of every part at
 * least `minLength` long at full size, to force the model's layer turbulent
 * there too. The small round parts (upper arms, legs, tubes) stay laminar at
 * full size, so they get none: tripping those would be a lie of its own.
 * Model-size height, m; where it sits (fraction of each part's length).
 */
export const MODEL_TRIPS = { height: 0.0004, at: 0.15, minLength: 0.25 } as const

/** A standard model order. */
export const STANDARD_MODEL = {
  /** 1:2 for a rider. */
  scale: 0.5,
  finish: 'sanded' as ModelFinish,
  /** Each part's size is off by this fraction (standard deviation). */
  accuracy: MODEL_GRADE.standard.accuracy,
} as const

/** The standard order as the shop writes it up. */
export const STANDARD_ORDER = { scale: 2 as ModelScale, finish: 'sanded' as ModelFinish, grade: 'standard' as ModelGrade, trips: false, taps: false }

/**
 * The seed for the model you test before contracts arrive (PR 5 gives each
 * job its own model and seed).
 */
export const DEMO_MODEL_SEED = 1

/**
 * The workshop chain (plan section 9.3): who makes the model. The outside
 * shop makes anything at its price list. Your own machines make models for
 * a share of that price and in fewer days, each with limits and a material
 * of its own:
 * - the resin printer is quick and smooth, but only small models fit and
 *   resin is brittle (thin parts flutter sooner);
 * - the FDM printer is cheap and takes any scale, but its parts are rough
 *   and a little bendy, and it only builds to the standard grade;
 * - the CNC mill cuts aluminium: dear to buy, but true to size and stiff.
 * Machines are bought for cash and arrive at once.
 */
export type MakerId = 'shop' | 'resin' | 'fdm' | 'cnc'
export type MachineId = Exclude<MakerId, 'shop'>

export interface Maker {
  scales: readonly ModelScale[]
  finishes: readonly ModelFinish[]
  grades: readonly ModelGrade[]
  /** A model's price and days as shares of the outside shop's for the same order. */
  priceShare: number
  daysShare: number
  /** Thin parts' flutter speed times this (the material's stiffness). */
  stiffness: number
  /** Each part's size error times this. */
  accuracyTimes: number
}

export const MAKERS: Record<MakerId, Maker> = {
  shop: { scales: [4, 3, 2, 12, 10, 8, 1, 2.5, 1.5, 6, 5], finishes: ['printed', 'sanded', 'polished'], grades: ['standard', 'fine'], priceShare: 1, daysShare: 1, stiffness: 1, accuracyTimes: 1 },
  resin: { scales: [4, 3, 12, 10, 1, 2.5, 6], finishes: ['sanded', 'polished'], grades: ['standard', 'fine'], priceShare: 0.3, daysShare: 0.3, stiffness: 0.8, accuracyTimes: 1 },
  fdm: { scales: [4, 3, 2, 12, 10, 8, 1, 2.5, 1.5, 6, 5], finishes: ['printed', 'sanded'], grades: ['standard'], priceShare: 0.2, daysShare: 0.5, stiffness: 0.9, accuracyTimes: 1 },
  cnc: { scales: [4, 3, 2, 12, 10, 8, 1, 2.5, 1.5, 6, 5], finishes: ['sanded', 'polished'], grades: ['standard', 'fine'], priceShare: 0.45, daysShare: 0.6, stiffness: 1.3, accuracyTimes: 0.5 },
}

/** What each machine costs to buy, ₽. */
export const MACHINE_PRICE: Record<MachineId, number> = { resin: 220_000, fdm: 120_000, cnc: 900_000 }

/** The order they're shown in. */
export const MACHINE_IDS: readonly MachineId[] = ['fdm', 'resin', 'cnc']
export const MAKER_IDS: readonly MakerId[] = ['shop', 'fdm', 'resin', 'cnc']
