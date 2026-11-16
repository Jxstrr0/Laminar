/**
 * The tunnel's latest hours-on-station forecast for a sensor pod, kept for
 * the Deliver sheet (PR 10ad): the declared hours start from it. Like the
 * kit plane's, it's only offered back for the design and range it was read
 * for, so an old forecast never fills in a new design. Not saved: open the
 * tunnel after a reload and it reads again.
 */
import type { PodDesign, TestRange } from '../data/pod'

export interface PodForecastNote {
  /** Hours on station over the range on its usual day, and the gain on the pod it's measured against, h. */
  hours: number
  gain: number
  /** Whether every reading had the pod under its stretch of wing (the gap was read, not left out). */
  wing: boolean
  /** The buffet index from the readings' shake, and whether it blurs the sensor's picture. */
  buffet: number
  blurs: boolean
  /** Whether the sting's tare and the blockage were both taken off. */
  calibrated: boolean
}

let latest: { key: string; forecast: PodForecastNote } | null = null

const keyOf = (design: PodDesign, range: TestRange['id']) => JSON.stringify([design, range])

export const podForecast = {
  set(design: PodDesign, range: TestRange['id'], forecast: PodForecastNote | null): void {
    latest = forecast ? { key: keyOf(design, range), forecast } : null
  },
  /** The forecast for this design and range, or null if the tunnel hasn't read one. */
  get(design: PodDesign, range: TestRange['id']): PodForecastNote | null {
    return latest && latest.key === keyOf(design, range) ? latest.forecast : null
  },
}
