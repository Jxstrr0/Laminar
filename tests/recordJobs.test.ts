import { afterEach, describe, expect, it } from 'vitest'
import { BRIEFS, RECORD_JOBS } from '../src/data/briefs'
import { STOCK_RECORD, type RecordDesign } from '../src/data/record'
import { SALT_FLATS } from '../src/data/saltFlats'
import {
  boardFor,
  briefTemplate,
  clampBid,
  currentRecordRun,
  daySeed,
  deliverRecord,
  isRecordBrief,
  newCareer,
  openTo,
  recordEventOf,
  type CareerState,
} from '../src/sim/career'
import { recordAero, recordDayAir, sightLoss, soundSpeed } from '../src/sim/record'
import { dragScaleForSpeed, PRACTICE_FLAT, speedIfRun, stillAttempt } from '../src/sim/recordJob'
import { legacyOf } from '../src/sim/legacy'

const recordBriefs = BRIEFS.filter((b) => b.event.record)
const flat = SALT_FLATS.sukhoye

/** A career with this record job in hand. */
function onJob(id: string, promise: number, fee = 300000): CareerState {
  const b = briefTemplate(id)!
  return { ...newCareer(3), job: { brief: { id, fee, days: b.days, seed: 41 }, promise, startDay: 0, daysLeft: b.days, spent: 0 } }
}

/** A well-sorted streamliner: a long nose drooped enough, a canopy the driver sees over, fin enough and the wheels covered. */
const GOOD: RecordDesign = { ...STOCK_RECORD.streamliner, nose: { length: 2, droop: 2 }, canopy: 0.25, fin: 0.6, fairings: 1 }
/** Fast in still air until the nose lifts: hardly any droop. */
const LIGHT: RecordDesign = { ...GOOD, nose: { length: 2.7, droop: 0 }, fin: 1.1 }
/** Hardly any fin: it wanders. */
const WANDERS: RecordDesign = { ...GOOD, fin: 0.1 }
/** A jet car shaped for the barrier (as in jet.test.ts), and the same car with a straight body and a short nose, held back by the squeeze. */
const GOOD_JET: RecordDesign = { ...STOCK_RECORD.jet, nose: { length: 4.5, droop: 3.5 }, canopy: 0.25, fin: 2.9, fairings: 1, waist: 0.6 }
const SQUEEZED_JET: RecordDesign = { ...GOOD_JET, nose: { length: 3.4, droop: 3.5 }, waist: 0 }
const goodFor = (b: { setup: unknown }) => ((b.setup as RecordDesign).class === 'jet' ? GOOD_JET : GOOD)
const sound = soundSpeed(flat.temperature)

const setupOf = (id: string) => briefTemplate(id)!.setup as RecordDesign
const pointsOf = (ms: number) => (ms * 3.6) / RECORD_JOBS.pointKmh

afterEach(() => {
  RECORD_JOBS.open = true
})

describe('record briefs', () => {
  it('are two streamliners, then two jet cars, at Lake Sukhoye', () => {
    expect(recordBriefs.map((b) => b.id)).toEqual(['kalina-streamliner', 'zarya-streamliner', 'ognivo-jet', 'proryv-jet'])
    expect(recordBriefs.map((b) => (b.setup as RecordDesign).class)).toEqual(['streamliner', 'streamliner', 'jet', 'jet'])
    for (const b of recordBriefs) {
      expect(isRecordBrief(b.id)).toBe(true)
      const event = recordEventOf(b)!
      expect(event.flat).toBe(flat)
      // The brief card's air is the flat's own usual day.
      expect([b.event.temperature, b.event.altitude]).toEqual([flat.temperature, flat.altitude])
      // The team's car finishes both runs as it is.
      expect(stillAttempt(b.setup as RecordDesign, flat).mean).not.toBeNull()
    }
    expect(sightLoss(setupOf('zarya-streamliner'))).toBeGreaterThan(0.05)
    expect(sightLoss(setupOf('kalina-streamliner'))).toBe(0)
    expect(isRecordBrief('belan-sport')).toBe(false)
    expect(recordEventOf(briefTemplate('belan-sport')!)).toBeNull()
  })

  it('come onto the board late in a career, Zarya last, and can be closed', () => {
    expect(openTo(briefTemplate('kalina-streamliner')!, 40)).toBe(false)
    expect(openTo(briefTemplate('kalina-streamliner')!, 60)).toBe(true)
    expect(openTo(briefTemplate('zarya-streamliner')!, 60)).toBe(false)
    expect(openTo(briefTemplate('zarya-streamliner')!, 80)).toBe(true)
    let offered = false
    for (let round = 0; round < 40; round++) offered ||= boardFor(1, round, false, 100).some((b) => isRecordBrief(b.id))
    expect(offered).toBe(true)
    // The switch still shuts them away.
    RECORD_JOBS.open = false
    for (const b of recordBriefs) expect(openTo(b, 100)).toBe(false)
    for (let round = 0; round < 30; round++) expect(boardFor(1, round, false, 100).some((b) => isRecordBrief(b.id))).toBe(false)
  })

  it('ask for a gain a well-sorted car makes with room to spare', () => {
    for (const b of recordBriefs) {
      const good = stillAttempt(goodFor(b), flat).mean!
      const gain = pointsOf(good - stillAttempt(b.setup as RecordDesign, flat).mean!)
      expect(gain, b.id).toBeGreaterThan(b.target + 2)
    }
  })

  it('move a bid 2 km/h at a time', () => {
    expect(clampBid('kalina-streamliner', { price: 250000, promise: 7.4 }).promise).toBe(7)
  })

  it('forecast at the job’s flat against the team’s own car, or Lake Sukhoye’s middling car between jobs', () => {
    expect(currentRecordRun(newCareer(3), 'streamliner')).toEqual({ flat: PRACTICE_FLAT.flat, old: STOCK_RECORD.streamliner })
    const zarya = currentRecordRun(onJob('zarya-streamliner', 5), 'streamliner')
    expect(zarya.old).toEqual(setupOf('zarya-streamliner'))
    expect(zarya.flat).toBe(flat)
  })
})

