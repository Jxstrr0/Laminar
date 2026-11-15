import { describe, expect, it } from 'vitest'
import { REFERENCE_COURSE, REFERENCE_RIDER } from '../src/data/field'
import { HOODS_POSITION, TT_POSITION } from '../src/data/rider'
import { UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { windAveragedCdA, yawCurve } from '../src/sim/aero/windAverage'
import { densityAt, viscosityAt } from '../src/sim/field/atmosphere'
import { courseTime } from '../src/sim/field/timeTrial'
import { describeShape } from '../src/sim/geom/body'
import { referenceRider } from '../src/sim/geom/rider'
import { sphere } from '../src/sim/geom/shapes'
import { harnessReport } from '../src/sim/harness'
import { gaussian } from '../src/sim/noise'
import { Rng } from '../src/sim/rng'
import { buildModel, fieldResult, prepareModel, readBalance, REFERENCE_TT, truth, tunnelReading } from '../src/sim/views'

const tt = referenceRider(TT_POSITION)
const hoods = referenceRider(HOODS_POSITION)
const calm = { density: 1.2, windSpeed: 0, windFromDeg: 0 }

describe('the reference rider', () => {
  it('reads like a real time-trial tuck and a rider on the hoods', () => {
    const a = truth(tt, REFERENCE_TT).cdA
    const b = truth(hoods, REFERENCE_TT).cdA
    expect(a).toBeGreaterThan(0.19)
    expect(a).toBeLessThan(0.26)
    expect(b).toBeGreaterThan(0.28)
    expect(b).toBeLessThan(0.4)
    expect(b).toBeGreaterThan(a * 1.25)
  })
  it('pays more drag as the wind swings round (the yaw curve)', () => {
    const c = truth(tt, REFERENCE_TT).curve
    const at = (y: number) => c.cdA[c.yawsDeg.indexOf(y)]!
    expect(at(10)).toBeGreaterThan(at(0))
    expect(at(-10)).toBeCloseTo(at(10), 9)
  })
})

describe('field air', () => {
  it('matches the standard atmosphere', () => {
    expect(densityAt(15, 0)).toBeCloseTo(1.225, 2)
    expect(viscosityAt(15)).toBeCloseTo(1.79e-5, 6)
  })
  it('thins with altitude and heat', () => {
    expect(densityAt(15, 2000)).toBeLessThan(densityAt(15, 0) * 0.85)
    expect(densityAt(35, 0)).toBeLessThan(densityAt(5, 0))
  })
})

describe('the time trial', () => {
  const cda = () => 0.22
  it('takes the reference rider 50 to 58 minutes over 40 km in still air', () => {
    const run = courseTime(REFERENCE_RIDER, REFERENCE_COURSE, calm, cda)
    expect(run.distance).toBe(40000)
    expect(run.time / 60).toBeGreaterThan(50)
    expect(run.time / 60).toBeLessThan(58)
  })
  it('is slower in a wind, even out and back', () => {
    const still = courseTime(REFERENCE_RIDER, REFERENCE_COURSE, calm, cda).time
    const windy = courseTime(REFERENCE_RIDER, REFERENCE_COURSE, { ...calm, windSpeed: 5 }, cda).time
    expect(windy).toBeGreaterThan(still)
  })
  it('is slower up a hill, in thicker air and with more drag', () => {
    const flat = courseTime(REFERENCE_RIDER, REFERENCE_COURSE, calm, cda).time
    const hill = courseTime(REFERENCE_RIDER, [{ length: 40000, gradient: 0.02, heading: 0 }], calm, cda).time
    const thick = courseTime(REFERENCE_RIDER, REFERENCE_COURSE, { ...calm, density: 1.3 }, cda).time
    const draggy = courseTime(REFERENCE_RIDER, REFERENCE_COURSE, calm, () => 0.3).time
    expect(hill).toBeGreaterThan(flat)
    expect(thick).toBeGreaterThan(flat)
    expect(draggy).toBeGreaterThan(flat)
  })
  it('reads the yaw angle from a crosswind', () => {
    const run = courseTime(REFERENCE_RIDER, REFERENCE_COURSE, { ...calm, windSpeed: 4, windFromDeg: 90 }, cda)
    expect(run.segments[0]!.yawDeg).toBeGreaterThan(10)
    expect(run.segments[1]!.yawDeg).toBeLessThan(-10)
  })
})

describe('wind-averaged CdA', () => {
  const curve = yawCurve(describeShape(tt), { density: 1.2, viscosity: 1.8e-5, speed: 12.5, turbulence: 0.015 }, 0.6)
  it('equals the head-on CdA with no wind', () => {
    expect(windAveragedCdA(curve, 12.5, 0)).toBeCloseTo(curve.cdA[curve.yawsDeg.indexOf(0)]!, 9)
  })
  it('rises with the wind', () => {
    expect(windAveragedCdA(curve, 12.5, 4)).toBeGreaterThan(windAveragedCdA(curve, 12.5, 2))
  })
})

describe('one truth, three views', () => {
  const model = { scale: 0.5, finish: 'sanded' as const, accuracy: 0.01, seed: 7 }
  const run = { speed: 30, yawDeg: 0 }

  it('the field result is the same for the same seed and differs across seeds', () => {
    const a = fieldResult(tt, REFERENCE_TT, 3)
    expect(fieldResult(tt, REFERENCE_TT, 3)).toEqual(a)
    expect(fieldResult(tt, REFERENCE_TT, 4).time).not.toBe(a.time)
  })
  it('a better shape wins on the same day', () => {
    expect(fieldResult(tt, REFERENCE_TT, 5).time).toBeLessThan(fieldResult(hoods, REFERENCE_TT, 5).time)
  })
  it('the tunnel reading repeats for a seed and scatters between runs', () => {
    const a = tunnelReading(tt, model, UNIVERSITY_TUNNEL, run, new Rng(1))
    expect(tunnelReading(tt, model, UNIVERSITY_TUNNEL, run, new Rng(1))).toEqual(a)
    const rng = new Rng(2)
    const first = tunnelReading(tt, model, UNIVERSITY_TUNNEL, run, rng).cdA
    const second = tunnelReading(tt, model, UNIVERSITY_TUNNEL, run, rng).cdA
    expect(second).not.toBe(first)
  })
  it('a well-built model at a good speed reads close to the truth', () => {
    const real = truth(tt, REFERENCE_TT).cdA
    const rng = new Rng(9)
    let sum = 0
    for (let i = 0; i < 20; i++) sum += tunnelReading(tt, model, UNIVERSITY_TUNNEL, run, rng).cdA
    expect(Math.abs(sum / 20 / real - 1)).toBeLessThan(0.06)
  })
  it('each model carries its own small build errors', () => {
    const a = describeShape(buildModel(tt, model)).frontalArea
    const b = describeShape(buildModel(tt, { ...model, seed: 8 })).frontalArea
    expect(a).not.toBe(b)
    expect(Math.abs(a / b - 1)).toBeLessThan(0.05)
  })
  it('the Reynolds trap: a small sphere model reads laminar while the real one is turbulent', () => {
    const ball = { bodies: [sphere('ball', 0.25)] }
    const real = truth(ball, REFERENCE_TT).forces.drag.bodies[0]!.regime
    const small = { scale: 0.25, finish: 'polished' as const, accuracy: 0, seed: 1 }
    const read = tunnelReading(ball, small, UNIVERSITY_TUNNEL, { speed: 25, yawDeg: 0 }, new Rng(1))
    expect(real).toBe('turbulent')
    expect(read.forces.drag.bodies[0]!.regime).toBe('laminar')
    expect(read.cdA).toBeGreaterThan(truth(ball, REFERENCE_TT).cdA * 2)
  })
})

describe('noise and the harness', () => {
  it('draws a bell curve', () => {
    const rng = new Rng(11)
    let sum = 0
    let sq = 0
    const n = 4000
    for (let i = 0; i < n; i++) {
      const g = gaussian(rng)
      sum += g
      sq += g * g
    }
    expect(Math.abs(sum / n)).toBeLessThan(0.06)
    expect(sq / n).toBeGreaterThan(0.9)
    expect(sq / n).toBeLessThan(1.1)
  })
  it('prints a report for each reference shape', () => {
    for (const name of ['sphere', 'rider-tt', 'rider-hoods', 'van']) {
      const lines = harnessReport(name)
      expect(lines.some((l) => l.startsWith('Field, 40 km TT'))).toBe(true)
    }
    expect(harnessReport('teapot')[0]).toContain('Unknown shape')
  })
})

describe('the balance on a prepared model', () => {
  const spec = referenceRider(TT_POSITION)
  const model = { scale: 0.5, finish: 'sanded' as const, accuracy: 0.01, seed: 4 }
  const run = { speed: 30, yawDeg: 5 }

  it('reads exactly what a one-off tunnel reading does', () => {
    const a = tunnelReading(spec, model, UNIVERSITY_TUNNEL, run, new Rng(9))
    const b = readBalance(prepareModel(spec, model), UNIVERSITY_TUNNEL, run, new Rng(9))
    expect(b).toEqual(a)
  })

  it('scatters reading to reading, around the quiet value', () => {
    const prepared = prepareModel(spec, model)
    const quiet = readBalance(prepared, { ...UNIVERSITY_TUNNEL, balanceNoise: 0 }, run, new Rng(1)).cdA
    const rng = new Rng(2)
    const reads = Array.from({ length: 200 }, () => readBalance(prepared, UNIVERSITY_TUNNEL, run, rng).cdA)
    expect(new Set(reads).size).toBeGreaterThan(190)
    const mean = reads.reduce((s, v) => s + v, 0) / reads.length
    expect(Math.abs(mean / quiet - 1)).toBeLessThan(0.003)
  })
})
