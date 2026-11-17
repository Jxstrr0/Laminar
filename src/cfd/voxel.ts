/**
 * Turning a model into solid cells for the CFD grid (PR 12b). Pure maths on
 * triangles, so it's tested without a GPU or three.js; the render side
 * (src/render/cfdShape.ts) hands over the model's triangles.
 *
 * The triangles come in the flow's frame: the air runs along +x, y is
 * across and z is up, in metres. The model is scaled to fit the grid with
 * room round it, nose upstream. Each mesh is filled on its own, so
 * overlapping parts (an arm through a torso) simply add up:
 * - Rays along x, y and z through every cell centre count that mesh's
 *   surface crossings; a cell between an entry and its exit gets a vote,
 *   and two votes of three make it solid. A body lofted along the flow with
 *   open ends (rays along x slip through) still fills from the other two.
 *   A ray with an odd number of crossings casts no votes.
 * - A part thinner than a cell or so (a tyre, a disc wheel, a frame tube)
 *   would slip between the rays: it's drawn instead as a one-cell shell
 *   from points sampled over its surface. That makes thin parts a little
 *   thick, one of the grid's biases.
 */
import { CFD } from '../data/cfd'
import type { Grid } from './lbm'

export interface Voxels extends Grid {
  /** Metres per cell at the model's scale. */
  cell: number
  /** Solid cells. */
  count: number
}

// Column centres sit a hair off the half-cell so a ray never runs exactly along a shared edge.
const NUDGE_Y = 1.37e-6
const NUDGE_Z = 2.71e-6

/** The model's bounding box across every mesh. */
function bounds(meshes: readonly Float32Array[]): { min: [number, number, number]; max: [number, number, number] } | null {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const m of meshes) {
    for (let i = 0; i < m.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = m[i + k]!
        if (v < min[k]!) min[k] = v
        if (v > max[k]!) max[k] = v
      }
    }
  }
  return min[0] === Infinity ? null : { min, max }
}

/**
 * Fill a grid from the model's meshes (each a flat list of triangles, nine
 * numbers apiece), scaled to fit CFD.fit's share of the grid.
 */
export function voxelize(meshes: readonly Float32Array[], size: { nx: number; ny: number; nz: number } = CFD.grid): Voxels {
  const { nx, ny, nz } = size
  const dims = [nx, ny, nz] as const
  const solid = new Uint8Array(nx * ny * nz)
  const box = bounds(meshes)
  if (!box) return { nx, ny, nz, solid, cell: 0, count: 0 }
  const len = box.max.map((v, k) => Math.max(v - box.min[k]!, 1e-9))
  // Cells per metre: the longest fit that leaves room round the model.
  const scale = Math.min((nx * CFD.fit.length) / len[0]!, (ny * CFD.fit.across) / len[1]!, (nz * CFD.fit.across) / len[2]!)
  // Where the box's corner lands, in cells: nose upstream, centred across and up.
  const off = [nx * CFD.fit.noseAt, (ny - len[1]! * scale) / 2, (nz - len[2]! * scale) / 2]
  const stride = [1, nx, nx * ny]
  const votes = new Uint8Array(nx * ny * nz)

  for (const m of meshes) {
    // The mesh in grid units, and its box.
    const g = new Float64Array(m.length - (m.length % 9))
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < g.length; i++) {
      const k = i % 3
      const v = (m[i]! - box.min[k]!) * scale + off[k]!
      g[i] = v
      if (v < lo[k]!) lo[k] = v
      if (v > hi[k]!) hi[k] = v
    }
    if (g.length === 0) continue
    // Cell ranges the mesh can touch.
    const c0 = lo.map((v) => Math.max(0, Math.floor(v)))
    const c1 = hi.map((v, k) => Math.min(dims[k]! - 1, Math.floor(v)))
    if (Math.min(hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!) < CFD.fit.thinCells) {
      shell(g, dims, stride, solid)
      continue
    }
    for (let z = c0[2]!; z <= c1[2]!; z++) for (let y = c0[1]!; y <= c1[1]!; y++) votes.fill(0, c0[0]! + nx * (y + ny * z), c1[0]! + 1 + nx * (y + ny * z))
    for (let axis = 0; axis < 3; axis++) castRays(g, axis, dims, stride, c0, c1, votes)
    for (let z = c0[2]!; z <= c1[2]!; z++) {
      for (let y = c0[1]!; y <= c1[1]!; y++) {
        for (let x = c0[0]!; x <= c1[0]!; x++) {
          const i = x + nx * (y + ny * z)
          if (votes[i]! >= 2) solid[i] = 1
        }
      }
    }
  }
  let count = 0
  for (let i = 0; i < solid.length; i++) count += solid[i]!
  return { nx, ny, nz, solid, cell: 1 / scale, count }
}

