import { describe, expect, it } from 'vitest'
import { OLD_POD, POD_BUFFET, POD_CLASS, POD_RANGE, STOCK_POD, type PodDesign } from '../src/data/pod'
import { hoursOnStation, patrolDrag, podBuffet, podDrag, podLengths, podMass } from '../src/sim/pod'

const STOCK = STOCK_POD.patrol
const OLD = OLD_POD.patrol
/** A well-shaped pod: fine nose, long tail, a fair gap, a little forward. */
const GOOD: PodDesign = { ...STOCK, nose: 0.85, tail: 0.95, gap: 0.46, at: 0.3 }
const old = () => hoursOnStation(OLD, { sensor: 'old' })

describe('the patrol plane’s sensor pod (PR 10y)', () => {
  it('flies the ministry’s plane some 9½ hours on station; the new sensor in the old shape loses over half an hour, a well-shaped pod beats the old one', () => {
    expect(old()).toBeGreaterThan(9)
    expect(old()).toBeLessThan(10)
    expect(old() - hoursOnStation(STOCK)).toBeGreaterThan(0.5)
    expect(hoursOnStation(GOOD)).toBeGreaterThan(old())
    // Every stock value is in its slider's range.
    const r = POD_RANGE.patrol
    expect(STOCK.gap).toBeGreaterThanOrEqual(r.gap.min)
    expect(GOOD.gap).toBeLessThanOrEqual(r.gap.max)
  })

  it('is the patrol leg’s fuel over the power at patrol speed, the same on every run', () => {
    const c = POD_CLASS.patrol
    const h = hoursOnStation(GOOD)
    expect((h * 3600 * patrolDrag(GOOD) * c.patrol) / (c.fuel * c.fuelEnergy * c.efficiency)).toBeCloseTo(1, 9)
    expect(hoursOnStation(GOOD)).toBe(h)
  })

  it('drags more under the wing than on its own, most with a tight gap; a pod tested alone can’t tell a gap from another', () => {
    const tight = { ...GOOD, gap: 0.1 }
    expect(podDrag(GOOD).installed).toBeGreaterThan(podDrag(GOOD).alone)
    expect(podDrag(tight).interference).toBeGreaterThan(podDrag(GOOD).interference * 3)
    expect(podDrag(tight).alone).toBeCloseTo(podDrag(GOOD).alone, 9)
    // The alone reading says the tight pod is as good as the well-hung one; on the wing it's worse than the old pod.
    expect(hoursOnStation(tight, { alone: true })).toBeGreaterThanOrEqual(hoursOnStation(GOOD, { alone: true }) - 0.05)
    expect(hoursOnStation(tight)).toBeLessThan(old())
    // Too far out, the pylon's own drag and weight cost again: the best gap is in between.
    expect(hoursOnStation({ ...GOOD, gap: 0.6 })).toBeLessThan(hoursOnStation(GOOD))
    // Hung forward eases the interference; too far forward the trim costs.
    expect(hoursOnStation({ ...GOOD, at: -1 })).toBeLessThan(hoursOnStation(GOOD))
    expect(hoursOnStation({ ...GOOD, at: 1 })).toBeLessThan(hoursOnStation(GOOD))
  })

  it('finer fairings are longer and heavier, and the last of the length buys little', () => {
    expect(podLengths({ ...GOOD, nose: 1 }).total).toBeGreaterThan(podLengths(GOOD).total)
    expect(podMass({ ...GOOD, tail: 1 })).toBeGreaterThan(podMass(GOOD))
    const step = (nose: number) => hoursOnStation({ ...GOOD, nose: nose + 0.1 }) - hoursOnStation({ ...GOOD, nose })
    expect(step(0)).toBeGreaterThan(step(0.85) * 3)
  })
})

describe('the pod’s buffet on a sensor run', () => {
  it('blurs the picture with the old shape round the new sensor, but not round the old one', () => {
    const b = podBuffet(STOCK)
    expect(b.blurs).toBe(true)
    expect(b.index).toBeGreaterThan(POD_BUFFET.limit)
    expect(b.cause).toBe('tail')
    expect(podBuffet(OLD, 'old').blurs).toBe(false)
    expect(podBuffet(GOOD).blurs).toBe(false)
  })

  it('names the gap when the pod hangs too close to the wing, and the tail when it’s cut off', () => {
    const close = podBuffet({ ...GOOD, gap: 0.1, tail: 0.8 })
    expect(close.cause).toBe('gap')
    expect(podBuffet({ ...GOOD, gap: 0.1 })).toMatchObject({ cause: 'gap', blurs: true })
    expect(podBuffet({ ...GOOD, tail: 0 })).toMatchObject({ cause: 'tail', blurs: true })
    // Clear of the wing and finely tapered, nothing shakes.
    expect(podBuffet({ ...GOOD, gap: 0.5, tail: 1 }).index).toBe(0)
  })
})
