/**
 * What the lab should sound like, from what the tunnel is doing (PR 13a).
 * Pure: no Web Audio here, so it's tested on its own; engine.ts plays it.
 */
import { AUDIO } from '../data/audio'
import type { StaffId } from '../data/staff'
import { ANALYST_LINES, CLIENT_LINES, CLIENT_VOICE, COMM_BIG_WIN, COMM_LINES, TECH_LINES, VOICE, isAnalystCue, isTechCue, type ReplayKind, type VoiceCue } from '../data/voice'

/** The fan's two voices: the motor's hum and the rushing air. */
export interface FanVoice {
  humHz: number
  humGain: number
  rushHz: number
  rushGain: number
}

/** The fan's sound at an air speed (m/s), out of the tunnel's top speed. */
export function fanVoice(speed: number, topSpeed: number): FanVoice {
  const f = AUDIO.fan
  const s = Math.max(0, speed)
  const share = topSpeed > 0 ? Math.min(1, s / topSpeed) : 0
  return {
    humHz: f.humBase + f.humPerMs * s,
    humGain: f.humGain * Math.min(1, share / f.humFadeIn),
    rushHz: f.rushBase + f.rushPerMs * s,
    // Loudness grows with the air's dynamic pressure, the square of its speed.
    rushGain: f.rushGain * share * share,
  }
}

/** Is the turntable (or sting, or strut) still on its way to the angle asked for? */
export const tableMoving = (angle: number, target: number) => angle !== target

/** The turntable's knock when it stops: once, as it arrives. */
export function tableCue(wasMoving: boolean, moving: boolean): 'clunk' | null {
  return wasMoving && !moving ? 'clunk' : null
}

// --- Voice (PR 14b): who says what. Pure, so the choices are tested on their own.

/** Who's in the room: the tech and analyst on the staff, and the brief in hand. */
export interface VoiceCast {
  tech: StaffId | null
  analyst: StaffId | null
  brief: string | null
}

/** The line for a cue with this cast, or null when nobody there would say it. */
export function lineForCue(cue: VoiceCue, cast: VoiceCast): string | null {
  if (isTechCue(cue)) return cast.tech === 'basov' || cast.tech === 'krasna' ? TECH_LINES[cast.tech][cue] : null
  if (isAnalystCue(cue)) return cast.analyst === 'zhelin' || cast.analyst === 'sorokova' ? ANALYST_LINES[cast.analyst][cue] : null
  if (!cast.brief) return null
  return CLIENT_LINES[CLIENT_VOICE[cast.brief] ?? 'boss'][cue]
}

/**
 * The commentator's line for a replay note, or null for notes he lets pass.
 * `ahead` splits a halfway note; `gain` (the new design's time saved, as a
 * share of the old time) turns a plain finish into "What a run!".
 */
export function commLineFor(replay: ReplayKind, kind: string, extra: { ahead?: boolean; gain?: number } = {}): string | null {
  const key = kind === 'half' ? (extra.ahead ? 'halfAhead' : 'halfBehind') : kind
  const line = COMM_LINES[`${replay}:${key}`] ?? null
  if (line && key === 'finish' && (extra.gain ?? 0) >= VOICE.bigWin) return COMM_BIG_WIN
  return line
}

/** Is a promise bold: past the client's ask by more than VOICE.boldBy of it? (Every sport's promise is bigger-is-better.) */
export const boldPromise = (promise: number, asked: number) => promise > asked + Math.abs(asked) * VOICE.boldBy

/** Did the road agree with the tunnel: a read off by VOICE.agreeWithin or less? */
export const roadAgreed = (readError: number) => Math.abs(readError) <= VOICE.agreeWithin
