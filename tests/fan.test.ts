import { describe, expect, it } from 'vitest'
import { UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { fanAtRest, setFanTarget, stepFan } from '../src/sim/fan'

const spec = UNIVERSITY_TUNNEL

describe('the fan', () => {
  it('spins up at its ramp rate, not in one jump', () => {
    let fan = setFanTarget(fanAtRest(), 30, spec)
    fan = stepFan(fan, 1, spec)
    expect(fan.speed).toBeCloseTo(spec.rampRate, 9)
  })

  it('settles on the target without overshooting', () => {
    let fan = setFanTarget(fanAtRest(), 12.5, spec)
    for (let i = 0; i < 600; i++) {
      fan = stepFan(fan, 1 / 60, spec)
      expect(fan.speed).toBeLessThanOrEqual(12.5 + 1e-9)
    }
    expect(fan.speed).toBeCloseTo(12.5, 9)
  })

  it('spins down too', () => {
    let fan = { target: 0, speed: 20 }
    fan = stepFan(fan, 1, spec)
    expect(fan.speed).toBeCloseTo(20 - spec.rampRate, 9)
  })

  it('never goes past top speed or below zero', () => {
    expect(setFanTarget(fanAtRest(), 999, spec).target).toBe(spec.topSpeed)
    expect(setFanTarget(fanAtRest(), -5, spec).target).toBe(0)
    expect(setFanTarget(fanAtRest(), Number.NaN, spec).target).toBe(0)
  })

  it('gives the same result every time', () => {
    const run = () => {
      let fan = setFanTarget(fanAtRest(), 37, spec)
      for (let i = 0; i < 200; i++) fan = stepFan(fan, 1 / 60, spec)
      return fan.speed
    }
    expect(run()).toBe(run())
  })
})
