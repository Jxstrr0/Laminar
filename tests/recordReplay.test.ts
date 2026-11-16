import { describe, expect, it } from 'vitest'
import { RECORD_RUN, STOCK_RECORD, type RecordDesign } from '../src/data/record'
import { RECORD_REPLAY } from '../src/data/replay'
import { SALT_FLATS } from '../src/data/saltFlats'
import { stillDay, twoWay } from '../src/sim/record'
import { chutesAt, recordNotes, recordRide, runClock, runTimeAt, saltCourse } from '../src/sim/recordReplay'
import { rideTime, timeAt, trackAt } from '../src/sim/replay'

const flat = SALT_FLATS.sukhoye
/** A well-sorted streamliner, one whose nose lifts, and one that wanders. */
const GOOD: RecordDesign = { ...STOCK_RECORD.streamliner, nose: { length: 2, droop: 2 }, canopy: 0.25, fin: 0.6, fairings: 1 }
const LIGHT: RecordDesign = { ...GOOD, nose: { length: 2.7, droop: 0 }, fin: 1.1 }
const WANDERS: RecordDesign = { ...GOOD, fin: 0.1 }
const day = { ...stillDay(flat), along: 2, cross: 1, shift: 0.4 }
const good = twoWay(GOOD, flat, day)
const light = twoWay(LIGHT, flat, day)
const length = (segs: readonly { length: number }[]) => segs.reduce((s, x) => s + x.length, 0)

describe('the salt course', () => {
  it('runs north, then back south, with the timed kilometre between two run-ups', () => {
    expect(saltCourse(0, 'streamliner').map((s) => s.heading)).toEqual([0, 0, 0])
    expect(saltCourse(1, 'streamliner').map((s) => s.heading)).toEqual([180, 180, 180])
    expect(saltCourse(0, 'streamliner').map((s) => s.length)).toEqual([RECORD_RUN.runUp.streamliner, RECORD_RUN.timed, RECORD_RUN.runUp.streamliner])
  })
})

describe('a run as a ride', () => {
  it('takes the timed kilometre in the run’s own time, then slows under the chutes', () => {
    const run = good.runs[0]
    const ride = recordRide(run, 0)
    const through = timeAt(ride, RECORD_RUN.runUp.streamliner + RECORD_RUN.timed) - timeAt(ride, RECORD_RUN.runUp.streamliner)
    expect(through).toBeCloseTo(run.time!, 6)
    const out = RECORD_RUN.runUp.streamliner + RECORD_RUN.timed
    let along = 0
    ride.course.forEach((seg, i) => {
      // The chutes are out only past the timed kilometre, and nothing goes wrong on a clean run.
      expect(ride.segments[i]!.eased).toBe(along >= out - 1e-6 ? 1 : 0)
      expect(ride.segments[i]!.faded).toBe(0)
      along += seg.length
    })
    // It slows nearly to a stop (the last piece is a 25 m crawl from walking pace up) well inside the far run-up.
    const last = ride.segments[ride.segments.length - 1]!
    expect(last.speed).toBeLessThan(Math.sqrt(RECORD_REPLAY.stopSpeed ** 2 + 2 * RECORD_REPLAY.chuteDecel * RECORD_REPLAY.stopPiece))
    expect(length(ride.course) - out).toBeLessThan(RECORD_RUN.runUp.streamliner / 2)
    expect(trackAt(ride, rideTime(ride) + 1).done).toBe(true)
  })

  it('shows a light nose or a wander over the stretch before the chutes come out early', () => {
    const run = light.runs[0]
    expect(run.abort?.cause).toBe('lift')
    const ride = recordRide(run, 0)
    let along = 0
    const marks = ride.segments.map((s, i) => {
      const m = { along, faded: s.faded, eased: s.eased }
      along += ride.course[i]!.length
      return m
    })
    const before = marks.filter((m) => m.eased === 0)
    expect(before.filter((m) => m.along >= run.abort!.at - RECORD_REPLAY.troubleSpan).every((m) => m.faded === 1)).toBe(true)
    expect(before.filter((m) => m.along < run.abort!.at - RECORD_REPLAY.troubleSpan - RECORD_RUN.step).every((m) => m.faded === 0)).toBe(true)
    // The chutes come out where the driver aborted.
    expect(marks.find((m) => m.eased === 1)!.along).toBeCloseTo(run.abort!.at, 6)
    expect(chutesAt(ride, run, 'streamliner')).toBeCloseTo(timeAt(ride, run.abort!.at), 9)
    const wander = twoWay(WANDERS, flat, day).runs[0]
    expect(wander.abort?.cause).toBe('wander')
    expect(recordRide(wander, 0).segments.some((s) => s.faded === 2)).toBe(true)
  })
})

describe('the replay clock', () => {
  it('plays the run-up fast and the timed kilometre slower, holding at the end', () => {
    const mine = recordRide(good.runs[0], 0)
    const old = recordRide(light.runs[0], 0)
    const c = runClock(mine, good.runs[0], old, 'streamliner')
    expect(c.length).toBeGreaterThan(8)
    expect(c.length).toBeLessThan(20)
    expect(c.slowFrom).toBeLessThan(timeAt(mine, RECORD_RUN.runUp.streamliner))
    let prev = -1
    for (let t = 0; t <= c.length + 1; t += 0.05) {
      const at = runTimeAt(c, t)
      expect(at).toBeGreaterThanOrEqual(prev)
      // Never a jump: at most the fast rate's step.
      if (prev >= 0) expect(at - prev).toBeLessThanOrEqual(RECORD_REPLAY.fastRate * 0.05 + 1e-9)
      prev = at
    }
    expect(runTimeAt(c, c.length)).toBeCloseTo(c.end, 6)
    expect(runTimeAt(c, c.length + 5)).toBe(c.end)
  })
})

describe('the commentator', () => {
  it('calls the start, the timed kilometre and the speed through it', () => {
    const notes = recordNotes(0, good.runs[0], good.runs[0], 2, 'streamliner')
    expect(notes.map((n) => n.kind)).toEqual(['start', 'timed', 'through'])
    expect(notes[0]).toMatchObject({ run: 0, head: 2 })
    expect(notes[2]).toMatchObject({ speed: good.runs[0].speed })
  })

  it('calls your chutes, and the old car’s when they come out on their own', () => {
    const mineLight = recordNotes(0, light.runs[0], good.runs[0], 2, 'streamliner')
    expect(mineLight.map((n) => n.kind)).toEqual(['start', 'abort'])
    expect(mineLight[1]).toMatchObject({ cause: 'lift' })
    const oldLight = recordNotes(1, good.runs[1], light.runs[1], -2, 'streamliner')
    expect(oldLight.map((n) => n.kind)).toContain('oldAbort')
    for (let i = 1; i < oldLight.length; i++) expect(oldLight[i]!.t).toBeGreaterThanOrEqual(oldLight[i - 1]!.t)
  })
})
