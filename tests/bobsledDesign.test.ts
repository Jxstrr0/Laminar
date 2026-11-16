import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { DEFAULT_JUMPER } from '../src/data/jumper'
import { BOB_SKELETON } from '../src/data/pose'
import { DEFAULT_BOBSLED, SLED, type BobsledDesign } from '../src/data/bobsled'
import { TRACKS } from '../src/data/tracks'
import { TCF_TIME_TRIAL } from '../src/data/rules'
import { designComfort, designEvent, designPose, designReadouts, designShape, isBobsled, isCyclist, isJumper, sportOf } from '../src/sim/design'
import { sledShape } from '../src/sim/geom/bobsled'
import { bobsledPose } from '../src/sim/geom/bobsledPose'
import { bobsledReadouts, helmetTop, referenceRun } from '../src/sim/bobsled'
import { bobDeskEstimate } from '../src/sim/desk'
import { soundDesign } from '../src/persist/save'
import { changedControls } from '../src/sim/designDiff'
import { partChanges, postureChanged, swapParts } from '../src/sim/remodel'
import { designEllipsoids } from '../src/sim/flow/ellipsoids'
import { REFERENCE_TT } from '../src/sim/views'

const track = TRACKS.belogor
const sled = (patch: Partial<BobsledDesign['sled']> = {}, tuck = DEFAULT_BOBSLED.tuck, crew: 2 | 4 = 2): BobsledDesign => ({
  sport: 'bobsled',
  crew,
  sled: { ...DEFAULT_BOBSLED.sled, ...patch },
  tuck,
})

describe('the bobsled as a design', () => {
  it('is its own sport, with the sled’s hull as its shape', () => {
    expect(sportOf(DEFAULT_BOBSLED)).toBe('bobsled')
    expect(isBobsled(DEFAULT_BOBSLED)).toBe(true)
    expect(isCyclist(DEFAULT_BOBSLED)).toBe(false)
    expect(isJumper(DEFAULT_BOBSLED)).toBe(false)
    expect(designShape(DEFAULT_BOBSLED)).toEqual(sledShape(DEFAULT_BOBSLED))
  })

  it('has nothing to hold and no pedals to push, and no cycling rules', () => {
    expect(designComfort(DEFAULT_BOBSLED).holdable).toBe(true)
    expect(designEvent(DEFAULT_BOBSLED, REFERENCE_TT)).toBe(REFERENCE_TT)
    const r = designReadouts(DEFAULT_BOBSLED, TCF_TIME_TRIAL)
    expect(r.breaks).toEqual([])
    expect(r.mass).toBe(SLED.mass[2])
    expect(r.frontalArea).toBeCloseTo(bobsledReadouts(DEFAULT_BOBSLED).frontalArea, 12)
  })

  it('shows less of the crew in a deeper tuck', () => {
    expect(bobsledReadouts(sled({}, 0)).frontalArea).toBeGreaterThan(bobsledReadouts(sled({}, 1)).frontalArea)
  })
})

describe('the crew in the cockpit', () => {
  it('puts the helmet’s top where the sim puts it, lower in a deeper tuck', () => {
    for (const tuck of [0, 0.5, 1]) {
      const d = sled({}, tuck)
      const pose = bobsledPose(d)
      expect(pose.head.y + BOB_SKELETON.helmetRadius).toBeCloseTo(helmetTop(d), 9)
    }
    expect(bobsledPose(sled({}, 1)).head.y).toBeLessThan(bobsledPose(sled({}, 0)).head.y)
    expect(designPose(DEFAULT_BOBSLED)).toEqual(bobsledPose(DEFAULT_BOBSLED))
  })

  it('seats every crew member, one behind the other inside the sled', () => {
    expect(bobsledPose(sled()).seats).toHaveLength(2)
    const four = bobsledPose(sled({}, 0.6, 4))
    expect(four.seats).toHaveLength(4)
    for (let i = 1; i < 4; i++) expect(four.seats[i]!).toBeLessThan(four.seats[i - 1]!)
    // The last one's hips stay ahead of the tail's end.
    const back = four.hip[0].x + four.seats[3]!
    expect(back).toBeGreaterThan(-SLED.body[4] / 2 - DEFAULT_BOBSLED.sled.tail)
    // Feet stay on the floor, knees under the cowling.
    const pose = bobsledPose(sled())
    expect(pose.knee[0].y).toBeLessThan(DEFAULT_BOBSLED.sled.cowl)
  })

  it('draws the hull and one helmet per crew member for the flow', () => {
    const e = designEllipsoids(DEFAULT_BOBSLED, designPose(DEFAULT_BOBSLED))
    expect(e.map((x) => x.id)).toEqual(['hull', 'helmet-1', 'helmet-2'])
    const four = sled({}, 0.6, 4)
    expect(designEllipsoids(four, designPose(four))).toHaveLength(5)
  })
})

