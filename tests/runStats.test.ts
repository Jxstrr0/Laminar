import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST, SIT_UP_CYCLIST, type CyclistDesign } from '../src/data/cyclist'
import { STANDARD_MODEL } from '../src/data/model'
import { RUN_STATS, UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { changedControls } from '../src/sim/designDiff'
import { cyclistShape } from '../src/sim/geom/cyclist'
import { Rng } from '../src/sim/rng'
import type { RunSample } from '../src/sim/run'
import { compareRuns, headlineCompare, headlineGroup, yawGroups } from '../src/sim/runStats'
import { prepareModel, readBalance } from '../src/sim/views'

/** A run of settled balance readings: `n` at each yaw, at 30 m/s. */
function balanceRun(design: CyclistDesign, yaws: number[], n: number, seed = 7): { samples: RunSample[] } {
  const prepared = prepareModel(cyclistShape(design), { ...STANDARD_MODEL, seed: 1 })
  const rng = new Rng(seed).fork('balance')
  const samples: RunSample[] = []
  for (const yawDeg of yaws)
    for (let i = 0; i < n; i++) {
      const r = readBalance(prepared, UNIVERSITY_TUNNEL, { speed: 30, yawDeg }, rng)
      samples.push({ t: samples.length * 0.25, speed: 30, yawDeg, cdA: r.cdA, cyA: r.cyA, dragN: 0, steady: true })
    }
  return { samples }
}

describe('run statistics', () => {
  it('groups settled readings by yaw and ignores moving ones', () => {
    const run = balanceRun(DEFAULT_CYCLIST, [-10, 0, 10], 12)
    run.samples.push({ t: 99, speed: 30, yawDeg: 5, cdA: 9, cyA: 0, dragN: 0, steady: false })
    const groups = yawGroups(run)
    expect(groups.map((g) => g.yawDeg)).toEqual([-10, 0, 10])
    for (const g of groups) {
      expect(g.n).toBe(12)
      expect(g.trusted).toBe(true)
      // 1 % balance noise on a CdA near 0.23.
      expect(g.sd).toBeGreaterThan(0.0005)
      expect(g.sd).toBeLessThan(0.006)
      expect(g.band).toBeCloseTo((RUN_STATS.z * g.sd) / Math.sqrt(12), 10)
    }
  })

  it('more readings narrow the band', () => {
    const few = yawGroups(balanceRun(DEFAULT_CYCLIST, [0], 8))[0]!
    const many = yawGroups(balanceRun(DEFAULT_CYCLIST, [0], 128))[0]!
    expect(many.band).toBeLessThan(few.band / 2)
  })

  it('the same design run twice is within the noise', () => {
    const a = balanceRun(DEFAULT_CYCLIST, [0], 24, 3)
    const b = balanceRun(DEFAULT_CYCLIST, [0], 24, 4)
    expect(compareRuns(a, b)[0]!.verdict).toBe('noise')
  })

  it('sitting up is clearly higher drag, and tucking back down clearly lower', () => {
    const tuck = balanceRun(DEFAULT_CYCLIST, [0, 10], 16, 3)
    const sit = balanceRun(SIT_UP_CYCLIST, [0, 10], 16, 4)
    for (const c of compareRuns(tuck, sit)) expect(c.verdict).toBe('higher')
    for (const c of compareRuns(sit, tuck)) expect(c.verdict).toBe('lower')
  })

  it('only compares shared yaws, and flags thin groups', () => {
    const a = balanceRun(DEFAULT_CYCLIST, [0, 5, 10], 10)
    const b = balanceRun(DEFAULT_CYCLIST, [5, 10], 2)
    const list = compareRuns(a, b)
    expect(list.map((c) => c.yawDeg)).toEqual([5, 10])
    expect(list.every((c) => c.verdict === 'tooFew')).toBe(true)
    expect(headlineCompare(list)!.yawDeg).toBe(5)
    expect(headlineCompare([])).toBeNull()
  })

  it('keeps different air speeds apart', () => {
    const run = balanceRun(DEFAULT_CYCLIST, [0], 8)
    for (const s of balanceRun(DEFAULT_CYCLIST, [0], 8).samples) run.samples.push({ ...s, speed: 20 })
    const groups = yawGroups(run)
    expect(groups.map((g) => g.speed)).toEqual([20, 30])
    expect(headlineGroup(groups)!.speed).toBe(30)
  })

  it('names the controls that changed', () => {
    expect(changedControls(DEFAULT_CYCLIST, DEFAULT_CYCLIST)).toEqual([])
    const b = structuredClone(DEFAULT_CYCLIST)
    b.posture.torsoDeg += 3
    b.wheels.rear = b.wheels.rear === 'disc' ? 'spoked' : 'disc'
    expect(changedControls(DEFAULT_CYCLIST, b)).toEqual(['torsoDeg', 'rear'])
  })
})
