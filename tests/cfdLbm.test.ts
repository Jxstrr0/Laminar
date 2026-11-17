import { describe, expect, it } from 'vitest'
import { C, OPP, Q, W, equilibrium } from '../src/cfd/d3q19'
import { bodyForce, cellFlow, cellIndex, dragCoefficient, fluidMass, frontalCells, initialPopulations, lbmStep, runCpu, sphereGrid, type Grid } from '../src/cfd/lbm'

const P = { inflow: 0.06, tau: 0.56 }

describe('the D3Q19 lattice (PR 12a)', () => {
  it('nineteen directions, weights summing to one, each with its opposite', () => {
    expect(C).toHaveLength(Q)
    expect(W.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
    for (let q = 0; q < Q; q++) {
      expect(OPP[OPP[q]!]).toBe(q)
      expect(C[OPP[q]!]!.map((v, k) => v + C[q]![k]!)).toEqual([0, 0, 0])
    }
  })

  it('equilibrium carries the density and momentum it was made from', () => {
    let rho = 0
    let mx = 0
    for (let q = 0; q < Q; q++) {
      const v = equilibrium(q, 1.02, 0.05, -0.01, 0.02)
      rho += v
      mx += v * C[q]![0]
    }
    expect(rho).toBeCloseTo(1.02, 12)
    expect(mx).toBeCloseTo(1.02 * 0.05, 12)
  })
})

describe('the CPU solver (PR 12a)', () => {
  it('leaves an empty tunnel as it found it: uniform flow stays uniform', () => {
    const g: Grid = { nx: 12, ny: 6, nz: 6, solid: new Uint8Array(12 * 36) }
    let a: Float32Array = initialPopulations(g, P)
    let b: Float32Array = new Float32Array(a.length)
    for (let s = 0; s < 20; s++) {
      lbmStep(g, P, a, b)
      ;[a, b] = [b, a]
    }
    const mid = cellFlow(g, a, cellIndex(g, 6, 3, 3))
    expect(mid.ux).toBeCloseTo(0.06, 5)
    expect(mid.rho).toBeCloseTo(1, 5)
    expect(Math.abs(mid.uy) + Math.abs(mid.uz)).toBeLessThan(1e-6)
    expect(bodyForce(g, a)).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('a body feels drag downstream and none sideways, slows the air behind it, and keeps mass bounded', () => {
    const g = sphereGrid(32, 16, 16, [10, 8, 8], 3.2)
    expect(frontalCells(g)).toBeGreaterThan(20)
    const start = fluidMass(g, initialPopulations(g, P))
    const { force, f } = runCpu(g, P, 300, 60)
    expect(force.x).toBeGreaterThan(0)
    // Symmetric body, symmetric flow: side force and lift are tiny next to drag.
    expect(Math.abs(force.y)).toBeLessThan(force.x * 0.02)
    expect(Math.abs(force.z)).toBeLessThan(force.x * 0.02)
    const wake = cellFlow(g, f, cellIndex(g, 15, 8, 8))
    const side = cellFlow(g, f, cellIndex(g, 10, 1, 8))
    expect(wake.ux).toBeLessThan(0.03)
    expect(side.ux).toBeGreaterThan(0.06)
    expect(fluidMass(g, f) / start).toBeGreaterThan(0.97)
    expect(fluidMass(g, f) / start).toBeLessThan(1.03)
    // A coarse grid's thick air: the sphere's Cd sits well above the real one's 0.47.
    const cd = dragCoefficient(force, g, P)
    expect(cd).toBeGreaterThan(0.6)
    expect(cd).toBeLessThan(6)
  }, 20000)

  it('thinner air (a shorter relaxation time) lowers the drag coefficient, as a higher Reynolds number does', () => {
    const g = sphereGrid(32, 16, 16, [10, 8, 8], 3.2)
    const thick = dragCoefficient(runCpu(g, { inflow: 0.06, tau: 0.7 }, 300, 60).force, g, P)
    const thin = dragCoefficient(runCpu(g, { inflow: 0.06, tau: 0.53 }, 300, 60).force, g, P)
    expect(thin).toBeLessThan(thick)
  }, 30000)
})
