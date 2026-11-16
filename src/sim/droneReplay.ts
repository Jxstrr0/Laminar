/**
 * The quad race replay, worked out from race day's two races (plan
 * section 9, PR 10h): the gate course as short straight pieces, each
 * quad's five laps as a ride along them, how far it leans at each moment,
 * and the moments worth a line from the commentator. Nothing here changes
 * a result; the replay only shows what the races decided.
 *
 * The race is flown in short steps (DRONE_RACE.step), so the replay reads
 * back the time each quad took over each piece: tilting back to brake into
 * a hairpin and pulling away out of it show as they happened. A quad that
 * tumbled stops where it did; the scene drops it onto the grass.
 */
import { DRONE_RACE, type DroneCourse } from '../data/drone'
import { segmentLength } from '../data/circuits'
import type { CourseSegment } from '../data/field'
import { DRONE_REPLAY as R } from '../data/replay'
import type { DroneRace } from './drone'
import type { Ride } from './replay'

/** One piece of the course as drawn: its length, heading, where it starts along the race, m, and its course segment. */
interface Piece {
  length: number
  heading: number
  from: number
  segment: number
}

/** The course cut into pieces for `laps` laps: straights every R.piece metres, corners every R.cornerStep degrees. */
function pieces(course: DroneCourse, laps: number): Piece[] {
  const out: Piece[] = []
  let heading = 0
  let along = 0
  for (let lap = 0; lap < laps; lap++) {
    course.segments.forEach((seg, i) => {
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
  }
  return out
}

const asCourse = (ps: readonly Piece[]): CourseSegment[] => ps.map((p) => ({ length: p.length, gradient: 0, heading: ((p.heading % 360) + 360) % 360 }))

/** One lap of the course, for the scene to draw (the ride goes round it five times). */
export function droneLap(course: DroneCourse): CourseSegment[] {
  return asCourse(pieces(course, 1))
}

/** Where each lap's straights start, m along one lap: the scene puts a gate there. */
export function droneGates(course: DroneCourse): number[] {
  const out: number[] = []
  let along = 0
  for (const seg of course.segments) {
    if (seg.kind === 'straight') out.push(along)
    along += segmentLength(seg)
  }
  return out
}

/** The race's clock: the time it reached each step's end, s, the way the race model worked it out (a standing start). */
function clock(race: Pick<DroneRace, 'speeds' | 'lengths'>, steps: number): { at: number[]; time: number[] } {
  const at = [0]
  const time = [0]
  for (let i = 0; i < steps; i++) {
    const entry = i === 0 ? 0 : race.speeds[i - 1]!
    at.push(at[i]! + race.lengths[i]!)
    time.push(time[i]! + race.lengths[i]! / Math.max((entry + race.speeds[i]!) / 2, 0.5))
  }
  return { at, time }
}

/** A value between a clock's steps (straight-line), by distance. */
function along(at: readonly number[], values: readonly number[], d: number): number {
  if (d <= 0) return values[0]!
  if (d >= at[at.length - 1]!) return values[values.length - 1]!
  let lo = 0
  let hi = at.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (at[mid]! <= d) lo = mid
    else hi = mid
  }
  const u = (d - at[lo]!) / (at[hi]! - at[lo]!)
  return values[lo]! + u * (values[hi]! - values[lo]!)
}

/** How far a race got, m: the whole race, or to where it tumbled. */
const reach = (race: Pick<DroneRace, 'lengths' | 'tumble'>) => race.tumble?.at ?? race.lengths.reduce((s, l) => s + l, 0)

/** A quad's race as the replay plays it: the ride, and its lean along the way. */
export interface DroneRide extends Ride {
  /** Each piece's lean at its end, radians, forward positive. */
  tilts: number[]
  /** When it tumbled, s into the race, or null if it finished. */
  tumbledAt: number | null
}

/**
 * A quad's race as a ride along the course, five laps: the time and speed
 * on each piece, and the lean it flew it at. One that tumbled stops at the
 * piece where it did.
 */
export function droneRide(course: DroneCourse, race: DroneRace): DroneRide {
  const end = reach(race)
  // The race model flew each step to its end; a tumble breaks off at the start of the step it happened in
  // (that step's tilt is the one that tumbled it, so the clock stops a step short of the tilts).
  const steps = race.tumble ? race.tilts.length - 1 : race.lengths.length
  const c = clock(race, steps)
  const leans = [0, ...race.tilts.slice(0, steps)]
  // At the tumble it had just tipped to the step's tilt that did it (tipped back, if braking).
  if (race.tumble) leans[steps] = race.tilts[steps]!
  const ps = pieces(course, DRONE_RACE.laps).filter((p) => p.from < end - 1e-6)
  const segments = ps.map((p) => {
    const to = Math.min(p.from + p.length, end)
    const time = Math.max(1e-6, along(c.at, c.time, to) - along(c.at, c.time, p.from))
    return { speed: (to - p.from) / time, yawDeg: 0, apparent: 0, time, eased: 0, faded: 0, steer: 0 }
  })
  // The last piece of a tumbled race ends where it tumbled.
  const last = ps[ps.length - 1]
  const course5 = asCourse(ps)
  if (race.tumble && last) course5[course5.length - 1] = { ...course5[course5.length - 1]!, length: end - last.from }
  return {
    course: course5,
    segments,
    tilts: ps.map((p) => along(c.at, leans, Math.min(p.from + p.length, end))),
    tumbledAt: race.tumble ? c.time[c.time.length - 1]! : null,
  }
}

/** How long the replay runs, in race seconds: until the slower quad crosses the line, or a moment after yours lands from a tumble. */
export function droneDuration(mine: DroneRide, old: DroneRide): number {
  if (mine.tumbledAt !== null) return mine.tumbledAt + R.tumble.seconds + R.hold
  const end = (r: DroneRide) => r.segments.reduce((s, x) => s + x.time, 0) + (r.tumbledAt === null ? 0 : R.tumble.seconds)
  return Math.max(end(mine), end(old))
}

/**
 * Race seconds at `s` seconds into the replay: `rate` race seconds a replay
 * second, slowing to `slowRate` just before your quad tumbles.
 */
export function droneClock(mine: DroneRide, s: number): number {
  const fast = s * R.rate
  if (mine.tumbledAt === null) return fast
  const from = Math.max(0, mine.tumbledAt - R.slowLead)
  return fast <= from ? fast : from + (s - from / R.rate) * R.slowRate
}

/** How long the replay takes to play, s: the inverse of droneClock at the end. */
export function dronePlayTime(mine: DroneRide, old: DroneRide): number {
  const end = droneDuration(mine, old)
  if (mine.tumbledAt === null) return end / R.rate
  const from = Math.max(0, mine.tumbledAt - R.slowLead)
  return from / R.rate + (end - from) / R.slowRate
}

/** The lean, radians, `t` seconds into a ride (eased between pieces). */
export function leanAt(ride: DroneRide, t: number): number {
  let elapsed = 0
  let before = 0
  for (let i = 0; i < ride.segments.length; i++) {
    const dt = ride.segments[i]!.time
    if (t < elapsed + dt) return before + ((t - elapsed) / dt) * (ride.tilts[i]! - before)
    elapsed += dt
    before = ride.tilts[i]!
  }
  return before
}

/** The lap a ride is on at a distance, 1 to the race's laps. */
export function lapAt(course: DroneCourse, distance: number): number {
  const lap = course.segments.reduce((s, seg) => s + segmentLength(seg), 0)
  return Math.min(DRONE_RACE.laps, Math.floor(distance / lap) + 1)
}

export type DroneNote =
  /** Off the line together, from a standing start. */
  | { t: number; kind: 'start' }
  /** The fastest point of your race, and the old quad's top speed, m/s. */
  | { t: number; kind: 'top'; speed: number; oldSpeed: number }
  /** Your speed controllers overheat: they lose thrust from here. */
  | { t: number; kind: 'hot' }
  /** Your quad tumbles: how fast it was going, m/s, and braking or flying. */
  | { t: number; kind: 'tumble'; speed: number; braking: boolean }
  /** Across the line: your race and the old quad's, s; yours null if it tumbled. */
  | { t: number; kind: 'finish'; time: number | null; oldTime: number }

/** The commentator's moments, in time order. */
export function droneNotes(mineRace: DroneRace, oldRace: DroneRace, mine: DroneRide, old: DroneRide): DroneNote[] {
  const notes: DroneNote[] = [{ t: 0, kind: 'start' }]
  // Where your quad is first fastest, on the first lap (the later ones repeat it).
  const lapPieces = Math.ceil(mine.segments.length / DRONE_RACE.laps)
  let fast = 0
  let elapsed = 0
  let fastAt = 0
  for (let i = 0; i < Math.min(lapPieces, mine.segments.length); i++) {
    if (mine.segments[i]!.speed > mine.segments[fast]!.speed) {
      fast = i
      fastAt = elapsed
    }
    elapsed += mine.segments[i]!.time
  }
  // Not before the start's line has had its moment.
  notes.push({ t: Math.max(fastAt, R.topFrom), kind: 'top', speed: mineRace.top, oldSpeed: oldRace.top })
  if (mineRace.hotAt !== null && (mine.tumbledAt === null || mineRace.hotAt < mine.tumbledAt)) notes.push({ t: mineRace.hotAt, kind: 'hot' })
  if (mine.tumbledAt !== null && mineRace.tumble) notes.push({ t: mine.tumbledAt, kind: 'tumble', speed: mineRace.tumble.speed, braking: mineRace.twist.braking })
  const oldEnd = old.segments.reduce((s, x) => s + x.time, 0)
  // Out of the race, the line comes once your quad is down: the old quad's time is told, not watched.
  const t = mineRace.time ?? (mine.tumbledAt ?? 0) + R.tumble.seconds
  notes.push({ t, kind: 'finish', time: mineRace.time, oldTime: oldRace.time ?? oldEnd })
  return notes.sort((a, b) => a.t - b.t)
}
