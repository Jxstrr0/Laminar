import { describe, expect, it } from 'vitest'
import { CAR_CLASS, CAR_RULES, STOCK_CAR, type CarDesign } from '../src/data/car'
import { CIRCUITS, lapLength, segmentLength } from '../src/data/circuits'
import {
  balanceLoss,
  carAero,
  checkCarRules,
  circuitDensity,
  floorFactor,
  heatLoss,
  lapGain,
  lapTime,
  porpoiseSpeed,
  scrutineered,
} from '../src/sim/car'

const dolgo = CIRCUITS['dolgo-ring']
const park = CIRCUITS['stavren-park']
const rho = circuitDensity(dolgo)

/** Good setups a search found, rounded: well sealed, the diffuser near its stall, more wing, the balance in the window. */
const GOOD: Record<'touring' | 'open', CarDesign> = {
  touring: { sport: 'car', class: 'touring', ride: { front: 0.065, rear: 0.095 }, frontWing: 14, rearWing: { angle: 21, chord: 0.28 }, diffuser: 15, floorEdge: 0.9, inlet: 0.85 },
  open: { sport: 'car', class: 'open', ride: { front: 0.06, rear: 0.07 }, frontWing: 20, rearWing: { angle: 20, chord: 0.27 }, diffuser: 16, floorEdge: 0.95, inlet: 0.8 },
}

const with_ = (d: CarDesign, patch: Partial<CarDesign>): CarDesign => ({ ...d, ...patch })

describe('the circuits', () => {
  it('turn one full circle and are a few kilometres round', () => {
    for (const c of [dolgo, park]) {
      const turn = c.segments.reduce((sum, s) => sum + (s.kind === 'corner' ? (s.dir === 'R' ? s.angle : -s.angle) : 0), 0)
      expect(turn).toBe(360)
      expect(lapLength(c)).toBeCloseTo(c.segments.reduce((s, x) => s + segmentLength(x), 0), 9)
    }
    expect(lapLength(dolgo)).toBeGreaterThan(4000)
    expect(lapLength(park)).toBeLessThan(3000)
  })
})

describe('the car’s aero', () => {
  it('starts every client in the window, legal, cool and clear of porpoising', () => {
    for (const d of Object.values(STOCK_CAR)) {
      expect(checkCarRules(d)).toEqual([])
      const a = carAero(d, 50, rho)
      const w = CAR_CLASS[d.class].window
      expect(a.balance).toBeGreaterThan(w.low)
      expect(a.balance).toBeLessThan(w.high)
      expect(heatLoss(d)).toBe(0)
      expect(porpoiseSpeed(d, rho)).toBeNull()
    }
  })

  it('makes an open-wheel car press down much harder than a touring car', () => {
    const t = carAero(STOCK_CAR.touring, 60, rho)
    const o = carAero(STOCK_CAR.open, 60, rho)
    expect(o.clA).toBeGreaterThan(t.clA * 1.8)
    expect(o.clA / o.cdA).toBeGreaterThan(t.clA / t.cdA)
  })

  it('has the floor pull harder as it sits lower, then collapse under its critical height', () => {
    const d = STOCK_CAR.open
    const crit = CAR_CLASS.open.floor.critHeight
    expect(floorFactor(d, CAR_CLASS.open.floor.refHeight)).toBeCloseTo(1, 9)
    expect(floorFactor(d, 0.03)).toBeGreaterThan(floorFactor(d, 0.05))
    expect(floorFactor(d, crit)).toBeGreaterThan(floorFactor(d, 0.03))
    // Past the edge it falls away.
    expect(floorFactor(d, crit * 0.5)).toBeLessThan(floorFactor(d, crit) * 0.8)
  })

  it('squashes the car down as the speed and the downforce rise', () => {
    const slow = carAero(GOOD.open, 20, rho)
    const fast = carAero(GOOD.open, 80, rho)
    expect(fast.front).toBeLessThan(slow.front)
    expect(fast.rear).toBeLessThan(slow.rear)
    expect(slow.front).toBeLessThan(GOOD.open.ride.front + 1e-9)
  })

  it('trades drag for rear downforce with the rear wing, moving the balance back, until it stalls', () => {
    const d = STOCK_CAR.touring
    const flat = carAero(with_(d, { rearWing: { angle: 4, chord: 0.24 } }), 50, rho)
    const steep = carAero(with_(d, { rearWing: { angle: 20, chord: 0.24 } }), 50, rho)
    expect(steep.clARear).toBeGreaterThan(flat.clARear)
    expect(steep.cdA).toBeGreaterThan(flat.cdA)
    expect(steep.balance).toBeLessThan(flat.balance)
    const stalled = carAero(with_(d, { rearWing: { angle: 30, chord: 0.24 } }), 50, rho)
    const atStall = carAero(with_(d, { rearWing: { angle: 24, chord: 0.24 } }), 50, rho)
    expect(stalled.parts.rearWing).toBeLessThan(atStall.parts.rearWing)
    expect(stalled.cdA).toBeGreaterThan(atStall.cdA)
  })

  it('moves the floor’s pull forward with rake', () => {
    const level = carAero(with_(STOCK_CAR.open, { ride: { front: 0.05, rear: 0.05 } }), 40, rho)
    const raked = carAero(with_(STOCK_CAR.open, { ride: { front: 0.05, rear: 0.09 } }), 40, rho)
    expect(raked.balance).toBeGreaterThan(level.balance)
  })
})

