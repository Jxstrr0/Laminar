/**
 * The outside model shop (plan section 9.3): what an order costs, how many
 * days it takes, and the model it builds. Prices and days come from
 * MODEL_SHOP; the model's build errors from its own seed.
 */
import { MAKERS, MODEL_GRADE, MODEL_SHOP, TRUCK_SCALES, type MakerId, type ModelFinish, type ModelGrade, type ModelScale } from '../data/model'
import type { EventSpec, ModelSpec, PreparedModel } from './views'
import { eventFlow } from './views'
import { AIR } from '../data/air'

export interface ModelOrder {
  /** The 4 in 1:4. */
  scale: ModelScale
  finish: ModelFinish
  grade: ModelGrade
  trips: boolean
  /** Pressure taps fitted (they read the surface pressure; they don't change the drag). */
  taps: boolean
  /** A ground board under a bobsled or truck model (left out for anything else; PR 8n, 9c). */
  board?: boolean
  /** Who makes it: the outside shop (left out) or one of your machines. */
  maker?: MakerId
}

/** Who makes an order. */
export const makerOf = (order: Pick<ModelOrder, 'maker'>): MakerId => order.maker ?? 'shop'

/** Whether the maker can build this order (scale, finish and grade within its limits). */
export function canMake(order: ModelOrder): boolean {
  const m = MAKERS[makerOf(order)]
  return m.scales.includes(order.scale) && m.finishes.includes(order.finish) && m.grades.includes(order.grade)
}

/** Is this a truck model's scale (PR 9c)? */
export const isTruckScale = (scale: ModelScale): boolean => (TRUCK_SCALES as readonly number[]).includes(scale)

/** The scales a maker builds for a rider-sized model, or for a truck. */
export function makerScales(maker: MakerId, truck: boolean): ModelScale[] {
  return MAKERS[maker].scales.filter((s) => isTruckScale(s) === truck)
}

/** The order moved to a maker, with anything it can't do changed to the nearest thing it can (a truck's scale stays a truck's). */
export function forMaker(order: ModelOrder, maker: MakerId): ModelOrder {
  const m = MAKERS[maker]
  const family = makerScales(maker, isTruckScale(order.scale))
  const scale = family.includes(order.scale) ? order.scale : family[family.length - 1]!
  const finish = m.finishes.includes(order.finish) ? order.finish : order.finish === 'printed' ? m.finishes[0]! : m.finishes[m.finishes.length - 1]!
  const grade = m.grades.includes(order.grade) ? order.grade : m.grades[0]!
  const { maker: _old, ...rest } = order
  return { ...rest, scale, finish, grade, ...(maker === 'shop' ? {} : { maker }) }
}

export interface Quote {
  /** ₽. */
  price: number
  days: number
}

/** A model maker on the staff: price and days times these (1 with nobody). */
export interface MakerHand {
  modelPrice: number
  modelDays: number
}

const NO_HAND: MakerHand = { modelPrice: 1, modelDays: 1 }

/**
 * What an order costs, and how long it takes: the shop's price list, times
 * the maker's shares, times what your own model maker brings.
 */
export function quote(order: ModelOrder, hand: MakerHand = NO_HAND): Quote {
  const m = MAKERS[makerOf(order)]
  const shop = shopQuote(order)
  const price = m.priceShare * hand.modelPrice
  const days = m.daysShare * hand.modelDays
  if (price === 1 && days === 1) return shop
  return {
    price: Math.round((shop.price * price) / MODEL_SHOP.round) * MODEL_SHOP.round,
    days: Math.max(1, Math.round(shop.days * days)),
  }
}

/** The outside shop's price and days for an order. */
function shopQuote(order: ModelOrder): Quote {
  const base = MODEL_SHOP.scale[order.scale]
  const finish = MODEL_SHOP.finish[order.finish]
  const grade = MODEL_SHOP.grade[order.grade]
  const trips = order.trips ? MODEL_SHOP.trips : { price: 0, days: 0 }
  const taps = order.taps ? MODEL_SHOP.taps : { price: 0, days: 0 }
  const board = order.board ? MODEL_SHOP.board : { price: 0, days: 0 }
  const raw = base.price * finish.times * grade.times + trips.price + taps.price + board.price
  return {
    price: Math.round(raw / MODEL_SHOP.round) * MODEL_SHOP.round,
    days: Math.max(1, base.days + finish.days + grade.days + trips.days + taps.days + board.days),
  }
}

/** The model an order builds, with this build's own seed. */
export function modelSpecOf(order: ModelOrder, seed: number): ModelSpec {
  return {
    scale: 1 / order.scale,
    finish: order.finish,
    accuracy: MODEL_GRADE[order.grade].accuracy * MAKERS[makerOf(order)].accuracyTimes,
    seed,
    ...(order.trips ? { trips: true } : {}),
    ...(order.board ? { board: true } : {}),
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
