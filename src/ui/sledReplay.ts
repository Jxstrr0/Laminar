/**
 * The bobsled replay (PR 8q): the day's run from behind the sled, your design
 * against the client's old sled raced in the same conditions as a see-through
 * ghost, fast-forwarded, with a live readout (the clock, speed, the gap to
 * the old sled, metres down the track) and a commentator's line at the
 * moments that matter. At the finish it shows your declared reference run
 * next to the real one, then hands over to the debrief. Every number comes
 * from the day's runs.
 */
import type { BobsledDesign } from '../data/bobsled'
import type { Track } from '../data/tracks'
import { SLED_REPLAY } from '../data/replay'
import { t } from '../data/strings'
import type { BobRun } from '../sim/bobsled'
import { frameAt, sledDuration, sledNotes, sledPath, timeAt, trackLine, type SledNote } from '../sim/sledReplay'
import { fixed } from './format'
import { commentate } from '../audio/voice'

export interface SledReplayInput {
  client: string
  event: string
  track: Track
  design: BobsledDesign
  setup: BobsledDesign
  /** The day's runs, yours and the old sled's. */
  day: BobRun
  baselineDay: BobRun
  /** The declared reference run, and the real one, s. */
  predicted: number
  actual: number
  /** Called when the replay closes, whether watched to the end or skipped. */
  onDone(): void
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

function readout(label: string): { box: HTMLElement; value: HTMLElement } {
  const box = el('div', 'replay-read')
  const value = el('span', 'replay-read-value')
  box.append(el('span', 'replay-read-label', label), value)
  return { box, value }
}

/** "0.32 s up", "0.10 s down" or "level", against the old sled. */
function gapText(gap: number): string {
  if (Math.abs(gap) < 0.005) return t('replay.level')
  return t(gap > 0 ? 'replay.up' : 'replay.down', { s: fixed(Math.abs(gap), 2) })
}

const kmh = (v: number) => fixed(v * 3.6, 1)

function noteText(n: SledNote, input: SledReplayInput): string {
  switch (n.kind) {
    case 'push':
      return t('sr.note.push', { client: input.client })
    case 'load':
      return t('sr.note.load', { kmh: kmh(n.speed) })
    case 'blind':
      return t('sr.note.blind')
    case 'horseshoe':
      return t('sr.note.horseshoe', { kmh: kmh(n.speed), gap: gapText(n.gap) })
    case 'top':
      return t('sr.note.top', { kmh: kmh(n.speed) })
    case 'finish':
      return t('sr.note.finish', { time: fixed(n.time, 2), gap: gapText(n.gap) })
  }
}

/** Play the replay over everything; it removes itself when done. */
export async function playSledReplay(input: SledReplayInput): Promise<void> {
  const { createSledView } = await import('../render/sledScene')
  const line = trackLine(input.track)
  const mine = sledPath(input.day, input.track, line)
  const old = sledPath(input.baselineDay, input.track, line)
  const duration = sledDuration(mine, old)
  const notes = sledNotes(input.track, mine, old)

  const root = el('div', 'replay')
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-labelledby', 'replay-title')
  const stage = el('div', 'replay-stage')
  const top = el('div', 'replay-top')
  const title = el('h2', 'replay-title', input.event)
  title.id = 'replay-title'
  const skip = el('button', 'chip replay-skip', t('replay.skip'))
  skip.type = 'button'
  skip.setAttribute('aria-label', t('replay.skipName'))
  top.append(title, skip)

  const panel = el('section', 'replay-panel')
  const clock = readout(t('replay.clock'))
  const speed = readout(t('replay.speed'))
  const gap = readout(t('sr.gap'))
  const down = readout(t('sr.down'))
  const reads = el('div', 'replay-reads')
  reads.append(clock.box, speed.box, gap.box, down.box)
  const said = el('p', 'replay-line')
  said.setAttribute('aria-live', 'polite')
  // Metres down the track: both sleds as dots.
  const strip = el('div', 'replay-strip')
  strip.setAttribute('aria-hidden', 'true')
  const dotOld = el('span', 'replay-dot is-old')
  const dotMine = el('span', 'replay-dot is-mine')
  strip.append(dotOld, dotMine)
  const legend = el('p', 'replay-legend')
  legend.append(el('span', 'replay-key is-mine'), t('replay.legend.mine'), el('span', 'replay-key is-old'), t('sr.legend.old'))
  const end = el('div', 'replay-end')
  end.hidden = true
  const verdict = el('p', 'replay-predicted', t('sr.predicted', { pred: fixed(input.predicted, 2), real: fixed(input.actual, 2) }))
  const next = el('button', 'shop-order', t('replay.debrief'))
  next.type = 'button'
  end.append(verdict, next)
  panel.append(reads, said, strip, legend, end)
  root.append(stage, top, panel)
  document.body.append(root)

  const reduce = reducedMotion()
  const view = createSledView(stage)
  const panelWatch = new ResizeObserver(() => view.setInset(panel.offsetHeight))
  panelWatch.observe(panel)
  view.setTrack(line)
  view.setSleds(input.design, input.setup)

  let raf = 0
  let started = 0
  let shown = -1
  let closed = false

  function draw(time: number) {
    const me = frameAt(mine, time)
    const them = frameAt(old, time)
    view.place(me, them)
    view.render()
    clock.value.textContent = `${fixed(Math.min(time, mine.finishAt), 2)} s`
    speed.value.textContent = `${kmh(me.speed)} km/h`
    // The gap at the spot you're at: the old sled's time there less yours.
    gap.value.textContent = gapText(me.finished ? old.finishAt - mine.finishAt : timeAt(old, me.s) - Math.min(time, mine.finishAt))
    down.value.textContent = `${fixed(me.s, 0)} m`
    dotMine.style.left = `${Math.min(100, (me.s / line.length) * 100)}%`
    dotOld.style.left = `${Math.min(100, (them.s / line.length) * 100)}%`
    let idx = -1
    for (let i = 0; i < notes.length; i++) if (notes[i]!.t <= time) idx = i
    if (idx !== shown && idx >= 0) {
      shown = idx
      said.textContent = noteText(notes[idx]!, input)
      // The commentator says it too (PR 14b).
      commentate('sled', notes[idx]!.kind)
    }
  }

  function finish() {
    cancelAnimationFrame(raf)
    draw(duration)
    skip.hidden = true
    end.hidden = false
    next.focus()
  }

  function tick(now: number) {
    if (closed) return
    if (!started) started = now
    const time = ((now - started) / 1000) * (duration / SLED_REPLAY.seconds)
    if (time >= duration) {
      finish()
      return
    }
    draw(time)
    raf = requestAnimationFrame(tick)
  }

  function close() {
    if (closed) return
    closed = true
    cancelAnimationFrame(raf)
    document.removeEventListener('keydown', onKey)
    panelWatch.disconnect()
    view.dispose()
    root.remove()
    input.onDone()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKey)
  skip.addEventListener('click', close)
  next.addEventListener('click', close)
  skip.focus()
  // Reduced motion: the camera rides with the sled, so the whole picture would rush past. Show the finish still instead.
  if (reduce) finish()
  else raf = requestAnimationFrame(tick)
}
