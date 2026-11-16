import { describe, expect, it } from 'vitest'
import { OLD_POD, POD_BODY, STOCK_POD, TEST_RANGES, type PodDesign } from '../src/data/pod'
import { STOCK_AIRCRAFT } from '../src/data/aircraft'
import { TCF_TIME_TRIAL } from '../src/data/rules'
import { designComfort, designPose, designReadouts, designShape, isAircraft, isPod, sportOf } from '../src/sim/design'
import { changedControls } from '../src/sim/designDiff'
import { podDeskEstimate } from '../src/sim/desk'
import { designEllipsoids } from '../src/sim/flow/ellipsoids'
import { describeShape } from '../src/sim/geom/body'
import { podMiddleX, podRadius, podShape, podX, wingBelow } from '../src/sim/geom/pod'
import { hoursOnStation, podLengths, podMass, sensorDiameter } from '../src/sim/pod'
import { partChanges, postureChanged, swapParts } from '../src/sim/remodel'
import { soundDesign } from '../src/persist/save'

const STOCK = STOCK_POD.patrol
const GOOD: PodDesign = { ...STOCK, nose: 0.85, tail: 0.95, gap: 0.46, at: 0.3 }
const range = TEST_RANGES.stepnoy

describe('the sensor pod as a design (PR 10z)', () => {
  it('is its own sport, with the pod as its shape', () => {
    expect(sportOf(STOCK)).toBe('pod')
    expect(isPod(STOCK)).toBe(true)
    expect(isAircraft(STOCK)).toBe(false)
    expect(isPod(STOCK_AIRCRAFT.kit)).toBe(false)
    expect(designShape(STOCK)).toEqual(podShape(STOCK))
    expect(designComfort(STOCK).holdable).toBe(true)
    const r = designReadouts(GOOD, TCF_TIME_TRIAL)
    expect(r.breaks).toEqual([])
    expect(r.mass).toBe(podMass(GOOD))
  })

  it('has the sensor’s circle for a front, a nose that sharpens and a tail that tapers to its base', () => {
    const d = sensorDiameter(STOCK)
    expect(describeShape(podShape(STOCK)).frontalArea).toBeCloseTo((Math.PI * d * d) / 4, 2)
    const l = podLengths(GOOD)
    expect(podRadius(GOOD, l.nose + l.middle / 2)).toBeCloseTo(d / 2, 9)
    // A dome's tip is blunter than a fine point's, a cut-off base wider than a fine one's.
    expect(podRadius(STOCK, 0)).toBeGreaterThan(podRadius(GOOD, 0) * 3)
    expect(podRadius(STOCK, podLengths(STOCK).total)).toBeGreaterThan(podRadius(GOOD, l.total) * 5)
    // The radius never grows past the sensor's, along the whole pod.
    for (let i = 0; i <= 50; i++) expect(podRadius(GOOD, (l.total * i) / 50)).toBeLessThanOrEqual(d / 2 + 1e-9)
  })

  it('hangs its middle forward of the wing’s thickest part by the stagger, the wing the gap above its top', () => {
    expect(podMiddleX(STOCK)).toBe(0)
    expect(podMiddleX(GOOD)).toBeCloseTo(0.3 * POD_BODY.slide, 9)
    expect(podX(GOOD, podLengths(GOOD).total / 2)).toBeCloseTo(podMiddleX(GOOD), 9)
    expect(wingBelow(GOOD)).toBeCloseTo(sensorDiameter(GOOD) / 2 + 0.46, 9)
    const e = designEllipsoids(GOOD, designPose(GOOD))
    expect(e.map((x) => x.id)).toEqual(['pod', 'wing'])
    expect(e[1]!.centre.y).toBeGreaterThan(e[0]!.centre.y + wingBelow(GOOD))
  })

  it('is one piece in the model shop; its four controls show as changes', () => {
    expect(partChanges(GOOD, STOCK)).toEqual([])
    expect(postureChanged(GOOD, STOCK)).toBe(true)
    expect(postureChanged(GOOD, structuredClone(GOOD))).toBe(false)
    expect(swapParts(GOOD, STOCK)).toEqual(GOOD)
    expect(changedControls(STOCK, GOOD)).toEqual(['senNose', 'senTail', 'senGap', 'senAt'])
  })

  it('saves and loads, clamping a slider past its range; a broken one is refused', () => {
    expect(soundDesign(JSON.parse(JSON.stringify(GOOD)))).toEqual(GOOD)
    expect(soundDesign({ ...GOOD, gap: 5 })).toMatchObject({ gap: 0.6 })
    expect(soundDesign({ ...GOOD, class: 'bomber' })).toBeNull()
    expect(soundDesign({ ...GOOD, tail: 'long' })).toBeNull()
  })
})

describe('the desk’s guess at a pod', () => {
  it('reads hours on station near the truth, against the old pod as the ministry flies it', () => {
    const desk = podDeskEstimate(GOOD, OLD_POD.patrol, range, 7, 'good')
    const truth = hoursOnStation(GOOD)
    expect(Math.abs(desk.value - truth)).toBeLessThan(0.15)
    expect(desk.low).toBeLessThan(desk.value)
    expect(desk.high).toBeGreaterThan(desk.value)
    expect(desk.old).toBeCloseTo(hoursOnStation(OLD_POD.patrol, { sensor: 'old' }), 9)
    expect(desk.buffet.blurs).toBe(false)
    expect(podDeskEstimate(STOCK, OLD_POD.patrol, range, 7, 'stock').buffet).toMatchObject({ blurs: true, cause: 'tail' })
    // The same job and design always give the same guess.
    expect(podDeskEstimate(GOOD, OLD_POD.patrol, range, 7, 'good')).toEqual(desk)
  })
})
