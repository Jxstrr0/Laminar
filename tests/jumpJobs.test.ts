import { afterEach, describe, expect, it } from 'vitest'
import { BRIEFS, JUMP_JOBS, PROMISE } from '../src/data/briefs'
import { DEFAULT_JUMPER, type JumperDesign } from '../src/data/jumper'
import { boardFor, briefTemplate, deliver, deliverJump, isJumpBrief, jumpEventOf, newCareer, openTo, type CareerState } from '../src/sim/career'
import { referenceJump } from '../src/sim/jumper'
import { reputationOf } from '../src/sim/reputation'

const jumper = (leanDeg: number, vAngleDeg: number, bagginess: number): JumperDesign => ({ sport: 'skijump', posture: { leanDeg, vAngleDeg }, suit: { bagginess } })

/** A career on a ski-jump job, as if the brief had been won at its suggested fee. */
function onJob(id: string, promise: number): CareerState {
  const b = briefTemplate(id)!
  return { ...newCareer(5), job: { brief: { id, fee: 50000, days: b.days, seed: 7 }, promise, startDay: 0, daysLeft: b.days, spent: 0 } }
}

describe('ski-jump briefs', () => {
  afterEach(() => {
    JUMP_JOBS.open = false
  })

  it('are jumps on a hill, each setup a jumper', () => {
    const jumps = BRIEFS.filter((b) => b.event.jump)
    expect(jumps.length).toBeGreaterThanOrEqual(2)
    for (const b of jumps) {
      expect(isJumpBrief(b.id)).toBe(true)
      expect(b.setup.sport).toBe('skijump')
      const ev = jumpEventOf(b)!
      expect(ev.hill.id).toBe(b.event.jump!.hill)
      expect(ev.headwind).toBe(b.event.windSpeed)
      // The ask is reachable: some design gains it with the floor held.
      const base = referenceJump(b.setup as JumperDesign, ev).distance
      const best = [DEFAULT_JUMPER, jumper(10, 38, 0.4), jumper(8, 40, 0.45)]
        .map((d) => referenceJump(d, ev))
        .filter((r) => r.stable)
        .reduce((m, r) => Math.max(m, r.distance), 0)
      expect(best - base).toBeGreaterThan(b.target)
    }
    expect(isJumpBrief('selivan-regional')).toBe(false)
    expect(jumpEventOf({ id: 'selivan-regional' })).toBeNull()
  })

  it('stay off the board until the board can show them', () => {
    const jump = BRIEFS.find((b) => b.event.jump)!
    expect(openTo(jump, 100)).toBe(false)
    for (let round = 1; round < 20; round++) expect(boardFor(5, round, false, 100).some((b) => isJumpBrief(b.id))).toBe(false)
    JUMP_JOBS.open = true
    expect(openTo(jump, 100)).toBe(true)
    expect(openTo(jump, 0)).toBe(false)
  })
})

describe('delivering a jumper', () => {
  const id = 'zorin-junior'
  const ev = () => jumpEventOf({ id })!
  const setup = () => briefTemplate(id)!.setup as JumperDesign

  it('pays in full when the reference jump gains what was promised', () => {
    const state = onJob(id, 6)
    const truth = referenceJump(DEFAULT_JUMPER, ev()).distance
    const d = deliverJump(state, DEFAULT_JUMPER, truth)!
    expect(d.debrief.achieved).toBeCloseTo(truth - referenceJump(setup(), ev()).distance, 9)
    expect(d.debrief.met).toBe(true)
    expect(d.debrief.penalty).toBe(0)
    expect(d.paid).toBe(50000)
    expect(d.debrief.read).toBe('good')
    expect(d.state.job).toBeNull()
    expect(d.state.day).toBe(state.day + state.job!.daysLeft)
    expect(d.state.history.at(-1)).toMatchObject({ id, promised: 6, predicted: truth, actual: truth })
    expect(d.debrief.reputation.after).toBe(reputationOf(d.state.history, d.state.broke))
    // The day is the show: both jumps flown in the same air.
    expect(d.debrief.day.temperature).toBe(d.debrief.baselineDay.temperature)
    expect(d.debrief.day.distance).toBeGreaterThan(d.debrief.baselineDay.distance)
  })

  it('takes a slice off for each metre short, and reads a wrong forecast as poor', () => {
    const d = deliverJump(onJob(id, 30), setup(), 120)!
    expect(d.debrief.achieved).toBe(0)
    expect(d.debrief.met).toBe(false)
    expect(d.debrief.cause).toBe('design')
    expect(d.debrief.shortfall).toBeCloseTo(30 - PROMISE.allowance, 9)
    expect(d.debrief.penalty).toBe(25000)
    expect(d.debrief.read).toBe('poor')
  })

  it('counts no gain under the stability floor', () => {
    const wild = jumper(12, 34, 1)
    const ref = referenceJump(wild, ev())
    expect(ref.stable).toBe(false)
    expect(ref.distance).toBeGreaterThan(referenceJump(setup(), ev()).distance + 6)
    const d = deliverJump(onJob(id, 6), wild, ref.distance)!
    expect(d.debrief.achieved).toBe(0)
    expect(d.debrief.cause).toBe('pitch')
    expect(d.debrief.met).toBe(false)
  })

  it('needs a ski-jump job', () => {
    expect(deliverJump(newCareer(5), DEFAULT_JUMPER, 90)).toBeNull()
    const cycling = { ...newCareer(5), job: { brief: { id: 'selivan-regional', fee: 50000, days: 20, seed: 7 }, promise: 3, startDay: 0, daysLeft: 20, spent: 0 } }
    expect(deliverJump(cycling, DEFAULT_JUMPER, 90)).toBeNull()
    // The CdA delivery still works as before.
    expect(deliver(cycling, briefTemplate('selivan-regional')!.setup, 0.25)).not.toBeNull()
  })
})
