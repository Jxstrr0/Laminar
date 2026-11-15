import { describe, expect, it } from 'vitest'
import { RUN_RECORDING, TUNNEL_BILLING } from '../src/data/tunnel'
import { addSample, fanPower, newRecorder, runCost, stepRecorder, type Recorder, type Run } from '../src/sim/run'

const DT = 1 / 60

/** Hold the air at `speed` for `seconds`, collecting a sample whenever one is due. */
function hold(rec: Recorder, speed: number, seconds: number): { rec: Recorder; finished: Run | null } {
  let finished: Run | null = null
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const s = stepRecorder(rec, speed, DT, 'test')
    rec = s.recorder
    if (s.sampleDue) rec = addSample(rec, { speed, yawDeg: 0, cdA: 0.23, cyA: 0, dragN: 1, steady: true })
    if (s.finished) finished = s.finished
  }
  return { rec, finished }
}

describe('tunnel runs', () => {
  it('starts at fan-up and ends at fan-down, numbering runs', () => {
    let rec = newRecorder()
    rec = hold(rec, 0.2, 1).rec
    expect(rec.run).toBeNull()
    rec = hold(rec, 20, 10).rec
    expect(rec.run?.id).toBe(1)
    const end = hold(rec, 0, DT)
    expect(end.rec.run).toBeNull()
    expect(end.finished?.id).toBe(1)
    expect(end.finished?.topSpeed).toBe(20)
    expect(end.finished?.duration).toBeCloseTo(10, 6)
    const again = hold(end.rec, 10, 1)
    expect(again.rec.run?.id).toBe(2)
  })

  it('samples the balance on a fixed beat', () => {
    const { rec } = hold(newRecorder(), 20, 10)
    const n = rec.run!.samples.length
    expect(n).toBeGreaterThanOrEqual(Math.floor(10 / RUN_RECORDING.sampleEvery))
    expect(n).toBeLessThanOrEqual(Math.ceil(10 / RUN_RECORDING.sampleEvery) + 1)
    expect(rec.run!.samples[1]!.t - rec.run!.samples[0]!.t).toBeCloseTo(RUN_RECORDING.sampleEvery, 6)
  })

  it('bills the cube of speed: top speed is what costs', () => {
    expect(fanPower(40) / fanPower(20)).toBeCloseTo(8, 9)
    const slow = hold(newRecorder(), 20, 60).rec.run!
    const fast = hold(newRecorder(), 40, 60).rec.run!
    expect(fast.energyKWh / slow.energyKWh).toBeCloseTo(8, 6)
    expect(runCost(fast) - TUNNEL_BILLING.perRun).toBeCloseTo((runCost(slow) - TUNNEL_BILLING.perRun) * 8, 6)
  })

  it('a minute at top speed costs a few thousand rubles, a short slow run little more than the fee', () => {
    const top = runCost(hold(newRecorder(), 40, 60).rec.run!)
    expect(top).toBeGreaterThan(1500)
    expect(top).toBeLessThan(5000)
    const gentle = runCost(hold(newRecorder(), 10, 30).rec.run!)
    expect(gentle).toBeLessThan(TUNNEL_BILLING.perRun * 1.1)
  })

  it('records the same run the same way every time', () => {
    expect(hold(newRecorder(), 25, 5).rec).toEqual(hold(newRecorder(), 25, 5).rec)
  })
})
