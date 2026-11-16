import { describe, expect, it } from 'vitest'
import { BRIEFS, PLANE_JOBS } from '../src/data/briefs'
import { PLANE_CLASS, STOCK_PLANE, SURVEY_PATTERN, SURVEY_SITES, type PlaneDesign } from '../src/data/plane'
import {
  briefTemplate,
  clampBid,
  currentPlaneRun,
  daySeed,
  deliverPlane,
  isPlaneBrief,
  newCareer,
  openTo,
  planeEventOf,
  type CareerState,
} from '../src/sim/career'
import { newLab } from '../src/sim/lab'
import { gustLimit, planeRange } from '../src/sim/plane'
import { dragScaleForRange, looseFix, nextTurn, PRACTICE_SITE, surveyDay, surveyDragArea, surveyFlight, turnRadius, turnStart, usualDay } from '../src/sim/planeJob'
import { readOf } from '../src/sim/reputation'

const planeBriefs = BRIEFS.filter((b) => b.event.plane)
const site = SURVEY_SITES.ozimka

/** A career with this survey job in hand. */
function onJob(id: string, promise: number, fee = 120000): CareerState {
  const b = briefTemplate(id)!
  return { ...newCareer(3), job: { brief: { id, fee, days: b.days, seed: 41 }, promise, startDay: 0, daysLeft: b.days, spent: 0 } }
}

/** The sorted survey drone from the sim's own tests: a finer nose and tail cone, the camera tucked to the rule and faired, winglets. */
const GOOD: PlaneDesign = { ...STOCK_PLANE.survey, fuselage: { nose: 0.3, taper: 0.9 }, camera: { drop: 0.35, fairing: 1, at: 0.5 }, winglets: 0.12, tail: 0.95 }
/** Sorted, but with the tail cut down as Vekha's engineers did: it spins in on a turn in the usual gust. */
const LOOSE: PlaneDesign = { ...GOOD, tail: 0.7 }

describe('survey briefs (PR 10m)', () => {
  it('are farms and mapping firms mid-career at the Ozimka fields, and a sorted plane flies further than each one asks', () => {
    expect(planeBriefs.map((b) => b.id)).toEqual(['kolos-survey', 'pashnya-survey', 'vekha-survey'])
    for (const b of planeBriefs) {
      expect(isPlaneBrief(b.id)).toBe(true)
      expect(b.minRep).toBeGreaterThanOrEqual(30)
      expect(planeEventOf({ id: b.id })!.site).toBe(site)
      expect(b.event.temperature).toBe(site.temperature)
      expect(b.event.altitude).toBe(site.altitude)
      expect((planeRange(GOOD, site) - planeRange(b.setup as PlaneDesign, site)) / PLANE_JOBS.pointKm).toBeGreaterThan(b.target)
    }
    expect(gustLimit(GOOD, site)).toBeGreaterThan(site.gust)
    expect(isPlaneBrief('shmel-quad')).toBe(false)
  })

  it('are on the board (PR 10n) once the firm is known, and bid a kilometre at a time', () => {
    expect(PLANE_JOBS.open).toBe(true)
    for (const b of planeBriefs) expect(openTo(b, 100)).toBe(true)
    expect(openTo(briefTemplate('kolos-survey')!, 0)).toBe(false)
    expect(clampBid('kolos-survey', { price: 100000, promise: 15.4 }).promise).toBe(15)
  })

  it('fly the job’s plane against the client’s own, or the maker’s between jobs, on a small model', () => {
    expect(currentPlaneRun(newCareer(3), 'survey')).toEqual({ site, old: STOCK_PLANE.survey })
    expect(currentPlaneRun(onJob('pashnya-survey', 20), 'survey').old).toEqual(briefTemplate('pashnya-survey')!.setup)
    expect(PRACTICE_SITE.site).toBe(site)
    expect(newLab(briefTemplate('kolos-survey')!.setup).order.scale).toBe(2.5)
  })

  it('Pashnya’s bare camera costs them range; Vekha’s cut-down tail spins in on a turn in the usual gust', () => {
    expect(planeRange(briefTemplate('pashnya-survey')!.setup as PlaneDesign, site)).toBeLessThan(planeRange(STOCK_PLANE.survey, site) - 3)
    const vekha = briefTemplate('vekha-survey')!.setup as PlaneDesign
    expect(planeRange(vekha, site)).toBeGreaterThan(planeRange(STOCK_PLANE.survey, site))
    expect(surveyFlight(vekha, site, usualDay(site)).stall).not.toBeNull()
  })
})

