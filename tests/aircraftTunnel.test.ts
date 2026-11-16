import { describe, expect, it } from 'vitest'
import { AIRCRAFT_CLASS, AIRFIELDS, STOCK_AIRCRAFT, type AircraftDesign } from '../src/data/aircraft'
import { AIRCRAFT_SCALES, MAKERS, MODEL_SHOP, STANDARD_ORDER } from '../src/data/model'
import { TUNNEL_UPGRADES, UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { aircraftClMax, aircraftDrag, aircraftDragAtLift, cruiseDensity, cruiseSpeed, KMH, stallCheck } from '../src/sim/aircraft'
import {
  aircraftLiftAt,
  aircraftReadings,
  aircraftReadStalled,
  aircraftReynolds,
  forecastAircraft,
  isAircraftRun,
  prepareAircraft,
  readAircraft,
} from '../src/sim/aircraftTunnel'
import { strains } from '../src/sim/failure'
import { makerScales, scaleFamily } from '../src/sim/modelShop'
import { DEG } from '../src/sim/num'
import { isPlaneRun } from '../src/sim/planeTunnel'
import { Rng } from '../src/sim/rng'
import type { RunSample } from '../src/sim/run'
import type { ModelSpec, TunnelSpec } from '../src/sim/views'

const field = AIRFIELDS.belyanka
const STOCK = STOCK_AIRCRAFT.kit
/** The sorted kit plane: spats, a tight cowl, faired struts toed in a little, the pod faired and left in the middle. */
const GOOD: AircraftDesign = { ...STOCK, spats: 1, cowling: 1, struts: { fairing: 1, toe: 2 }, pod: { fairing: 1, at: 0 } }

const IDEAL: TunnelSpec = { turbulence: 0, balanceNoise: 0 }
const model = (scale: number): ModelSpec => ({ scale: 1 / scale, finish: 'sanded', accuracy: 0, seed: 1 })
/** A sweep up past the stall (about 18°). */
const SWEEP = [-2, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]

/** Read a model through a pitch sweep and forecast cruise and the stall. */
function forecast(design: AircraftDesign, powered: boolean, pitches = SWEEP) {
  const prepared = prepareAircraft(design, model(6), powered)
  const rng = new Rng(3)
  const reads = pitches.map((pitchDeg) => readAircraft(prepared, IDEAL, { speed: 40, pitchDeg }, rng))
  return forecastAircraft(reads, design, STOCK, field)!
}

/** Flight's own cruise speed, km/h. */
const cruise = (design: AircraftDesign) => cruiseSpeed(design, field) * KMH

describe('the kit plane’s drag at a lift', () => {
  it('is the same drag flight makes carrying its weight', () => {
    const density = cruiseDensity(field)
    const flying = aircraftDrag(GOOD, 50, density)
    expect(aircraftDragAtLift(GOOD, flying.cl).cdA).toBeCloseTo(flying.cdA, 12)
    expect(aircraftDragAtLift(GOOD, flying.cl, { slipstream: false }).cdA).toBeCloseTo(aircraftDrag(GOOD, 50, density, { slipstream: false }).cdA, 12)
  })

  it('makes lift along a straight line to the stall, then loses it', () => {
    const c = aircraftClMax(GOOD)
    expect(aircraftLiftAt(GOOD, 8 * DEG)).toEqual({ cl: AIRCRAFT_CLASS.kit.liftSlope * 8 * DEG, stalled: false })
    const past = aircraftLiftAt(GOOD, 20 * DEG)
    expect(past.stalled).toBe(true)
    expect(past.cl).toBeLessThan(c)
  })
})

describe('a kit-plane model in the tunnel', () => {
  it('reads the lift true and the drag with the slipstream only when powered', () => {
    const powered = readAircraft(prepareAircraft(GOOD, model(6), true), IDEAL, { speed: 40, pitchDeg: 4 }, new Rng(1))
    const stopped = readAircraft(prepareAircraft(GOOD, model(6), false), IDEAL, { speed: 40, pitchDeg: 4 }, new Rng(1))
    expect(powered.cl).toBeCloseTo(AIRCRAFT_CLASS.kit.liftSlope * 4 * DEG, 9)
    expect(powered.cdA).toBeCloseTo(aircraftDragAtLift(GOOD, powered.cl).cdA, 9)
    expect(stopped.cdA).toBeCloseTo(aircraftDragAtLift(GOOD, stopped.cl, { slipstream: false }).cdA, 9)
    expect(stopped.cdA).toBeLessThan(powered.cdA)
    expect(powered.powered).toBe(true)
    expect(stopped.powered).toBe(false)
    expect(aircraftReadStalled(GOOD, powered)).toBe(false)
    // Its wing's Reynolds number is well clear of the trouble a small drone wing has.
    expect(aircraftReynolds(prepareAircraft(GOOD, model(6), false), 30)).toBeGreaterThan(400_000)
  })

  it('forecasts cruise true with a powered model, and the stall from a sweep past it', () => {
    const f = forecast(GOOD, true)
    expect(f.powered).toBe(true)
    expect(Math.abs(f.cruise - cruise(GOOD))).toBeLessThan(0.3)
    expect(f.gain).toBeGreaterThan(10)
    // A whole-degree sweep reads just past the peak, so it reads the stall a touch high: cautious, never hopeful.
    expect(f.clMax!).toBeLessThanOrEqual(aircraftClMax(GOOD))
    expect(f.clMax!).toBeGreaterThan(aircraftClMax(GOOD) * 0.96)
    expect(f.stall!).toBeGreaterThanOrEqual(stallCheck(GOOD).stall)
    expect(f.stall! - stallCheck(GOOD).stall).toBeLessThan(1.5)
    expect(f.passes).toBe(true)
  })

  it('promises a faster cruise than the plane makes with its prop stopped (Kelbo’s trap)', () => {
    const f = forecast(GOOD, false)
    expect(f.powered).toBe(false)
    expect(f.cruise - cruise(GOOD)).toBeGreaterThan(4)
    expect(f.drag).toBeLessThan(0.97)
  })

  it('only a powered model finds the strut toe that meets the swirl', () => {
    const best = (powered: boolean) => {
      let at = 0
      let low = Infinity
      for (let toe = -6; toe <= 6; toe += 0.5) {
        const d = { ...GOOD, struts: { fairing: 1, toe } }
        const r = readAircraft(prepareAircraft(d, model(6), powered), IDEAL, { speed: 40, pitchDeg: 2 }, new Rng(1))
        if (r.cdA < low) {
          low = r.cdA
          at = toe
        }
      }
      return at
    }
    expect(best(false)).toBe(0)
    expect(best(true)).toBeGreaterThanOrEqual(1.5)
    expect(best(true)).toBeLessThanOrEqual(3)
  })

  it('can’t say whether the inspector signs off without a reading past the stall', () => {
    const f = forecast(GOOD, true, [0, 2, 4, 6, 8])
    expect(f.clMax).toBeNull()
    expect(f.stall).toBeNull()
    expect(f.passes).toBeNull()
  })

  it('reads the stall creeping up when square tips take the wing’s lift', () => {
    const tips: AircraftDesign = { ...GOOD, wingtips: 1 }
    const f = forecast(tips, true)
    expect(f.passes).toBe(false)
    expect(f.stall!).toBeGreaterThan(AIRCRAFT_CLASS.kit.certifiedStall)
  })
})

describe('kit-plane models in the shop and on the sting', () => {
  it('builds them at their own scales, and they fit the test section', () => {
    for (const s of AIRCRAFT_SCALES) {
      expect(scaleFamily(s)).toBe('aircraft')
      expect(MODEL_SHOP.scale[s].price).toBeGreaterThan(0)
      expect(AIRCRAFT_CLASS.kit.span / s).toBeLessThan(UNIVERSITY_TUNNEL.section.width)
    }
    expect(makerScales('shop', 'aircraft')).toEqual([...AIRCRAFT_SCALES])
    expect(MAKERS.resin.scales).not.toContain(5)
  })

  it('pitches on a sting that holds a stalled 1:5 model in the university fan, but not in the big one', () => {
    const big = { order: { ...STANDARD_ORDER, scale: 5 as const }, design: GOOD }
    const sting = (loadN: number) => strains(big, 30, loadN).find((s) => s.part === 'sting')!.level
    const load = (speed: number) => 0.5 * 1.225 * speed * speed * AIRCRAFT_CLASS.kit.wingArea * aircraftClMax(GOOD) / 25
    expect(sting(load(UNIVERSITY_TUNNEL.topSpeed))).toBeLessThan(0.95)
    expect(sting(load(TUNNEL_UPGRADES.fan.topSpeed))).toBeGreaterThan(1)
  })
})

describe('a kit-plane run’s samples', () => {
  it('reads back for the forecast, with whether the prop was driven, and isn’t taken for a survey drone’s', () => {
    const p = prepareAircraft(GOOD, model(6), true)
    const rng = new Rng(4)
    const samples: RunSample[] = SWEEP.map((pitchDeg, i) => {
      const r = readAircraft(p, IDEAL, { speed: 40, pitchDeg }, rng)
      return { t: i, speed: 40, yawDeg: pitchDeg, cdA: r.cdA, cyA: 0, dragN: r.dragN, cl: r.cl, re: r.re, steady: true }
    })
    samples.push({ ...samples[0]!, steady: false })
    const run = { samples, powered: true as const }
    expect(isAircraftRun(run)).toBe(true)
    expect(isPlaneRun(run)).toBe(false)
    expect(isAircraftRun({ samples: [{ ...samples[0]!, cm: -0.05 }] })).toBe(false)
    const back = aircraftReadings([run])
    expect(back).toHaveLength(SWEEP.length)
    expect(back.every((r) => r.powered)).toBe(true)
    const f = forecastAircraft(back, GOOD, STOCK, field)!
    expect(f.cruise).toBeCloseTo(forecast(GOOD, true).cruise, 6)
    expect(aircraftReadings([{ samples }]).every((r) => !r.powered)).toBe(true)
  })
})
