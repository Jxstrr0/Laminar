import { afterEach, describe, expect, it } from 'vitest'
import { BRIEFS, JUMP_JOBS, PROMISE } from '../src/data/briefs'
import { DEFAULT_JUMPER, type JumperDesign } from '../src/data/jumper'
import { boardFor, briefTemplate, currentJumpEvent, deliver, deliverJump, isJumpBrief, jumpEventOf, newCareer, openTo, type CareerState } from '../src/sim/career'
import { PRACTICE_JUMP } from '../src/data/hills'
import { legacyOf } from '../src/sim/legacy'
import { jumpDay, referenceJump } from '../src/sim/jumper'
import { reputationOf } from '../src/sim/reputation'

const jumper = (leanDeg: number, vAngleDeg: number, bagginess: number): JumperDesign => ({ sport: 'skijump', posture: { leanDeg, vAngleDeg }, suit: { bagginess } })

/** A career on a ski-jump job, as if the brief had been won at its suggested fee. */
function onJob(id: string, promise: number): CareerState {
  const b = briefTemplate(id)!
  return { ...newCareer(5), job: { brief: { id, fee: 50000, days: b.days, seed: 7 }, promise, startDay: 0, daysLeft: b.days, spent: 0 } }
}

describe('ski-jump briefs', () => {
  afterEach(() => {
    JUMP_JOBS.open = true
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
      // The longest stable jump over a coarse sweep of the design.
      let best = 0
      for (let lean = 6; lean <= 26; lean += 4)
        for (let v = 20; v <= 45; v += 5)
          for (let bag = 0; bag <= 0.6; bag += 0.2) {
            const r = referenceJump(jumper(lean, v, bag), ev)
            if (r.stable) best = Math.max(best, r.distance)
          }
      expect(best - base).toBeGreaterThan(b.target)
    }
    expect(isJumpBrief('selivan-regional')).toBe(false)
    expect(jumpEventOf({ id: 'selivan-regional' })).toBeNull()
  })

  it('join the board once the firm is known enough, and the switch can take them off', () => {
    const jump = BRIEFS.find((b) => b.event.jump)!
    expect(openTo(jump, 100)).toBe(true)
    expect(openTo(jump, 0)).toBe(false)
    let seen = false
    for (let round = 1; round < 40; round++) seen ||= boardFor(5, round, false, 100).some((b) => isJumpBrief(b.id))
    expect(seen).toBe(true)
    JUMP_JOBS.open = false
    expect(openTo(jump, 100)).toBe(false)
    for (let round = 1; round < 20; round++) expect(boardFor(5, round, false, 100).some((b) => isJumpBrief(b.id))).toBe(false)
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

describe('the cap at HS (Kelbo, 16 November 2026)', () => {
  // The best stable jumper on the large hill flies past HS 134.
  const long = jumper(6, 40, 0.2)
  const id = 'kuzmenko-large'
  const ev = () => jumpEventOf({ id })!

  it('counts no metres past the hill size', () => {
    const r = referenceJump(long, ev())
    expect(r.stable).toBe(true)
    expect(r.pastHs).toBe(true)
    expect(r.distance).toBeGreaterThan(ev().hill.hs)
    expect(r.counted).toBe(ev().hill.hs)
    const short = referenceJump(DEFAULT_JUMPER, jumpEventOf({ id: 'zorin-junior' })!)
    expect(short.pastHs).toBe(false)
    expect(short.counted).toBe(short.distance)
  })

  it('bails out at HS on the day, safely and without blame', () => {
    const event = { ...ev(), spread: { temperature: 0, wind: 0, speed: 0 } }
    const day = jumpDay(long, event, 3)
    expect(day.distance).toBe(event.hill.hs)
    expect(day.trouble).toBe('long')
  })

  it('pays on the counted distance, and the forecast is judged against it', () => {
    const base = referenceJump(briefTemplate(id)!.setup as JumperDesign, ev())
    expect(base.stable).toBe(true)
    expect(base.pastHs).toBe(false)
    const d = deliverJump(onJob(id, 8), long, ev().hill.hs)!
    expect(d.debrief.achieved).toBeCloseTo(ev().hill.hs - base.distance, 9)
    expect(d.debrief.actual).toBe(ev().hill.hs)
    expect(d.debrief.readError).toBe(0)
    expect(d.debrief.met).toBe(true)
    // Heading past HS is the jumper's call, not a fault the report blames on the suit.
    if (d.debrief.day.trouble === 'long') expect(d.debrief.trouble).toBeNull()
  })

  it('opens the large hill only to a well-known lab', () => {
    const b = BRIEFS.find((x) => x.id === id)!
    expect(openTo(b, 30)).toBe(false)
    expect(openTo(b, 60)).toBe(true)
  })
})

describe('jump jobs around the career', () => {
  it('builds the jumper for the job’s hill, or the practice jump between jobs', () => {
    expect(currentJumpEvent(newCareer(5))).toBe(PRACTICE_JUMP)
    expect(currentJumpEvent(onJob('kuzmenko-large', 8)).hill.id).toBe('large')
    expect(currentJumpEvent(onJob('zorin-junior', 6))).toEqual(jumpEventOf({ id: 'zorin-junior' }))
  })

  it('tells metres from a cut in the legacy’s best job', () => {
    const d = deliverJump(onJob('zorin-junior', 6), DEFAULT_JUMPER, 90)!
    const jumpOnly = legacyOf(d.state).best!
    expect(jumpOnly.unit).toBe('m')
    expect(jumpOnly.cut).toBeCloseTo(d.debrief.achieved, 9)
    // A cut in %, however small, is the best job once there is one: the two can't be weighed.
    const cut = { id: 'selivan-regional', day: 1, fee: 1, paid: 1, promised: 1, achieved: 0.5, predicted: 0.25, actual: 0.25 }
    const both = legacyOf({ ...d.state, history: [...d.state.history, cut] }).best!
    expect(both.unit).toBe('pct')
    expect(both.cut).toBe(0.5)
  })
})
