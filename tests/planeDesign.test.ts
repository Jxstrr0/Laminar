import { describe, expect, it } from 'vitest'
import { PLANE_CLASS, PLANE_RANGE, STOCK_PLANE, SURVEY_SITES, type PlaneDesign } from '../src/data/plane'
import { STOCK_DRONE } from '../src/data/drone'
import { TCF_TIME_TRIAL } from '../src/data/rules'
import { designComfort, designPose, designReadouts, designShape, isDrone, isPlane, sportOf } from '../src/sim/design'
import { changedControls } from '../src/sim/designDiff'
import { planeDeskEstimate } from '../src/sim/desk'
import { planeMass, planeRange } from '../src/sim/plane'
import { designEllipsoids } from '../src/sim/flow/ellipsoids'
import { describeShape } from '../src/sim/geom/body'
import { fuselageFullness, planeLength, planeShape, podPlace, tailEnd } from '../src/sim/geom/plane'
import { partChanges, postureChanged, swapParts } from '../src/sim/remodel'
import { soundDesign } from '../src/persist/save'

const site = SURVEY_SITES.ozimka
const STOCK = STOCK_PLANE.survey
/** The sorted survey drone from the sim's own tests. */
const GOOD: PlaneDesign = { ...STOCK, fuselage: { nose: 0.3, taper: 0.9 }, camera: { drop: 0.35, fairing: 1, at: 0.5 }, winglets: 0.12, tail: 0.95 }

describe('the survey drone as a design', () => {
  it('is its own sport, with its fuselage and camera pod as its shape', () => {
    expect(sportOf(STOCK)).toBe('plane')
    expect(isPlane(STOCK)).toBe(true)
    expect(isDrone(STOCK)).toBe(false)
    expect(isPlane(STOCK_DRONE.racer)).toBe(false)
    expect(designShape(STOCK)).toEqual(planeShape(STOCK))
  })

  it('has nobody to tire and no cycling rules, and weighs what the sim says', () => {
    expect(designComfort(STOCK).holdable).toBe(true)
    const r = designReadouts(GOOD, TCF_TIME_TRIAL)
    expect(r.breaks).toEqual([])
    expect(r.mass).toBe(planeMass(GOOD))
  })

  it('has a slim fuselage whose nose and tail cone follow the sliders', () => {
    const area = describeShape(planeShape(STOCK)).frontalArea
    expect(area).toBeGreaterThan(0.008)
    expect(area).toBeLessThan(0.03)
    expect(planeLength(GOOD) - planeLength(STOCK)).toBeCloseTo(0.1, 9)
    // A finer taper ends the tail cone smaller.
    expect(tailEnd({ ...STOCK, fuselage: { ...STOCK.fuselage, taper: 1 } })).toBeLessThan(tailEnd(STOCK))
    expect(fuselageFullness(STOCK, planeLength(STOCK))).toBeCloseTo(tailEnd(STOCK), 9)
  })

  it('hangs the camera lower the more it drops, and slides it forward', () => {
    const flush = podPlace({ ...STOCK, camera: { ...STOCK.camera, drop: 0 } })
    const down = podPlace({ ...STOCK, camera: { ...STOCK.camera, drop: 1 } })
    expect(down.bottom).toBeLessThan(flush.bottom)
    // Flush, most of the pod is up inside the belly.
    expect(flush.top).toBeGreaterThan(-0.065)
    const fwd = podPlace({ ...STOCK, camera: { ...STOCK.camera, at: 1 } })
    expect(fwd.x).toBeLessThan(podPlace(STOCK).x)
    expect(podPlace({ ...STOCK, camera: { ...STOCK.camera, fairing: 1 } }).length).toBeGreaterThan(podPlace(STOCK).length)
  })

  it('shows the flow round the fuselage, the wing and the pod', () => {
    expect(designEllipsoids(STOCK, designPose(STOCK)).length).toBe(3)
  })
})

