/**
 * The bobsled replay's numbers (PR 8q): the track's centre line worked out
 * from its stretches, where each sled is on it at each moment of the day's
 * run, how far it rides up the curve walls, and when the commentator speaks.
 * Everything comes from the runs the sim already ran (src/sim/bobsled.ts);
 * the only change is that time lost steering late, which the run adds at the
 * finish, is shared out over the curves where it was lost.
 */
import { SLED_REPLAY as R } from '../data/replay'
import type { Track, TrackStretch } from '../data/tracks'
import { detAtan, detCos, detSin, PI } from './det'
import type { BobRun } from './bobsled'

/** The track's centre line, sampled along its length. */
export interface TrackLine {
  /** Metres from the start, rising. */
  s: number[]
  /** Position: x and z across the mountain, y up (the start is at the origin), m. */
  x: number[]
  y: number[]
  z: number[]
  /** Heading in the plan, radians (0 along +x, rising turns toward +z), and the slope's drop per metre. */
  heading: number[]
  grade: number[]
  /** Signed curvature, 1/m: positive turning toward +z (right, seen from the sled), 0 on a straight. */
  curve: number[]
  /** Start to finish, m. */
  length: number
}

/** The push zone, then every stretch: curves turn right, then left, and so on. */
function pieces(track: Track): TrackStretch[] {
  return [{ length: track.push.length, grade: track.push.grade, radius: 0 }, ...track.stretches]
}

/** The track's centre line, walked a step at a time. */
export function trackLine(track: Track, step: number = R.step): TrackLine {
  const line: TrackLine = { s: [0], x: [0], y: [0], z: [0], heading: [0], grade: [], curve: [], length: 0 }
  let s = 0
  let x = 0
  let y = 0
  let z = 0
  let h = 0
  let turn = 1
  for (const st of pieces(track)) {
    const c = st.radius > 0 ? turn / st.radius : 0
    if (st.radius > 0) turn = -turn
    const k = st.grade / 100
    const n = Math.max(1, Math.ceil(st.length / step - 1e-9))
    const ds = st.length / n
    // The first point of a stretch carries the stretch's own grade and curve.
    if (line.grade.length < line.s.length) {
      line.grade.push(k)
      line.curve.push(c)
    }
    for (let i = 0; i < n; i++) {
      // Midpoint heading, so a curve's chord lands on the arc.
      const mid = h + (c * ds) / 2
      x += detCos(mid) * ds
      z += detSin(mid) * ds
      y -= k * ds
      h += c * ds
      s += ds
      line.s.push(s)
      line.x.push(x)
      line.y.push(y)
      line.z.push(z)
      line.heading.push(h)
      line.grade.push(k)
      line.curve.push(c)
    }
  }
  line.length = s
  return line
}

/** The index of the sample at or before s (clamped). */
function sampleAt(line: TrackLine, s: number): number {
  const a = line.s
  if (s <= 0) return 0
  if (s >= line.length) return a.length - 2
  let lo = 0
  let hi = a.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (a[mid]! <= s) lo = mid
    else hi = mid
  }
  return lo
}

export interface LinePoint {
  x: number
  y: number
  z: number
  heading: number
  grade: number
  curve: number
}

/** The centre line at s metres from the start. */
export function pointAt(line: TrackLine, s: number): LinePoint {
  const i = sampleAt(line, s)
  const j = i + 1
  const span = line.s[j]! - line.s[i]!
  const u = span > 1e-9 ? Math.max(0, Math.min(1, (s - line.s[i]!) / span)) : 0
  const mix = (a: number[]) => a[i]! + (a[j]! - a[i]!) * u
  // A sample's grade and curve belong to the stretch the sled is in: the one ahead of the sample.
  return { x: mix(line.x), y: mix(line.y), z: mix(line.z), heading: mix(line.heading), grade: line.grade[j]!, curve: line.curve[j]! }
}

export interface SledFrame {
  /** Seconds since the push began. */
  t: number
  /** Metres from the start, and speed, m/s. */
  s: number
  speed: number
  /** How far up the channel's wall the sled rides, degrees: positive up the right wall. */
  bankDeg: number
  /** Over the line. */
  finished: boolean
}

export interface SledPath {
  frames: SledFrame[]
  /** When it crosses the line, s. */
  finishAt: number
  topSpeed: number
  loadSpeed: number
  /** When the crew loaded, s. */
  loadAt: number
  blindLoss: number
}

/** Metres of curve passed by s, of all the curves' metres. */
function curveShare(track: Track, s: number): number {
  let at = 0
  let passed = 0
  let total = 0
  for (const st of pieces(track)) {
    if (st.radius > 0) {
      total += st.length
      passed += Math.max(0, Math.min(st.length, s - at))
    }
    at += st.length
  }
  return total > 0 ? passed / total : 0
}

/** How far up the wall a sled at this speed rides in this curvature, degrees (balanced: weight and the turn's pull). */
export function bankFor(speed: number, curve: number): number {
  if (curve === 0) return 0
  const deg = (detAtan((speed * speed * Math.abs(curve)) / R.gravity) * 180) / PI
  // A turn to the right throws the sled up the left wall.
  return -Math.sign(curve) * Math.min(R.maxBankDeg, deg)
}

