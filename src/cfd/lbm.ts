/**
 * The CFD Cluster's solver, on the CPU (PR 12a): a lattice Boltzmann grid
 * (D3Q19, BGK collisions) with the body as solid cells. This is the
 * reference the GPU kernel in gpu.ts must match: tests run it on small grids,
 * the browser check runs both and compares. Players' runs use the GPU.
 *
 * Each step, every fluid cell pulls the populations streaming into it from
 * its neighbours, then relaxes them towards equilibrium:
 * - from a solid neighbour, the cell's own outgoing population comes back
 *   (bounce-back: the body's surface is a no-slip wall);
 * - from upstream of the grid, still air at the inflow speed comes in;
 * - from downstream of it, the cell's own population (the flow leaves freely);
 * - across the sides and top, the grid wraps round (a wide, open tunnel).
 *
 * Buffers hold populations after collision, laid out one direction at a
 * time (all cells' q = 0, then all cells' q = 1, …), as the GPU wants.
 */
import { C, equilibrium, OPP, Q, W } from './d3q19'

// Flat copies of the lattice for the hot loops.
const CX = Int8Array.from(C, (c) => c[0])
const CY = Int8Array.from(C, (c) => c[1])
const CZ = Int8Array.from(C, (c) => c[2])
const WQ = Float64Array.from(W)
const OPPQ = Int8Array.from(OPP)

/** The grid and which cells are solid (the body). */
export interface Grid {
  nx: number
  ny: number
  nz: number
  /** 1 for a solid cell, 0 for air; index x + nx·(y + ny·z). */
  solid: Uint8Array
}

export interface LbmParams {
  /** Inflow speed along +x, lattice units. */
  inflow: number
  /** Relaxation time (0.5 < tau). */
  tau: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export const cellIndex = (g: Pick<Grid, 'nx' | 'ny'>, x: number, y: number, z: number) => x + g.nx * (y + g.ny * z)

const wrap = (i: number, n: number) => (i < 0 ? i + n : i >= n ? i - n : i)

/** All cells start at rest density, moving at the inflow speed (the solid ones hold the same; they're never read as air). */
export function initialPopulations(g: Grid, p: LbmParams): Float32Array {
  const n = g.nx * g.ny * g.nz
  const f = new Float32Array(n * Q)
  for (let q = 0; q < Q; q++) f.fill(equilibrium(q, 1, p.inflow, 0, 0), q * n, (q + 1) * n)
  return f
}

/** One step: stream from `src` into each fluid cell, collide, write to `dst`. */
export function lbmStep(g: Grid, p: LbmParams, src: Float32Array, dst: Float32Array): void {
  const { nx, ny, nz, solid } = g
  const n = nx * ny * nz
  const omega = 1 / p.tau
  const fin = new Float64Array(Q)
  const inflow = new Float64Array(Q)
  for (let q = 0; q < Q; q++) inflow[q] = equilibrium(q, 1, p.inflow, 0, 0)
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const i = x + nx * (y + ny * z)
        if (solid[i]) {
          for (let q = 0; q < Q; q++) dst[q * n + i] = src[q * n + i]!
          continue
        }
        let rho = 0
        let ux = 0
        let uy = 0
        let uz = 0
        for (let q = 0; q < Q; q++) {
          const cx = CX[q]!
          const cy = CY[q]!
          const cz = CZ[q]!
          const sx = x - cx
          let v: number
          if (sx < 0) v = inflow[q]!
          else if (sx >= nx) v = src[q * n + i]!
          else {
            const j = sx + nx * (wrap(y - cy, ny) + ny * wrap(z - cz, nz))
            v = solid[j] ? src[OPPQ[q]! * n + i]! : src[q * n + j]!
          }
          fin[q] = v
          rho += v
          ux += v * cx
          uy += v * cy
          uz += v * cz
        }
        ux /= rho
        uy /= rho
        uz /= rho
        const uu = 1.5 * (ux * ux + uy * uy + uz * uz)
        for (let q = 0; q < Q; q++) {
          // The same equilibrium as d3q19.ts, inlined for speed.
          const cu = 3 * (CX[q]! * ux + CY[q]! * uy + CZ[q]! * uz)
          const eq = WQ[q]! * rho * (1 + cu + 0.5 * cu * cu - uu)
          dst[q * n + i] = fin[q]! - omega * (fin[q]! - eq)
        }
      }
    }
  }
}

/**
 * The force the air puts on the body (momentum exchange): each population
 * leaving a fluid cell towards a solid one bounces back, handing the body
 * twice its momentum. Read from post-collision populations.
 */
