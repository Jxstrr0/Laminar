/**
 * The music bed (PR 13s): the calm lab loop, or the upbeat replay loop while
 * a replay is on screen. It plays through the engine's master volume, so the
 * sound chip mutes it too, and has its own on/off chip, remembered in
 * `laminar.music`. A track's file is fetched the first time it's wanted; the
 * game simply has no music until then (or offline with an old cache).
 *
 * Each track loops by overlapping its passes: the next pass starts
 * MUSIC_TUNING.overlap seconds before the last one ends, one fading in as the
 * other fades out. That hides the join, whatever padding the MP3 has.
 */
import { MUSIC, MUSIC_TUNING, type TrackName } from '../data/music'
import { audioOut, isMuted } from './engine'

const KEY = 'laminar.music'

let on = readOn()
const listeners = new Set<(on: boolean) => void>()
const buffers = new Map<TrackName, AudioBuffer>()
const loading = new Map<TrackName, Promise<AudioBuffer | null>>()

function readOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

function load(name: TrackName, ctx: AudioContext): void {
  if (loading.has(name)) return
  const p = fetch(`./music/${MUSIC[name].file}`)
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
    .then((bytes) => ctx.decodeAudioData(bytes))
    .then((buf) => {
      buffers.set(name, buf)
      return buf
    })
    .catch(() => {
      loading.delete(name) // try again next time (offline, say)
      return null
    })
  loading.set(name, p)
}

/** A track as it plays: its own volume, the passes queued so far, and when the next one is due. */
interface Playing {
  name: TrackName
  gain: GainNode
  passes: Set<AudioBufferSourceNode>
  nextAt: number
  first: boolean
}

let current: Playing | null = null

function startTrack(name: TrackName, ctx: AudioContext, master: GainNode, buf: AudioBuffer): Playing {
  const gain = ctx.createGain()
  const now = ctx.currentTime
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(MUSIC[name].gain, now + MUSIC_TUNING.switchFade)
  gain.connect(master)
  const p: Playing = { name, gain, passes: new Set(), nextAt: now, first: true }
  topUp(p, ctx, buf)
  return p
}

/** Queue passes until the next one is more than the look-ahead away. */
function topUp(p: Playing, ctx: AudioContext, buf: AudioBuffer): void {
  const { overlap, lookAhead } = MUSIC_TUNING
  while (p.nextAt - ctx.currentTime < lookAhead) {
    const at = Math.max(p.nextAt, ctx.currentTime)
    const end = at + buf.duration
    const src = ctx.createBufferSource()
    src.buffer = buf
    // This pass's own fade: in over the overlap (the first pass starts full,
    // the track's volume fades it in), then out over the overlap at its end.
    const env = ctx.createGain()
    env.gain.setValueAtTime(p.first ? 1 : 0, at)
    env.gain.linearRampToValueAtTime(1, at + overlap)
    env.gain.setValueAtTime(1, end - overlap)
    env.gain.linearRampToValueAtTime(0, end)
    src.connect(env).connect(p.gain)
    src.start(at)
    src.stop(end)
    p.passes.add(src)
    src.addEventListener('ended', () => p.passes.delete(src))
    p.first = false
    p.nextAt = end - overlap
  }
}

function stopTrack(p: Playing, ctx: AudioContext): void {
  const now = ctx.currentTime
  const fade = MUSIC_TUNING.switchFade
  p.gain.gain.cancelScheduledValues(now)
  p.gain.gain.setValueAtTime(p.gain.gain.value, now)
  p.gain.gain.linearRampToValueAtTime(0, now + fade)
  for (const src of p.passes) {
    try {
      src.stop(now + fade)
    } catch {
      // Already stopped.
    }
  }
}

const replayOpen = () => document.querySelector('.replay') !== null

/** Every half second: which track should be playing, and keep it going. */
function tick(): void {
  const out = audioOut()
  if (!out) return
  const want: TrackName | null = on && !isMuted() ? (replayOpen() ? 'replay' : 'lab') : null
  if (current && current.name !== want) {
    stopTrack(current, out.ctx)
    current = null
  }
  if (!want) return
  const buf = buffers.get(want)
  if (!buf) return load(want, out.ctx)
  if (!current) current = startTrack(want, out.ctx, out.master, buf)
  else topUp(current, out.ctx, buf)
}

let started = false

/** Start the music's clock (after the first tap, once the sound can start). */
export function startMusic(): void {
  if (started || !audioOut()) return
  started = true
  // Fetch both now, so a replay's music is ready when the replay opens.
  if (on) for (const name of Object.keys(MUSIC) as TrackName[]) load(name, audioOut()!.ctx)
  tick()
  window.setInterval(tick, MUSIC_TUNING.watchMs)
}

export const isMusicOn = () => on

/** Music on or off, remembered for next time. */
export function setMusicOn(value: boolean): void {
  on = value
  try {
    localStorage.setItem(KEY, value ? '1' : '0')
  } catch {
    // Private browsing may refuse; the choice still holds for this visit.
  }
  tick()
  for (const f of listeners) f(value)
}

/** Hear about the music being turned on or off (its chip shows it). */
export function onMusic(f: (on: boolean) => void): void {
  listeners.add(f)
}
