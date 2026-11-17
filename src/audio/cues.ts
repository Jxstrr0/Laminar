/**
 * What the lab should sound like, from what the tunnel is doing (PR 13a).
 * Pure: no Web Audio here, so it's tested on its own; engine.ts plays it.
 */
import { AUDIO } from '../data/audio'

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
