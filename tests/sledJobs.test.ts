import { afterEach, describe, expect, it } from 'vitest'
import { BRIEFS, PROMISE, SLED_JOBS } from '../src/data/briefs'
import { CLUB_BOBSLED, DEFAULT_BOBSLED, type BobsledDesign } from '../src/data/bobsled'
import { TRACKS } from '../src/data/tracks'
import { referenceConditions, referenceRun, runWith } from '../src/sim/bobsled'
import {
  boardFor,
  briefTemplate,
  clampBid,
  currentSledEvent,
  daySeed,
  deliverSled,
  isSledBrief,
  newCareer,
  openTo,
  sledEventOf,
  type CareerState,
} from '../src/sim/career'
import { cdAForTime, PRACTICE_RUN, raceConditions } from '../src/sim/sledJob'

const track = TRACKS.belogor
const sledBriefs = BRIEFS.filter((b) => b.event.sled)

/** A career with this sled job in hand. */
function onJob(id: string, promise: number, fee = 60000): CareerState {
  const b = briefTemplate(id)!
  return { ...newCareer(3), job: { brief: { id, fee, days: b.days, seed: 41 }, promise, startDay: 0, daysLeft: b.days, spent: 0 } }
}

afterEach(() => {
  SLED_JOBS.open = false
})

describe('bobsled briefs', () => {
  it('are a two-man club job, a two-man championship and a four-man one later', () => {
    expect(sledBriefs.map((b) => b.id)).toEqual(['kostrov-club', 'kedrova-two', 'gromov-four'])
    for (const b of sledBriefs) {
      expect(isSledBrief(b.id)).toBe(true)
      const e = sledEventOf(b)!
      expect(e.crew).toBe(b.setup.sport === 'bobsled' ? b.setup.crew : 0)
      expect(e.track).toBe(track)
    }
    expect(sledEventOf(briefTemplate('gromov-four')!)!.crew).toBe(4)
    expect(briefTemplate('gromov-four')!.minRep).toBeGreaterThan(briefTemplate('kedrova-two')!.minRep!)
    expect(isSledBrief('zorin-junior')).toBe(false)
  })

  it('stay off the board until the screens can show them', () => {
    for (const b of sledBriefs) expect(openTo(b, 100)).toBe(false)
    for (let round = 0; round < 30; round++) expect(boardFor(1, round, false, 100).some((b) => isSledBrief(b.id))).toBe(false)
    SLED_JOBS.open = true
    expect(openTo(briefTemplate('kostrov-club')!, 20)).toBe(true)
    expect(openTo(briefTemplate('gromov-four')!, 20)).toBe(false)
    expect(openTo(briefTemplate('gromov-four')!, 50)).toBe(true)
  })

  it('ask for a gain the desk can see from the old sled', () => {
    for (const b of sledBriefs) {
      const setup = b.setup as BobsledDesign
      const good = { ...DEFAULT_BOBSLED, crew: setup.crew }
      const gain = (referenceRun(setup, track).time - referenceRun(good, track).time) / SLED_JOBS.pointSeconds
      expect(gain).toBeGreaterThan(b.target)
    }
  })

  it('take bids in hundredths of a second', () => {
    expect(clampBid('kostrov-club', { price: 60000, promise: 12.34 }).promise).toBe(12.3)
    expect(clampBid('zorin-junior', { price: 50000, promise: 6.3 }).promise).toBe(6.5)
  })

  it('race Belogor between jobs', () => {
    expect(currentSledEvent(newCareer(1))).toBe(PRACTICE_RUN)
    expect(currentSledEvent(onJob('gromov-four', 6)).crew).toBe(4)
  })
})

describe('race day for a sled', () => {
  it('turns a run time back into the drag that gives it', () => {
    const day = referenceConditions(DEFAULT_BOBSLED)
    for (const cdA of [0.15, 0.2, 0.3]) {
      const time = runWith(cdA, DEFAULT_BOBSLED, track, day).time
      expect(cdAForTime(time, DEFAULT_BOBSLED, track)).toBeCloseTo(cdA, 6)
    }
  })

  it('keeps a promise the sled makes, and pays in full for a good read', () => {
    const d = deliverSled(onJob('kostrov-club', 12), DEFAULT_BOBSLED, referenceRun(DEFAULT_BOBSLED, track).time)!
    expect(d.debrief.achieved).toBeGreaterThan(12)
    expect(d.debrief.met).toBe(true)
    expect(d.paid).toBe(60000)
    expect(d.debrief.read).toBe('good')
    expect(Math.abs(d.debrief.readError)).toBeLessThan(1e-6)
    expect(d.state.history.at(-1)!.predicted).toBeCloseTo(d.debrief.actualCdA, 6)
  })

  it('docks the fee for a miss: the old sled gains nothing', () => {
    const d = deliverSled(onJob('kostrov-club', 12), CLUB_BOBSLED, referenceRun(CLUB_BOBSLED, track).time)!
    expect(d.debrief.achieved).toBeCloseTo(0, 9)
    expect(d.debrief.met).toBe(false)
    expect(d.debrief.cause).toBe('design')
    expect(d.debrief.penalty).toBe(60000 * PROMISE.maxShare)
  })

  it('judges the read on drag: a bare-floor forecast 0.4 s quick is a poor read', () => {
    const real = referenceRun(DEFAULT_BOBSLED, track).time
    const d = deliverSled(onJob('kostrov-club', 12), DEFAULT_BOBSLED, real - 0.4)!
    expect(d.debrief.readError).toBeLessThan(-0.04)
    expect(d.debrief.read).toBe('poor')
    const close = deliverSled(onJob('kostrov-club', 12), DEFAULT_BOBSLED, real - 0.03)!
    expect(close.debrief.read).toBe('good')
  })

  it('blames the cowling when steering late cost the promise', () => {
    // A tall cowling and the deepest tuck: the driver can't see the curves.
    const blind: BobsledDesign = { ...DEFAULT_BOBSLED, sled: { ...DEFAULT_BOBSLED.sled, cowl: 0.6 }, tuck: 1 }
    const ref = referenceRun(blind, track)
    expect(ref.blindLoss).toBeGreaterThan(0)
    // Promise what the sled would gain if the driver could see: the late steering takes it away.
    const sighted = (referenceRun(CLUB_BOBSLED, track).time - (ref.time - ref.blindLoss)) / SLED_JOBS.pointSeconds
    const d = deliverSled(onJob('kostrov-club', Math.floor(sighted)), blind, ref.time)!
    expect(d.debrief.blind).toEqual({ lost: ref.blindLoss, fix: 'cowl' })
    expect(d.debrief.met).toBe(false)
    expect(d.debrief.cause).toBe('sight')
  })

  it('races both sleds in the same seeded conditions', () => {
    const job = onJob('kedrova-two', 6, 100000)
    const a = deliverSled(job, DEFAULT_BOBSLED, 49.8)!
    const b = deliverSled(job, DEFAULT_BOBSLED, 49.8)!
    expect(a.debrief.conditions).toEqual(b.debrief.conditions)
    expect(a.debrief.conditions).toEqual(raceConditions(a.event, daySeed(job.job!.brief)))
    expect(a.debrief.day.time).toBeLessThan(a.debrief.baselineDay.time)
  })

  it('won’t deliver a two-man sled to a four-man job, or a sled to no job', () => {
    expect(deliverSled(onJob('gromov-four', 6, 170000), DEFAULT_BOBSLED, 49)).toBeNull()
    expect(deliverSled(newCareer(1), DEFAULT_BOBSLED, 49)).toBeNull()
  })
})
