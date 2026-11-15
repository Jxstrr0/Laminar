import { describe, expect, it } from 'vitest'
import { UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { setYawTarget, stepTurntable, turntableAtRest } from '../src/sim/turntable'

const spec = UNIVERSITY_TUNNEL.turntable

describe('turntable', () => {
  it('starts square to the wind', () => {
    expect(turntableAtRest()).toEqual({ target: 0, angle: 0 })
  })

  it('keeps targets inside its range and on its steps', () => {
    expect(setYawTarget(turntableAtRest(), 99, spec).target).toBe(spec.max)
    expect(setYawTarget(turntableAtRest(), -99, spec).target).toBe(spec.min)
    expect(setYawTarget(turntableAtRest(), 7.4, spec).target).toBe(7)
    expect(setYawTarget(turntableAtRest(), Number.NaN, spec).target).toBe(0)
  })

  it('turns at its own rate, then stops on the target', () => {
    let s = setYawTarget(turntableAtRest(), 10, spec)
    s = stepTurntable(s, 1, spec)
    expect(s.angle).toBeCloseTo(spec.rate, 9)
    for (let i = 0; i < 10; i++) s = stepTurntable(s, 1, spec)
    expect(s.angle).toBe(10)
    s = stepTurntable(setYawTarget(s, -10, spec), 1, spec)
    expect(s.angle).toBeCloseTo(10 - spec.rate, 9)
  })
})