describe('survey day', () => {
  it('is seeded, gusts about the site’s usual, and comes on a turn partway through the flight', () => {
    const event = planeEventOf({ id: 'kolos-survey' })!
    expect(surveyDay(event, 9)).toEqual(surveyDay(event, 9))
    const gusts = Array.from({ length: 200 }, (_, i) => surveyDay(event, i + 1))
    const mean = gusts.reduce((s, d) => s + d.gust, 0) / gusts.length
    expect(mean).toBeCloseTo(site.gust, 1)
    for (const d of gusts) {
      expect(d.gust).toBeGreaterThanOrEqual(0)
      expect(d.gustAt).toBeGreaterThanOrEqual(PLANE_JOBS.gustKm.min)
      expect(d.gustAt).toBeLessThan(PLANE_JOBS.gustKm.max + (SURVEY_PATTERN.line + Math.PI * turnRadius('survey')) / 1000)
      // On a turn's start.
      expect(nextTurn('survey', d.gustAt)).toBeCloseTo(d.gustAt, 9)
    }
  })

  it('flies the whole range if it rides the gust out, lands in the crop where the gust comes if not, and misses a gust after it has landed', () => {
    const calm = surveyFlight(GOOD, site, { temperature: 16, gust: 1.5, gustAt: 40 })
    expect(calm.stall).toBeNull()
    expect(calm.flown).toBe(calm.range)
    const rough = surveyFlight(GOOD, site, { temperature: 16, gust: 3, gustAt: 40 })
    expect(rough.stall).toEqual({ gust: 3, at: 40 })
    expect(rough.flown).toBe(40)
    expect(rough.limit).toBeLessThan(3)
    expect(surveyFlight(GOOD, site, { temperature: 16, gust: 3, gustAt: 200 }).stall).toBeNull()
  })

  it('flies lines 600 m long, turning round in a half circle at the bank its class flies', () => {
    // 16 m/s at 35°: about a 37 m radius.
    expect(turnRadius('survey')).toBeGreaterThan(35)
    expect(turnRadius('survey')).toBeLessThan(39)
    expect(turnStart('survey', 0)).toBeCloseTo(0.6, 9)
    expect(turnStart('survey', 1) - turnStart('survey', 0)).toBeCloseTo((600 + Math.PI * turnRadius('survey')) / 1000, 9)
    expect(nextTurn('survey', 0)).toBeCloseTo(0.6, 9)
    expect(nextTurn('survey', 0.61)).toBeCloseTo(turnStart('survey', 1), 9)
    expect(usualDay(site).gustAt).toBeCloseTo(0.6, 9)
  })
})

describe('delivering a survey drone', () => {
  it('judges the promise on the usual day’s range over the client’s plane, and the read on drag', () => {
    const job = onJob('kolos-survey', 15)
    const real = planeRange(GOOD, site)
    const d = deliverPlane(job, GOOD, real)!
    expect(d.debrief.achieved).toBeCloseTo((real - planeRange(STOCK_PLANE.survey, site)) / PLANE_JOBS.pointKm, 6)
    expect(d.debrief.met).toBe(true)
    expect(d.debrief.cause).toBeNull()
    expect(d.debrief.stall).toBeNull()
    expect(d.debrief.camera).toBeNull()
    // Declaring the true range reads the drag true; ten kilometres long is reading it low.
    expect(Math.abs(d.debrief.readError)).toBeLessThan(1e-9)
    expect(d.debrief.read).toBe(readOf(d.debrief.readError))
    expect(deliverPlane(job, GOOD, real + 10)!.debrief.readError).toBeLessThan(-0.05)
    // Survey day is seeded: the same air and gust for both planes.
    expect(d.debrief.day).toEqual(surveyDay(d.event, daySeed(job.job!.brief)))
    expect(d.debrief.baselineFlight.range).toBeCloseTo(planeRange(STOCK_PLANE.survey, site, d.debrief.day.temperature), 9)
  })

  it('a plane the usual gust stalls on a turn spins in and gains nothing, and the debrief says what to change', () => {
    expect(gustLimit(LOOSE, site)).toBeLessThan(site.gust)
    const d = deliverPlane(onJob('vekha-survey', 12), LOOSE, 110)!
    expect(d.debrief.actual).toBeNull()
    expect(d.debrief.achieved).toBe(0)
    expect(d.debrief.cause).toBe('stall')
    expect(d.debrief.stall).toMatchObject({ fix: 'tailSize' })
    expect(d.debrief.stall!.limit).toBeLessThan(d.debrief.stall!.gust)
    // Their own plane counts on paper, though it spins in too.
    expect(d.debrief.baseline).toBeCloseTo(planeRange(briefTemplate('vekha-survey')!.setup as PlaneDesign, site), 9)
    // The sorted plane keeps Vekha's promise.
    expect(deliverPlane(onJob('vekha-survey', 12), GOOD, 108)!.debrief.met).toBe(true)
  })

  it('blames the nose when it took more margin than the tail, and notes a camera tucked past the rule', () => {
    expect(looseFix({ ...GOOD, tail: 1, fuselage: { nose: 0.45, taper: 0.9 } })).toBe('planeNose')
    expect(looseFix(LOOSE)).toBe('tailSize')
    const high = { ...GOOD, camera: { ...GOOD.camera, drop: 0 } }
    expect(deliverPlane(onJob('kolos-survey', 15), high, 108)!.debrief.camera).toEqual({ fix: 'cameraDrop' })
  })

  it('turns a declared range back into drag, and refuses anything but a survey job', () => {
    const r = planeRange(GOOD, site)
    expect(dragScaleForRange(r, GOOD, site)).toBeCloseTo(1, 9)
    expect(dragScaleForRange(r - 10, GOOD, site)).toBeGreaterThan(1)
    expect(surveyDragArea(GOOD, site)).toBeLessThan(surveyDragArea(STOCK_PLANE.survey, site))
    expect(PLANE_CLASS.survey.survey).toBe(16)
    expect(deliverPlane(newCareer(3), GOOD, r)).toBeNull()
    expect(deliverPlane(onJob('shmel-quad', 12), GOOD, r)).toBeNull()
  })
})
