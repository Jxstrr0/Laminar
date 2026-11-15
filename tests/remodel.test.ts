import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST, SIT_UP_CYCLIST, type CyclistDesign } from '../src/data/cyclist'
import { MODEL_SHOP } from '../src/data/model'
import { partChanges, postureChanged, swapCost, swapParts } from '../src/sim/remodel'

const clone = (d: CyclistDesign) => structuredClone(d)

describe('keeping the model in step with the design', () => {
  it('sees no change in the same design', () => {
    expect(partChanges(DEFAULT_CYCLIST, clone(DEFAULT_CYCLIST))).toEqual([])
    expect(postureChanged(DEFAULT_CYCLIST, clone(DEFAULT_CYCLIST))).toBe(false)
  })

  it('names each swapped part, and a helmet tweak counts as the helmet', () => {
    const bench = clone(DEFAULT_CYCLIST)
    bench.helmet.tail = 0.6
    bench.wheels.rear = 'disc'
    bench.suit.armTrips = true
    expect(partChanges(DEFAULT_CYCLIST, bench)).toEqual(['helmet', 'suit', 'rearWheel'])
    expect(postureChanged(DEFAULT_CYCLIST, bench)).toBe(false)
    expect(swapCost(partChanges(DEFAULT_CYCLIST, bench))).toBe(3 * MODEL_SHOP.partSwap)
  })

  it('swaps the parts but keeps the old position', () => {
    const swapped = swapParts(DEFAULT_CYCLIST, SIT_UP_CYCLIST)
    expect(swapped.posture).toEqual(DEFAULT_CYCLIST.posture)
    expect(swapped.helmet).toEqual(SIT_UP_CYCLIST.helmet)
    expect(swapped.bars).toBe(SIT_UP_CYCLIST.bars)
    expect(partChanges(swapped, SIT_UP_CYCLIST)).toEqual([])
    expect(postureChanged(swapped, SIT_UP_CYCLIST)).toBe(true)
    // A copy, not a shared object.
    expect(swapped.helmet).not.toBe(SIT_UP_CYCLIST.helmet)
  })
})
