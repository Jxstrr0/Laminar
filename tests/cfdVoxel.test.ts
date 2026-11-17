import { describe, expect, it } from 'vitest'
import { voxelize } from '../src/cfd/voxel'
import { frontalCells } from '../src/cfd/lbm'

/** A closed box's twelve triangles. */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Float32Array {
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ]
  const faces = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [3, 2, 6], [3, 6, 7], [0, 3, 7], [0, 7, 4], [1, 5, 6], [1, 6, 2]]
  return Float32Array.from(faces.flatMap((f) => f.flatMap((i) => v[i]!)))
}

/** A closed sphere from latitude and longitude bands. */
function sphere(r: number, bands = 24): Float32Array {
  const out: number[] = []
  const at = (i: number, j: number) => {
    const th = (Math.PI * i) / bands
    const ph = (2 * Math.PI * j) / bands
    return [r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)]
  }
  for (let i = 0; i < bands; i++) {
    for (let j = 0; j < bands; j++) {
      const a = at(i, j)
      const b = at(i + 1, j)
      const c = at(i + 1, j + 1)
      const d = at(i, j + 1)
      if (i > 0) out.push(...a, ...b, ...d)
      if (i < bands - 1) out.push(...b, ...c, ...d)
    }
  }
  return Float32Array.from(out)
}

const size = { nx: 96, ny: 48, nz: 48 }

describe('voxelizing a model (PR 12b)', () => {
  it('a box fills a box of cells, nose upstream, centred across and up', () => {
    const v = voxelize([box(0, 0, 0, 2, 1, 1)], size)
    // Two metres long fits the length share: 0.36 · 96 ≈ 34.6 cells, so about 17 cells a metre.
    expect(v.cell).toBeCloseTo(2 / (96 * 0.36), 6)
    const expected = (2 / v.cell) * (1 / v.cell) * (1 / v.cell)
    expect(v.count / expected).toBeGreaterThan(0.85)
    expect(v.count / expected).toBeLessThan(1.15)
    // The first solid column sits at the nose position.
    let first = 96
    for (let i = 0; i < v.solid.length; i++) if (v.solid[i]) first = Math.min(first, i % 96)
    expect(first).toBe(Math.round(96 * 0.2))
    // Centred across: the solid cells balance either side of the middle.
    let left = 0
    let right = 0
    for (let i = 0; i < v.solid.length; i++) {
      if (!v.solid[i]) continue
      if (Math.floor(i / 96) % 48 < 24) left++
      else right++
    }
    expect(left).toBe(right)
  })

  it('a sphere fills about its volume, and shows about its disc to the flow', () => {
    const v = voxelize([sphere(0.5)], size)
    const r = 0.5 / v.cell
    expect(v.count / ((4 / 3) * Math.PI * r ** 3)).toBeGreaterThan(0.9)
    expect(v.count / ((4 / 3) * Math.PI * r ** 3)).toBeLessThan(1.1)
    expect(frontalCells(v) / (Math.PI * r * r)).toBeGreaterThan(0.9)
    expect(frontalCells(v) / (Math.PI * r * r)).toBeLessThan(1.1)
  })

  it('overlapping parts add up instead of cancelling', () => {
    const one = voxelize([box(0, 0, 0, 2, 1, 1)], size)
    const both = voxelize([box(0, 0, 0, 2, 1, 1), box(0.5, 0.25, 0.25, 1.5, 0.75, 0.75)], size)
    expect(both.count).toBe(one.count)
  })

  it('fills a body lofted along the flow with an open end, and draws a thin sheet as a one-cell plate', () => {
    const closed = voxelize([box(0, 0, 0, 2, 1, 1)], size)
    // The downstream face left off: rays along x slip through, but y and z still see it.
    const open = voxelize([box(0, 0, 0, 2, 1, 1).slice(0, 9 * 10)], size)
    expect(open.count).toBe(closed.count)
    // A flat square sheet across the flow (like a disc wheel side-on): a plate one cell thick.
    const sheet = Float32Array.from([0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1])
    const plate = voxelize([sheet, box(0.5, 0, 0, 2, 1, 1)], size)
    const body = voxelize([box(0.5, 0, 0, 2, 1, 1), Float32Array.from([0, 0, 0, 0, 1, 0, 0, 1, 1])], size)
    const side = Math.round(1 / plate.cell)
    expect(plate.count - body.count).toBeGreaterThan(side * side * 0.4)
    expect(voxelize([], size).count).toBe(0)
  })
})
