/**
 * The record-run replay, worked out from record day's runs (plan section 9,
 * PR 9v): each run as a ride down the course, the chutes out at the end (or
 * where the driver aborted), a clock that plays the long run-up fast and
 * the timed kilometre slower, and the moments worth a line from the
 * commentator. Nothing here changes a result; the replay only shows what
 * the runs decided.
 *
 * A ride's pieces carry two marks the scene reads (a record car never uses
 * them otherwise): `eased` 1 under the chutes, and `faded` on the stretch
 * before an abort, 1 for a light nose and 2 for a wander.
 */
import type { CourseSegment } from '../data/field'
import { RECORD_RUN as RUN, type RecordClass } from '../data/record'
import { RECORD_REPLAY as R } from '../data/replay'
import type { SegmentResult } from './field/timeTrial'
import type { RecordAbort, RecordRun } from './record'
import { rideTime, timeAt, type Ride } from './replay'

/** Which run: 0 out (north, into the wind along the course), 1 back. */
export type RunIndex = 0 | 1

const headingOf = (run: RunIndex) => (run === 0 ? 0 : 180)

/** The course as drawn for this class's run-up: the run-up, the timed kilometre, and the far run-up, where the car stops. */
export function saltCourse(run: RunIndex, cls: RecordClass): CourseSegment[] {
  const heading = headingOf(run)
  const runUp = RUN.runUp[cls]
  return [
    { length: runUp, gradient: 0, heading },
    { length: RUN.timed, gradient: 0, heading },
    { length: runUp, gradient: 0, heading },
  ]
}

const piece = (speed: number, length: number, marks: { eased?: number; faded?: number } = {}): SegmentResult => ({
  speed,
  yawDeg: 0,
  apparent: 0,
  time: length / Math.max(speed, 0.5),
  eased: marks.eased ?? 0,
  faded: marks.faded ?? 0,
  steer: 0,
})

/** The trouble mark before an abort. */
const troubleMark = (abort: RecordAbort) => (abort.cause === 'lift' ? 1 : 2)

/**
 * A run as a ride: a piece for each step the run was worked out in, then
 * the chutes until the car is nearly stopped. A run that ended with the
 * chutes out early shows its trouble over the stretch before.
 */
export function recordRide(run: Pick<RecordRun, 'speeds' | 'abort'>, index: RunIndex): Ride {
  const heading = headingOf(index)
  const course: CourseSegment[] = []
  const segments: SegmentResult[] = []
  const add = (length: number, seg: SegmentResult) => {
    course.push({ length, gradient: 0, heading })
    segments.push(seg)
  }
  const s = run.speeds
  const troubleFrom = run.abort ? run.abort.at - R.troubleSpan : Infinity
  for (let i = 1; i < s.length; i++) {
    const from = (i - 1) * RUN.step
    add(RUN.step, piece((s[i - 1]! + s[i]!) / 2, RUN.step, { faded: run.abort && from >= troubleFrom ? troubleMark(run.abort) : 0 }))
  }
  // Chutes out: slowing steadily from the last speed until the car's nearly stopped.
  let v = run.abort ? run.abort.speed : s[s.length - 1]!
  while (v > R.stopSpeed + 1e-9) {
    const next = Math.sqrt(Math.max(R.stopSpeed * R.stopSpeed, v * v - 2 * R.chuteDecel * R.stopPiece))
    add(R.stopPiece, piece((v + next) / 2, R.stopPiece, { eased: 1 }))
    v = next
  }
  return { course, segments }
}

/** When the run's chutes come out, run s: where the driver aborted, or the end of the timed kilometre. */
export function chutesAt(ride: Ride, run: Pick<RecordRun, 'abort'>, cls: RecordClass): number {
  return timeAt(ride, run.abort ? run.abort.at : RUN.runUp[cls] + RUN.timed)
}

/**
 * The clock for one run: the run-up plays fast, then from just before
 * your car reaches the timed kilometre (or pulls its chutes, or goes
 * through the sound barrier at `boomAt` run seconds, if sooner)
 * until it stops, slower; anything after (the old car still going) fast
 * again. Times in run seconds; `length` is in replay seconds.
 */
export interface RunClock {
  slowFrom: number
  slowTo: number
  end: number
  length: number
}

export function runClock(mine: Ride, mineRun: Pick<RecordRun, 'abort'>, old: Ride, cls: RecordClass, boomAt = Infinity): RunClock {
  // A car through the sound barrier (PR 9z+) slows the clock from there: the boom is worth watching.
  const enter = Math.min(timeAt(mine, RUN.runUp[cls]), chutesAt(mine, mineRun, cls), boomAt)
  const end = Math.max(rideTime(mine), rideTime(old))
  const slowTo = rideTime(mine)
  const slowFrom = Math.max(0, Math.min(enter - R.lead, slowTo))
  const length = slowFrom / R.fastRate + (slowTo - slowFrom) / R.slowRate + (end - slowTo) / R.fastRate
  return { slowFrom, slowTo, end, length }
}

