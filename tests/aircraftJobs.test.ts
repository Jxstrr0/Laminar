import { describe, expect, it } from 'vitest'
import { AIRCRAFT_JOBS, BRIEFS } from '../src/data/briefs'
import { AIRCRAFT_CLASS, AIRFIELDS, STOCK_AIRCRAFT, type AircraftDesign } from '../src/data/aircraft'
import { cruiseSpeed, KMH, stallCheck } from '../src/sim/aircraft'
import { cruiseDragArea, dragScaleForCruise, PRACTICE_FIELD, testDay, testFlight, usualTestDay } from '../src/sim/aircraftJob'
import {
  aircraftEventOf,
  briefTemplate,
  clampBid,
  currentAircraftRun,
  daySeed,
  deliverAircraft,
  isAircraftBrief,
  newCareer,
  openTo,
  type CareerState,
} from '../src/sim/career'
import { newLab } from '../src/sim/lab'
import { readOf } from '../src/sim/reputation'

const kitBriefs = BRIEFS.filter((b) => b.event.aircraft)
const field = AIRFIELDS.belyanka

/** A career with this light-aircraft job in hand. */
function onJob(id: string, promise: number, fee = 180000): CareerState {
  const b = briefTemplate(id)!
  return { ...newCareer(3), job: { brief: { id, fee, days: b.days, seed: 41 }, promise, startDay: 0, daysLeft: b.days, spent: 0 } }
}

/** The sorted kit plane: spats, a tight cowl, faired struts toed into the swirl, the pod faired and left in the middle. */
const GOOD: AircraftDesign = { ...STOCK_AIRCRAFT.kit, spats: 1, cowling: 1, struts: { fairing: 1, toe: 2 }, pod: { fairing: 1, at: 0 } }
/** Sorted, but with square tips as Ozerov fitted them: the stall speed creeps past the certified figure. */
const TIPPED: AircraftDesign = { ...GOOD, wingtips: 1 }

/** Cruise on the usual day, km/h. */
const cruise = (d: AircraftDesign) => cruiseSpeed(d, field) * KMH

describe('light-aircraft briefs (PR 10t)', () => {
  it('are owners and clubs late in the career at Belyanka, and a sorted plane cruises faster than each one asks', () => {
    expect(kitBriefs.map((b) => b.id)).toEqual(['belyanka-club', 'ozerov-tips', 'dalny-ferry'])
    for (const b of kitBriefs) {
      expect(isAircraftBrief(b.id)).toBe(true)
      expect(b.minRep).toBeGreaterThanOrEqual(55)
      expect(aircraftEventOf({ id: b.id })!.field).toBe(field)
      expect(b.event.temperature).toBe(field.temperature)
      expect(b.event.altitude).toBe(field.altitude)
      expect((cruise(GOOD) - cruise(b.setup as AircraftDesign)) / AIRCRAFT_JOBS.pointKmh).toBeGreaterThan(b.target)
    }
    expect(stallCheck(GOOD).passes).toBe(true)
    expect(isAircraftBrief('kolos-survey')).toBe(false)
  })

  it('stay off the board until it can show them (10u), and bid a km/h at a time', () => {
    expect(AIRCRAFT_JOBS.open).toBe(false)
    for (const b of kitBriefs) expect(openTo(b, 100)).toBe(false)
    expect(clampBid('belyanka-club', { price: 180000, promise: 12.4 }).promise).toBe(12)
  })

  it('fly the job’s plane against the client’s own, or the kit between jobs, on the 1:6 model', () => {
    expect(currentAircraftRun(newCareer(3), 'kit')).toEqual({ field, old: STOCK_AIRCRAFT.kit })
    expect(currentAircraftRun(onJob('ozerov-tips', 10), 'kit').old).toEqual(briefTemplate('ozerov-tips')!.setup)
    expect(PRACTICE_FIELD.field).toBe(field)
    expect(newLab(briefTemplate('belyanka-club')!.setup).order.scale).toBe(6)
  })

  it('Ozerov’s square tips and pod forward won’t be signed off; Dalny’s struts, faired but toed against the swirl, cost them speed', () => {
    const ozerov = briefTemplate('ozerov-tips')!.setup as AircraftDesign
    expect(cruise(ozerov)).toBeGreaterThan(cruise(STOCK_AIRCRAFT.kit))
    expect(stallCheck(ozerov).passes).toBe(false)
    const dalny = briefTemplate('dalny-ferry')!.setup as AircraftDesign
    expect(cruise(dalny)).toBeLessThan(cruise(STOCK_AIRCRAFT.kit))
  })
})

