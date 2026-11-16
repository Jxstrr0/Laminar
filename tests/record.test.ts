import { describe, expect, it } from 'vitest'
import { COMPRESSIBILITY, RECORD_RUN, RECORD_SIDE, STOCK_RECORD, type RecordDesign } from '../src/data/record'
import { SALT_FLATS } from '../src/data/saltFlats'
import { densityAt } from '../src/sim/field/atmosphere'
import {
  criticalMach,
  dragRise,
  marginNeeded,
  recordAero,
  recordDayAir,
  recordRun,
  sideCentre,
  sightLoss,
  soundSpeed,
  stillDay,
  twoWay,
  type RunAir,
} from '../src/sim/record'

const flat = SALT_FLATS.sukhoye
const STOCK = STOCK_RECORD.streamliner
/** A well-shaped streamliner: a long nose drooped enough, a low canopy, a big fin and enclosed wheels. */
const GOOD: RecordDesign = { ...STOCK, nose: { length: 2.7, droop: 3 }, canopy: 0.25, fin: 1, fairings: 1 }
const still: RunAir = { temperature: flat.temperature, density: densityAt(flat.temperature, flat.altitude), head: 0, cross: 0 }
const kmh = (v: number) => v * 3.6

describe('the streamliner’s aero', () => {
  it('trades the nose’s pressure drag for its skin drag: neither stub nor needle is best', () => {
    const nose = (length: number) => recordAero({ ...STOCK, nose: { length, droop: 0 } }).drag.nose
    expect(nose(2.5)).toBeLessThan(nose(1))
    expect(nose(2.5)).toBeLessThan(nose(3.5) + 1e-9)
  })

  it('faired wheels, a lower canopy and a smaller fin each cut drag', () => {
    const cdA = (d: RecordDesign) => recordAero(d).cdA
    expect(cdA({ ...STOCK, fairings: 1 })).toBeLessThan(cdA(STOCK))
    expect(cdA({ ...STOCK, canopy: 0.2 })).toBeLessThan(cdA(STOCK))
    expect(cdA({ ...STOCK, fin: 0.2 })).toBeLessThan(cdA(STOCK))
    expect(cdA(GOOD)).toBeLessThan(cdA(STOCK) * 0.7)
  })

  it('droop presses the nose down at a cost in drag; a longer nose lifts more', () => {
    const at = (length: number, droop: number) => recordAero({ ...STOCK, nose: { length, droop } })
    expect(at(2, 3).liftFront).toBeLessThan(at(2, 0).liftFront)
    expect(at(2, 3).cdA).toBeGreaterThan(at(2, 0).cdA)
    expect(at(3, 2).liftFront).toBeGreaterThan(at(1.5, 2).liftFront)
  })
})

describe('pointing straight', () => {
  it('the team’s car holds a modest crosswind', () => {
    const m = sideCentre(STOCK).margin
    expect(m).toBeGreaterThan(marginNeeded(0))
    expect(m).toBeGreaterThan(marginNeeded(3))
  })

  it('a fin pulls the side force back; a long nose and front fairings pull it forward', () => {
    const m = (d: RecordDesign) => sideCentre(d).margin
    expect(m({ ...STOCK, fin: 1 })).toBeGreaterThan(m(STOCK))
    expect(m({ ...STOCK, nose: { length: 3.5, droop: 2 } })).toBeLessThan(m(STOCK))
    // Rear fairings sit far behind the mass, but the front ones nearly cancel them.
    expect(sideCentre({ ...STOCK, fin: 0 }).margin).toBeLessThan(0)
  })
})

describe('the air squeezing near the speed of sound', () => {
  it('sound travels faster in warm air', () => {
    expect(soundSpeed(15)).toBeCloseTo(340.3, 0)
    expect(soundSpeed(35)).toBeGreaterThan(soundSpeed(15))
  })

  it('adds no drag below the critical Mach number, then more and more', () => {
    const crit = criticalMach(STOCK)
    expect(crit).toBeCloseTo(COMPRESSIBILITY.critical, 9)
    expect(dragRise(STOCK, crit - 0.05)).toBe(1)
    expect(dragRise(STOCK, crit + 0.05)).toBeGreaterThan(1)
    expect(dragRise(STOCK, 0.9)).toBeGreaterThan(dragRise(STOCK, crit + 0.05) + 1)
    // About 650 km/h on a usual day.
    expect(kmh(crit * soundSpeed(flat.temperature))).toBeGreaterThan(600)
    expect(kmh(crit * soundSpeed(flat.temperature))).toBeLessThan(680)
  })

  it('lets the air squeeze later round a longer nose', () => {
    expect(criticalMach({ ...STOCK, nose: { length: 3, droop: 2 } })).toBeGreaterThan(criticalMach(STOCK))
  })
})