/** The run second shown `t` replay seconds into the run (held at the end past it). */
export function runTimeAt(c: RunClock, t: number): number {
  const a = c.slowFrom / R.fastRate
  const b = a + (c.slowTo - c.slowFrom) / R.slowRate
  if (t <= a) return t * R.fastRate
  if (t <= b) return c.slowFrom + (t - a) * R.slowRate
  return Math.min(c.end, c.slowTo + (t - b) * R.fastRate)
}

export type RecordNote =
  /** Off the line: the wind in the driver's face, m/s (negative: from behind). */
  | { t: number; kind: 'start'; run: RunIndex; head: number }
  /** Into the timed kilometre: each car's speed there, m/s (null if the old one already stopped). */
  | { t: number; kind: 'timed'; run: RunIndex; speed: number; oldSpeed: number | null }
  /** Your car's chutes come out early: why, and how fast it was going, m/s. */
  | { t: number; kind: 'abort'; run: RunIndex; cause: RecordAbort['cause']; speed: number }
  /** The old car's chutes come out early. */
  | { t: number; kind: 'oldAbort'; run: RunIndex; cause: RecordAbort['cause']; speed: number }
  /** Out of the timed kilometre: each car's speed through it, m/s (null if it didn't get through). */
  | { t: number; kind: 'through'; run: RunIndex; speed: number; oldSpeed: number | null }
  /** Your car goes through the sound barrier (PR 9z+): its speed over the salt then, m/s. */
  | { t: number; kind: 'barrier'; run: RunIndex; speed: number }

/** A car's Mach number at this speed over the salt with the wind in its face (negative: from behind), m/s, in air where sound goes `sound` m/s. */
export function recordMach(speed: number, head: number, sound: number): number {
  return Math.max(0, speed + head) / sound
}

/**
 * Where a run first goes through the sound barrier, m from the start, and
 * how fast over the salt, m/s; null if it never does. Found between the
 * run's steps, so the moment doesn't jump a whole step.
 */
export function barrierAt(run: Pick<RecordRun, 'speeds'>, head: number, sound: number): { at: number; speed: number } | null {
  const s = run.speeds
  for (let i = 1; i < s.length; i++) {
    const a = recordMach(s[i - 1]!, head, sound)
    const b = recordMach(s[i]!, head, sound)
    if (a < 1 && b >= 1) {
      const k = (1 - a) / (b - a)
      return { at: (i - 1 + k) * RUN.step, speed: s[i - 1]! + k * (s[i]! - s[i - 1]!) }
    }
  }
  return null
}

/**
 * The commentator's moments in one run, in time order (run seconds). Given
 * the speed of sound on the day, m/s, a car that goes through the sound
 * barrier gets a line for it.
 */
export function recordNotes(index: RunIndex, mine: RecordRun, old: RecordRun, head: number, cls: RecordClass, sound?: number): RecordNote[] {
  const me = recordRide(mine, index)
  const them = recordRide(old, index)
  const notes: RecordNote[] = [{ t: 0, kind: 'start', run: index, head }]
  const runUp = RUN.runUp[cls]
  const entry = runUp / RUN.step
  if (!mine.abort || mine.abort.at > runUp) notes.push({ t: timeAt(me, runUp), kind: 'timed', run: index, speed: mine.speeds[entry]!, oldSpeed: old.speeds[entry] ?? null })
  if (mine.abort) notes.push({ t: chutesAt(me, mine, cls), kind: 'abort', run: index, cause: mine.abort.cause, speed: mine.abort.speed })
  else notes.push({ t: chutesAt(me, mine, cls), kind: 'through', run: index, speed: mine.speed!, oldSpeed: old.speed })
  const boom = sound === undefined ? null : barrierAt(mine, head, sound)
  if (boom) notes.push({ t: timeAt(me, boom.at), kind: 'barrier', run: index, speed: boom.speed })
  // The old car's own abort gets a line if it doesn't land on top of one of yours.
  if (old.abort) {
    const at = chutesAt(them, old, cls)
    if (!notes.some((n) => n.t > 0 && Math.abs(n.t - at) < R.lead * 2)) notes.push({ t: at, kind: 'oldAbort', run: index, cause: old.abort.cause, speed: old.abort.speed })
  }
  return notes.sort((a, b) => a.t - b.t)
}