describe('pricing a declared speed in drag', () => {
  it('gives the car’s own drag for its own speed, more for less and less for more', () => {
    const truth = speedIfRun(GOOD, flat)
    expect(dragScaleForSpeed(truth, GOOD, flat)).toBeCloseTo(1, 3)
    expect(dragScaleForSpeed(truth - 10, GOOD, flat)).toBeGreaterThan(1)
    expect(dragScaleForSpeed(truth + 10, GOOD, flat)).toBeLessThan(1)
    // A car whose nose lifts is still priced on what its drag is worth.
    expect(dragScaleForSpeed(speedIfRun(LIGHT, flat), LIGHT, flat)).toBeCloseTo(1, 3)
  })
})

describe('delivering a record car', () => {
  it('keeps a promise the car makes on the still day, and reads the drag from the declared speed', () => {
    const job = onJob('kalina-streamliner', 10)
    const truth = stillAttempt(GOOD, flat).mean!
    const d = deliverRecord(job, GOOD, truth)!
    expect(d.debrief.met).toBe(true)
    expect(d.debrief.cause).toBeNull()
    expect(d.debrief.penalty).toBe(0)
    expect(d.debrief.achieved).toBeCloseTo(pointsOf(truth - stillAttempt(setupOf('kalina-streamliner'), flat).mean!), 6)
    expect(d.debrief.actualCdA).toBeCloseTo(recordAero(GOOD).cdA, 9)
    expect(Math.abs(d.debrief.readError)).toBeLessThan(0.001)
    expect(d.debrief.read).toBe('good')
    expect(d.state.job).toBeNull()
    // Record day is seeded from the brief, and both cars run in it.
    const air = recordDayAir(flat, daySeed(job.job!.brief))
    expect(d.debrief.day).toEqual(air)
    expect(d.debrief.attempt.runs).toHaveLength(2)
    expect(d.debrief.baselineAttempt.runs).toHaveLength(2)
  })

  it('judges an over-declared speed as a read that thought the car slipperier', () => {
    const truth = stillAttempt(GOOD, flat).mean!
    const d = deliverRecord(onJob('kalina-streamliner', 10), GOOD, truth + 15 / 3.6)!
    expect(d.debrief.readError).toBeLessThan(-0.02)
  })

  it('gives a car that pulls its chutes nothing, and names the nose or the fin', () => {
    const light = deliverRecord(onJob('kalina-streamliner', 10), LIGHT, 170)!
    expect(light.debrief.actual).toBeNull()
    expect(light.debrief.achieved).toBe(0)
    expect(light.debrief.met).toBe(false)
    expect(light.debrief.cause).toBe('lift')
    expect(light.debrief.abort).toMatchObject({ cause: 'lift', fix: 'noseDroop' })
    expect(light.debrief.abort!.speed).toBeGreaterThan(300)
    const wander = deliverRecord(onJob('kalina-streamliner', 10), WANDERS, 170)!
    expect(wander.debrief.cause).toBe('wander')
    expect(wander.debrief.abort).toMatchObject({ cause: 'wander', fix: 'fin' })
  })

  it('names the low canopy when the power it cost the driver lost the promise', () => {
    const zarya = setupOf('zarya-streamliner')
    // The team's car with the wheels covered and a lighter fin, canopy still low: just short of a promise it would keep with the driver seeing.
    const blind: RecordDesign = { ...zarya, fin: 0.6, fairings: 1 }
    const seeing = pointsOf(stillAttempt(blind, flat, { sighted: true }).mean! - stillAttempt(zarya, flat).mean!)
    const made = pointsOf(stillAttempt(blind, flat).mean! - stillAttempt(zarya, flat).mean!)
    expect(seeing - made).toBeGreaterThan(3)
    const d = deliverRecord(onJob('zarya-streamliner', Math.floor(seeing) - 1), blind, 165)!
    expect(d.debrief.met).toBe(false)
    expect(d.debrief.cause).toBe('sight')
    expect(d.debrief.sight).toMatchObject({ fix: 'canopy' })
    expect(d.debrief.sight!.lost).toBeGreaterThan(5)
  })

  it('refuses another sport’s job, and shows in the legacy in km/h', () => {
    const car = { ...newCareer(3), job: { brief: { id: 'belan-sport', fee: 70000, days: 20, seed: 1 }, promise: 3, startDay: 0, daysLeft: 20, spent: 0 } }
    expect(deliverRecord(car, GOOD, 170)).toBeNull()
    const d = deliverRecord(onJob('kalina-streamliner', 10), GOOD, stillAttempt(GOOD, flat).mean!)!
    const best = legacyOf(d.state).best!
    expect(best.unit).toBe('kmh')
    expect(best.cut).toBeCloseTo(d.debrief.achieved * RECORD_JOBS.pointKmh, 6)
  })
})

