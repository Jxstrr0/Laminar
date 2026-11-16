import { describe, expect, it } from 'vitest'
import { AIRCRAFT_CLASS, AIRCRAFT_RANGE, AIRFIELDS, STOCK_AIRCRAFT, type AircraftDesign } from '../src/data/aircraft'
import {
  aircraftClMax,
  aircraftDrag,
  aircraftMass,
  aircraftSpanEfficiency,
  cruiseDensity,
  cruisePower,
  cruiseSpeed,
  KMH,
  stallCheck,
} from '../src/sim/aircraft'

const field = AIRFIELDS.belyanka
const STOCK = STOCK_AIRCRAFT.kit
/** A sensibly modded kit: full spats, the tight cowl, faired struts toed into the swirl, the pod faired. Rounded tips, the pod in the middle. */
const GOOD: AircraftDesign = { ...STOCK, spats: 1, cowling: 1, struts: { fairing: 1, toe: 2 }, pod: { fairing: 1, at: 0 } }
const kmh = (d: AircraftDesign, opts = {}) => cruiseSpeed(d, field, opts) * KMH

describe('the light aircraft (PR 10p)', () => {
  it('cruises the kit at some 175 km/h, and a well-modded one 15–20 km/h faster', () => {
    expect(kmh(STOCK)).toBeGreaterThan(170)
    expect(kmh(STOCK)).toBeLessThan(180)
    expect(kmh(GOOD) - kmh(STOCK)).toBeGreaterThan(15)
    expect(kmh(GOOD) - kmh(STOCK)).toBeLessThan(22)
    // Every slider's stock value is in its range.
    const r = AIRCRAFT_RANGE.kit
    expect(STOCK.struts.toe).toBeGreaterThanOrEqual(r.toe.min)
    expect(STOCK.pod.at).toBeLessThanOrEqual(r.podAt.max)
  })

  it('cruises where the prop’s push at cruise power meets the drag', () => {
    const v = cruiseSpeed(GOOD, field)
    const density = cruiseDensity(field)
    const power = 0.5 * density * v * v * v * aircraftDrag(GOOD, v, density).cdA
    expect(power / cruisePower(GOOD)).toBeCloseTo(1, 6)
    // Twice the drag, slower; the same plane always gives the same speed.
    expect(cruiseSpeed(GOOD, field, { drag: 2 })).toBeLessThan(v * 0.85)
    expect(cruiseSpeed(GOOD, field)).toBe(v)
  })

  it('adds up its drag, and each mod takes its own share off', () => {
    const density = cruiseDensity(field)
    const d = aircraftDrag(STOCK, 50, density)
    expect(d.cdA).toBeCloseTo(d.wing + d.induced + d.fuselage + d.tail + d.misc + d.cowl + d.gear + d.struts + d.pod + d.tips, 12)
    const with_ = (patch: Partial<AircraftDesign>) => aircraftDrag({ ...STOCK, ...patch }, 50, density)
    expect(with_({ spats: 1 }).gear).toBeLessThan(d.gear)
    expect(with_({ cowling: 1 }).cowl).toBeLessThan(d.cowl)
    expect(with_({ struts: { fairing: 1, toe: 0 } }).struts).toBeLessThan(d.struts)
    expect(with_({ pod: { fairing: 1, at: 0 } }).pod).toBeLessThan(d.pod)
    // The pod forward clears its wake off the wing.
    expect(with_({ pod: { fairing: 0, at: 1 } }).pod).toBeLessThan(d.pod)
    // Square tips: less drag from making lift.
    expect(with_({ wingtips: 1 }).induced).toBeLessThan(d.induced)
    expect(aircraftSpanEfficiency({ ...STOCK, wingtips: 1 })).toBeGreaterThan(AIRCRAFT_CLASS.kit.oswald)
    // Spats and fairings weigh something.
    expect(aircraftMass(GOOD)).toBeGreaterThan(aircraftMass(STOCK))
  })
})

describe('the prop wash (Kelbo’s trap)', () => {
  it('makes the plane drag more in flight than with its prop stopped, so a prop-off tunnel over-reads the speed', () => {
    const density = cruiseDensity(field)
    const flying = aircraftDrag(GOOD, 50, density)
    const stopped = aircraftDrag(GOOD, 50, density, { slipstream: false })
    expect(flying.cowl).toBeGreaterThan(stopped.cowl)
    expect(flying.gear).toBeGreaterThan(stopped.gear)
    expect(flying.fuselage).toBeGreaterThan(stopped.fuselage)
    expect(flying.tail).toBe(stopped.tail)
    expect(kmh(GOOD, { slipstream: false }) - kmh(GOOD)).toBeGreaterThan(5)
  })

  it('meets the strut fairings’ roots at an angle: straight air wants no toe, the swirl wants some', () => {
    const density = cruiseDensity(field)
    const toed = (toe: number, slipstream: boolean) =>
      aircraftDrag({ ...GOOD, struts: { fairing: 1, toe } }, 50, density, { slipstream }).struts
    expect(toed(0, false)).toBeLessThan(toed(2, false))
    expect(toed(2, true)).toBeLessThan(toed(0, true))
    // Bare round struts don't care which way the air comes.
    const bare = (toe: number) => aircraftDrag({ ...STOCK, struts: { fairing: 0, toe } }, 50, density, { slipstream: false }).struts
    expect(bare(4)).toBeCloseTo(bare(0), 12)
  })
})

describe('the stall speed', () => {
  it('passes the inspector on the kit’s tips with the pod in the middle', () => {
    const check = stallCheck(GOOD)
    expect(check.passes).toBe(true)
    expect(check.limit).toBe(AIRCRAFT_CLASS.kit.certifiedStall)
    expect(check.stall).toBeGreaterThan(check.limit - 5)
  })

  it('creeps past the certified figure with square tips, or the pod slid well forward', () => {
    expect(stallCheck({ ...GOOD, wingtips: 1 }).passes).toBe(false)
    expect(stallCheck({ ...GOOD, pod: { fairing: 1, at: 1 } }).passes).toBe(false)
    // A little of each still passes; the pod aft of the middle costs no lift.
    expect(stallCheck({ ...GOOD, wingtips: 0.4, pod: { fairing: 1, at: 0.2 } }).passes).toBe(true)
    expect(aircraftClMax({ ...GOOD, pod: { fairing: 1, at: -1 } })).toBe(aircraftClMax(GOOD))
    // The wing's most lift, measured lower, means a faster stall.
    expect(stallCheck(GOOD, aircraftClMax(GOOD) * 0.9).stall).toBeGreaterThan(stallCheck(GOOD).stall)
  })
})
