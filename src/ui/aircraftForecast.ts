/**
 * The tunnel's latest cruise forecast for a kit plane, kept for the Deliver
 * sheet (PR 10u): the declared cruise starts from it. Like the survey
 * drone's, it's only offered back for the design and airfield it was read
 * for, so an old forecast never fills in a new design. Not saved: open the
 * tunnel after a reload and it reads again.
 */
import type { AircraftDesign, Airfield } from '../data/aircraft'

export interface AircraftForecastNote {
  /** Cruise on the airfield's usual day, km/h, and the gain on the client's plane, km/h. */
  cruise: number
  gain: number
  /** Whether every reading in the drag fit had the prop driven (the slipstream was in them). */
  powered: boolean
  /** The stall speed, km/h, and whether the inspector signs it off; null if no reading went past the stall. */
  stall: number | null
  passes: boolean | null
  /** Whether the sting's tare and the blockage were both taken off. */
  calibrated: boolean
}

let latest: { key: string; forecast: AircraftForecastNote } | null = null

const keyOf = (design: AircraftDesign, field: Airfield['id']) => JSON.stringify([design, field])

export const aircraftForecast = {
  set(design: AircraftDesign, field: Airfield['id'], forecast: AircraftForecastNote | null): void {
    latest = forecast ? { key: keyOf(design, field), forecast } : null
  },
  /** The forecast for this design and airfield, or null if the tunnel hasn't read one. */
  get(design: AircraftDesign, field: Airfield['id']): AircraftForecastNote | null {
    return latest && latest.key === keyOf(design, field) ? latest.forecast : null
  },
}