describe('test day', () => {
  it('is seeded, and its air strays about the airfield’s usual', () => {
    const event = aircraftEventOf({ id: 'belyanka-club' })!
    expect(testDay(event, 9)).toEqual(testDay(event, 9))
    const days = Array.from({ length: 200 }, (_, i) => testDay(event, i + 1))
    const mean = days.reduce((s, d) => s + d.temperature, 0) / days.length
    expect(Math.abs(mean - field.temperature)).toBeLessThan(1)
    expect(new Set(days.map((d) => d.temperature)).size).toBeGreaterThan(150)
  })

  it('cruises faster on a cold day, and the inspector checks the stall in standard air whatever the day', () => {
    const cold = testFlight(GOOD, field, { temperature: -10 })
    const warm = testFlight(GOOD, field, { temperature: 20 })
    expect(cold.cruise).not.toBeCloseTo(warm.cruise, 1)
    expect(cold.stall).toBe(warm.stall)
    expect(testFlight(GOOD, field, usualTestDay(field)).cruise).toBeCloseTo(cruise(GOOD), 9)
    expect(testFlight(TIPPED, field, usualTestDay(field))).toMatchObject({ passes: false, limit: AIRCRAFT_CLASS.kit.certifiedStall })
  })

  it('turns a declared cruise back into the drag that flies it', () => {
    expect(dragScaleForCruise(cruise(GOOD), GOOD, field)).toBeCloseTo(1, 6)
    expect(dragScaleForCruise(cruise(GOOD) + 10, GOOD, field)).toBeLessThan(0.9)
    expect(dragScaleForCruise(cruise(GOOD) - 10, GOOD, field)).toBeGreaterThan(1.1)
    // Held to its range for a declaration nothing could fly.
    expect(dragScaleForCruise(1000, GOOD, field)).toBeCloseTo(AIRCRAFT_JOBS.dragScale.min, 6)
  })
})

describe('delivering a light aircraft', () => {
  it('judges the promise on the usual day’s cruise over the client’s plane, and the read on drag', () => {
    const job = onJob('belyanka-club', 12)
    const real = cruise(GOOD)
    const d = deliverAircraft(job, GOOD, real)!
    expect(d.debrief.achieved).toBeCloseTo((real - cruise(STOCK_AIRCRAFT.kit)) / AIRCRAFT_JOBS.pointKmh, 6)
    expect(d.debrief.met).toBe(true)
    expect(d.debrief.cause).toBeNull()
    expect(d.debrief.stall).toBeNull()
    expect(d.debrief.actualCdA).toBeCloseTo(cruiseDragArea(GOOD, field), 12)
    // Declaring the true cruise reads the drag true; 8 km/h fast (a stopped prop's promise) is reading it low.
    expect(Math.abs(d.debrief.readError)).toBeLessThan(1e-6)
    expect(d.debrief.read).toBe(readOf(d.debrief.readError))
    expect(deliverAircraft(job, GOOD, real + 8)!.debrief.readError).toBeLessThan(-0.08)
    // Test day is seeded: the same air for both planes.
    expect(d.debrief.day).toEqual(testDay(d.event, daySeed(job.job!.brief)))
    expect(d.debrief.baselineFlight.cruise).toBeCloseTo(cruiseSpeed(STOCK_AIRCRAFT.kit, field, { temperature: d.debrief.day.temperature }) * KMH, 9)
  })

  it('a mod whose stall speed creeps past the limit isn’t signed off and gains nothing, and the debrief says what to change', () => {
    const d = deliverAircraft(onJob('ozerov-tips', 10), TIPPED, 195)!
    expect(d.debrief.actual).toBeNull()
    expect(d.debrief.achieved).toBe(0)
    expect(d.debrief.cause).toBe('stall')
    expect(d.debrief.stall).toMatchObject({ fix: 'wingtips', limit: AIRCRAFT_CLASS.kit.certifiedStall })
    expect(d.debrief.stall!.stall).toBeGreaterThan(d.debrief.stall!.limit)
    // Their own plane counts on paper, though the inspector won't sign it off either.
    expect(d.debrief.baseline).toBeCloseTo(cruise(briefTemplate('ozerov-tips')!.setup as AircraftDesign), 9)
    // The sorted plane keeps Ozerov's promise.
    expect(deliverAircraft(onJob('ozerov-tips', 10), GOOD, 194)!.debrief.met).toBe(true)
  })

  it('blames the pod when it took more of the wing’s lift than the tips', () => {
    const d = deliverAircraft(onJob('ozerov-tips', 10), { ...GOOD, pod: { fairing: 1, at: 1 }, wingtips: 0.3 }, 194)!
    expect(d.debrief.cause).toBe('stall')
    expect(d.debrief.stall!.fix).toBe('acPodAt')
  })

  it('a plane that misses the promise names the design, and only a light-aircraft job takes a kit plane', () => {
    const d = deliverAircraft(onJob('dalny-ferry', 16), STOCK_AIRCRAFT.kit, 175)!
    expect(d.debrief.met).toBe(false)
    expect(d.debrief.cause).toBe('design')
    expect(deliverAircraft(newCareer(3), GOOD, 190)).toBeNull()
    expect(deliverAircraft(onJob('kolos-survey', 15), GOOD, 190)).toBeNull()
  })
})
