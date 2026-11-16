/**
 * A survey-drone job's survey day (plan sections 6.8 and 9, PR 10m).
 *
 * - The promise is range on one charge at survey speed on the site's usual
 *   day, over the client's own plane on paper. A plane that stalls in the
 *   site's usual gust on a turn spins into the crop and gains nothing. The
 *   drone breaks; nobody is hurt.
 * - Survey day is the show: one seeded day's air, and its strongest gust
 *   on a turn, somewhere along the flight. Your plane and the client's fly
 *   the same day; one that can't ride that gust out lands in the crop there.
 * - The declared number is the new plane's range. How good a read it was is
 *   judged on drag: range goes as one over drag at survey speed, so the
 *   declared range turns straight back into a drag area.
 */
import { PLANE_JOBS, type BriefTemplate } from '../data/briefs'
import { PLANE_AERO as A, PLANE_CLASS, SURVEY_SITES, type PlaneDesign, type SurveySite } from '../data/plane'
import { gaussian } from './noise'
import { gustLimit, gustTurn, planeDrag, planeRange, siteDensity } from './plane'
import { Rng } from './rng'
import type { FixTarget } from './failure'

/** A brief's survey contract, ready for the flight. */
export interface PlaneEvent {
  site: SurveySite
  /** Day-to-day spread of survey day's air (standard deviation), °C. */
  spread: { temperature: number }
}

/** A brief's survey contract, or null if it isn't a survey brief. */
export function planeEventFrom(b: Pick<BriefTemplate, 'event' | 'setup'>): PlaneEvent | null {
  const e = b.event
  if (!e.plane || b.setup.sport !== 'plane') return null
  return { site: SURVEY_SITES[e.plane.site], spread: { temperature: e.spread.temperature } }
}

/** The site between jobs: the Ozimka fields on their usual day. */
export const PRACTICE_SITE: PlaneEvent = { site: SURVEY_SITES.ozimka, spread: { temperature: 0 } }

/** Survey day, seeded: its air, its strongest gust on a turn, m/s, and how far through the flight it comes (a share). The same for both planes. */
export interface SurveyDay {
  temperature: number
  gust: number
  gustAt: number
}

export function surveyDay(event: PlaneEvent, seed: number): SurveyDay {
  const rng = new Rng(seed).fork('survey-day')
  const temperature = event.site.temperature + event.spread.temperature * gaussian(rng)
  const gust = Math.max(0, event.site.gust + PLANE_JOBS.gustSpread * gaussian(rng))
  return { temperature, gust, gustAt: rng.range(PLANE_JOBS.gustAt.min, PLANE_JOBS.gustAt.max) }
}

/** One plane's survey flight: the range it would fly, what it did fly, km, and where it stalled, if it did. */
export interface SurveyFlight {
  range: number
  flown: number
  /** Null if it rode out the gust; else the gust, m/s, and how far it had flown, km. */
  stall: { gust: number; at: number } | null
  /** The strongest gust it rides out on a turn that day, m/s. */
  limit: number
}

/** A plane's survey flight on a day: it flies its range unless the day's gust on a turn stalls it first. */
export function surveyFlight(design: PlaneDesign, site: SurveySite, day: SurveyDay): SurveyFlight {
  const range = planeRange(design, site, day.temperature)
  const limit = gustLimit(design, site, day.temperature)
  const stalls = gustTurn(design, site, day.gust, day.temperature).stalls
  const at = range * day.gustAt
  return { range, flown: stalls ? at : range, stall: stalls ? { gust: day.gust, at } : null, limit }
}

/** The site's usual day, with its usual strongest gust coming halfway: what the promise is judged on. */
export function usualDay(site: SurveySite): SurveyDay {
  return { temperature: site.temperature, gust: site.gust, gustAt: 0.5 }
}

/** The plane's drag area at survey speed on the site's usual day, m²: the number the read is judged on. */
export function surveyDragArea(design: PlaneDesign, site: SurveySite): number {
  return planeDrag(design, PLANE_CLASS[design.class].survey, siteDensity(site)).cdA
}

/** How much of the plane's real drag would fly this range on the usual day (1: exactly its drag). Range goes as one over drag. */
export function dragScaleForRange(range: number, design: PlaneDesign, site: SurveySite): number {
  return range > 0 ? planeRange(design, site) / range : Infinity
}

/**
 * What loosened the plane in pitch, for a stall's "change this": the tail
 * cut down below the maker's, or the nose stretched past it, whichever
 * took more margin away (the tail if neither did).
 */
export function looseFix(design: PlaneDesign): FixTarget {
  const tail = A.tailMargin * Math.max(0, 1 - design.tail)
  const nose = A.noseMargin * Math.max(0, design.fuselage.nose - A.noseStock)
  return nose > tail ? 'planeNose' : 'tailSize'
}
