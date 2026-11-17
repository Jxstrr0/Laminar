/**
 * The voice player (PR 14b). Lines play one at a time through the game's own
 * sound (so the mute chip silences them too), with a caption naming who
 * speaks. Each file is fetched the first time its line plays, then kept; the
 * offline worker caches it for later visits.
 *
 * - say(cue): a tunnel call-out, an analyst's remark or a client's line, if
 *   someone on hand would say it (see lineForCue).
 * - commentate(...): the commentator over a replay note.
 * - sayAfterReplay(cue): waits for the replay to close (the debrief lines).
 *
 * A call-out that can't play within a few seconds is dropped, and the same
 * cue isn't repeated within VOICE.repeat seconds.
 *
 * In time with the picture (PR 13u): the commentator's line belongs to a
 * moment on screen, so it never queues behind anyone. It cuts in over other
 * speech (see commTakeover), a newer call replaces an older one still
 * waiting, and a call that would land late is dropped. While anyone speaks,
 * the music and effects step back (duckForVoice).
 */
import { REPLAY } from '../data/replay'
import { COMM_BIG_WIN, COMM_LINES, SPEAKER_NAMES, VOICE, VOICE_LINES, type ReplayKind, type VoiceCue } from '../data/voice'
import { commLineFor, commTakeover, lineForCue, type VoiceCast } from './cues'
import { audioOut, duckForVoice, isMuted } from './engine'
import { onReplay, replayOpen } from './replayWatch'
import { replaySfx } from './sfx'

interface Pending {
  id: string
  /** When it was asked for, ms. */
  at: number
  /** Hold it until no replay is on screen. */
  afterReplay: boolean
}

/** The line on the air: its sound, its volume, whose it is and when it ends (in the sound's clock). */
interface OnAir {
  src: AudioBufferSourceNode
  gain: GainNode
  comm: boolean
  end: number
}

let castOf: () => VoiceCast = () => ({ tech: null, analyst: null, brief: null })
const buffers = new Map<string, Promise<AudioBuffer | null>>()
const lastCue = new Map<string, number>()
const queue: Pending[] = []
/** The commentator's latest call, waiting for its moment to be heard (only ever one). */
let comm: { id: string; at: number } | null = null
/** True from picking a line until the gap after it ends: one line at a time. */
let busy = false
let onAir: OnAir | null = null
let caption: HTMLElement | null = null
let watching = false

/** Tell the player who's on staff and which brief is in hand (main.ts). */
export function setVoiceCast(get: () => VoiceCast): void {
  castOf = get
}

export function say(cue: VoiceCue): void {
  enqueue(cue, lineForCue(cue, castOf()), false)
}

export function sayAfterReplay(cue: VoiceCue): void {
  enqueue(cue, lineForCue(cue, castOf()), true)
}

export function commentate(replay: ReplayKind, kind: string, extra: { ahead?: boolean; level?: boolean; gain?: number; jet?: boolean } = {}): void {
  // The moment's sound effect (PR 13r), if it has one; a jet car's record run has its own.
  replaySfx(replay === 'record' && extra.jet ? 'recordJet' : replay, kind)
  const id = commLineFor(replay, kind, extra)
  const out = audioOut('voice')
  if (!id || !out || isMuted()) return
  watch()
  comm = { id, at: performance.now() }
  const line = VOICE_LINES[id]
  if (line) void load(id, line.file, out.ctx)
  if (!onAir) return void next()
  const left = onAir.end - out.ctx.currentTime
  // Waiting: the line on the air hands over when it ends. Cutting: fade it now, and it hands over as it stops.
  if (commTakeover({ comm: onAir.comm, left }, VOICE.commWait) === 'cut') fade(onAir, out.ctx)
}

/**
 * Fetch the commentator's lines ahead of a replay (the Deliver sheet calls
 * this), so his first call isn't late waiting for its file.
 */
export function preloadCommentary(): void {
  const out = audioOut('voice')
  if (!out) return
  for (const id of new Set([...Object.values(COMM_LINES), COMM_BIG_WIN])) {
    const line = VOICE_LINES[id]
    if (line) void load(id, line.file, out.ctx)
  }
}

function enqueue(key: string, id: string | null, afterReplay: boolean, repeat: number = VOICE.repeat): void {
  if (!id || isMuted() || !audioOut('voice')) return
  watch()
  const now = performance.now()
  const last = lastCue.get(key)
  if (repeat > 0 && last !== undefined && now - last < repeat * 1000) return
  lastCue.set(key, now)
  // Only call-outs count toward the queue's room; the debrief lines always wait their turn.
  const waiting = queue.filter((p) => !p.afterReplay)
  if (!afterReplay && waiting.length >= VOICE.queue) queue.splice(queue.indexOf(waiting[0]!), 1)
  queue.push({ id, at: now, afterReplay })
  void next()
}

