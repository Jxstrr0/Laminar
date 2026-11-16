/**
 * The tunnel's latest race forecast for a racing quad, kept for the Deliver
 * sheet (PR 10g): the declared race time starts from it. Like the car's,
 * it's only offered back for the design and course it was read for, so an
 * old forecast never fills in a new design. Not saved: open the tunnel
 * after a reload and it reads again.
 */
import type { DroneCourse, DroneDesign } from '../data/drone'

export interface DroneForecastNote {
  /** The race on the course's usual day, s, and the gain on the pilot's quad, s; both null if the forecast quad tumbles. */
  time: number | null
  gain: number | null
  /** Where the forecast quad tumbles, km/h, or null. */
  tumble: number | null
  /** Whether any reading met the pod far enough off its nose to measure the twist (else a tumble can't be seen). */
  twistMeasured: boolean
  /** Whether the props were spinning (the downwash measured), or stopped (the maker's bare-arm figure). */
  downwashMeasured: boolean
  /** Whether the sting's tare and the blockage were both taken off. */
  calibrated: boolean
}

let latest: { key: string; forecast: DroneForecastNote } | null = null

const keyOf = (design: DroneDesign, course: DroneCourse['id']) => JSON.stringify([design, course])

export const droneForecast = {
  set(design: DroneDesign, course: DroneCourse['id'], forecast: DroneForecastNote | null): void {
    latest = forecast ? { key: keyOf(design, course), forecast } : null
  },
  /** The forecast for this design and course, or null if the tunnel hasn't read one. */
  get(design: DroneDesign, course: DroneCourse['id']): DroneForecastNote | null {
    return latest && latest.key === keyOf(design, course) ? latest.forecast : null
  },
}
