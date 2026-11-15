import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { DEMO_MODEL_SEED, STANDARD_MODEL } from '../src/data/model'
import { UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { cyclistShape, legFactor } from '../src/sim/geom/cyclist'
import { riderPose } from '../src/sim/geom/pose'
import { Rng } from '../src/sim/rng'
import type { Run, RunSample } from '../src/sim/run'
import { legCycle, poolRuns, yawGroups } from '../src/sim/runStats'
import { prepareModel, readBalance } from '../src/sim/views'

const model = { ...STANDARD_MODEL, seed: DEMO_MODEL_SEED }
const quiet = { ...UNIVERSITY_TUNNEL, balanceNoise: 0 }
const reading = (crankDeg?: number) =>
  readBalance(prepareModel(cyclistShape(DEFAULT_CYCLIST, crankDeg === undefined ? {} : { crankDeg }), model), quiet, { speed: 30, yawDeg: 0 }, new Rng(1)).cdA

/** A run of one design at one crank angle: `n` settled readings at 0° and 30 m/s. */
function run(crankDeg: number, seed: number, n = 20): Run {
  const prepared = prepareModel(cyclistShape(DEFAULT_CYCLIST, { crankDeg }), model)
  const rng = new Rng(seed)
  const samples: RunSample[] = Array.from({ length: n }, (_, i) => {
    const r = readBalance(prepared, UNIVERSITY_TUNNEL, { speed: 30, yawDeg: 0 }, rng)
    return { t: i * 0.25, speed: 30, yawDeg: 0, cdA: r.cdA, cyA: r.cyA, dragN: 0, steady: true }
  })
  return { id: seed, model: 'rider', samples, duration: n * 0.25, energyKWh: 0, topSpeed: 30 }
}

describe('the legs’ swing', () => {
  it('peaks with a thigh up, dips with the cranks level, and averages to 1 over a stroke', () => {
    expect(legFactor(75)).toBeCloseTo(1.1, 6)
    expect(legFactor(165)).toBeCloseTo(0.9, 6)
    const four = [0, 45, 90, 135].map(legFactor)
    expect(four.reduce((a, b) => a + b, 0) / 4).toBeCloseTo(1, 9)
  })

  it('leaves the pedalling rider (no crank given) unchanged', () => {
    // At 30° the swing is zero, so the fixed legs match the pedalling ones.
    expect(reading(30)).toBeCloseTo(reading(), 9)
  })

  it('makes a static model read off the pedalling truth, and four even angles average it out', () => {
    const pedalling = reading()
    const standard = reading(15)
    expect(standard).toBeLessThan(pedalling)
    expect(Math.abs(standard / pedalling - 1)).toBeGreaterThan(0.01)
    expect(reading(75)).toBeGreaterThan(pedalling * 1.02)
    const avg = [0, 45, 90, 135].map((c) => reading(c)).reduce((a, b) => a + b, 0) / 4
    expect(Math.abs(avg / pedalling - 1)).toBeLessThan(0.002)
  })

  it('turns the model’s feet with the crank dial', () => {
    const a = riderPose(DEFAULT_CYCLIST, 0)
    const b = riderPose(DEFAULT_CYCLIST, 90)
    expect(a.foot[0].x).toBeGreaterThan(b.foot[0].x)
    expect(b.foot[0].y).toBeLessThan(a.foot[0].y)
    expect(riderPose(DEFAULT_CYCLIST)).toEqual(riderPose(DEFAULT_CYCLIST, 15))
  })
})

describe('repeat runs and the pedalling average', () => {
  it('pools repeat runs into a narrower band, with the run-to-run spread', () => {
    const one = yawGroups(run(15, 1))[0]!
    const pooled = poolRuns([run(15, 1), run(15, 2), run(15, 3)])
    expect(pooled).toHaveLength(1)
    expect(pooled[0]!.runs).toBe(3)
    expect(pooled[0]!.n).toBe(60)
    expect(pooled[0]!.band).toBeLessThan(one.band)
    expect(pooled[0]!.spread).not.toBeNull()
    expect(poolRuns([run(15, 1)])[0]!.spread).toBeNull()
  })

  it('needs two crank angles, and calls four enough', () => {
    expect(legCycle(new Map([[15, [run(15, 1)]]]))).toBeNull()
    const two = legCycle(new Map([[15, [run(15, 1)]], [75, [run(75, 2)]]]))!
    expect(two.angles.map((a) => a.crankDeg)).toEqual([15, 75])
    expect(two.enough).toBe(false)
    const four = legCycle(new Map([0, 45, 90, 135].map((c, i) => [c, [run(c, 10 + i)]])))!
    expect(four.enough).toBe(true)
    expect(Math.abs(four.mean / reading() - 1)).toBeLessThan(0.006)
  })
})
