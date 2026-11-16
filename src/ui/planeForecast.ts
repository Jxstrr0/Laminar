/**
 * The tunnel's latest range forecast for a survey drone, kept for the
 * Deliver sheet (PR 10n): the declared range starts from it. Like the
 * quad's, it's only offered back for the design and site it was read for,
 * so an old forecast never fills in a new design. Not saved: open the tunnel
 * after a reload and it reads again.
 */
import type { PlaneDesign, SurveySite } from '../data/plane'

export interface PlaneForecastNote {
  /** Range on a charge on the site's usual day, km, and the gain on the client's plane, km. */
  range: number
  gain: number
  /** Whether the usual gust on a turn stalls it, or null if the forecast couldn't judge (no reading past the stall, or none with lift enough for the margin). */
  stalls: boolean | null
  /** The lowest Reynolds number the readings were taken at, and the full-size wing's: far apart, a small model's early stall may be in it. */
  re: number
  fieldRe: number
  /** Whether the readings were taken with trip strips on the wing. */
  trips: boolean
  /** Whether the sting's tare and the blockage were both taken off. */
  calibrated: boolean
}

let latest: { key: string; forecast: PlaneForecastNote } | null = null

const keyOf = (design: PlaneDesign, site: SurveySite['id']) => JSON.stringify([design, site])

export const planeForecast = {
  set(design: PlaneDesign, site: SurveySite['id'], forecast: PlaneForecastNote | null): void {
    latest = forecast ? { key: keyOf(design, site), forecast } : null
  },
  /** The forecast for this design and site, or null if the tunnel hasn't read one. */
  get(design: PlaneDesign, site: SurveySite['id']): PlaneForecastNote | null {
    return latest && latest.key === keyOf(design, site) ? latest.forecast : null
  },
}