describe('the desk on a sled', () => {
  it('guesses the run within its bars, and gives the same guess for the same sled and job', () => {
    const real = referenceRun(DEFAULT_BOBSLED, track).time
    let inside = 0
    for (let seed = 1; seed <= 40; seed++) {
      const d = bobDeskEstimate(DEFAULT_BOBSLED, track, seed, 'k')
      expect(d.low).toBeLessThan(d.value)
      expect(d.high).toBeGreaterThan(d.value)
      if (real >= d.low && real <= d.high) inside++
    }
    // ±1.5 standard deviations holds the truth about 87 % of the time.
    expect(inside).toBeGreaterThan(28)
    expect(bobDeskEstimate(DEFAULT_BOBSLED, track, 7, 'k')).toEqual(bobDeskEstimate(DEFAULT_BOBSLED, track, 7, 'k'))
  })

  it('splits its guess into parts that add up to it', () => {
    const d = bobDeskEstimate(DEFAULT_BOBSLED, track, 3, 'k')
    expect(d.drag.hull + d.drag.nose + d.drag.runners + d.drag.crew).toBeCloseTo(d.cdA, 12)
    expect(d.drag.cdA).toBe(d.cdA)
  })

  it('is uncertain by tenths of a second: more than a client’s hundredths', () => {
    const d = bobDeskEstimate(DEFAULT_BOBSLED, track, 1, 'k')
    expect((d.high - d.low) / 2).toBeGreaterThan(0.15)
    expect(bobDeskEstimate(DEFAULT_BOBSLED, track, 1, 'k', 3).high - bobDeskEstimate(DEFAULT_BOBSLED, track, 1, 'k', 3).low).toBeLessThan(d.high - d.low)
  })
})

describe('the sled in saves, run reports and the model shop', () => {
  it('round-trips through a save and turns away a sled it couldn’t have written', () => {
    expect(soundDesign(structuredClone(DEFAULT_BOBSLED))).toEqual(DEFAULT_BOBSLED)
    expect(soundDesign({ ...DEFAULT_BOBSLED, crew: 3 })).toBeNull()
    expect(soundDesign({ ...DEFAULT_BOBSLED, sled: { nose: 0.6, tail: 'long', cowl: 0.5 } })).toBeNull()
    // Out-of-range numbers come back inside the sliders.
    const wild = soundDesign({ ...DEFAULT_BOBSLED, sled: { nose: 5, tail: 0.4, cowl: 0.1 }, tuck: 2 }) as BobsledDesign
    expect(wild.sled.nose).toBe(0.9)
    expect(wild.sled.cowl).toBe(0.4)
    expect(wild.tuck).toBe(1)
  })

  it('names the sled controls that changed', () => {
    expect(changedControls(DEFAULT_BOBSLED, sled({ nose: 0.7, cowl: 0.5 }))).toEqual(['sledNose', 'cowl'])
    expect(changedControls(DEFAULT_BOBSLED, sled({}, 0.9))).toEqual(['tuck'])
    expect(changedControls(DEFAULT_BOBSLED, DEFAULT_CYCLIST)).toContain('sledNose')
  })

  it('needs a new model for any change: the shell and its crew are one moulding', () => {
    expect(partChanges(DEFAULT_BOBSLED, sled({ cowl: 0.5 }))).toEqual([])
    expect(postureChanged(DEFAULT_BOBSLED, sled({ cowl: 0.5 }))).toBe(true)
    expect(postureChanged(DEFAULT_BOBSLED, sled({}, 0.8))).toBe(true)
    expect(postureChanged(DEFAULT_BOBSLED, sled({}, 0.6, 4))).toBe(true)
    expect(postureChanged(DEFAULT_BOBSLED, structuredClone(DEFAULT_BOBSLED))).toBe(false)
    expect(postureChanged(DEFAULT_BOBSLED, DEFAULT_JUMPER)).toBe(true)
    expect(swapParts(DEFAULT_BOBSLED, sled({ cowl: 0.5 }))).toEqual(DEFAULT_BOBSLED)
  })
})
