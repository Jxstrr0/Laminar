import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { MODEL_TRIPS, STANDARD_MODEL, STANDARD_ORDER } from '../src/data/model'
import { UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { cyclistShape } from '../src/sim/geom/cyclist'
import { matchedSpeed, modelSpecOf, quote, reynoldsRatio } from '../src/sim/modelShop'
import { Rng } from '../src/sim/rng'
import { buildModel, prepareModel, readBalance, REFERENCE_TT, truth } from '../src/sim/views'

const spec = cyclistShape(DEFAULT_CYCLIST)
const air = { ...UNIVERSITY_TUNNEL, balanceNoise: 0, turbulence: 0.013 }
const full = truth(spec, REFERENCE_TT).cdA
const read = (order: Parameters<typeof modelSpecOf>[0], speed: number) =>
  readBalance(prepareModel(spec, modelSpecOf(order, 1)), air, { speed, yawDeg: 0 }, new Rng(1)).cdA

describe('the model shop', () => {
  it('prices the standard order, and adds up finish, grade and trips', () => {
    expect(quote(STANDARD_ORDER)).toEqual({ price: 52000, days: 7 })
    expect(quote({ scale: 4, finish: 'printed', grade: 'fine', trips: true, taps: false })).toEqual({ price: 30000, days: 6 })
    expect(quote({ scale: 2, finish: 'polished', grade: 'standard', trips: false, taps: false }).price).toBeGreaterThan(52000)
  })

  it('builds the standard order as the standard model', () => {
    const m = modelSpecOf(STANDARD_ORDER, 7)
    expect(m).toEqual({ scale: STANDARD_MODEL.scale, finish: STANDARD_MODEL.finish, accuracy: STANDARD_MODEL.accuracy, seed: 7 })
    expect(modelSpecOf({ ...STANDARD_ORDER, trips: true }, 7).trips).toBe(true)
  })

  it('tapes trip strips only on the parts long at full size', () => {
    const built = buildModel(spec, modelSpecOf({ ...STANDARD_ORDER, trips: true }, 1))
    const trip = (id: string) => built.bodies.find((b) => b.id === id)?.trip
    expect(trip('torso')).toEqual({ at: MODEL_TRIPS.at, height: MODEL_TRIPS.height })
    expect(trip('helmet')).toBeDefined()
    expect(trip('thigh-1')).toBeUndefined()
    expect(trip('upper-arm-1')).toBeUndefined()
    expect(buildModel(spec, modelSpecOf(STANDARD_ORDER, 1)).bodies.some((b) => b.trip)).toBe(false)
  })
})

describe('the Reynolds trap', () => {
  it('matches the full-size Reynolds number at the matched speed', () => {
    const half = prepareModel(spec, modelSpecOf(STANDARD_ORDER, 1))
    const v = matchedSpeed(0.5, REFERENCE_TT)
    expect(reynoldsRatio(half, v, REFERENCE_TT)).toBeCloseTo(1, 9)
    // A 1:4 model would need more than the fan has.
    expect(matchedSpeed(0.25, REFERENCE_TT)).toBeGreaterThan(UNIVERSITY_TUNNEL.topSpeed)
  })

  it('makes a 1:4 model read high even flat out, and the shop’s trip strips fix most of it', () => {
    const small = { ...STANDARD_ORDER, scale: 4 as const }
    const top = UNIVERSITY_TUNNEL.topSpeed
    expect(read(small, top) / full - 1).toBeGreaterThan(0.02)
    expect(Math.abs(read({ ...small, trips: true }, top) / full - 1)).toBeLessThan(0.01)
  })

  it('reads true at 1:2 near the matched speed, and well low when run flat out', () => {
    expect(Math.abs(read(STANDARD_ORDER, 25) / full - 1)).toBeLessThan(0.01)
    expect(read(STANDARD_ORDER, 40) / full - 1).toBeLessThan(-0.1)
  })
})
