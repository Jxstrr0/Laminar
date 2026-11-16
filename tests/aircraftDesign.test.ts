import { describe, expect, it } from 'vitest'
import { AIRCRAFT_BODY, AIRCRAFT_RANGE, AIRFIELDS, STOCK_AIRCRAFT, type AircraftDesign } from '../src/data/aircraft'
import { STOCK_PLANE } from '../src/data/plane'
import { TCF_TIME_TRIAL } from '../src/data/rules'
import { aircraftMass, cruiseSpeed, KMH, stallFix } from '../src/sim/aircraft'
import { designComfort, designPose, designReadouts, designShape, isAircraft, isPlane, sportOf } from '../src/sim/design'
import { changedControls } from '../src/sim/designDiff'
import { aircraftDeskEstimate } from '../src/sim/desk'
import { designEllipsoids } from '../src/sim/flow/ellipsoids'
import { describeShape } from '../src/sim/geom/body'
import { aircraftShape, cowlFront, fuselageFullness, podFullness, podPlace } from '../src/sim/geom/aircraft'
import { partChanges, postureChanged, swapParts } from '../src/sim/remodel'
import { soundDesign } from '../src/persist/save'

const field = AIRFIELDS.belyanka
const STOCK = STOCK_AIRCRAFT.kit
/** The well-modded kit from the sim's own tests. */
const GOOD: AircraftDesign = { ...STOCK, spats: 1, cowling: 1, struts: { fairing: 1, toe: 2 }, pod: { fairing: 1, at: 0 } }

describe('the kit plane as a design', () => {
  it('is its own sport, with its fuselage and pod as its shape', () => {
    expect(sportOf(STOCK)).toBe('aircraft')
    expect(isAircraft(STOCK)).toBe(true)
    expect(isPlane(STOCK)).toBe(false)
    expect(isAircraft(STOCK_PLANE.survey)).toBe(false)
    expect(designShape(STOCK)).toEqual(aircraftShape(STOCK))
  })

  it('has nobody to tire and no cycling rules, and weighs what the sim says', () => {
    expect(designComfort(STOCK).holdable).toBe(true)
    const r = designReadouts(GOOD, TCF_TIME_TRIAL)
    expect(r.breaks).toEqual([])
    expect(r.mass).toBe(aircraftMass(GOOD))
  })

  it('has a cabin-sized front, a cowl that slims as it tightens, and a pod that fairs to a teardrop and slides', () => {
    const area = describeShape(aircraftShape(STOCK)).frontalArea
    expect(area).toBeGreaterThan(0.9)
    expect(area).toBeLessThan(1.6)
    expect(cowlFront({ ...STOCK, cowling: 1 })).toBeLessThan(cowlFront(STOCK))
    expect(fuselageFullness(STOCK, AIRCRAFT_BODY.cowl + 0.5)).toBe(1)
    // A faired pod tapers to a fine tail; the box keeps its size to the end.
    const len = AIRCRAFT_BODY.pod.length
    expect(podFullness({ ...STOCK, pod: { fairing: 1, at: 0 } }, len * 0.98)).toBeLessThan(0.3)
    expect(podFullness(STOCK, len * 0.9)).toBe(1)
    expect(podPlace({ ...STOCK, pod: { fairing: 0, at: 1 } }).x).toBeLessThan(podPlace(STOCK).x)
  })

  it('shows the flow round the fuselage, the wing and the pod', () => {
    expect(designEllipsoids(STOCK, designPose(STOCK)).length).toBe(3)
  })
})

describe('the desk on a kit plane', () => {
  it('guesses the cruise speed within its bars most of the time, the same guess for the same plane and job', () => {
    const real = cruiseSpeed(GOOD, field) * KMH
    let inside = 0
    for (let seed = 1; seed <= 30; seed++) {
      const d = aircraftDeskEstimate(GOOD, STOCK, field, seed, 'k')
      expect(d.low).toBeLessThan(d.value)
      expect(d.high).toBeGreaterThan(d.value)
      if (real >= d.low && real <= d.high) inside++
    }
    expect(inside).toBeGreaterThan(20)
    expect(aircraftDeskEstimate(GOOD, STOCK, field, 7, 'k')).toEqual(aircraftDeskEstimate(GOOD, STOCK, field, 7, 'k'))
  })

  it('knows the client’s plane, sees the modded one fly faster and pass the inspector, and is less unsure with a better analyst', () => {
    const d = aircraftDeskEstimate(GOOD, STOCK, field, 1, 'k')
    expect(d.old).toBeCloseTo(cruiseSpeed(STOCK, field) * KMH, 9)
    expect(d.value).toBeGreaterThan(d.old + 10)
    expect(d.passes).toBe(true)
    expect(d.stall).toBeLessThan(d.limit)
    const sharp = aircraftDeskEstimate(GOOD, STOCK, field, 1, 'k', 3)
    expect(sharp.high - sharp.low).toBeLessThan(d.high - d.low)
  })

  it('sees square tips or a pod well forward lift the stall past the certified speed, and names which', () => {
    const tips = { ...GOOD, wingtips: 1 }
    expect(aircraftDeskEstimate(tips, STOCK, field, 1, 'k').passes).toBe(false)
    expect(stallFix(tips)).toBe('wingtips')
    const pod = { ...GOOD, pod: { fairing: 1, at: 1 } }
    expect(aircraftDeskEstimate(pod, STOCK, field, 1, 'k').passes).toBe(false)
    expect(stallFix(pod)).toBe('acPodAt')
    expect(stallFix(STOCK)).toBe('wingtips')
  })
})

describe('the kit plane in saves, run reports and the model shop', () => {
  it('round-trips through a save, keeps inside its ranges, and turns away a plane it couldn’t have written', () => {
    for (const d of [STOCK, GOOD]) expect(soundDesign(structuredClone(d))).toEqual(d)
    expect(soundDesign({ ...GOOD, class: 'airliner' })).toBeNull()
    expect(soundDesign({ ...GOOD, struts: { fairing: 'full', toe: 0 } })).toBeNull()
    const wild = soundDesign({ ...GOOD, spats: 4, cowling: -1, wingtips: 2, struts: { fairing: 3, toe: 40 }, pod: { fairing: -1, at: -9 } }) as AircraftDesign
    const R = AIRCRAFT_RANGE.kit
    expect(wild).toMatchObject({ spats: R.spats.max, cowling: R.cowling.min, wingtips: R.wingtips.max })
    expect(wild.struts).toEqual({ fairing: R.fairing.max, toe: R.toe.max })
    expect(wild.pod).toEqual({ fairing: R.podFairing.min, at: R.podAt.min })
  })

  it('names the changed settings', () => {
    expect(changedControls(STOCK, GOOD)).toEqual(['acCowling', 'spats', 'strutFairing', 'strutToe', 'acPodFairing'])
    expect(changedControls(STOCK, { ...STOCK, wingtips: 0.5 })).toEqual(['wingtips'])
  })

  it('is one model: any change is a new one, and nothing swaps', () => {
    expect(partChanges(STOCK, GOOD)).toEqual([])
    expect(postureChanged(STOCK, GOOD)).toBe(true)
    expect(postureChanged(STOCK, structuredClone(STOCK))).toBe(false)
    expect(swapParts(STOCK, GOOD)).toEqual(STOCK)
  })
})