describe('a run down the salt', () => {
  it('runs the team’s car at a believable record speed, faster through the timed kilometre the better the shape', () => {
    const stock = recordRun(STOCK, still)
    const good = recordRun(GOOD, still)
    expect(stock.abort).toBeNull()
    expect(good.abort).toBeNull()
    expect(kmh(stock.speed!)).toBeGreaterThan(500)
    expect(kmh(good.speed!)).toBeLessThan(680)
    expect(good.speed!).toBeGreaterThan(stock.speed! * 1.05)
    // Still picking up speed through the timed kilometre, so its mean is under its top.
    expect(stock.speed!).toBeLessThan(stock.top)
    expect(stock.speeds.length).toBe((RECORD_RUN.runUp + RECORD_RUN.timed) / RECORD_RUN.step + 1)
  })

  it('a canopy too low to see the line costs speed', () => {
    expect(sightLoss({ ...GOOD, canopy: 0.15 })).toBeGreaterThan(0)
    expect(sightLoss(GOOD)).toBe(0)
    expect(recordRun({ ...GOOD, canopy: 0.15 }, still).speed!).toBeLessThan(recordRun(GOOD, still).speed!)
  })

  it('aborts with the chutes when the nose goes light', () => {
    const run = recordRun({ ...GOOD, nose: { length: 2.7, droop: 0 } }, still)
    expect(run.abort?.cause).toBe('lift')
    expect(run.speed).toBeNull()
    expect(run.abort!.speed).toBeGreaterThan(100)
  })

  it('aborts when the car wanders, and a crosswind finds a small margin', () => {
    const noFin = recordRun({ ...STOCK, fin: 0 }, still)
    expect(noFin.abort?.cause).toBe('wander')
    expect(noFin.abort!.speed).toBeGreaterThanOrEqual(RECORD_SIDE.wanderSpeed)
    // Just enough fin in still air, not in a 2 m/s crosswind.
    const small: RecordDesign = { ...GOOD, fin: 0.7 }
    expect(sideCentre(small).margin).toBeGreaterThan(marginNeeded(0))
    expect(recordRun(small, still).abort).toBeNull()
    expect(recordRun(small, { ...still, cross: 2 }).abort?.cause).toBe('wander')
  })

  it('goes quicker with the wind behind and slower into it', () => {
    const into = recordRun(STOCK, { ...still, head: 3 }).speed!
    const behind = recordRun(STOCK, { ...still, head: -3 }).speed!
    expect(behind).toBeGreaterThan(recordRun(STOCK, still).speed!)
    expect(into).toBeLessThan(recordRun(STOCK, still).speed!)
  })
})

describe('the record: a run each way within the hour', () => {
  it('in still air both runs match and the mean is either one', () => {
    const a = twoWay(STOCK, flat, stillDay(flat))
    expect(a.runs[0].speed).toBeCloseTo(a.runs[1].speed!, 9)
    expect(a.mean).toBeCloseTo(a.runs[0].speed!, 9)
  })

  it('a steady wind mostly cancels', () => {
    const calm = twoWay(STOCK, flat, stillDay(flat)).mean!
    const windy = twoWay(STOCK, flat, { ...stillDay(flat), along: 4 })
    const spread = Math.abs(windy.runs[0].speed! - windy.runs[1].speed!)
    expect(spread).toBeGreaterThan(calm * 0.01)
    expect(Math.abs(windy.mean! - calm)).toBeLessThan(spread / 5)
  })

  it('doesn’t count if either run is aborted', () => {
    const a = twoWay({ ...STOCK, fin: 0 }, flat, stillDay(flat))
    expect(a.mean).toBeNull()
  })

  it('draws the same day from the same seed', () => {
    expect(recordDayAir(flat, 7)).toEqual(recordDayAir(flat, 7))
    expect(recordDayAir(flat, 7)).not.toEqual(recordDayAir(flat, 8))
  })
})