/** Rays along one axis through the cell centres the mesh covers: each cell between an entry and its exit gets a vote. */
function castRays(g: Float64Array, axis: number, dims: readonly number[], stride: readonly number[], c0: readonly number[], c1: readonly number[], votes: Uint8Array): void {
  // The two axes across the rays.
  const a = (axis + 1) % 3
  const b = (axis + 2) % 3
  const na = c1[a]! - c0[a]! + 1
  const nb = c1[b]! - c0[b]! + 1
  const hits: number[][] = Array.from({ length: na * nb }, () => [])
  for (let t = 0; t + 8 < g.length; t += 9) {
    const pa = g[t + a]!
    const pb = g[t + b]!
    const qa = g[t + 3 + a]!
    const qb = g[t + 3 + b]!
    const ra = g[t + 6 + a]!
    const rb = g[t + 6 + b]!
    const det = (qa - pa) * (rb - pb) - (ra - pa) * (qb - pb)
    if (Math.abs(det) < 1e-12) continue
    const i0 = Math.max(c0[a]!, Math.ceil(Math.min(pa, qa, ra) - 0.5))
    const i1 = Math.min(c1[a]!, Math.floor(Math.max(pa, qa, ra) - 0.5))
    const j0 = Math.max(c0[b]!, Math.ceil(Math.min(pb, qb, rb) - 0.5))
    const j1 = Math.min(c1[b]!, Math.floor(Math.max(pb, qb, rb) - 0.5))
    for (let j = j0; j <= j1; j++) {
      const yb = j + 0.5 + NUDGE_Z
      for (let i = i0; i <= i1; i++) {
        const ya = i + 0.5 + NUDGE_Y
        // Barycentric weights of the ray in the triangle's shadow.
        const u = ((ya - pa) * (rb - pb) - (ra - pa) * (yb - pb)) / det
        const v = ((qa - pa) * (yb - pb) - (ya - pa) * (qb - pb)) / det
        if (u < 0 || v < 0 || u + v > 1) continue
        const p = g[t + axis]!
        hits[i - c0[a]! + na * (j - c0[b]!)]!.push(p + u * (g[t + 3 + axis]! - p) + v * (g[t + 6 + axis]! - p))
      }
    }
  }
  for (let col = 0; col < hits.length; col++) {
    const h = hits[col]!
    if (h.length < 2 || h.length % 2 === 1) continue
    h.sort((p, q) => p - q)
    const ia = c0[a]! + (col % na)
    const ib = c0[b]! + Math.floor(col / na)
    const base = ia * stride[a]! + ib * stride[b]!
    for (let p = 0; p + 1 < h.length; p += 2) {
      const from = Math.max(0, Math.ceil(h[p]! - 0.5))
      const to = Math.min(dims[axis]! - 1, Math.floor(h[p + 1]! - 0.5))
      for (let c = from; c <= to; c++) votes[base + c * stride[axis]!]!++
    }
  }
}

/** A thin part as a one-cell shell: every cell a point on its surface falls in, sampled finer than half a cell. */
function shell(g: Float64Array, dims: readonly number[], stride: readonly number[], solid: Uint8Array): void {
  for (let t = 0; t + 8 < g.length; t += 9) {
    let longest = 0
    for (const [p, q] of [[0, 3], [3, 6], [6, 0]] as const) {
      const dx = g[t + p]! - g[t + q]!
      const dy = g[t + p + 1]! - g[t + q + 1]!
      const dz = g[t + p + 2]! - g[t + q + 2]!
      longest = Math.max(longest, Math.sqrt(dx * dx + dy * dy + dz * dz))
    }
    const steps = Math.max(1, Math.ceil(longest * 2))
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps - i; j++) {
        const u = i / steps
        const v = j / steps
        let index = 0
        let inside = true
        for (let k = 0; k < 3; k++) {
          const c = Math.floor(g[t + k]! + u * (g[t + 3 + k]! - g[t + k]!) + v * (g[t + 6 + k]! - g[t + k]!))
          if (c < 0 || c >= dims[k]!) inside = false
          index += c * stride[k]!
        }
        if (inside) solid[index] = 1
      }
    }
  }
}
