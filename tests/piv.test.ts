import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { DEFAULT_JUMPER } from '../src/data/jumper'
import { STOCK_POD } from '../src/data/pod'
import { DEFAULT_TRUCK } from '../src/data/truck'
import { STOCK_AIRCRAFT } from '../src/data/aircraft'
import type { Flow } from '../src/sim/aero/flow'
import type { Design } from '../src/sim/design'
import { riderFlowField } from '../src/sim/flow/field'
import { pivReading } from '../src/sim/flow/piv'
import { pivDragArea, pivHint } from '../src/sim/pivHint'

const FLOW: Flow = { density: 1.2, viscosity: 1.8e-5, speed: 20, turbulence: 0.005 }
const POD = STOCK_POD.patrol
const read = (d: Design, yaw = 0) => pivReading(riderFlowField(d, FLOW, yaw), pivDragArea(d) ?? 0, { skipWing: d === POD || (d as { sport?: string }).sport === 'pod' })

describe('PIV reading (PR 10ag)', () => {
  it('gives the same reading for the same design', () => {
    const a = read(DEFAULT_CYCLIST)
    const b = read(DEFAULT_CYCLIST)
    expect(a.loss).toBe(b.loss)
    expect(a.sheet.values).toEqual(b.sheet.values)
  })

  it('shows still air inside the model, free stream ahead and a slower wake behind', () => {
    const r = read(DEFAULT_CYCLIST)
    const { cols, rows, values } = r.sheet
    expect(values.length).toBe(cols * rows)
    expect(values.some(Number.isNaN)).toBe(true)
    // Top corner ahead of the nose (row 0 is the lowest): clear of the rider.
    const ahead = values[(rows - 1) * cols] as number
    expect(ahead).toBeGreaterThan(0.9)
    // The slowest air behind the rider is slower than anything ahead.
    let behind = Infinity
    for (let r2 = 0; r2 < rows; r2++) {
      const v = values[r2 * cols + cols - Math.floor(cols / 3)] as number
      if (!Number.isNaN(v)) behind = Math.min(behind, v)
    }
    expect(behind).toBeLessThan(ahead)
  })

  it('loses more speed in the wake the more drag the tunnel measured', () => {
    const field = riderFlowField(DEFAULT_CYCLIST, FLOW, 0)
    const low = pivReading(field, 0.15).loss
    const high = pivReading(field, 0.3).loss
    expect(high).toBeGreaterThan(low)
    expect(low).toBeGreaterThan(0)
  })

  it('reads a finer pod tail as a smaller speed loss, and still some wake at the finest', () => {
    const blunt = read({ ...POD, tail: 0 })
    const fine = read({ ...POD, tail: 1 })
    expect(fine.loss).toBeLessThan(blunt.loss)
    expect(fine.loss).toBeGreaterThan(0.01)
  })

  it('works with the model yawed on the turntable', () => {
    const r = read(DEFAULT_CYCLIST, 10)
    expect(r.loss).toBeGreaterThan(0)
    expect(r.sheet.values.some((v) => !Number.isNaN(v))).toBe(true)
  })

  it('leaves the wing out of a sensor pod but keeps a kit plane’s', () => {
    const plane = STOCK_AIRCRAFT.kit
    const field = riderFlowField(plane, FLOW, 0)
    const area = pivDragArea(plane) ?? 0
    const whole = pivReading(field, area)
    const cut = pivReading(field, area, { skipWing: true })
    // Without the wing the slice is narrower, so the same drag is a bigger loss.
    expect(cut.cross.du).toBeLessThan(whole.cross.du)
    expect(cut.loss).toBeGreaterThan(whole.loss)
  })
})

describe('PIV hint (PR 10ag)', () => {
  it('names the pod’s tail when it is blunt, and the gap once the tail is fine and the pod hangs close', () => {
    expect(pivHint({ ...POD, tail: 0 })?.control).toBe('senTail')
    expect(pivHint({ ...POD, tail: 1, gap: 0.1 })?.control).toBe('senGap')
  })

  it('names a slider of the design’s own sport, with a share of the drag', () => {
    const cases: [Design, readonly string[]][] = [
      [DEFAULT_CYCLIST, ['torsoDeg', 'headDrop', 'armWidth', 'handReach', 'handHeight', 'tail']],
      [DEFAULT_TRUCK, ['cabNose', 'fairing', 'extenders', 'gapLength', 'gapFill', 'skirts', 'boatTail', 'tailAngle']],
      [STOCK_AIRCRAFT.kit, ['acCowling', 'spats', 'wingtips', 'strutFairing', 'strutToe', 'acPodFairing', 'acPodAt']],
    ]
    for (const [design, allowed] of cases) {
      const h = pivHint(design)
      expect(h).not.toBeNull()
      expect(allowed).toContain(h!.control)
      expect(h!.gain).toBeGreaterThan(0)
      expect(h!.gain).toBeLessThan(1)
    }
  })

  it('only ever names a jumper’s suit (the jump lives on lift too)', () => {
    const h = pivHint(DEFAULT_JUMPER)
    if (h) expect(h.control).toBe('bagginess')
  })

  it('moves on once a slider is already at its best', () => {
    const first = pivHint({ ...POD, tail: 0 })!
    expect(first.control).toBe('senTail')
    const next = pivHint({ ...POD, tail: 1 })
    expect(next?.control).not.toBe('senTail')
  })
})
