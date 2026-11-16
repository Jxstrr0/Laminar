import { describe, expect, it } from 'vitest'
import { CAR_RANGE, STOCK_CAR, type CarDesign } from '../src/data/car'
import { CIRCUITS } from '../src/data/circuits'
import { TCF_TIME_TRIAL } from '../src/data/rules'
import { DEFAULT_TRUCK } from '../src/data/truck'
import { lapGain } from '../src/sim/car'
import { designComfort, designPose, designReadouts, designShape, isCar, isTruck, sportOf } from '../src/sim/design'
import { changedControls } from '../src/sim/designDiff'
import { carDeskEstimate } from '../src/sim/desk'
import { designEllipsoids } from '../src/sim/flow/ellipsoids'
import { carLength, carShape, carX, floorAt } from '../src/sim/geom/car'
import { partChanges, postureChanged, swapParts } from '../src/sim/remodel'
import { soundDesign } from '../src/persist/save'

const dolgo = CIRCUITS['dolgo-ring']
/** A well-set touring car (from the sim's own tests): about a second a lap on the Dolgo Ring. */
const GOOD: CarDesign = { sport: 'car', class: 'touring', ride: { front: 0.065, rear: 0.095 }, frontWing: 14, rearWing: { angle: 21, chord: 0.28 }, diffuser: 15, floorEdge: 0.9, inlet: 0.85 }

describe('the racing car as a design', () => {
  it('is its own sport, with its shell as its shape', () => {
    for (const car of [STOCK_CAR.touring, STOCK_CAR.open]) {
      expect(sportOf(car)).toBe('car')
      expect(isCar(car)).toBe(true)
      expect(isTruck(car)).toBe(false)
      expect(designShape(car)).toEqual(carShape(car))
    }
    expect(isCar(DEFAULT_TRUCK)).toBe(false)
  })

  it('has nobody to tire and no cycling rules: the federation’s rules are the sheet’s own', () => {
    expect(designComfort(STOCK_CAR.open).holdable).toBe(true)
    expect(designReadouts({ ...STOCK_CAR.touring, ride: { front: 0.04, rear: 0.04 } }, TCF_TIME_TRIAL).breaks).toEqual([])
  })

  it('is drawn centred on its middle, nose forward, with its floor raked as set', () => {
    const car = STOCK_CAR.open
    expect(carX(car, 0)).toBeCloseTo(carLength(car) / 2, 9)
    expect(carX(car, carLength(car))).toBeCloseTo(-carLength(car) / 2, 9)
    // The rear rides higher than the front, so the floor climbs toward the back.
    expect(floorAt(car, carLength(car) * 0.8)).toBeGreaterThan(floorAt(car, carLength(car) * 0.2))
    // The cockpit is near the middle.
    expect(Math.abs(designPose(car).head.x)).toBeLessThan(1)
  })

  it('shows the flow round the whole car', () => {
    const e = designEllipsoids(STOCK_CAR.touring, designPose(STOCK_CAR.touring))
    expect(e.length).toBeGreaterThan(0)
  })
})

describe('the desk on a racing car', () => {
  it('guesses the lap gain within its bars most of the time, the same guess for the same car and job', () => {
    const real = lapGain(GOOD, STOCK_CAR.touring, dolgo)
    expect(real).toBeGreaterThan(0.5)
    let inside = 0
    for (let seed = 1; seed <= 30; seed++) {
      const d = carDeskEstimate(GOOD, STOCK_CAR.touring, dolgo, seed, 'k')
      expect(d.low).toBeLessThan(d.value)
      expect(d.high).toBeGreaterThan(d.value)
      if (real >= d.low && real <= d.high) inside++
    }
    expect(inside).toBeGreaterThan(20)
    expect(carDeskEstimate(GOOD, STOCK_CAR.touring, dolgo, 7, 'k')).toEqual(carDeskEstimate(GOOD, STOCK_CAR.touring, dolgo, 7, 'k'))
  })

  it('is unsure by tenths, less with a better analyst, and reads the downforce and balance', () => {
    const d = carDeskEstimate(GOOD, STOCK_CAR.touring, dolgo, 1, 'k')
    const spread = (d.high - d.low) / 2
    expect(spread).toBeGreaterThan(0.05)
    expect(spread).toBeLessThan(1)
    expect(carDeskEstimate(GOOD, STOCK_CAR.touring, dolgo, 1, 'k', 3).high - carDeskEstimate(GOOD, STOCK_CAR.touring, dolgo, 1, 'k', 3).low).toBeLessThan(d.high - d.low)
    // Hundreds of kilograms of pull at 200 km/h, with the balance near the middle.
    expect(d.downKg).toBeGreaterThan(200)
    expect(d.balance).toBeGreaterThan(0.3)
    expect(d.balance).toBeLessThan(0.6)
    // The car against itself gains nothing, give or take the desk's guess.
    const same = carDeskEstimate(STOCK_CAR.touring, STOCK_CAR.touring, dolgo, 1, 'k')
    expect(same.low).toBeLessThan(0.3)
    expect(same.high).toBeGreaterThan(-0.3)
  })
})

describe('the racing car in saves, run reports and the model shop', () => {
  it('round-trips through a save, keeps each class inside its own ranges, and turns away a car it couldn’t have written', () => {
    for (const car of [STOCK_CAR.touring, STOCK_CAR.open, GOOD]) expect(soundDesign(structuredClone(car))).toEqual(car)
    expect(soundDesign({ ...GOOD, class: 'rally' })).toBeNull()
    expect(soundDesign({ ...GOOD, ride: { front: 'low', rear: 0.1 } })).toBeNull()
    const wild = soundDesign({ ...STOCK_CAR.open, ride: { front: 0.2, rear: 0 }, rearWing: { angle: 60, chord: 0.1 } }) as CarDesign
    expect(wild.ride.front).toBe(CAR_RANGE.open.front.max)
    expect(wild.ride.rear).toBe(CAR_RANGE.open.rear.min)
    expect(wild.rearWing.angle).toBe(CAR_RANGE.open.angle.max)
    expect(wild.rearWing.chord).toBe(CAR_RANGE.open.chord.min)
  })

  it('names the car’s changed settings', () => {
    expect(changedControls(STOCK_CAR.touring, { ...STOCK_CAR.touring, frontWing: 12, diffuser: 14 })).toEqual(['frontWing', 'diffuser'])
    expect(changedControls(STOCK_CAR.touring, { ...STOCK_CAR.touring, ride: { front: 0.08, rear: 0.11 } })).toEqual(['rideFront'])
  })

  it('is one model: any change is a new one, and nothing swaps', () => {
    expect(partChanges(STOCK_CAR.touring, GOOD)).toEqual([])
    expect(postureChanged(STOCK_CAR.touring, GOOD)).toBe(true)
    expect(postureChanged(STOCK_CAR.touring, structuredClone(STOCK_CAR.touring))).toBe(false)
    expect(swapParts(STOCK_CAR.touring, GOOD)).toEqual(STOCK_CAR.touring)
  })
})
