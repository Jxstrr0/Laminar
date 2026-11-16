import { describe, expect, it } from 'vitest'
import { RECORD_RANGE, STOCK_RECORD, type RecordDesign } from '../src/data/record'
import { SALT_FLATS } from '../src/data/saltFlats'
import { TCF_TIME_TRIAL } from '../src/data/rules'
import { STOCK_CAR } from '../src/data/car'
import { designComfort, designPose, designReadouts, designShape, isCar, isRecord, sportOf } from '../src/sim/design'
import { changedControls } from '../src/sim/designDiff'
import { recordDeskEstimate } from '../src/sim/desk'
import { designEllipsoids } from '../src/sim/flow/ellipsoids'
import { describeShape } from '../src/sim/geom/body'
import { canopyAt, recordShape, recordX } from '../src/sim/geom/record'
import { recordLength, stillDay, twoWay } from '../src/sim/record'
import { partChanges, postureChanged, swapParts } from '../src/sim/remodel'
import { soundDesign } from '../src/persist/save'

const flat = SALT_FLATS.sukhoye
const STOCK = STOCK_RECORD.streamliner
// Drooped a little more than the sim's own test car, so the desk's guess at the lift never stops it.
const GOOD: RecordDesign = { ...STOCK, nose: { length: 2.7, droop: 4 }, canopy: 0.25, fin: 1, fairings: 1 }

describe('the streamliner as a design', () => {
  it('is its own sport, with its shell as its shape', () => {
    expect(sportOf(STOCK)).toBe('record')
    expect(isRecord(STOCK)).toBe(true)
    expect(isCar(STOCK)).toBe(false)
    expect(isRecord(STOCK_CAR.open)).toBe(false)
    expect(designShape(STOCK)).toEqual(recordShape(STOCK))
  })

  it('has nobody to tire and no cycling rules', () => {
    expect(designComfort(STOCK).holdable).toBe(true)
    expect(designReadouts(STOCK, TCF_TIME_TRIAL).breaks).toEqual([])
  })

  it('is drawn centred on its middle, nose forward, longer with a longer nose', () => {
    expect(recordX(STOCK, 0)).toBeCloseTo(recordLength(STOCK) / 2, 9)
    expect(recordX(STOCK, recordLength(STOCK))).toBeCloseTo(-recordLength(STOCK) / 2, 9)
    expect(recordLength(GOOD)).toBeGreaterThan(recordLength(STOCK))
  })

  it('has a slim frontal area that a taller canopy adds to, and a canopy only over the driver', () => {
    const area = (d: RecordDesign) => describeShape(recordShape(d)).frontalArea
    expect(area(STOCK)).toBeGreaterThan(0.5)
    expect(area(STOCK)).toBeLessThan(1.5)
    expect(area({ ...STOCK, canopy: 0.45 })).toBeGreaterThan(area({ ...STOCK, canopy: 0.15 }))
    expect(canopyAt(STOCK, 0.5)).toBe(0)
    expect(canopyAt(STOCK, recordLength(STOCK) - 0.5)).toBe(0)
  })

  it('shows the flow round the whole car', () => {
    expect(designEllipsoids(STOCK, designPose(STOCK)).length).toBeGreaterThan(0)
  })
})

describe('the desk on a streamliner', () => {
  it('guesses the record speed within its bars most of the time, the same guess for the same car and job', () => {
    const real = twoWay(GOOD, flat, stillDay(flat)).mean!
    let inside = 0
    for (let seed = 1; seed <= 30; seed++) {
      const d = recordDeskEstimate(GOOD, STOCK, flat, seed, 'k')
      expect(d.low!).toBeLessThan(d.value!)
      expect(d.high!).toBeGreaterThan(d.value!)
      if (real >= d.low! && real <= d.high!) inside++
    }
    expect(inside).toBeGreaterThan(20)
    expect(recordDeskEstimate(GOOD, STOCK, flat, 7, 'k')).toEqual(recordDeskEstimate(GOOD, STOCK, flat, 7, 'k'))
  })

  it('knows the team’s car, keeps most of the nose’s weight on a sound design, and is less unsure with a better analyst', () => {
    const d = recordDeskEstimate(GOOD, STOCK, flat, 1, 'k')
    expect(d.old).toBeCloseTo(twoWay(STOCK, flat, stillDay(flat)).mean!, 9)
    expect(d.value!).toBeGreaterThan(d.old!)
    expect(d.noseKept).toBeGreaterThan(0.5)
    expect(d.noseKept).toBeLessThan(1)
    const sharp = recordDeskEstimate(GOOD, STOCK, flat, 1, 'k', 3)
    expect(sharp.high! - sharp.low!).toBeLessThan(d.high! - d.low!)
  })

  it('sees a nose with no droop go light', () => {
    const d = recordDeskEstimate({ ...GOOD, nose: { length: 2.7, droop: 0 } }, STOCK, flat, 1, 'k')
    expect(d.value).toBeNull()
    expect(d.abort?.cause).toBe('lift')
  })
})

describe('the streamliner in saves, run reports and the model shop', () => {
  it('round-trips through a save, keeps inside its ranges, and turns away a car it couldn’t have written', () => {
    for (const d of [STOCK, GOOD]) expect(soundDesign(structuredClone(d))).toEqual(d)
    expect(soundDesign({ ...GOOD, class: 'rocket' })).toBeNull()
    expect(soundDesign({ ...GOOD, nose: { length: 'long', droop: 2 } })).toBeNull()
    const wild = soundDesign({ ...GOOD, nose: { length: 9, droop: -9 }, fin: 5, fairings: -1 }) as RecordDesign
    expect(wild.nose.length).toBe(RECORD_RANGE.streamliner.length.max)
    expect(wild.nose.droop).toBe(RECORD_RANGE.streamliner.droop.min)
    expect(wild.fin).toBe(RECORD_RANGE.streamliner.fin.max)
    expect(wild.fairings).toBe(RECORD_RANGE.streamliner.fairings.min)
  })

  it('names the changed settings', () => {
    expect(changedControls(STOCK, { ...STOCK, fin: 0.8, fairings: 1 })).toEqual(['fin', 'fairings'])
    expect(changedControls(STOCK, { ...STOCK, nose: { length: 1.5, droop: 3 } })).toEqual(['noseDroop'])
  })

  it('is one model: any change is a new one, and nothing swaps', () => {
    expect(partChanges(STOCK, GOOD)).toEqual([])
    expect(postureChanged(STOCK, GOOD)).toBe(true)
    expect(postureChanged(STOCK, structuredClone(STOCK))).toBe(false)
    expect(swapParts(STOCK, GOOD)).toEqual(STOCK)
  })
})
