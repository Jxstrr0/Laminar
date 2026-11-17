/**
 * The sound engine (PR 13a): plays the cues from cues.ts with the Web Audio
 * API. Browsers only allow sound after a tap, so nothing starts until
 * unlockAudio() runs in one. Muting is remembered in `laminar.muted`, and
 * the sound pauses while the game is in the background.
 *
 * The mix (PR 13u): voice lines, effects and music each have their own bus
 * into the master volume, so the music and effects can step back while
 * someone speaks, and a limiter after the master keeps sounds landing
 * together from clipping.
 */
import { AUDIO, MIX } from '../data/audio'
import { fanVoice } from './cues'

const MUTED_KEY = 'laminar.muted'

export type Bus = 'voice' | 'sfx' | 'music'

interface Voices {
  ctx: AudioContext
  master: GainNode
  buses: Record<Bus, GainNode>
  hum: OscillatorNode
  humFilter: BiquadFilterNode
  humGain: GainNode
  rushFilter: BiquadFilterNode
  rushGain: GainNode
  whirr: OscillatorNode
  whirrGain: GainNode
  noise: AudioBuffer
}

let voices: Voices | null = null
let muted = readMuted()
const listeners = new Set<(muted: boolean) => void>()

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1'
  } catch {
    return false
  }
}

/** Half a second of white noise, looped for the air and cut short for knocks. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate / 2), ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

function build(): Voices | null {
  const Ctx = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  if (!Ctx) return null
  const ctx = new Ctx()
  const master = ctx.createGain()
  master.gain.value = muted ? 0 : AUDIO.master
  const L = MIX.limiter
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = L.threshold
  limiter.knee.value = L.knee
  limiter.ratio.value = L.ratio
  limiter.attack.value = L.attack
  limiter.release.value = L.release
  master.connect(limiter).connect(ctx.destination)
  const bus = () => {
    const g = ctx.createGain()
    g.connect(master)
    return g
  }
  const buses: Record<Bus, GainNode> = { voice: bus(), sfx: bus(), music: bus() }
  // The code-made sounds below are effects: they step back for a voice line too.
  const fx = buses.sfx

  // The fan motor's hum.
  const hum = ctx.createOscillator()
  hum.type = 'sawtooth'
  const humFilter = ctx.createBiquadFilter()
  humFilter.type = 'lowpass'
  humFilter.frequency.value = AUDIO.fan.humCutoff
  const humGain = ctx.createGain()
  humGain.gain.value = 0
  hum.connect(humFilter).connect(humGain).connect(fx)
  hum.start()

  // The rushing air.
  const noise = noiseBuffer(ctx)
  const rush = ctx.createBufferSource()
  rush.buffer = noise
  rush.loop = true
  const rushFilter = ctx.createBiquadFilter()
  rushFilter.type = 'bandpass'
  rushFilter.Q.value = AUDIO.fan.rushQ
  const rushGain = ctx.createGain()
  rushGain.gain.value = 0
  rush.connect(rushFilter).connect(rushGain).connect(fx)
  rush.start()

  // The turntable's motor, wobbling a little.
  const whirr = ctx.createOscillator()
  whirr.type = 'triangle'
  whirr.frequency.value = AUDIO.whirr.pitch
  const wobble = ctx.createOscillator()
  wobble.frequency.value = AUDIO.whirr.wobble
  const wobbleDepth = ctx.createGain()
  wobbleDepth.gain.value = AUDIO.whirr.wobbleDepth
  wobble.connect(wobbleDepth).connect(whirr.frequency)
  const whirrGain = ctx.createGain()
  whirrGain.gain.value = 0
  whirr.connect(whirrGain).connect(fx)
  whirr.start()
  wobble.start()

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void ctx.suspend()
    else if (!muted) void ctx.resume()
  })
  return { ctx, master, buses, hum, humFilter, humGain, rushFilter, rushGain, whirr, whirrGain, noise }
}

/** Start the sound, from inside a tap or key press (browsers require one). */
export function unlockAudio(): void {
  try {
    voices ??= build()
    if (voices && !muted && voices.ctx.state !== 'running') void voices.ctx.resume()
  } catch {
    voices = null
  }
}