describe('the desk on a survey drone', () => {
  it('guesses the range within its bars most of the time, the same guess for the same plane and job', () => {
    const real = planeRange(GOOD, site)
    let inside = 0
    for (let seed = 1; seed <= 30; seed++) {
      const d = planeDeskEstimate(GOOD, STOCK, site, seed, 'k')
      expect(d.low).toBeLessThan(d.value)
      expect(d.high).toBeGreaterThan(d.value)
      if (real >= d.low && real <= d.high) inside++
    }
    expect(inside).toBeGreaterThan(20)
    expect(planeDeskEstimate(GOOD, STOCK, site, 7, 'k')).toEqual(planeDeskEstimate(GOOD, STOCK, site, 7, 'k'))
  })

  it('knows the client’s plane, sees the sorted one fly further and ride out the usual gust, and is less unsure with a better analyst', () => {
    const d = planeDeskEstimate(GOOD, STOCK, site, 1, 'k')
    expect(d.old).toBeCloseTo(planeRange(STOCK, site), 9)
    expect(d.value).toBeGreaterThan(d.old)
    expect(d.stalls).toBe(false)
    expect(d.gustLimit).toBeGreaterThan(site.gust)
    expect(d.cameraHigh).toBe(false)
    const sharp = planeDeskEstimate(GOOD, STOCK, site, 1, 'k', 3)
    expect(sharp.high - sharp.low).toBeLessThan(d.high - d.low)
  })

  it('sees a small tail with a long nose stall in the usual gust, and a camera tucked past the client’s rule', () => {
    const loose = planeDeskEstimate({ ...GOOD, fuselage: { ...GOOD.fuselage, nose: 0.45 }, tail: 0.8 }, STOCK, site, 1, 'k')
    expect(loose.stalls).toBe(true)
    expect(loose.gustLimit).toBeLessThan(site.gust)
    expect(loose.margin).toBeLessThan(0.1)
    const high = planeDeskEstimate({ ...GOOD, camera: { ...GOOD.camera, drop: 0 } }, STOCK, site, 1, 'k')
    expect(high.cameraHigh).toBe(true)
    // The client lowers it to their rule, so tucking it past that gains nothing.
    expect(high.value).toBeCloseTo(planeDeskEstimate(GOOD, STOCK, site, 1, 'k').value, 1)
    expect(PLANE_CLASS.survey.cameraMinDrop).toBe(GOOD.camera.drop)
  })
})

describe('the survey drone in saves, run reports and the model shop', () => {
  it('round-trips through a save, keeps inside its ranges, and turns away a plane it couldn’t have written', () => {
    for (const d of [STOCK, GOOD]) expect(soundDesign(structuredClone(d))).toEqual(d)
    expect(soundDesign({ ...GOOD, class: 'airliner' })).toBeNull()
    expect(soundDesign({ ...GOOD, camera: { drop: 'low', fairing: 1, at: 0 } })).toBeNull()
    const wild = soundDesign({ ...GOOD, fuselage: { nose: 9, taper: -1 }, camera: { drop: 3, fairing: -2, at: 5 }, winglets: 1, tail: 0 }) as PlaneDesign
    const R = PLANE_RANGE.survey
    expect(wild.fuselage).toEqual({ nose: R.nose.max, taper: R.taper.min })
    expect(wild.camera).toEqual({ drop: R.drop.max, fairing: R.fairing.min, at: R.at.max })
    expect(wild.winglets).toBe(R.winglets.max)
    expect(wild.tail).toBe(R.tail.min)
  })

  it('names the changed settings', () => {
    expect(changedControls(STOCK, GOOD)).toEqual(['planeNose', 'tailCone', 'tailSize', 'cameraDrop', 'cameraFairing', 'cameraAt', 'winglets'])
    expect(changedControls(STOCK, { ...STOCK, tail: 1.2 })).toEqual(['tailSize'])
  })

  it('is one model: any change is a new one, and nothing swaps', () => {
    expect(partChanges(STOCK, GOOD)).toEqual([])
    expect(postureChanged(STOCK, GOOD)).toBe(true)
    expect(postureChanged(STOCK, structuredClone(STOCK))).toBe(false)
    expect(swapParts(STOCK, GOOD)).toEqual(STOCK)
  })
})
