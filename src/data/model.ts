/**
 * Scale models (plan section 6.5). A model is the design made smaller, with
 * small build errors and a surface finish of its own. The model shop with
 * real choices, prices and days arrives in PR 3; these are the defaults the
 * tunnel reading uses until then.
 */

/** Surface finish: sand-grain roughness height, m (real size on the model). */
export const MODEL_FINISH = {
  printed: 0.00008,
  sanded: 0.00002,
  polished: 0.000004,
} as const

export type ModelFinish = keyof typeof MODEL_FINISH

/** A standard model order. */
export const STANDARD_MODEL = {
  /** 1:2 for a rider. */
  scale: 0.5,
  finish: 'sanded' as ModelFinish,
  /** Each part's size is off by this fraction (standard deviation). */
  accuracy: 0.01,
} as const

/**
 * The seed for the model you test before contracts arrive (PR 5 gives each
 * job its own model and seed).
 */
export const DEMO_MODEL_SEED = 1
