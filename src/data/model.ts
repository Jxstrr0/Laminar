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

export type ModelScale = (typeof MODEL_SCALES)[number]

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
  /** Pressure taps: pinholes over the rider piped to the tunnel's scanner. */
  taps: { price: 8000, days: 2 },
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
