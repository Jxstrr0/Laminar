import { describe, expect, it } from 'vitest'
import { AIR } from '../src/data/air'
import { BOB_CREW, CLUB_BOBSLED, DEFAULT_BOBSLED, SLIDING_RULES, type BobsledDesign } from '../src/data/bobsled'
import { TRACKS } from '../src/data/tracks'
import { bobRun, checkSledRules, crewCdA, iceFriction, loadLoss, referenceConditions, referenceRun, sightMargin, sledDrag } from '../src/sim/bobsled'
import { sledLength } from '../src/sim/geom/bobsled'

const track = TRACKS.belogor
const flow = { density: AIR.density, viscosity: AIR.viscosity, speed: 30, turbulence: 0.015 }
const sled = (patch: Partial<BobsledDesign['sled']> = {}, tuck = DEFAULT_BOBSLED.tuck, crew: 2 | 4 = 2): BobsledDesign => ({
  sport: 'bobsled',
  crew,
  sled: { ...DEFAULT_BOBSLED.sled, ...patch },
  tuck,
})
const time = (d: BobsledDesign) => referenceRun(d, track).time

describe('the sled and its rules', () => {
  it('keeps the default sleds inside the Tarnovian Sliding Federation’s box', () => {
    expect(checkSledRules(DEFAULT_BOBSLED)).toEqual([])
    expect(checkSledRules(CLUB_BOBSLED)).toEqual([])
    expect(sledLength(DEFAULT_BOBSLED)).toBeLessThanOrEqual(SLIDING_RULES.maxLength[2])
  })

  it('makes nose and tail share the length, and caps the cowling', () => {
    const long = checkSledRules(sled({ nose: 0.9, tail: 0.5 }))
    expect(long).toEqual([{ rule: 'length', part: 'sled.nose', value: expect.closeTo(2.95, 9), limit: 2.7 }])
    expect(checkSledRules(sled({ nose: 0.58, tail: 0.6 }))[0]!.part).toBe('sled.tail')
    // A four-man sled has more length to share.
    expect(checkSledRules(sled({ nose: 0.8, tail: 0.5 }, 0.6, 4))).toEqual([])
    expect(checkSledRules(sled({ cowl: 0.62 }))).toEqual([{ rule: 'cowl', part: 'sled.cowl', value: 0.62, limit: 0.6 }])
  })
})

describe('the drag', () => {
  it('lands near real sleds: about 0.19 m² racing, 0.31 m² for an old club sled', () => {
    expect(sledDrag(DEFAULT_BOBSLED, flow).cdA).toBeGreaterThan(0.16)
    expect(sledDrag(DEFAULT_BOBSLED, flow).cdA).toBeLessThan(0.22)
    expect(sledDrag(CLUB_BOBSLED, flow).cdA).toBeGreaterThan(0.27)
  })

  it('pays for a blunt nose and a stubby tail', () => {
    expect(sledDrag(sled({ nose: 0.3 }), flow).nose).toBeGreaterThan(3 * sledDrag(sled({ nose: 0.6 }), flow).nose)
    expect(sledDrag(sled({ tail: 0.1 }), flow).hull).toBeGreaterThan(sledDrag(sled({ tail: 0.45 }), flow).hull + 0.02)
  })

  it('finds the best split of the length between nose and tail in the middle', () => {
    const middle = time(sled({ nose: 0.7, tail: 0.45 }))
    expect(time(sled({ nose: 0.4, tail: 0.75 }))).toBeGreaterThan(middle + 0.1)
    expect(time(sled({ nose: 0.8, tail: 0.35 }))).toBeGreaterThan(middle + 0.1)
  })

  it('hides the crew behind a taller cowling and a deeper tuck; the ones behind ride sheltered', () => {
    expect(crewCdA(sled({ cowl: 0.58 }))).toBeLessThan(crewCdA(sled({ cowl: 0.48 })))
    expect(crewCdA(sled({}, 1))).toBeLessThan(crewCdA(sled({}, 0)))
    // Two more crew add far less than two more drivers would.
    const two = crewCdA(sled())
    const four = crewCdA(sled({}, DEFAULT_BOBSLED.tuck, 4))
    expect(four / two).toBeCloseTo((1 + 3 * BOB_CREW.shelter) / (1 + BOB_CREW.shelter), 9)
  })
})

describe('the run', () => {
  it('runs Belogor in about 50 s near 130 km/h, and a racing sled beats the old club sled', () => {
    const r = referenceRun(DEFAULT_BOBSLED, track)
    expect(r.time).toBeGreaterThan(47)
    expect(r.time).toBeLessThan(53)
    expect(r.topSpeed * 3.6).toBeGreaterThan(120)
    expect(r.topSpeed * 3.6).toBeLessThan(145)
    expect(time(CLUB_BOBSLED)).toBeGreaterThan(r.time + 1)
  })

  it('costs loading speed for a deep tuck and a tall cowling, so the deepest tuck gains little', () => {
    expect(loadLoss(sled({}, 1))).toBeGreaterThan(loadLoss(sled({}, 0.5)))
    expect(loadLoss(sled({ cowl: 0.6 }))).toBeGreaterThan(loadLoss(sled({ cowl: 0.5 })))
    const gainTo08 = time(sled({}, 0.6)) - time(sled({}, 0.8))
    const gainTo1 = time(sled({}, 0.8)) - time(sled({}, 1))
    expect(gainTo1).toBeLessThan(gainTo08)
  })

  it('loses time in every curve when the driver can’t see over the cowling', () => {
    const blind = sled({ cowl: 0.6 }, 1)
    expect(sightMargin(blind)).toBeLessThan(0)
    const r = referenceRun(blind, track)
    expect(r.blindLoss).toBeGreaterThan(0)
    expect(referenceRun(DEFAULT_BOBSLED, track).blindLoss).toBe(0)
  })

  it('feels the day: wind along the track, ice off its best temperature, a slower push', () => {
    const day = referenceConditions(DEFAULT_BOBSLED)
    const base = bobRun(DEFAULT_BOBSLED, track, day).time
    expect(bobRun(DEFAULT_BOBSLED, track, { ...day, headwind: 2 }).time).toBeGreaterThan(base + 0.2)
    expect(bobRun(DEFAULT_BOBSLED, track, { ...day, headwind: -2 }).time).toBeLessThan(base - 0.2)
    expect(iceFriction(-2)).toBeGreaterThan(iceFriction(-7))
    expect(bobRun(DEFAULT_BOBSLED, track, { ...day, iceTemp: -1 }).time).toBeGreaterThan(base)
    expect(bobRun(DEFAULT_BOBSLED, track, { ...day, pushSpeed: day.pushSpeed - 0.3 }).time).toBeGreaterThan(base + 0.1)
  })

  it('gives the same time for the same sled and day, every time', () => {
    expect(time(DEFAULT_BOBSLED)).toBe(time(structuredClone(DEFAULT_BOBSLED)))
    const r = referenceRun(DEFAULT_BOBSLED, track)
    // The trace runs from the start to the finish, in order.
    expect(r.trace[0]!.t).toBe(0)
    expect(r.trace.at(-1)!.t).toBeCloseTo(r.time, 9)
    for (let i = 1; i < r.trace.length; i++) expect(r.trace[i]!.s).toBeGreaterThanOrEqual(r.trace[i - 1]!.s)
  })
})
