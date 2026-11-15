/**
 * The outside model shop (plan section 9.3): what an order costs, how many
 * days it takes, and the model it builds. Prices and days come from
 * MODEL_SHOP; the model's build errors from its own seed.
 */
import { MODEL_GRADE, MODEL_SHOP, type ModelFinish, type ModelGrade, type ModelScale } from '../data/model'
import type { EventSpec, ModelSpec, PreparedModel } from './views'
import { eventFlow } from './views'
import { AIR } from '../data/air'

export interface ModelOrder {
  /** The 4 in 1:4. */
  scale: ModelScale
  finish: ModelFinish
  grade: ModelGrade
  trips: boolean
}

export interface Quote {
  /** ₽. */
  price: number
  days: number
}

/** What the shop charges for an order, and how long it takes. */
export function quote(order: ModelOrder): Quote {
  const base = MODEL_SHOP.scale[order.scale]
  const finish = MODEL_SHOP.finish[order.finish]
  const grade = MODEL_SHOP.grade[order.grade]
  const trips = order.trips ? MODEL_SHOP.trips : { price: 0, days: 0 }
  const raw = base.price * finish.times * grade.times + trips.price
  return {
    price: Math.round(raw / MODEL_SHOP.round) * MODEL_SHOP.round,
    days: Math.max(1, base.days + finish.days + grade.days + trips.days),
  }
}

/** The model an order builds, with this build's own seed. */
export function modelSpecOf(order: ModelOrder, seed: number): ModelSpec {
  return {
    scale: 1 / order.scale,
    finish: order.finish,
    accuracy: MODEL_GRADE[order.grade].accuracy,
    seed,
    ...(order.trips ? { trips: true } : {}),
  }
}

/**
 * The model's Reynolds number at a tunnel speed over the full-size rider's
 * at the event (1 is a match). Below 1 the model's air behaves like slower
 * air: boundary layers stay laminar longer and separate earlier.
 */
export function reynoldsRatio(prepared: PreparedModel, speed: number, event: EventSpec): number {
  const flow = eventFlow(event)
  const model = (AIR.density * speed * prepared.longest) / AIR.viscosity
  const full = (flow.density * flow.speed * (prepared.longest / prepared.scale)) / flow.viscosity
  return full > 0 ? model / full : 0
}

/** The tunnel speed that matches the full-size Reynolds number for a scale (may be past the fan's top speed). */
export function matchedSpeed(scale: number, event: EventSpec): number {
  const flow = eventFlow(event)
  return (flow.speed * flow.density * AIR.viscosity) / (scale * AIR.density * flow.viscosity)
}
