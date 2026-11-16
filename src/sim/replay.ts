/**
 * The race-day replay, worked out from the field result (plan section 4,
 * step 8): where each rider is at any moment on the race clock, the gap
 * between your design and the client's old setup, the wind each one faces,
 * and the moments worth a line from the commentator. Nothing here changes a
 * result; the replay only shows what the field model already decided.
 */
import type { CourseSegment } from '../data/field'
import { REPLAY } from '../data/replay'
import { detCos, detSin } from './det'
import type { SegmentResult } from './field/timeTrial'
import { DEG } from './num'

/** A rider's ride as the replay needs it: the course and their speed on each stretch. */
export interface Ride {
  course: readonly CourseSegment[]
  segments: readonly SegmentResult[]
}

export interface TrackPoint {
  /** Metres ridden. */
  distance: number
  /** Position, m: x east, z south (so north is −z, as three.js looks). */
  x: number
  z: number
  /** Heading, degrees (0 north, 90 east). */
  heading: number
  /** Ground speed, m/s, and apparent wind yaw, degrees. */
  speed: number
  yawDeg: number
  segment: number
  done: boolean
  /** Trouble on this stretch (from the field model): power given up in gusts, and to sitting up. */
  eased: number
  faded: number
}

const unit = (heading: number) => ({ dx: detSin(heading * DEG), dz: -detCos(heading * DEG) })

/** Where the rider is `t` seconds into the race. Past the finish, they wait on the line. */
export function trackAt(ride: Ride, t: number): TrackPoint {
  let x = 0
  let z = 0
  let elapsed = 0
  let distance = 0
  const last = ride.course.length - 1
  for (let i = 0; i <= last; i++) {
    const seg = ride.course[i]!
    const r = ride.segments[i]!
    const { dx, dz } = unit(seg.heading)
    if (t < elapsed + r.time) {
      const along = Math.max(0, t - elapsed) * r.speed
      return { distance: distance + along, x: x + dx * along, z: z + dz * along, heading: seg.heading, speed: r.speed, yawDeg: r.yawDeg, segment: i, done: false, eased: r.eased, faded: r.faded }
    }
    elapsed += r.time
    distance += seg.length
    x += dx * seg.length
    z += dz * seg.length
  }
  const seg = ride.course[last]!
  const r = ride.segments[last]!
  return { distance, x, z, heading: seg.heading, speed: r.speed, yawDeg: r.yawDeg, segment: last, done: true, eased: 0, faded: r.faded }
}

/** The race-clock time the rider reaches `distance` metres (their finish time past the end). */
export function timeAt(ride: Ride, distance: number): number {
  let elapsed = 0
  let covered = 0
  for (let i = 0; i < ride.course.length; i++) {
    const len = ride.course[i]!.length
    const r = ride.segments[i]!
    if (distance <= covered + len) return elapsed + Math.max(0, distance - covered) / r.speed
    elapsed += r.time
    covered += len
  }
  return elapsed
}

export function rideTime(ride: Ride): number {
  return ride.segments.reduce((s, r) => s + r.time, 0)
}

/**
 * Seconds the old setup is behind your design at race time `t` (negative
 * when it's ahead): how long until it reaches where you are now, or, once
 * you've finished, the gap at the line.
 */
export function gapAt(mine: Ride, old: Ride, t: number): number {
  const finish = rideTime(mine)
  if (t >= finish) return rideTime(old) - finish
  return timeAt(old, trackAt(mine, t).distance) - t
}

export type WindFeel = 'head' | 'cross' | 'tail'

/** The angle between two headings, 0–180 degrees. */
export function turnAngle(a: number, b: number): number {
  return Math.abs(((((b - a) % 360) + 540) % 360) - 180)
}

