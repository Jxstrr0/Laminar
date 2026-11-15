import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { CP_PALETTE, TAPS } from '../src/data/flowViz'
import { MODEL_SHOP, STANDARD_ORDER } from '../src/data/model'
import { riderFlowField } from '../src/sim/flow/field'
import { readTaps, soften, tapExtremes, tapLayout } from '../src/sim/flow/taps'
import { modelSpecOf, quote } from '../src/sim/modelShop'
import { Rng } from '../src/sim/rng'
import { eventFlow, REFERENCE_TT } from '../src/sim/views'

const field = riderFlowField(DEFAULT_CYCLIST, eventFlow(REFERENCE_TT), 0)
const taps = tapLayout(field)

describe('pressure taps', () => {
  it('cover the rider’s parts with a coarse lattice', () => {
    expect(taps.length).toBeGreaterThan(60)
    expect(taps.length).toBeLessThan(800)
    const parts = new Set(taps.map((t) => t.bodyId))
    expect(parts.has('helmet')).toBe(true)
    expect(parts.has('torso')).toBe(true)
  })

  it('read stagnation pressure on the front of the helmet and suction round its sides', () => {
    const cps = readTaps(field, taps, new Rng(1))
    const helmet = taps.map((t, i) => ({ t, cp: cps[i]! })).filter((x) => x.t.bodyId === 'helmet')
    const d = field.downstream
    const front = helmet.filter((x) => x.t.normal.x * d.x + x.t.normal.y * d.y + x.t.normal.z * d.z < -0.8)
    const side = helmet.filter((x) => Math.abs(x.t.normal.z) > 0.8)
    expect(front.length).toBeGreaterThan(0)
    expect(side.length).toBeGreaterThan(0)
    const mean = (xs: { cp: number }[]) => xs.reduce((a, x) => a + x.cp, 0) / xs.length
    expect(mean(front)).toBeGreaterThan(0.3)
    expect(mean(side)).toBeLessThan(0)
  })

  it('give the same scan for the same seed, and scatter by about the scanner’s noise', () => {
    const a = readTaps(field, taps, new Rng(4))
    expect(readTaps(field, taps, new Rng(4))).toEqual(a)
    const b = readTaps(field, taps, new Rng(5))
    const diffs = a.map((v, i) => v - b[i]!)
    const rms = Math.sqrt(diffs.reduce((s, d) => s + d * d, 0) / diffs.length)
    // Two independent scans differ by √2 × the scatter.
    expect(rms / (Math.SQRT2 * TAPS.noise)).toBeGreaterThan(0.8)
    expect(rms / (Math.SQRT2 * TAPS.noise)).toBeLessThan(1.2)
  })

  it('name the strongest suction and the highest pressure', () => {
    const cps = readTaps(field, taps, new Rng(1))
    const x = tapExtremes(taps, cps)!
    expect(x.suction.cp).toBe(Math.min(...cps))
    expect(x.pressure.cp).toBe(Math.max(...cps))
    expect(x.pressure.cp).toBeGreaterThan(0.8)
    expect(x.suction.cp).toBeLessThan(-0.5)
    expect(x.suction.cp).toBeGreaterThan(TAPS.floor - 5 * TAPS.noise)
    expect(tapExtremes([], [])).toBeNull()
  })

  it('ease off runaway suction smoothly, keeping the readings in order', () => {
    expect(soften(-0.5)).toBe(-0.5)
    expect(soften(TAPS.knee)).toBeCloseTo(TAPS.knee, 12)
    expect(soften(-3)).toBeLessThan(soften(-2))
    expect(soften(-1e6)).toBeGreaterThan(TAPS.floor)
  })

  it('cost extra at the shop and leave the model’s build alone', () => {
    const plain = quote(STANDARD_ORDER)
    const tapped = quote({ ...STANDARD_ORDER, taps: true })
    expect(tapped.price - plain.price).toBe(MODEL_SHOP.taps.price)
    expect(tapped.days - plain.days).toBe(MODEL_SHOP.taps.days)
    expect(modelSpecOf({ ...STANDARD_ORDER, taps: true }, 3)).toEqual(modelSpecOf(STANDARD_ORDER, 3))
  })

  it('map onto a palette that spans the readings, with ticks inside it', () => {
    expect(CP_PALETTE.min).toBeLessThan(0)
    expect(CP_PALETTE.max).toBeGreaterThan(0)
    for (const tick of CP_PALETTE.ticks) {
      expect(tick).toBeGreaterThanOrEqual(CP_PALETTE.min)
      expect(tick).toBeLessThanOrEqual(CP_PALETTE.max)
    }
  })
})
