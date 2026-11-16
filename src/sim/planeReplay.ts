/**
 * The survey-day highlights, worked out from survey day's two flights
 * (plan section 9, PR 10o). Kelbo chose highlights in 3D (16 November
 * 2026): a survey flight runs most of two hours, so the replay plays clips
 * of it and cuts between them. The launch and the first turn; the day's big
 * gust on a turn, slowed down; then each plane gliding down when its battery
 * reaches the reserve. Nothing here changes a result; the replay only shows
 * what the flights decided.
 *
 * Both planes fly the same survey lines side by side at survey speed: back
 * and forth across the field, a half-circle turn at each end. A plane that
 * stalls in the gust spins into the crop where it did.
 */
import type { CourseSegment } from '../data/field'
import { PLANE_CLASS, SURVEY_PATTERN, type PlaneClass } from '../data/plane'
import { SURVEY_REPLAY as R, SURVEY_SCENE } from '../data/replay'
import { PI } from './det'
import { turnRadius, type SurveyDay, type SurveyFlight } from './planeJob'
import type { Ride } from './replay'

/** The survey lines as pieces, as far as `metres`: a line east, a turn right round to a line west, a turn left, and so on. */
export function surveyCourse(cls: PlaneClass, metres: number): CourseSegment[] {
  const r = turnRadius(cls)
  const n = Math.ceil(180 / R.turnStep)
  const piece = (PI * r) / n
  const out: CourseSegment[] = []
  let along = 0
  const push = (length: number, heading: number) => {
    const len = Math.min(length, metres - along)
    if (len <= 1e-9) return false
    out.push({ length: len, gradient: 0, heading: ((heading % 360) + 360) % 360 })
    along += len
    return along < metres - 1e-9
  }
  for (let k = 0; ; k++) {
    const east = k % 2 === 0
    if (!push(SURVEY_PATTERN.line, east ? 90 : 270)) break
    // Both turns swing round through south, so the lines stack down the field.
    let more = true
    for (let i = 0; i < n && more; i++) more = push(piece, east ? 90 + (i + 0.5) * (180 / n) : 270 - (i + 0.5) * (180 / n))
    if (!more) break
  }
  return out
}

/** How far a plane banks `metres` along its flight, radians (right wing down positive): level on the lines, rolled into each turn. */
export function bankAt(cls: PlaneClass, metres: number): number {
  const r = turnRadius(cls)
  const arc = PI * r
  const u = metres - SURVEY_PATTERN.line
  if (u < 0) return 0
  const lap = SURVEY_PATTERN.line + arc
  const k = Math.floor(u / lap)
  const w = u - k * lap
  if (w >= arc) return 0
  const ramp = Math.min(1, w / R.rollIn, (arc - w) / R.rollIn)
  // After an eastward line it turns right; after a westward one, left.
  return (k % 2 === 0 ? 1 : -1) * ((PLANE_CLASS[cls].bank * PI) / 180) * ramp
}

/** A plane's survey flight as the replay plays it. */
export interface PlaneRide extends Ride {
  cls: PlaneClass
  /** Metres it flew, and its speed, m/s. */
  end: number
  speed: number
  /** When it stalled in the gust, flight seconds, or null; when it touched down at its reserve, or null. */
  stalledAt: number | null
  landedAt: number | null
}

/** A plane's flight as a ride along the survey lines at survey speed, to where it stalled or landed. */
export function planeRide(cls: PlaneClass, flight: SurveyFlight): PlaneRide {
  const speed = PLANE_CLASS[cls].survey
  const end = flight.flown * 1000
  const course = surveyCourse(cls, end)
  const segments = course.map((c) => ({ speed, yawDeg: 0, apparent: 0, time: c.length / speed, eased: 0, faded: 0, steer: 0 }))
  const time = end / speed
  return { course, segments, cls, end, speed, stalledAt: flight.stall ? time : null, landedAt: flight.stall ? null : time }
}

/** A plane as the clock has it: its height over the crop, m, bank and pitch, radians (nose up positive), and how far round it has spun, radians. */
export interface PlanePose {
  height: number
  bank: number
  pitch: number
  spin: number
}

const smooth = (x: number) => x * x * (3 - 2 * x)

/** Where a plane is in the air `time` flight seconds in: on its lines, spinning down from a stall, or gliding in to land. */
export function planePose(ride: PlaneRide, time: number): PlanePose {
  const fly = SURVEY_SCENE.flyHeight
  const d = Math.min(time * ride.speed, ride.end)
  if (ride.stalledAt !== null && time >= ride.stalledAt) {
    const f = Math.min(1, (time - ride.stalledAt) / R.spin.seconds)
    return {
      height: fly * (1 - f * f),
      bank: bankAt(ride.cls, ride.end) * (1 - f),
      pitch: (-R.spin.noseDeg * PI * Math.min(1, 3 * f)) / 180,
      spin: 2 * PI * R.spin.turns * f,
    }
  }
  if (ride.landedAt !== null) {
    const g = Math.min(1, Math.max(0, (time - (ride.landedAt - R.glide)) / R.glide))
    return { height: fly * (1 - smooth(g)), bank: bankAt(ride.cls, d) * (1 - g), pitch: 0, spin: 0 }
  }
  return { height: fly, bank: bankAt(ride.cls, d), pitch: 0, spin: 0 }
}

