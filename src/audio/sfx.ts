/**
 * Plays the sound-effects pack (PR 13r) through the engine's master volume,
 * so the mute button covers it. Every effect is fetched once after the first
 * tap and cached by the service worker; until it's in, the code-made sound
 * from engine.ts plays where there is one (the knock, the crack, the air).
 */
import { SFX, SFX_TUNING, replaySfxFor, type SfxName } from '../data/sfx'
import { audioOut, isMuted } from './engine'

const buffers = new Map<SfxName, AudioBuffer>()
const loading = new Map<SfxName, Promise<AudioBuffer | null>>()

function load(name: SfxName, ctx: AudioContext): Promise<AudioBuffer | null> {
  let p = loading.get(name)
  if (!p) {
    p = fetch(`./sfx/${SFX[name].file}`)
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
  return p
}

/** Fetch the whole pack (call after the first tap, when the sound can start). */
export function preloadSfx(): void {
  const out = audioOut()
  if (!out) return
  for (const name of Object.keys(SFX) as SfxName[]) void load(name, out.ctx)
}

interface Playing {
  src: AudioBufferSourceNode
  gain: GainNode
}

function start(name: SfxName, level = 1): Playing | null {
  const out = audioOut()
  const buf = buffers.get(name)
  if (!out || !buf) return null
  const src = out.ctx.createBufferSource()
  src.buffer = buf
  const gain = out.ctx.createGain()
  gain.gain.value = SFX[name].gain * level
  if (SFX[name].loop) {
    src.loop = true
    src.loopStart = SFX_TUNING.loopTrim
    src.loopEnd = buf.duration - SFX_TUNING.loopTrim
  }
  src.connect(gain).connect(out.master)
  src.start(out.ctx.currentTime, SFX[name].loop ? SFX_TUNING.loopTrim : 0)
  return { src, gain }
}

function fadeOut(p: Playing): void {
  const out = audioOut()
  if (!out) return
  const now = out.ctx.currentTime
  p.gain.gain.setTargetAtTime(0, now, SFX_TUNING.fade / 3)
  p.src.stop(now + SFX_TUNING.fade * 2)
}

/**
 * Play an effect once. If it hasn't loaded yet, `fallback` plays instead (the
 * code-made twin, when there is one) and the file is asked for.
 */
export function playSfx(name: SfxName, fallback?: () => void): void {
  const out = audioOut()
  if (!out || isMuted()) return
  if (!start(name)) {
    fallback?.()
    void load(name, out.ctx)
  }
}

// --- The tunnel's air: a loop under the code-made hum, following the fan.

let air: Playing | null = null

/** The tunnel's recorded air at an air speed (m/s), out of the tunnel's top speed; 0 fades it out. */
export function setTunnelAir(speed: number, topSpeed: number): void {
  const out = audioOut()
  if (!out) return
  const share = topSpeed > 0 ? Math.min(1, Math.max(0, speed) / topSpeed) : 0
  if (share <= 0) {
    if (air) fadeOut(air)
    air = null
    return
  }
  if (!air) {
    air = start('tunnel', 0)
    if (!air) return void load('tunnel', out.ctx)
  }
  const now = out.ctx.currentTime
  const level = SFX.tunnel.gain * share ** SFX_TUNING.tunnelPower
  const { low, high } = SFX_TUNING.tunnelRate
  air.gain.gain.setTargetAtTime(level, now, SFX_TUNING.fade)
  air.src.playbackRate.setTargetAtTime(low + (high - low) * share, now, SFX_TUNING.fade)
}

// --- The replays: an effect at each note that has one. A loop (the sled's
// runners) stops at the finish or when the replay closes; the one-shots are
// short and play out, so the cheer isn't cut off by "See the debrief".

const replayOpen = () => document.querySelector('.replay') !== null
const loops = new Set<Playing>()
let watching = false

function stopLoops(): void {
  for (const p of loops) fadeOut(p)
  loops.clear()
}

function watchReplay(): void {
  if (watching) return
  watching = true
  const timer = window.setInterval(() => {
    if (replayOpen() && loops.size > 0) return
    window.clearInterval(timer)
    watching = false
    stopLoops()
  }, SFX_TUNING.watchMs)
}

/** The effect for a replay's note, if it has one. */
export function replaySfx(replay: string, kind: string): void {
  if (kind === 'finish') stopLoops()
  const name = replaySfxFor(replay, kind)
  if (!name || isMuted()) return
  const p = start(name)
  if (!p || !p.src.loop) return
  loops.add(p)
  watchReplay()
}

/**
 * Play an effect once the event's replay has been and gone (the fee landing
 * as the debrief opens). The replay opens a moment after the delivery, so
 * this waits for it to open first, or plays after `replayWaitMs` if none does.
 */
export function playAfterReplay(name: SfxName): void {
  let seen = false
  let waited = 0
  const timer = window.setInterval(() => {
    waited += SFX_TUNING.watchMs
    if (replayOpen()) return void (seen = true)
    if (!seen && waited < SFX_TUNING.replayWaitMs) return
    window.clearInterval(timer)
    playSfx(name)
  }, SFX_TUNING.watchMs)
}
