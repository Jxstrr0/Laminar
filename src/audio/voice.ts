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
 */
import { SPEAKER_NAMES, VOICE, VOICE_LINES, type ReplayKind, type VoiceCue } from '../data/voice'
import { commLineFor, lineForCue, type VoiceCast } from './cues'
import { audioOut, isMuted } from './engine'

interface Pending {
  id: string
  /** When it was asked for, ms. */
  at: number
  /** Hold it until no replay is on screen. */
  afterReplay: boolean
}

let castOf: () => VoiceCast = () => ({ tech: null, analyst: null, brief: null })
const buffers = new Map<string, Promise<AudioBuffer | null>>()
const lastCue = new Map<string, number>()
const queue: Pending[] = []
let speaking = false
let polling = false
let caption: HTMLElement | null = null

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

export function commentate(replay: ReplayKind, kind: string, extra: { ahead?: boolean; gain?: number } = {}): void {
  const id = commLineFor(replay, kind, extra)
  // The commentator never waits: a late line would talk over the next moment.
  if (id) enqueue(`${replay}:${kind}`, id, false, 0)
}

function enqueue(key: string, id: string | null, afterReplay: boolean, repeat: number = VOICE.repeat): void {
  if (!id || isMuted() || !audioOut()) return
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

const replayOpen = () => document.querySelector('.replay') !== null

async function next(): Promise<void> {
  if (speaking) return
  // The first line that can play now: debrief lines sit out while a replay runs.
  const at = queue.findIndex((p) => !(p.afterReplay && replayOpen()))
  if (at < 0) {
    // Only debrief lines left, and a replay still running: look again shortly (one timer at a time).
    if (queue.length > 0 && !polling) {
      polling = true
      window.setTimeout(() => {
        polling = false
        void next()
      }, 500)
    }
    return
  }
  const item = queue.splice(at, 1)[0]!
  if (!item.afterReplay && performance.now() - item.at > VOICE.stale * 1000) return void next()
  const out = audioOut()
  const line = VOICE_LINES[item.id]
  if (!out || !line || isMuted()) return void next()
  speaking = true
  const buffer = await load(item.id, line.file, out.ctx)
  if (!buffer || isMuted()) {
    speaking = false
    return void next()
  }
  const src = out.ctx.createBufferSource()
  src.buffer = buffer
  const gain = out.ctx.createGain()
  gain.gain.value = VOICE.gain
  src.connect(gain).connect(out.master)
  showCaption(`${SPEAKER_NAMES[line.speaker]}: ${line.text}`)
  src.onended = () => {
    hideCaption()
    window.setTimeout(() => {
      speaking = false
      void next()
    }, VOICE.gap * 1000)
  }
  src.start()
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

/** A ride's note: ahead or behind at halfway, and the finish gap as a share of the old setup's time. */
export function voiceGap(n: { kind: string }, oldTime: number): { ahead: boolean; gain: number } {
  const gap = 'gap' in n ? (n as { gap: number }).gap : 0
  return { ahead: gap > 0, gain: n.kind === 'finish' && oldTime > 0 ? gap / oldTime : 0 }
}
