/**
 * The lap replay, worked out from race day's two laps (plan section 9,
 * PR 9o): the circuit as a course of short straight pieces, each car's lap
 * as a ride along it, and the moments worth a line from the commentator.
 * Nothing here changes a result; the replay only shows what the laps
 * decided.
 *
 * The lap is worked out in short steps (LAP.step); the replay reads back
 * the time each car took over each piece, so braking into a hairpin and
 * pulling away out of it show as they happened. A car porpoising is marked
 * on its pieces (in `eased`, which a car never otherwise uses) so the
 * scene can bounce it.
 */
import { LAP } from '../data/car'
import { segmentLength, type Circuit } from '../data/circuits'
import type { CourseSegment } from '../data/field'
import { CAR_REPLAY as R } from '../data/replay'
import type { Lap } from './car'
import type { Ride } from './replay'

/** One piece of the circuit as drawn: its length, heading, and where it starts along the lap, m. */
interface Piece {
  length: number
  heading: number
  from: number
  /** The circuit segment it belongs to. */
  segment: number
}

/** The circuit cut into pieces: straights every R.piece metres, corners every R.cornerStep degrees. */
function pieces(circuit: Circuit): Piece[] {
  const out: Piece[] = []
  let heading = 0
  let along = 0
  circuit.segments.forEach((seg, i) => {
    const len = segmentLength(seg)
    if (seg.kind === 'straight') {
      const n = Math.max(1, Math.ceil(len / R.piece))
      for (let k = 0; k < n; k++) out.push({ length: len / n, heading, from: along + (k * len) / n, segment: i })
    } else {
      const n = Math.max(1, Math.ceil(seg.angle / R.cornerStep))
      const turn = (seg.dir === 'R' ? 1 : -1) * (seg.angle / n)
      for (let k = 0; k < n; k++) {
        // Each piece points along the middle of its arc.
        out.push({ length: len / n, heading: heading + turn / 2, from: along + (k * len) / n, segment: i })
        heading += turn
      }
    }
    along += len
  })
  return out
}

/** The circuit as the replay's course. */
export function circuitCourse(circuit: Circuit): CourseSegment[] {
  return pieces(circuit).map((p) => ({ length: p.length, gradient: 0, heading: ((p.heading % 360) + 360) % 360 }))
}

/**
 * The time a lap took to reach each distance along it, s, as the lap
 * worked it out: the same steps, each at the mean of its end speeds.
 */
function clock(circuit: Circuit, lap: Pick<Lap, 'speeds'>): { at: number[]; time: number[] } {
  const lengths: number[] = []
  for (const seg of circuit.segments) {
    const len = segmentLength(seg)
    const n = Math.max(1, Math.round(len / LAP.step))
    for (let k = 0; k < n; k++) lengths.push(len / n)
  }
  const count = Math.min(lengths.length, lap.speeds.length)
  const at = [0]
  const time = [0]
  for (let i = 0; i < count; i++) {
    const entry = lap.speeds[(i + count - 1) % count]!
    const mean = (entry + lap.speeds[i]!) / 2
    at.push(at[i]! + lengths[i]!)
    time.push(time[i]! + lengths[i]! / Math.max(mean, 1))
  }
  return { at, time }
}

/** The time on a lap's clock at a distance, s (straight-line between its steps). */
function timeOn(c: { at: number[]; time: number[] }, d: number): number {
  const { at, time } = c
  if (d <= 0) return 0
  if (d >= at[at.length - 1]!) return time[time.length - 1]!
  let lo = 0
  let hi = at.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (at[mid]! <= d) lo = mid
    else hi = mid
  }
  const u = (d - at[lo]!) / (at[hi]! - at[lo]!)
  return time[lo]! + u * (time[hi]! - time[lo]!)
}

/**
 * A car's lap as a ride along the circuit: the time and speed on each
 * piece. A piece where the car ran at its porpoising speed is marked
 * (eased 1) for the scene to bounce.
 */
export function carRide(circuit: Circuit, lap: Pick<Lap, 'speeds' | 'porpoise'>): Ride {
  const ps = pieces(circuit)
  const c = clock(circuit, lap)
  return {
    course: circuitCourse(circuit),
    segments: ps.map((p) => {
      const time = Math.max(1e-6, timeOn(c, p.from + p.length) - timeOn(c, p.from))
      const speed = p.length / time
      const bouncing = lap.porpoise !== null && speed >= lap.porpoise - 1
      return { speed, yawDeg: 0, apparent: 0, time, eased: bouncing ? 1 : 0, faded: 0, steer: 0 }
    }),
  }
}

/** How long the replay runs, in lap seconds: until the slower car crosses the line. */
export function carDuration(mine: Pick<Lap, 'time'>, old: Pick<Lap, 'time'>): number {
  return Math.max(mine.time, old.time)
}

export type CarNote =
  /** Off the line together, on a flying lap. */
  | { t: number; kind: 'start' }
  /** The slowest corner: each car's speed through it, m/s. */
  | { t: number; kind: 'slowest'; speed: number; oldSpeed: number }
  /** Your car starts to porpoise: the speed it bounces at, m/s. */
  | { t: number; kind: 'porpoise'; speed: number }
  /** The fastest point: each car's top speed, m/s. */
  | { t: number; kind: 'top'; speed: number; oldSpeed: number }
  /** Across the line: each lap, s. */
  | { t: number; kind: 'finish'; time: number; oldTime: number }

/** The commentator's moments, in time order. */
export function carNotes(circuit: Circuit, mine: Lap, old: Lap): CarNote[] {
  const notes: CarNote[] = [{ t: 0, kind: 'start' }]
  const ride = carRide(circuit, mine)
  const ps = pieces(circuit)
  const startOf = (i: number) => {
    let t = 0
    for (let k = 0; k < i; k++) t += ride.segments[k]!.time
    return t
  }
  // The slowest corner on your lap, and the old car's speed there.
  let slow = -1
  for (const c of mine.corners) if (slow < 0 || c.speed < mine.corners[slow]!.speed) slow = mine.corners.indexOf(c)
  if (slow >= 0) {
    const corner = mine.corners[slow]!
    const piece = ps.findIndex((p) => p.segment === corner.segment)
    const theirs = old.corners.find((c) => c.segment === corner.segment)
    if (piece >= 0 && theirs) notes.push({ t: startOf(piece) + ride.segments[piece]!.time * R.noteAt, kind: 'slowest', speed: corner.speed, oldSpeed: theirs.speed })
  }
  // The first piece where your car bounces.
  const bounce = ride.segments.findIndex((s) => s.eased > 0)
  if (bounce >= 0 && mine.porpoise !== null) notes.push({ t: startOf(bounce), kind: 'porpoise', speed: mine.porpoise })
  // Where your car is fastest.
  let fast = 0
  for (let i = 1; i < ride.segments.length; i++) if (ride.segments[i]!.speed > ride.segments[fast]!.speed) fast = i
  if (!notes.some((n) => n.kind === 'porpoise' && Math.abs(n.t - startOf(fast)) < 2))
    notes.push({ t: startOf(fast), kind: 'top', speed: mine.top, oldSpeed: old.top })
  notes.push({ t: mine.time, kind: 'finish', time: mine.time, oldTime: old.time })
  return notes.sort((a, b) => a.t - b.t)
}