describe('jet car jobs (PR 9z)', () => {
  it('come after the streamliners, Proryv last', () => {
    expect(openTo(briefTemplate('ognivo-jet')!, 70)).toBe(false)
    expect(openTo(briefTemplate('ognivo-jet')!, 80)).toBe(true)
    expect(openTo(briefTemplate('proryv-jet')!, 80)).toBe(false)
    expect(openTo(briefTemplate('proryv-jet')!, 90)).toBe(true)
  })

  it('run cars worse than the stock jet, short of the sound barrier', () => {
    for (const id of ['ognivo-jet', 'proryv-jet']) {
      const team = stillAttempt(setupOf(id), flat)
      expect(team.mean!, id).toBeLessThan(stillAttempt(STOCK_RECORD.jet, flat).mean! + 30 / 3.6)
      expect(team.runs[0].topMach, id).toBeLessThan(0.95)
    }
  })

  it('Proryv wants its car through the sound barrier, and a car that stops short of it can’t do it', () => {
    const b = briefTemplate('proryv-jet')!
    const needed = stillAttempt(setupOf('proryv-jet'), flat).mean! + (b.target * RECORD_JOBS.pointKmh) / 3.6
    expect(needed).toBeGreaterThan(sound)
    // Only just: the target is the barrier, not a long way past it.
    expect(needed).toBeLessThan(sound + 5 / 3.6)
    expect(stillAttempt(SQUEEZED_JET, flat).mean!).toBeLessThan(sound)
  })

  it('names the squeeze when a jet car misses short of the barrier, with a jump to the waist', () => {
    const d = deliverRecord(onJob('proryv-jet', 54, 600000), SQUEEZED_JET, stillAttempt(SQUEEZED_JET, flat).mean!)!
    expect(d.debrief.met).toBe(false)
    expect(d.debrief.cause).toBe('squeeze')
    expect(d.debrief.squeeze).toMatchObject({ fix: 'waist' })
    expect(d.debrief.squeeze!.mach).toBeGreaterThan(0.9)
    expect(d.debrief.squeeze!.extra).toBeGreaterThan(0.5)
    expect(d.debrief.meanMach!).toBeLessThan(1)
  })

  it('keeps Proryv’s promise through the barrier, and says so', () => {
    const d = deliverRecord(onJob('proryv-jet', 54, 600000), GOOD_JET, stillAttempt(GOOD_JET, flat).mean!)!
    expect(d.debrief.met).toBe(true)
    expect(d.debrief.cause).toBeNull()
    expect(d.debrief.meanMach!).toBeGreaterThan(1)
  })

  it('let a bid promise Proryv’s ask, and the Deliver sheet take a speed past the barrier', () => {
    const b = briefTemplate('proryv-jet')!
    expect(clampBid('proryv-jet', { price: b.fee.min, promise: b.target }).promise).toBe(b.target)
    expect(clampBid('proryv-jet', { price: b.fee.min, promise: 999 }).promise).toBe(RECORD_JOBS.promiseMax)
    // Other jobs keep their cap.
    expect(clampBid('belan-sport', { price: 1, promise: 999 }).promise).toBe(30)
    const best = stillAttempt(GOOD_JET, flat).mean! * 3.6
    expect(RECORD_JOBS.declared.max).toBeGreaterThan(best + 100)
  })

  it('never says a streamliner squeezed', () => {
    const d = deliverRecord(onJob('kalina-streamliner', 10), GOOD, stillAttempt(GOOD, flat).mean!)!
    expect(d.debrief.squeeze).toBeNull()
    expect(d.debrief.meanMach!).toBeLessThan(0.6)
  })
})
