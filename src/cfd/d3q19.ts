/**
 * The D3Q19 lattice (PR 12a): nineteen velocities per cell (rest, six faces,
 * twelve edges) and their weights. The CPU reference (lbm.ts) and the GPU
 * kernel (gpu.ts) both read these, so the two stay the same scheme.
 */

/** The velocity set, [x, y, z] per direction. Pairs 1–2, 3–4, … point opposite ways. */
export const C: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  [1, 1, 0], [-1, -1, 0], [1, -1, 0], [-1, 1, 0],
  [1, 0, 1], [-1, 0, -1], [1, 0, -1], [-1, 0, 1],
  [0, 1, 1], [0, -1, -1], [0, 1, -1], [0, -1, 1],
]

export const Q = 19

/** Weights: 1/3 at rest, 1/18 along an axis, 1/36 along an edge. */
export const W: readonly number[] = C.map(([x, y, z]) => {
  const n = Math.abs(x) + Math.abs(y) + Math.abs(z)
  return n === 0 ? 1 / 3 : n === 1 ? 1 / 18 : 1 / 36
})

/** The direction pointing the other way. */
export const OPP: readonly number[] = C.map(([x, y, z]) => C.findIndex(([a, b, c]) => a === -x && b === -y && c === -z))

/** The equilibrium population for direction q at density rho and velocity u. */
export function equilibrium(q: number, rho: number, ux: number, uy: number, uz: number): number {
  const [cx, cy, cz] = C[q]!
  const cu = 3 * (cx * ux + cy * uy + cz * uz)
  const uu = 1.5 * (ux * ux + uy * uy + uz * uz)
  return W[q]! * rho * (1 + cu + 0.5 * cu * cu - uu)
}
