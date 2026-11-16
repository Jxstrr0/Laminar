import { describe, expect, it } from 'vitest'
import { POD_REPLAY as R } from '../src/data/replay'
import { STOCK_POD, TEST_RANGES, type PodDesign } from '../src/data/pod'
import { podFlight, usualRangeDay } from '../src/sim/podJob'
import { podClocks, podNotes, podShow, steppe } from '../src/sim/podReplay'

const range = TEST_RANGES.stepnoy
const GOOD: PodDesign = { ...STOCK_POD.patrol, nose: 0.9, tail: 0.9, gap: 0.5, at: 0.2 }
const fly = (d: PodDesign) => podFlight(d, range, usualRangeDay(range))

describe('range day from the sensor (PR 10af)', () => {
  it('runs both clocks at one rate, the longer patrol filling the clock time, and ends each at its hours', () => {
    const show = podShow(fly(GOOD), fly(STOCK_POD.patrol))
    expect(show.rejected).toBe(false)
    expect(show.blur).toBe(0)
    expect(Math.max(show.mineEnd, show.oldEnd)).toBeCloseTo(R.clockSeconds, 9)
    expect(show.mineHours).toBeCloseTo(fly(GOOD).hours, 9)
    expect(podClocks(show, 1e3)).toEqual({ mine: show.mineHours, old: show.oldHours })
    const half = podClocks(show, show.oldEnd / 2)
    expect(half.mine).toBeCloseTo(half.old, 9)
    expect(podNotes(show).map((n) => n.kind)).toEqual(['start', 'buffet', 'done', 'done'])
  })

  it('a pod past the buffet limit shakes, blurs, and is called off part-way', () => {
    const tight = fly({ ...GOOD, gap: 0.1 })
    const show = podShow(tight, fly(STOCK_POD.patrol))
    expect(show.rejected).toBe(true)
    expect(show.blur).toBeGreaterThan(R.blurBase)
    expect(show.shake).toBeGreaterThan(podShow(fly(GOOD), fly(GOOD)).shake)
    expect(show.mineEnd).toBe(R.rejectAt)
    expect(show.mineHours).toBeLessThan(tight.hours)
    expect(podNotes(show).map((n) => n.kind)).toEqual(['start', 'buffet', 'rejected', 'done'])
  })

  it('lays the steppe out from the seed', () => {
    expect(steppe(7)).toEqual(steppe(7))
    expect(steppe(7)).not.toEqual(steppe(8))
    expect(steppe(7).fields).toHaveLength(R.fields)
  })
})