export function bodyForce(g: Grid, f: Float32Array): Vec3 {
  const { nx, ny, nz, solid } = g
  const n = nx * ny * nz
  let fx = 0
  let fy = 0
  let fz = 0
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const i = x + nx * (y + ny * z)
        if (solid[i]) continue
        for (let q = 1; q < Q; q++) {
          const [cx, cy, cz] = C[q]!
          const tx = x + cx
          if (tx < 0 || tx >= nx) continue
          const j = tx + nx * (wrap(y + cy, ny) + ny * wrap(z + cz, nz))
          if (!solid[j]) continue
          const m = 2 * f[q * n + i]!
          fx += m * cx
          fy += m * cy
          fz += m * cz
        }
      }
    }
  }
  return { x: fx, y: fy, z: fz }
}

/** Density and velocity in one cell (zero velocity in a solid one). */
export function cellFlow(g: Grid, f: Float32Array, i: number): { rho: number; ux: number; uy: number; uz: number } {
  if (g.solid[i]) return { rho: 1, ux: 0, uy: 0, uz: 0 }
  const n = g.nx * g.ny * g.nz
  let rho = 0
  let ux = 0
  let uy = 0
  let uz = 0
  for (let q = 0; q < Q; q++) {
    const v = f[q * n + i]!
    const [cx, cy, cz] = C[q]!
    rho += v
    ux += v * cx
    uy += v * cy
    uz += v * cz
  }
  return { rho, ux: ux / rho, uy: uy / rho, uz: uz / rho }
}

/** Total mass in the air cells. */
export function fluidMass(g: Grid, f: Float32Array): number {
  const n = g.nx * g.ny * g.nz
  let m = 0
  for (let i = 0; i < n; i++) if (!g.solid[i]) for (let q = 0; q < Q; q++) m += f[q * n + i]!
  return m
}

/** Cells the body shows the flow, looking downstream: its frontal area in cells². */
export function frontalCells(g: Grid): number {
  let count = 0
  for (let z = 0; z < g.nz; z++) {
    for (let y = 0; y < g.ny; y++) {
      for (let x = 0; x < g.nx; x++) {
        if (g.solid[cellIndex(g, x, y, z)]) {
          count++
          break
        }
      }
    }
  }
  return count
}

/** The drag coefficient on the frontal area: Fx over ½ρU²A. */
export function dragCoefficient(force: Vec3, g: Grid, p: LbmParams): number {
  const a = frontalCells(g)
  return a === 0 ? 0 : force.x / (0.5 * p.inflow * p.inflow * a)
}

/** A whole run on the CPU, for tests and small grids: the force averaged over the last `average` steps. */
export function runCpu(g: Grid, p: LbmParams, steps: number, average: number): { force: Vec3; f: Float32Array } {
  let a: Float32Array = initialPopulations(g, p)
  let b: Float32Array = new Float32Array(a.length)
  const sum = { x: 0, y: 0, z: 0 }
  for (let s = 0; s < steps; s++) {
    lbmStep(g, p, a, b)
    ;[a, b] = [b, a]
    if (s >= steps - average) {
      const f = bodyForce(g, a)
      sum.x += f.x
      sum.y += f.y
      sum.z += f.z
    }
  }
  const k = Math.max(1, Math.min(average, steps))
  return { force: { x: sum.x / k, y: sum.y / k, z: sum.z / k }, f: a }
}

/** A box of solid cells, inclusive bounds: for tests and calibration. */
export function boxGrid(nx: number, ny: number, nz: number, from: [number, number, number], to: [number, number, number]): Grid {
  const solid = new Uint8Array(nx * ny * nz)
  for (let z = from[2]; z <= to[2]; z++) for (let y = from[1]; y <= to[1]; y++) for (let x = from[0]; x <= to[0]; x++) solid[cellIndex({ nx, ny }, x, y, z)] = 1
  return { nx, ny, nz, solid }
}

/** A sphere of solid cells: for tests and calibration. */
export function sphereGrid(nx: number, ny: number, nz: number, centre: [number, number, number], radius: number): Grid {
  const solid = new Uint8Array(nx * ny * nz)
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const dx = x + 0.5 - centre[0]
        const dy = y + 0.5 - centre[1]
        const dz = z + 0.5 - centre[2]
        if (dx * dx + dy * dy + dz * dz <= radius * radius) solid[cellIndex({ nx, ny }, x, y, z)] = 1
      }
    }
  }
  return { nx, ny, nz, solid }
}
