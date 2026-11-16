/**
 * The jump replay (PR 8j): the day's jump side-on, your design against the
 * client's old setup flown in the same air, in slow motion, with a live
 * readout (time in the air, distance, speed, the stability margin) and a
 * commentator's line at the moments that matter. At the landing it shows
 * your declared distance next to what the reference jump counted, then
 * hands over to the debrief. Every number comes from the day's flights.
 */
import type { JumperDesign } from '../data/jumper'
import type { Hill } from '../data/hills'
import { JUMP_REPLAY } from '../data/replay'
import { t } from '../data/strings'
import type { JumpResult } from '../sim/jumper'
import { frameAt, jumpDuration, jumpNotes, jumpPath, type JumpNote } from '../sim/jumpReplay'
import { fixed } from './format'

export interface JumpReplayInput {
  client: string
  event: string
  hill: Hill
  design: JumperDesign
  setup: JumperDesign
  /** The day's jumps, yours and the old setup's. */
  day: JumpResult
  baselineDay: JumpResult
  /** The declared reference jump, and what it counted, m. */
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

/** "3.2 m past the old setup", "1.0 m short of the old setup" or "level with the old setup". */
function gapText(gap: number): string {
  if (Math.abs(gap) < 0.05) return t('jr.gap.level')
  return t(gap > 0 ? 'jr.gap.past' : 'jr.gap.short', { m: fixed(Math.abs(gap), 1) })
}

function noteText(n: JumpNote, input: JumpReplayInput): string {
  switch (n.kind) {
    case 'off':
      return t('jr.note.off', { client: input.client, kmh: fixed(n.speed * 3.6, 1) })
    case 'settled':
      return t('jr.note.settled', { pct: fixed(n.margin * 100, 1) })
    case 'pitch':
      return t('jr.note.pitch', { client: input.client })
    case 'long':
      return t('jr.note.long', { client: input.client, hs: fixed(input.hill.hs, 0) })
    case 'wobble':
      return t('jr.note.wobble')
    case 'land':
      return t('jr.note.land', { m: fixed(n.distance, 1), gap: gapText(n.gap) })
  }
}

/** Play the replay over everything; it removes itself when done. */
export async function playJumpReplay(input: JumpReplayInput): Promise<void> {
  const { createJumpView } = await import('../render/jumpScene')
  const mine = jumpPath(input.day, input.hill)
  const old = jumpPath(input.baselineDay, input.hill)
  const duration = jumpDuration(mine, old)
  const notes = jumpNotes(input.day, mine, old)
  // The strip runs a little past the hill size.
  const length = input.hill.hs * 1.1

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
  const clock = readout(t('jr.time'))
  const dist = readout(t('jr.distance'))
  const speed = readout(t('replay.speed'))
  const margin = readout(t('jr.margin'))
  const reads = el('div', 'replay-reads')
  reads.append(clock.box, dist.box, speed.box, margin.box)
  const line = el('p', 'replay-line')
  line.setAttribute('aria-live', 'polite')
  // Distance down the slope: both jumpers as dots, with the K and hill-size ticks.
  const strip = el('div', 'replay-strip is-jump')
  strip.setAttribute('aria-hidden', 'true')
  for (const [at, cls, label] of [
    [input.hill.k, 'is-k', t('jr.tickK')],
    [input.hill.hs, 'is-hs', t('jr.tickHs')],
  ] as const) {
    const left = `${(at / length) * 100}%`
    const tick = el('span', `replay-tick ${cls}`)
    tick.style.left = left
    const name = el('span', 'replay-tick-label', label)
    name.style.left = left
    strip.append(tick, name)
  }
  const dotOld = el('span', 'replay-dot is-old')
  const dotMine = el('span', 'replay-dot is-mine')
  strip.append(dotOld, dotMine)
  const legend = el('p', 'replay-legend')
  legend.append(el('span', 'replay-key is-mine'), t('replay.legend.mine'), el('span', 'replay-key is-old'), t('replay.legend.old'))
  const end = el('div', 'replay-end')
  end.hidden = true
  const verdict = el('p', 'replay-predicted', t('jr.predicted', { pred: fixed(input.predicted, 1), real: fixed(input.actual, 1) }))
  const next = el('button', 'shop-order', t('replay.debrief'))
  next.type = 'button'
  end.append(verdict, next)
  panel.append(reads, line, strip, legend, end)
  root.append(stage, top, panel)
  document.body.append(root)

  const reduce = reducedMotion()
  const view = createJumpView(stage)
  const panelWatch = new ResizeObserver(() => view.setInset(panel.offsetHeight))
  panelWatch.observe(panel)
  view.setHill(input.hill)
  view.setJumpers(input.design, input.setup)

  let raf = 0
  let started = 0
  let shown = -1
  let closed = false

  function draw(time: number) {
    const me = frameAt(mine, time)
    const them = frameAt(old, time)
    view.place(me, them)
    view.render()
    clock.value.textContent = `${fixed(Math.min(time, mine.landAt), 2)} s`
    dist.value.textContent = `${fixed(me.along, 1)} m`
    speed.value.textContent = `${fixed(me.speed * 3.6, 1)} km/h`
    margin.value.textContent = me.landed ? t('jr.onSnow') : `${fixed(me.margin * 100, 1)} %`
    dotMine.style.left = `${Math.min(100, (me.along / length) * 100)}%`
    dotOld.style.left = `${Math.min(100, (them.along / length) * 100)}%`
    let idx = -1
    for (let i = 0; i < notes.length; i++) if (notes[i]!.t <= time) idx = i
    if (idx !== shown && idx >= 0) {
      shown = idx
      line.textContent = noteText(notes[idx]!, input)
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
    const time = ((now - started) / 1000) * (duration / JUMP_REPLAY.seconds)
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
  // Reduced motion: the camera rides with the jumper, so the whole picture would slide. Show the landing still instead.
  if (reduce) finish()
  else raf = requestAnimationFrame(tick)
}