/** The curvature averaged over `span` metres either side of s, so a sled eases up the wall into a curve rather than jumping. */
export function curveNear(line: TrackLine, s: number, span: number = R.easeSpan): number {
  const n = 8
  let sum = 0
  for (let i = 0; i <= n; i++) sum += pointAt(line, Math.max(0, Math.min(line.length, s - span + (2 * span * i) / n))).curve
  return sum / (n + 1)
}

/** One sled's run, frame by frame, with the late steering's time shared over the curves. */
export function sledPath(run: BobRun, track: Track, line: TrackLine): SledPath {
  const trace = run.trace
  // The run's last point is the finish with all the steering time added on: take it off, and spread it over the curves instead.
  const frames: SledFrame[] = trace.map((p, i) => ({
    t: (i === trace.length - 1 ? p.t - run.blindLoss : p.t) + run.blindLoss * curveShare(track, p.s),
    s: p.s,
    speed: p.speed,
    bankDeg: bankFor(p.speed, curveNear(line, p.s)),
    finished: false,
  }))
  const last = frames[frames.length - 1]
  const finishAt = last ? last.t : 0
  if (last) frames.push({ ...last, t: finishAt + R.hold, speed: last.speed, bankDeg: 0, finished: true })
  const load = trace[1]
  return { frames, finishAt, topSpeed: run.topSpeed, loadSpeed: run.loadSpeed, loadAt: load ? load.t : 0, blindLoss: run.blindLoss }
}

/** The sled at time t (s since the push began), between frames; held past the line after the finish. */
export function frameAt(path: SledPath, t: number): SledFrame {
  const f = path.frames
  if (f.length === 0) return { t, s: 0, speed: 0, bankDeg: 0, finished: false }
  if (t >= path.finishAt) return { ...f[f.length - 1]!, t }
  let i = 1
  while (i < f.length - 1 && f[i]!.t < t) i++
  const a = f[i - 1]!
  const b = f[i]!
  const u = b.t - a.t > 1e-9 ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 1
  const mix = (p: number, q: number) => p + (q - p) * u
  return { t, s: mix(a.s, b.s), speed: mix(a.speed, b.speed), bankDeg: mix(a.bankDeg, b.bankDeg), finished: false }
}

/** When the sled passed s metres from the start, s (its finish time past the line). */
export function timeAt(path: SledPath, s: number): number {
  const f = path.frames.filter((x) => !x.finished)
  if (f.length === 0) return 0
  if (s <= f[0]!.s) return f[0]!.t
  for (let i = 1; i < f.length; i++) {
    const a = f[i - 1]!
    const b = f[i]!
    if (b.s >= s) return b.s - a.s > 1e-9 ? a.t + ((s - a.s) / (b.s - a.s)) * (b.t - a.t) : b.t
  }
  return path.finishAt
}

/** The replay's length: to the later finish and its hold. */
export function sledDuration(mine: SledPath, old: SledPath): number {
  return Math.max(mine.finishAt, old.finishAt) + R.hold
}

/** What the commentator says, and when (run seconds). */
export type SledNote =
  | { kind: 'push'; t: number }
  | { kind: 'load'; t: number; speed: number }
  | { kind: 'blind'; t: number }
  | { kind: 'horseshoe'; t: number; speed: number; gap: number }
  | { kind: 'top'; t: number; speed: number }
  | { kind: 'finish'; t: number; time: number; gap: number }

/** Where the track's longest curve starts, m (the horseshoe), and where its first curve starts. */
function curveStarts(track: Track): { first: number; longest: number } {
  let at = 0
  let first = -1
  let longest = -1
  let longestLength = 0
  for (const st of pieces(track)) {
    if (st.radius > 0) {
      if (first < 0) first = at
      if (st.length > longestLength) {
        longestLength = st.length
        longest = at
      }
    }
    at += st.length
  }
  return { first, longest }
}

/**
 * The commentator's lines: the push, the load, the driver steering late (when the
 * cowling hides the line), the horseshoe, the top speed and the finish. A
 * gap is the old sled's time at the same spot less yours: positive, you're up.
 */
export function sledNotes(track: Track, mine: SledPath, old: SledPath): SledNote[] {
  const notes: SledNote[] = [
    { kind: 'push', t: 0 },
    { kind: 'load', t: mine.loadAt, speed: mine.loadSpeed },
  ]
  const { first, longest } = curveStarts(track)
  if (mine.blindLoss > 0 && first >= 0) notes.push({ kind: 'blind', t: timeAt(mine, first) })
  if (longest >= 0) {
    const t = timeAt(mine, longest)
    notes.push({ kind: 'horseshoe', t, speed: frameAt(mine, t).speed, gap: timeAt(old, longest) - t })
  }
  // The fastest moment, if it isn't right on the line (then the finish says it all).
  const top = mine.frames.filter((f) => !f.finished).reduce((a, b) => (b.speed > a.speed ? b : a), mine.frames[0]!)
  if (top && top.t < mine.finishAt - 3) notes.push({ kind: 'top', t: top.t, speed: top.speed })
  notes.push({ kind: 'finish', t: mine.finishAt, time: mine.finishAt, gap: old.finishAt - mine.finishAt })
  return notes.sort((a, b) => a.t - b.t)
}
