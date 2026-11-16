import { describe, expect, it } from 'vitest'
import { CAR_AERO, CAR_TUNNEL, STOCK_CAR, type CarDesign } from '../src/data/car'
import { CIRCUITS } from '../src/data/circuits'
import { lapGain, lapTime } from '../src/sim/car'
import { aeroMap, carFloor, forecastLap, heightsAt, maxDrop, prepareCar, readCar, type CarFloor } from '../src/sim/carTunnel'
import { Rng } from '../src/sim/rng'
import type { ModelSpec, TunnelSpec } from '../src/sim/views'

const TOURING: CarDesign = { sport: 'car', class: 'touring', ride: { front: 0.065, rear: 0.095 }, frontWing: 14, rearWing: { angle: 21, chord: 0.28 }, diffuser: 15, floorEdge: 0.9, inlet: 0.85 }
const OPEN: CarDesign = { sport: 'car', class: 'open', ride: { front: 0.06, rear: 0.07 }, frontWing: 20, rearWing: { angle: 20, chord: 0.27 }, diffuser: 16, floorEdge: 0.95, inlet: 0.8 }
/** A single-seater set too low: its floor stalls on the straights and it porpoises. */
const LOW: CarDesign = { ...OPEN, ride: { front: 0.035, rear: 0.045 } }

const IDEAL: TunnelSpec = { turbulence: 0, balanceNoise: 0 }
const MODEL: ModelSpec = { scale: CAR_TUNNEL.scale, finish: 'sanded', accuracy: 0, seed: 1 }
const DROPS = [0, 0.01, 0.02, 0.03, 0.04]

/** Read a car at each drop over a floor and forecast its lap. */
function forecast(design: CarDesign, floor: CarFloor, circuit: keyof typeof CIRCUITS, drops = DROPS) {
  const prepared = prepareCar(design, MODEL, floor)
  const reads = drops.map((drop) => readCar(prepared, IDEAL, { speed: 40, drop }, new Rng(1)))
  return forecastLap(reads, design, STOCK_CAR[design.class], CIRCUITS[circuit])!
}

describe('a car model in the tunnel', () => {
  it('sits over a rolling road if the tunnel has one, else the shop’s board, else the still floor', () => {
    expect(carFloor(true, false)).toBe('rolling')
    expect(carFloor(true, true)).toBe('rolling')
    expect(carFloor(false, true)).toBe('board')
    expect(carFloor(false, false)).toBe('still')
  })

  it('is lowered by the mount, never under the skid plank, as far as its class allows', () => {
    expect(heightsAt(OPEN, 0.02).front).toBeCloseTo(0.04, 9)
    expect(heightsAt(OPEN, 0.02).rear).toBeCloseTo(0.05, 9)
    expect(heightsAt(OPEN, 0.2).front).toBe(CAR_AERO.plank)
    expect(maxDrop(TOURING)).toBeGreaterThan(maxDrop(OPEN))
  })

  it('reads standing wheels as draggy until a rolling road spins them', () => {
    const at = (floor: CarFloor) => readCar(prepareCar(TOURING, MODEL, floor), IDEAL, { speed: 40, drop: 0 }, new Rng(1))
    expect(at('still').cdA - at('rolling').cdA).toBeGreaterThan(CAR_TUNNEL.staticWheels * 0.9)
    // Off the rolling road the floor pulls less.
    expect(at('still').clAFront + at('still').clARear).toBeLessThan(at('board').clAFront + at('board').clARear)
    expect(at('board').clAFront + at('board').clARear).toBeLessThan(at('rolling').clAFront + at('rolling').clARear)
  })

  it('scatters reading to reading with the balance’s noise, and pools them by drop', () => {
    const p = prepareCar(TOURING, MODEL, 'rolling')
    const rng = new Rng(3)
    const reads = [0, 0, 0, 0.01].map((drop) => readCar(p, { turbulence: 0, balanceNoise: 0.01 }, { speed: 40, drop }, rng))
    expect(reads[0]!.cdA).not.toBe(reads[1]!.cdA)
    const map = aeroMap(reads)
    expect(map.map((m) => m.n)).toEqual([3, 1])
    expect(reads[0]!.downN).toBeGreaterThan(0)
  })
})

describe('the lap forecast', () => {
  it('on a rolling road matches the circuit within a few hundredths', () => {
    for (const car of [TOURING, OPEN]) {
      for (const circuit of ['dolgo-ring', 'stavren-park'] as const) {
        expect(Math.abs(forecast(car, 'rolling', circuit).gain - lapGain(car, STOCK_CAR[car.class], CIRCUITS[circuit]))).toBeLessThan(0.05)
      }
    }
  })

  it('reads short over the still floor, and the ground board takes part of that away', () => {
    for (const car of [TOURING, OPEN]) {
      const truth = lapGain(car, STOCK_CAR[car.class], CIRCUITS['dolgo-ring'])
      const still = forecast(car, 'still', 'dolgo-ring').gain
      const board = forecast(car, 'board', 'dolgo-ring').gain
      expect(still).toBeLessThan(board)
      expect(board).toBeLessThan(truth)
    }
  })

  it('sees porpoising that isn’t there over the still floor, which stalls the floor too soon', () => {
    expect(lapTime(OPEN, CIRCUITS['dolgo-ring']).porpoise).toBeNull()
    expect(forecast(OPEN, 'still', 'dolgo-ring').porpoise).not.toBeNull()
    expect(forecast(OPEN, 'board', 'dolgo-ring').porpoise).toBeNull()
    expect(forecast(OPEN, 'rolling', 'dolgo-ring').porpoise).toBeNull()
  })

  it('finds real porpoising once the readings go low enough to stall the floor', () => {
    const truth = lapTime(LOW, CIRCUITS['dolgo-ring']).porpoise
    expect(truth).not.toBeNull()
    const f = forecast(LOW, 'rolling', 'dolgo-ring')
    expect(f.porpoise).not.toBeNull()
    expect(Math.abs(f.porpoise! - truth!)).toBeLessThan(8)
    // Read only at the static height, the map can't see the stall at all.
    expect(forecast(LOW, 'rolling', 'dolgo-ring', [0]).porpoise).toBeNull()
  })

  it('asks for lower readings until the map reaches as low as the car squats', () => {
    const top = forecast(OPEN, 'rolling', 'dolgo-ring', [0])
    expect(top.covered).toBe(false)
    expect(top.need).toBeGreaterThan(top.have)
    expect(forecast(OPEN, 'rolling', 'dolgo-ring').covered).toBe(true)
    expect(forecastLap([], OPEN, STOCK_CAR.open, CIRCUITS['dolgo-ring'])).toBeNull()
  })
})