/** When a replay closes: the commentator is done, and the debrief's lines may start. */
function watch(): void {
  if (watching) return
  watching = true
  onReplay((open) => {
    if (open) return
    comm = null
    void next()
  })
}

/** The next line to say: the commentator's call first, then the queue (debrief lines sit out while a replay runs). */
function pick(): { id: string; comm: boolean } | null {
  if (comm) {
    const c = comm
    comm = null
    if (performance.now() - c.at <= VOICE.commStale * 1000) return { id: c.id, comm: true }
  }
  while (queue.length > 0) {
    const at = queue.findIndex((p) => !(p.afterReplay && replayOpen()))
    if (at < 0) return null
    const item = queue.splice(at, 1)[0]!
    if (item.afterReplay || performance.now() - item.at <= VOICE.stale * 1000) return { id: item.id, comm: false }
  }
  return null
}

async function next(): Promise<void> {
  if (busy) return
  const item = pick()
  const out = audioOut('voice')
  if (!item || !out) return
  const line = VOICE_LINES[item.id]
  if (!line || isMuted()) return void next()
  busy = true
  const buffer = await load(item.id, line.file, out.ctx)
  // A commentator's call came in while this one loaded: the newer moment wins.
  if (!buffer || isMuted() || (comm && !item.comm) || (item.comm && comm)) {
    busy = false
    return void next()
  }
  const src = out.ctx.createBufferSource()
  src.buffer = buffer
  const gain = out.ctx.createGain()
  gain.gain.value = VOICE.gain
  src.connect(gain).connect(out.master)
  const air: OnAir = { src, gain, comm: item.comm, end: out.ctx.currentTime + buffer.duration }
  onAir = air
  duckForVoice(true)
  showCaption(`${SPEAKER_NAMES[line.speaker]}: ${line.text}`)
  src.onended = () => {
    if (onAir === air) onAir = null
    duckForVoice(false)
    hideCaption()
    // The commentator's next call follows close behind; anyone else gets a breath.
    window.setTimeout(
      () => {
        busy = false
        void next()
      },
      (comm ? VOICE.commGap : VOICE.gap) * 1000,
    )
  }
  src.start()
}

/** Fade a line out quickly to make room for the commentator. */
function fade(air: OnAir, ctx: AudioContext): void {
  const now = ctx.currentTime
  air.end = Math.min(air.end, now + VOICE.cutFade)
  air.gain.gain.setTargetAtTime(0, now, VOICE.cutFade / 3)
  try {
    air.src.stop(now + VOICE.cutFade)
  } catch {
    // Already stopping.
  }
}

function load(id: string, file: string, ctx: AudioContext): Promise<AudioBuffer | null> {
  let p = buffers.get(id)
  if (!p) {
    p = fetch(`./voice/${file}`)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
      .then((bytes) => ctx.decodeAudioData(bytes))
      .catch(() => {
        buffers.delete(id) // try again next time (offline, say)
        return null
      })
    buffers.set(id, p)
  }
  return p
}

/** The caption: who's speaking and what they say, over the bottom of the screen. */
function showCaption(text: string): void {
  if (!caption) {
    caption = document.createElement('p')
    caption.className = 'voice-caption'
    caption.setAttribute('role', 'status')
    caption.setAttribute('aria-live', 'polite')
  }
  caption.textContent = text
  caption.hidden = false
  // Over a replay when one is open, so it sits above it.
  ;(document.querySelector('.replay') ?? document.body).append(caption)
}

function hideCaption(): void {
  if (caption) caption.hidden = true
}

/** A car's or quad's finish note: the new design's time saved, as a share of the old time. */
export function finishGain(n: { kind: string }): { gain: number } {
  if (n.kind !== 'finish' || !('time' in n) || !('oldTime' in n)) return { gain: 0 }
  const { time, oldTime } = n as { time: number | null; oldTime: number }
  return { gain: time === null || oldTime <= 0 ? 0 : (oldTime - time) / oldTime }
}

/** A ride's note: ahead, behind or level at halfway (as the screen says it), and the finish gap as a share of the old setup's time. */
export function voiceGap(n: { kind: string }, oldTime: number): { ahead: boolean; level: boolean; gain: number } {
  const gap = 'gap' in n ? (n as { gap: number }).gap : 0
  return { ahead: gap > 0, level: Math.abs(gap) < REPLAY.levelWithin, gain: n.kind === 'finish' && oldTime > 0 ? gap / oldTime : 0 }
}
