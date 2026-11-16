/**
 * The tunnel's latest truck forecast, kept for the Deliver sheet (PR 9f):
 * the declared fuel figure starts from it. Like the sled's, it's only
 * offered back for the design and route it was run for, so an old forecast
 * never fills in a new design. Not saved: open the tunnel after a reload and
 * it reads again.
 */
import type { Route } from '../data/routes'
import type { TruckDesign } from '../data/truck'

export interface TruckForecast {
  /** The wind-averaged fuel figure on the pooled, corrected readings, litres per 100 km. */
  fuel: number
  /** The saving that figure means against the fleet's truck, %. */
  saving: number
  /** Whether the model sat on a ground board (without one the underside reads low, so the figure is too good). */
  board: boolean
  /** Whether the readings went past straight on (without a sweep a crosswind's cost is missed). */
  swept: boolean
}

let latest: { key: string; forecast: TruckForecast } | null = null

const keyOf = (design: TruckDesign, route: Route['id']) => JSON.stringify([design, route])

export const truckForecast = {
  set(design: TruckDesign, route: Route['id'], forecast: TruckForecast | null): void {
    latest = forecast ? { key: keyOf(design, route), forecast } : null
  },
  /** The forecast for this design and route, or null if the tunnel hasn't read one. */
  get(design: TruckDesign, route: Route['id']): TruckForecast | null {
    return latest && latest.key === keyOf(design, route) ? latest.forecast : null
  },
}