/** One clip of the highlights: flight seconds `from` to `to`, played at `rate` flight seconds a replay second. */
export interface Clip {
  from: number
  to: number
  rate: number
}

/**
 * The highlights: the launch, the gust's turn (if either plane is still
 * flying when it comes), and the landings the camera can see. The camera
 * stays with your plane, so a landing after yours is down (theirs, out of
 * sight ahead or behind) isn't shown, only told. Clips that overlap merge,
 * at the slower rate.
 */
export function surveyClips(mine: PlaneRide, old: PlaneRide, day: SurveyDay): Clip[] {
  const myEnd = mine.end / mine.speed
  const clips: Clip[] = [{ from: 0, to: Math.min(R.launch.seconds, myEnd), rate: R.launch.rate }]
  const gust = (day.gustAt * 1000) / mine.speed
  if (gust < myEnd + R.spin.seconds) {
    const stalls = mine.stalledAt !== null || old.stalledAt !== null
    clips.push({ from: gust - R.gust.before, to: gust + Math.max(R.gust.after, stalls ? R.spin.seconds + 1 : 0), rate: R.gust.rate })
  }
  // Their landing, while yours is still flying; then yours.
  if (old.landedAt !== null && old.landedAt < myEnd) clips.push({ from: old.landedAt - R.land.before, to: old.landedAt + R.land.after, rate: R.land.rate })
  if (mine.landedAt !== null) clips.push({ from: mine.landedAt - R.land.before, to: mine.landedAt + R.land.after, rate: R.land.rate })
  const sorted = clips.map((c) => ({ ...c, from: Math.max(0, c.from) })).sort((a, b) => a.from - b.from)
  const out: Clip[] = []
  for (const c of sorted) {
    const last = out[out.length - 1]
    if (last && c.from <= last.to) {
      last.to = Math.max(last.to, c.to)
      last.rate = Math.min(last.rate, c.rate)
    } else out.push({ ...c })
  }
  return out
}

/** How long the highlights take to play, s: each clip at its rate, then a hold on the last moment. */
export function clipsPlayTime(clips: readonly Clip[]): number {
  return clips.reduce((s, c) => s + (c.to - c.from) / c.rate, 0) + R.hold
}

/** Flight seconds at `s` seconds into the highlights, and which clip that is. */
export function clipClock(clips: readonly Clip[], s: number): { time: number; clip: number } {
  let left = s
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i]!
    const span = (c.to - c.from) / c.rate
    if (left < span) return { time: c.from + left * c.rate, clip: i }
    left -= span
  }
  const last = clips.length - 1
  return { time: clips[last]!.to, clip: last }
}

export type SurveyNote =
  /** Both planes off the launcher together. */
  | { t: number; kind: 'launch' }
  /** A cut ahead: how far your plane has flown by the clip's start, km. */
  | { t: number; kind: 'later'; km: number }
  /** The day's big gust on a turn, m/s: whether each plane rides it out (yours and theirs; theirs null if it had landed), and the most yours rides out, m/s. */
  | { t: number; kind: 'gust'; gust: number; mine: boolean; old: boolean | null; limit: number }
  /** Their plane down at its reserve, km. */
  | { t: number; kind: 'landOld'; km: number }
  /** Yours down: at its reserve, or in the crop; how far it flew and theirs, km, and whether theirs spun in too. */
  | { t: number; kind: 'end'; km: number; oldKm: number; stalled: boolean; oldStalled: boolean }

/** The commentator's moments, in time order. */
export function surveyNotes(mine: PlaneRide, old: PlaneRide, day: SurveyDay, flight: SurveyFlight, clips: readonly Clip[]): SurveyNote[] {
  const notes: SurveyNote[] = [{ t: 0, kind: 'launch' }]
  for (const c of clips.slice(1)) notes.push({ t: c.from, kind: 'later', km: Math.min(c.from * mine.speed, mine.end) / 1000 })
  const gust = (day.gustAt * 1000) / mine.speed
  if (clips.some((c) => gust >= c.from && gust <= c.to))
    notes.push({ t: gust, kind: 'gust', gust: day.gust, mine: mine.stalledAt === null, old: old.end / 1000 < day.gustAt ? null : old.stalledAt === null, limit: flight.limit })
  if (old.landedAt !== null && clips.some((c) => old.landedAt! >= c.from && old.landedAt! <= c.to)) notes.push({ t: old.landedAt, kind: 'landOld', km: old.end / 1000 })
  const myEnd = mine.end / mine.speed
  // Once yours is down (spun in, after its fall), the day's tally.
  notes.push({ t: mine.stalledAt !== null ? myEnd + R.spin.seconds : myEnd, kind: 'end', km: mine.end / 1000, oldKm: old.end / 1000, stalled: mine.stalledAt !== null, oldStalled: old.stalledAt !== null })
  return notes.sort((a, b) => a.t - b.t)
}
