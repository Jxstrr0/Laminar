/**
 * The tunnel's latest lap forecast for a racing car, kept for the Deliver
 * sheet (PR 9n): the declared lap time starts from it. Like the truck's,
 * it's only offered back for the design and circuit it was read for, so an
 * old forecast never fills in a new design. Not saved: open the tunnel
 * after a reload and it reads again.
 */
import type { CarDesign } from '../data/car'
import type { Circuit } from '../data/circuits'
import type { CarFloor } from '../sim/carTunnel'

export interface CarForecast {
  /** The lap on the circuit's usual day, read from the aero map, s, and the gain on the team's car, s. */
  time: number
  gain: number
  /** The floor under the model: still, the shop's ground board, or a rolling road. */
  floor: CarFloor
  /** Whether the map was read as low as the car squats at its fastest. */
  covered: boolean
  /** Where the map says the car porpoises, m/s, or null. */
  porpoise: number | null
}

let latest: { key: string; forecast: CarForecast } | null = null

const keyOf = (design: CarDesign, circuit: Circuit['id']) => JSON.stringify([design, circuit])

export const carForecast = {
  set(design: CarDesign, circuit: Circuit['id'], forecast: CarForecast | null): void {
    latest = forecast ? { key: keyOf(design, circuit), forecast } : null
  },
  /** The forecast for this design and circuit, or null if the tunnel hasn't read one. */
  get(design: CarDesign, circuit: Circuit['id']): CarForecast | null {
    return latest && latest.key === keyOf(design, circuit) ? latest.forecast : null
  },
}
