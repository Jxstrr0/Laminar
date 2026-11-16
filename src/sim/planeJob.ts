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
import { ATMOSPHERE } from '../data/field'
import { PLANE_AERO as A, PLANE_CLASS, SURVEY_PATTERN, SURVEY_SITES, type PlaneClass, type PlaneDesign, type SurveySite } from '../data/plane'
import { detCos, detSin, PI } from './det'
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

/** The radius of a survey plane's turns at each line's end, m: its survey speed, banked as its class says. */
export function turnRadius(cls: PlaneClass): number {
  const c = PLANE_CLASS[cls]
  const bank = (c.bank * PI) / 180
  return (c.survey * c.survey * detCos(bank)) / (ATMOSPHERE.gravity * detSin(bank))
}

/** Where the turn after line `n` starts (0: the first turn, after the first line), km along the flight. */
export function turnStart(cls: PlaneClass, n: number): number {
  return (SURVEY_PATTERN.line * (n + 1) + PI * turnRadius(cls) * n) / 1000
}

/** The first turn's start at or past `km` along the flight, km. */
export function nextTurn(cls: PlaneClass, km: number): number {
  const lap = SURVEY_PATTERN.line + PI * turnRadius(cls)
  // A hair of slack, so a turn's own start (worked out the other way round) finds itself.
  const n = Math.max(0, Math.ceil((km * 1000 - SURVEY_PATTERN.line) / lap - 1e-9))
  return turnStart(cls, n)
}

/**
 * Survey day, seeded: its air, its strongest gust on a turn, m/s, and where
 * along the lines it comes, km (the start of a turn: a moment in the day,
 * the same for both planes, which fly side by side). The same for both
 * planes.
 */
export interface SurveyDay {
  temperature: number
  gust: number
  gustAt: number
}

export function surveyDay(event: PlaneEvent, seed: number, cls: PlaneClass = 'survey'): SurveyDay {
  const rng = new Rng(seed).fork('survey-day')
  const temperature = event.site.temperature + event.spread.temperature * gaussian(rng)
  const gust = Math.max(0, event.site.gust + PLANE_JOBS.gustSpread * gaussian(rng))
  return { temperature, gust, gustAt: nextTurn(cls, rng.range(PLANE_JOBS.gustKm.min, PLANE_JOBS.gustKm.max)) }
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

/** A plane's survey flight on a day: it flies its range unless the day's gust on a turn stalls it first (one that has landed by then misses it). */
export function surveyFlight(design: PlaneDesign, site: SurveySite, day: SurveyDay): SurveyFlight {
  const range = planeRange(design, site, day.temperature)
  const limit = gustLimit(design, site, day.temperature)
  const stalls = range > day.gustAt && gustTurn(design, site, day.gust, day.temperature).stalls
  return { range, flown: stalls ? day.gustAt : range, stall: stalls ? { gust: day.gust, at: day.gustAt } : null, limit }
}

/** The site's usual day, its usual strongest gust on the very first turn: what the promise is judged on. */
export function usualDay(site: SurveySite, cls: PlaneClass = 'survey'): SurveyDay {
  return { temperature: site.temperature, gust: site.gust, gustAt: turnStart(cls, 0) }
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