describe('the lap', () => {
  it('takes an open-wheel car round faster than a touring car, about where real ones are', () => {
    const t = lapTime(STOCK_CAR.touring, dolgo)
    const o = lapTime(STOCK_CAR.open, dolgo)
    expect(o.time).toBeLessThan(t.time - 10)
    expect(t.time).toBeGreaterThan(85)
    expect(t.time).toBeLessThan(120)
    expect(o.top * 3.6).toBeGreaterThan(280)
    expect(t.length).toBeCloseTo(lapLength(dolgo), 6)
    // Every corner is slower than the top speed, the hairpin slowest.
    const slowest = t.corners.reduce((a, b) => (a.speed < b.speed ? a : b))
    expect(slowest.radius).toBe(20)
  })

  it('is the same every time', () => {
    expect(lapTime(GOOD.open, park)).toEqual(lapTime(GOOD.open, park))
  })

  it('rewards a good setup: tenths for a touring car, more for a single-seater', () => {
    expect(lapGain(GOOD.touring, STOCK_CAR.touring, dolgo)).toBeGreaterThan(0.6)
    expect(lapGain(GOOD.touring, STOCK_CAR.touring, park)).toBeGreaterThan(0.3)
    expect(lapGain(GOOD.open, STOCK_CAR.open, dolgo)).toBeGreaterThan(1.2)
    expect(lapGain(GOOD.open, STOCK_CAR.open, park)).toBeGreaterThan(1)
  })

  it('costs the driver grip outside the balance window, and lap time with it', () => {
    const w = CAR_CLASS.touring.window
    expect(balanceLoss(STOCK_CAR.touring, (w.low + w.high) / 2)).toBe(0)
    expect(balanceLoss(STOCK_CAR.touring, w.low - 0.05)).toBeCloseTo(0.04, 9)
    expect(balanceLoss(STOCK_CAR.touring, w.high + 0.05)).toBeCloseTo(0.04, 9)
    // No front wing and a big rear wing: the front washes out in every fast corner.
    const tail = with_(GOOD.touring, { frontWing: 0, rearWing: { angle: 24, chord: 0.3 } })
    const lap = lapTime(tail, dolgo)
    expect(lap.corners.some((c) => c.loss > 0)).toBe(true)
    expect(lap.time).toBeGreaterThan(lapTime(GOOD.touring, dolgo).time)
  })

  it('runs an engine hot behind too small an inlet', () => {
    const small = with_(GOOD.open, { inlet: 0.4 })
    expect(heatLoss(small)).toBeGreaterThan(0.15)
    expect(lapTime(small, dolgo).heat).toBe(heatLoss(small))
    expect(lapTime(small, dolgo).time).toBeGreaterThan(lapTime(GOOD.open, dolgo).time)
  })

  it('porpoises a car set too low: the floor stalls at speed, the driver lifts, and the lap is slower', () => {
    const low = with_(GOOD.open, { ride: { front: 0.025, rear: 0.025 } })
    const speed = porpoiseSpeed(low, rho)
    expect(speed).not.toBeNull()
    const lap = lapTime(low, dolgo)
    expect(lap.porpoise).toBeCloseTo(speed!, 6)
    expect(lap.top).toBeLessThanOrEqual(speed! + 1e-6)
    expect(lapTime(GOOD.open, dolgo).porpoise).toBeNull()
    expect(lap.time).toBeGreaterThan(lapTime(GOOD.open, dolgo).time)
  })
})

describe('the Tarnovian Motor Racing Federation’s rulebook', () => {
  it('flags ride heights under the plank and a rear wing past its chord, and the scrutineers fix them', () => {
    const r = CAR_RULES.open
    const wild = with_(GOOD.open, { ride: { front: 0.015, rear: 0.03 }, rearWing: { angle: 20, chord: 0.45 } })
    expect(checkCarRules(wild).map((b) => b.rule)).toEqual(['rideFront', 'chord'])
    const fixed = scrutineered(wild)
    expect(checkCarRules(fixed)).toEqual([])
    expect(fixed.ride).toEqual({ front: r.minRide, rear: 0.03 })
    expect(fixed.rearWing.chord).toBe(r.maxChord)
    expect(scrutineered(GOOD.open)).toBe(GOOD.open)
  })
})