const glide = (param: AudioParam, value: number, v: Voices) => param.setTargetAtTime(value, v.ctx.currentTime, AUDIO.glide)

/** The fan at an air speed, out of the tunnel's top speed; 0 silences it. */
export function setFan(speed: number, topSpeed: number): void {
  const v = voices
  if (!v) return
  const f = fanVoice(speed, topSpeed)
  glide(v.hum.frequency, f.humHz, v)
  glide(v.humGain.gain, f.humGain, v)
  glide(v.rushFilter.frequency, f.rushHz, v)
  glide(v.rushGain.gain, f.rushGain, v)
}

/** The turntable's motor on or off. */
export function setWhirr(on: boolean): void {
  const v = voices
  if (!v) return
  glide(v.whirrGain.gain, on ? AUDIO.whirr.gain : 0, v)
}

/** A short burst: a tone and filtered noise, each falling away. */
function knock(pitch: number | null, toneGain: number, noiseGain: number, cutoff: number, decay: number, type: BiquadFilterType): void {
  const v = voices
  if (!v || muted) return
  const now = v.ctx.currentTime
  if (pitch !== null) {
    const osc = v.ctx.createOscillator()
    osc.frequency.setValueAtTime(pitch, now)
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, now + decay)
    const g = v.ctx.createGain()
    g.gain.setValueAtTime(toneGain, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + decay)
    osc.connect(g).connect(v.buses.sfx)
    osc.start(now)
    osc.stop(now + decay + 0.05)
  }
  const src = v.ctx.createBufferSource()
  src.buffer = v.noise
  const filter = v.ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = cutoff
  const g = v.ctx.createGain()
  g.gain.setValueAtTime(noiseGain, now)
  g.gain.exponentialRampToValueAtTime(0.0001, now + decay)
  src.connect(filter).connect(g).connect(v.buses.sfx)
  src.start(now)
  src.stop(now + decay + 0.05)
}

/** The turntable locking at its angle. */
export function clunk(): void {
  const c = AUDIO.clunk
  knock(c.pitch, c.gain, c.noiseGain, c.noiseCutoff, c.decay, 'lowpass')
}

/** A part letting go. */
export function snap(): void {
  const s = AUDIO.snap
  knock(null, 0, s.gain, s.cutoff, s.decay, 'highpass')
}

export const isMuted = () => muted

/** The sound's context and the bus a kind of sound plays into (null before the first tap). */
export function audioOut(bus: Bus = 'sfx'): { ctx: AudioContext; master: GainNode } | null {
  return voices ? { ctx: voices.ctx, master: voices.buses[bus] } : null
}

let speaking = 0

/**
 * Someone starts (true) or stops (false) speaking: the music and the effects
 * step back while they do, and come back after. Counted, so two lines that
 * overlap for a moment don't bring the music back early.
 */
export function duckForVoice(on: boolean): void {
  speaking = Math.max(0, speaking + (on ? 1 : -1))
  const v = voices
  if (!v) return
  const now = v.ctx.currentTime
  const ducked = speaking > 0
  const tc = ducked ? MIX.duckAttack : MIX.duckRelease
  v.buses.music.gain.setTargetAtTime(ducked ? MIX.duck.music : 1, now, tc)
  v.buses.sfx.gain.setTargetAtTime(ducked ? MIX.duck.sfx : 1, now, tc)
}

/** Mute or unmute, remembered for next time. */
export function setMuted(on: boolean): void {
  muted = on
  try {
    localStorage.setItem(MUTED_KEY, on ? '1' : '0')
  } catch {
    // Private browsing may refuse; the choice still holds for this visit.
  }
  const v = voices
  if (v) {
    v.master.gain.setTargetAtTime(on ? 0 : AUDIO.master, v.ctx.currentTime, 0.03)
    if (!on) void v.ctx.resume()
  }
  for (const f of listeners) f(on)
}

/** Hear about mute changes (the chip shows them). */
export function onMuted(f: (muted: boolean) => void): void {
  listeners.add(f)
}