/** How the day's wind feels on a heading: in the face, from the side, or behind. */
export function windFeel(heading: number, windFromDeg: number): WindFeel {
  const rel = turnAngle(heading, windFromDeg)
  return rel <= REPLAY.headDeg ? 'head' : rel >= REPLAY.tailDeg ? 'tail' : 'cross'
}

/** A moment worth a line from the commentator, on the race clock. */
export type ReplayNote =
  | { kind: 'start'; t: number; wind: WindFeel | null }
  | { kind: 'bell'; t: number; gap: number }
  | { kind: 'turn'; t: number; km: number; wind: WindFeel }
  | { kind: 'meet'; t: number; gap: number }
  | { kind: 'half'; t: number; gap: number }
  | { kind: 'finish'; t: number; gap: number }
  /** Your rider eases off in a gust, or sits up for the last third (plan section 7). */
  | { kind: 'gust'; t: number }
  | { kind: 'fade'; t: number }

export interface NoteOptions {
  windFromDeg: number
  /** Still air: no wind to speak of. */
  calm: boolean
  /** On the track: the lap length, m, for the bell. */
  lap?: number
}

/** The commentator's moments for your ride against the old setup, in race-clock order. */
export function replayNotes(mine: Ride, old: Ride, opts: NoteOptions): ReplayNote[] {
  const { windFromDeg } = opts
  const notes: ReplayNote[] = [{ kind: 'start', t: 0, wind: opts.calm ? null : windFeel(mine.course[0]!.heading, windFromDeg) }]
  let t = 0
  let km = 0
  for (let i = 1; i < mine.course.length; i++) {
    t += mine.segments[i - 1]!.time
    km += mine.course[i - 1]!.length / 1000
    const next = mine.course[i]!.heading
    if (!opts.lap && turnAngle(mine.course[i - 1]!.heading, next) > REPLAY.turnDeg) notes.push({ kind: 'turn', t, km, wind: windFeel(next, windFromDeg) })
  }
  const finish = rideTime(mine)
  notes.push({ kind: 'half', t: finish / 2, gap: gapAt(mine, old, finish / 2) })
  // On an out-and-back (one sharp turn and no other), you meet the old setup still heading out once you've turned.
  const turns: number[] = []
  for (let i = 1; i < mine.course.length; i++) if (turnAngle(mine.course[i - 1]!.heading, mine.course[i]!.heading) > REPLAY.turnDeg) turns.push(i)
  const back = turns.length === 1 ? turns[0]! : -1
  if (!opts.lap && back > 0 && turnAngle(mine.course[back - 1]!.heading, mine.course[back]!.heading) >= REPLAY.backDeg) {
    const turnAt = mine.course.slice(0, back).reduce((sum, c) => sum + c.length, 0)
    const start = timeAt(mine, turnAt)
    for (let s = start; s < finish; s += REPLAY.meetStep) {
      const me = trackAt(mine, s).distance
      const them = trackAt(old, s).distance
      if (them >= turnAt) break
      if (me + them >= 2 * turnAt) {
        notes.push({ kind: 'meet', t: s, gap: gapAt(mine, old, s) })
        break
      }
    }
  }
  // Trouble: the first stretch where your rider eased off in a gust, and where they sat up.
  let at = 0
  let gust = false
  let fade = false
  for (const r of mine.segments) {
    if (!gust && r.eased > 0) {
      notes.push({ kind: 'gust', t: at + r.time * REPLAY.gustAt })
      gust = true
    }
    if (!fade && r.faded > 0) {
      notes.push({ kind: 'fade', t: at })
      fade = true
    }
    at += r.time
  }
  if (opts.lap) {
    const length = mine.course.reduce((sum, c) => sum + c.length, 0)
    const bell = timeAt(mine, length - opts.lap)
    notes.push({ kind: 'bell', t: bell, gap: gapAt(mine, old, bell) })
  }
  notes.push({ kind: 'finish', t: finish, gap: gapAt(mine, old, finish) })
  return notes.sort((a, b) => a.t - b.t)
}
