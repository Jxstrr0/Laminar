/**
 * The jump replay's numbers (PR 8j): where a jumper is at each moment of the
 * day's flight, and when the commentator speaks. Everything comes from the
 * flight the sim already flew; the only change is at the end, where a jump
 * measured shorter than its flight (a wobbly landing, or the bail-out at the
 * hill size) comes down over the last few metres to touch at its mark.
 */
import { JUMP_REPLAY } from '../data/replay'
import type { Hill } from '../data/hills'
import { detAtan2 } from './det'
import { groundAt, hillSurface, xAtAlong, type JumpResult, type Surface } from './jumper'

const DEG = Math.PI / 180

/** Eases from 0 to 1 as u goes from 0 to 1, flat at both ends. */
const smooth = (u: number) => u * u * (3 - 2 * u)

export interface JumpFrame {
  /** Seconds since take-off. */
  t: number
  /** Position: forward from the take-off edge and up from it, m. */
  x: number
  y: number
  /** Metres along the slope under the jumper (the distance so far). */
  along: number
  /** The body's angle above level, degrees: the path's angle plus the skis' angle of attack. */
  pitchDeg: number
  /** Speed, m/s, and the static margin of the attitude held. */
  speed: number
  margin: number
  /** On the snow (after the landing). */
  landed: boolean
}

export interface JumpPath {
  frames: JumpFrame[]
  /** When the skis touch, s, and the measured distance, m. */
  landAt: number
  distance: number
}

/** The slope's own angle at x, degrees (negative going down). */
function slopeDeg(surface: Surface, x: number): number {
  const a = groundAt(surface, x - 0.5).y
  const b = groundAt(surface, x + 0.5).y
  return detAtan2(b - a, 1) / DEG
}

/** One jumper's flight, frame by frame, ending on the snow at the measured distance. */
export function jumpPath(result: JumpResult, hill: Hill): JumpPath {
  const surface = hillSurface(hill)
  const track = result.flight.track
  const flownX = track.length ? (track[track.length - 1] as (typeof track)[number]).x : 0
  const landX = Math.min(flownX, xAtAlong(surface, result.distance))
  // A landing short of the flight comes down over the last stretch.
  const short = landX < flownX - 1e-6
  const bendFrom = landX - JUMP_REPLAY.bend
  const frames: JumpFrame[] = []
  const at = (p: (typeof track)[number], y: number): JumpFrame => ({
    t: p.t,
    x: p.x,
    y,
    along: groundAt(surface, Math.max(0, p.x)).s,
    pitchDeg: 0,
    speed: p.speed,
    margin: p.margin,
    landed: false,
  })
  const bent = (x: number, y: number) => {
    if (!short || x <= bendFrom) return y
    const ground = groundAt(surface, x).y
    return y + (ground - y) * smooth(Math.min(1, (x - bendFrom) / (landX - bendFrom)))
  }
  let landAt = result.flight.time
  for (let i = 0; i < track.length; i++) {
    const p = track[i]!
    if (p.x < landX) {
      frames.push(at(p, bent(p.x, p.y)))
      continue
    }
    // The touchdown, between this sample and the one before.
    const q = track[i - 1] ?? p
    const share = p.x - q.x > 1e-9 ? (landX - q.x) / (p.x - q.x) : 1
    landAt = q.t + (p.t - q.t) * share
    const touch = { ...p, t: landAt, x: landX, speed: q.speed + (p.speed - q.speed) * share }
    frames.push({ ...at(touch, groundAt(surface, landX).y), along: result.distance })
    break
  }
  // The body's angle: the path's own angle plus the skis' angle of attack.
  for (let i = 0; i < frames.length; i++) {
    const a = frames[Math.max(0, i - 1)]!
    const b = frames[Math.min(frames.length - 1, i + 1)]!
    const path = b.x - a.x > 1e-9 ? detAtan2(b.y - a.y, b.x - a.x) / DEG : 0
    const alpha = track[Math.min(i, track.length - 1)]!.alpha
    frames[i]!.pitchDeg = path + alpha
  }
  // On the snow: the skis along the slope, held there.
  const last = frames[frames.length - 1]
  if (last) frames.push({ ...last, t: landAt + JUMP_REPLAY.hold, pitchDeg: slopeDeg(surface, last.x), landed: true })
  return { frames, landAt, distance: result.distance }
}

/** The jumper at time t (s since take-off), between frames; held on the snow after the landing. */
export function frameAt(path: JumpPath, t: number): JumpFrame {
  const f = path.frames
  if (f.length === 0) return { t, x: 0, y: 0, along: 0, pitchDeg: 0, speed: 0, margin: 0, landed: false }
  if (t >= path.landAt) return { ...f[f.length - 1]!, t }
  let i = 1
  while (i < f.length - 1 && f[i]!.t < t) i++
  const a = f[i - 1]!
  const b = f[i]!
  const u = b.t - a.t > 1e-9 ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 1
  const mix = (p: number, q: number) => p + (q - p) * u
  return {
    t,
    x: mix(a.x, b.x),
    y: mix(a.y, b.y),
    along: mix(a.along, b.along),
    pitchDeg: mix(a.pitchDeg, b.pitchDeg),
    speed: mix(a.speed, b.speed),
    margin: mix(a.margin, b.margin),
    landed: false,
  }
}

/** How long the replay runs in flight seconds: to the later landing, then the hold. */
export function jumpDuration(mine: JumpPath, old: JumpPath): number {
  return Math.max(mine.landAt, old.landAt) + JUMP_REPLAY.hold
}

export type JumpNote =
  | { t: number; kind: 'off'; speed: number }
  | { t: number; kind: 'settled'; margin: number }
  | { t: number; kind: 'pitch' }
  | { t: number; kind: 'long' }
  | { t: number; kind: 'wobble' }
  | { t: number; kind: 'land'; distance: number; gap: number }

/** The commentator's lines, in order: take-off, settled in the air, any trouble, the landing against the old setup. */
export function jumpNotes(result: JumpResult, mine: JumpPath, old: JumpPath): JumpNote[] {
  const notes: JumpNote[] = [{ t: 0, kind: 'off', speed: result.takeoffSpeed }]
  const settled = JUMP_REPLAY.settled
  if (mine.landAt > settled + 0.5) notes.push({ t: settled, kind: 'settled', margin: frameAt(mine, settled).margin })
  const pitched = result.flight.pitchedAt
  if (pitched !== null && pitched < mine.landAt) notes.push({ t: Math.max(settled + 0.3, pitched), kind: 'pitch' })
  // The bail-out and the wobble are called just before the touchdown.
  const before = Math.max(settled + 0.6, mine.landAt - 0.6)
  if (result.trouble === 'long') notes.push({ t: before, kind: 'long' })
  if (result.trouble === 'wobble') notes.push({ t: before, kind: 'wobble' })
  notes.push({ t: mine.landAt, kind: 'land', distance: mine.distance, gap: mine.distance - old.distance })
  return notes.sort((a, b) => a.t - b.t)
}
