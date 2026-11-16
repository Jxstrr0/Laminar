import { describe, expect, it } from 'vitest'
import { DRONE_CLASS, DRONE_COURSES, DRONE_RANGE, STOCK_DRONE, type DroneDesign } from '../src/data/drone'
import { STOCK_RECORD } from '../src/data/record'
import { TCF_TIME_TRIAL } from '../src/data/rules'
import { designComfort, designPose, designReadouts, designShape, isDrone, isRecord, sportOf } from '../src/sim/design'
import { changedControls } from '../src/sim/designDiff'
import { droneDeskEstimate } from '../src/sim/desk'
import { droneMass, droneRace } from '../src/sim/drone'
import { designEllipsoids } from '../src/sim/flow/ellipsoids'
import { describeShape } from '../src/sim/geom/body'
import { droneShape, podEnds } from '../src/sim/geom/drone'
import { partChanges, postureChanged, swapParts } from '../src/sim/remodel'
import { soundDesign } from '../src/persist/save'

const course = DRONE_COURSES.lugovoy
const STOCK = STOCK_DRONE.racer
/** The sorted club racer from the sim's own tests: short pod raked to the racing tilt, the vents it needs, arms faired. */
const GOOD: DroneDesign = { ...STOCK, pod: { length: 0.12, rake: 70, vents: DRONE_CLASS.racer.coolNeed }, arms: 1 }

describe('the racing quad as a design', () => {
  it('is its own sport, with its pod and frame as its shape', () => {
    expect(sportOf(STOCK)).toBe('drone')
    expect(isDrone(STOCK)).toBe(true)
    expect(isRecord(STOCK)).toBe(false)
    expect(isDrone(STOCK_RECORD.jet)).toBe(false)
    expect(designShape(STOCK)).toEqual(droneShape(STOCK))
  })

  it('has nobody to tire and no cycling rules, and weighs what the sim says', () => {
    expect(designComfort(STOCK).holdable).toBe(true)
    const r = designReadouts(GOOD, TCF_TIME_TRIAL)
    expect(r.breaks).toEqual([])
    expect(r.mass).toBe(droneMass(GOOD))
  })

  it('has a small frontal area, and a pod raked up on the frame', () => {
    const area = describeShape(droneShape(STOCK)).frontalArea
    expect(area).toBeGreaterThan(0.003)
    expect(area).toBeLessThan(0.02)
    const flat = podEnds({ ...STOCK, pod: { ...STOCK.pod, rake: 0 } })
    const up = podEnds({ ...STOCK, pod: { ...STOCK.pod, rake: 60 } })
    expect(flat.nose.y).toBeCloseTo(flat.back.y, 9)
    expect(up.nose.y).toBeGreaterThan(up.back.y)
    expect(up.nose.x - up.back.x).toBeCloseTo(STOCK.pod.length / 2, 3)
  })

  it('shows the flow round the pod and the frame', () => {
    expect(designEllipsoids(STOCK, designPose(STOCK)).length).toBe(2)
  })
})

describe('the desk on a racing quad', () => {
  it('guesses the race time within its bars most of the time, the same guess for the same quad and job', () => {
    const real = droneRace(GOOD, course).time!
    let inside = 0
    for (let seed = 1; seed <= 30; seed++) {
      const d = droneDeskEstimate(GOOD, STOCK, course, seed, 'k')
      expect(d.low!).toBeLessThan(d.value!)
      expect(d.high!).toBeGreaterThan(d.value!)
      if (real >= d.low! && real <= d.high!) inside++
    }
    expect(inside).toBeGreaterThan(20)
    expect(droneDeskEstimate(GOOD, STOCK, course, 7, 'k')).toEqual(droneDeskEstimate(GOOD, STOCK, course, 7, 'k'))
  })

  it('knows the club’s quad, sees the sorted one faster with its pod near head-on, and is less unsure with a better analyst', () => {
    const d = droneDeskEstimate(GOOD, STOCK, course, 1, 'k')
    expect(d.old).toBeCloseTo(droneRace(STOCK, course).time!, 9)
    expect(d.value!).toBeLessThan(d.old!)
    expect(Math.abs(d.podAngle)).toBeLessThan(10)
    expect(d.twist.share).toBeLessThan(1)
    expect(d.hotAt).toBeNull()
    const sharp = droneDeskEstimate(GOOD, STOCK, course, 1, 'k', 3)
    expect(sharp.high! - sharp.low!).toBeLessThan(d.high! - d.low!)
  })

  it('sees a long pod raked hard tumble on the brakes, and shut vents overheat', () => {
    const twisty = droneDeskEstimate({ ...GOOD, pod: { ...GOOD.pod, length: 0.2 } }, STOCK, course, 1, 'k')
    expect(twisty.value).toBeNull()
    expect(twisty.tumble).not.toBeNull()
    expect(twisty.twist.braking).toBe(true)
    expect(twisty.twist.share).toBeGreaterThan(1)
    const hot = droneDeskEstimate({ ...GOOD, pod: { ...GOOD.pod, vents: 0 } }, STOCK, course, 1, 'k')
    expect(hot.hotAt).toBe(DRONE_CLASS.racer.heatAfter)
    expect(hot.heat).toBeGreaterThan(0)
  })
})

describe('the racing quad in saves, run reports and the model shop', () => {
  it('round-trips through a save, keeps inside its ranges, and turns away a quad it couldn’t have written', () => {
    for (const d of [STOCK, GOOD]) expect(soundDesign(structuredClone(d))).toEqual(d)
    expect(soundDesign({ ...GOOD, class: 'heavy-lift' })).toBeNull()
    expect(soundDesign({ ...GOOD, pod: { length: 'long', rake: 2, vents: 1 } })).toBeNull()
    const wild = soundDesign({ ...GOOD, pod: { length: 9, rake: -9, vents: 3 }, arms: -1 }) as DroneDesign
    expect(wild.pod.length).toBe(DRONE_RANGE.racer.length.max)
    expect(wild.pod.rake).toBe(DRONE_RANGE.racer.rake.min)
    expect(wild.pod.vents).toBe(DRONE_RANGE.racer.vents.max)
    expect(wild.arms).toBe(DRONE_RANGE.racer.arms.min)
  })

  it('names the changed settings', () => {
    expect(changedControls(STOCK, GOOD)).toEqual(['podRake', 'podVents', 'armFairings'])
    expect(changedControls(STOCK, { ...STOCK, pod: { ...STOCK.pod, length: 0.16 } })).toEqual(['podLength'])
  })

  it('is one model: any change is a new one, and nothing swaps', () => {
    expect(partChanges(STOCK, GOOD)).toEqual([])
    expect(postureChanged(STOCK, GOOD)).toBe(true)
    expect(postureChanged(STOCK, structuredClone(STOCK))).toBe(false)
    expect(swapParts(STOCK, GOOD)).toEqual(STOCK)
  })
})
