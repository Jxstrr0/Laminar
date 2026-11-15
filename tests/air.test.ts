import { describe, expect, it } from 'vitest'
import { AIR } from '../src/data/air'
import { circleArea, dragForce, dynamicPressure, reynolds } from '../src/sim/air'

describe('air sums', () => {
  it('dynamic pressure at 10 m/s in sea-level air is about 61 Pa', () => {
    expect(dynamicPressure(AIR.density, 10)).toBeCloseTo(61.25, 6)
  })

  it('a 25 cm sphere at 40 m/s runs near Re 680 000', () => {
    const re = reynolds(AIR.density, 40, 0.25, AIR.viscosity)
    expect(re).toBeGreaterThan(6.7e5)
    expect(re).toBeLessThan(6.8e5)
  })

  it('a circle of 1 m diameter has area pi/4', () => {
    expect(circleArea(1)).toBeCloseTo(Math.PI / 4, 12)
  })

  it('drag is q times Cd times area', () => {
    expect(dragForce(100, 0.5, 2)).toBe(100)
  })
})
