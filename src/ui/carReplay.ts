/**
 * The lap replay (PR 9o): race day round the circuit from behind your car,
 * the team's old car as a see-through twin alongside, sped up, with a live
 * readout (the lap clock, your speed, and the gap to their car at the same
 * spot) and a commentator's line at the moments that matter. A car that
 * porpoises bounces where it does. At the end it shows your declared lap
 * next to the real one, then hands over to the race weekend's debrief.
 * Every number comes from race day's two laps.
 */
import type { CarDesign } from '../data/car'
import type { Circuit } from '../data/circuits'
import { CAR_REPLAY } from '../data/replay'
import { t } from '../data/strings'
import type { Lap } from '../sim/car'
import { carDuration, carNotes, carRide, type CarNote } from '../sim/carReplay'
import { timeAt, trackAt } from '../sim/replay'
import { fixed } from './format'
import { commentate, finishGain } from '../audio/voice'

export interface CarReplayInput {
  client: string
  event: string
  circuit: Circuit
  /** Your car as it raced (after scrutineering), and the team's old one. */
  design: CarDesign
  setup: CarDesign
  /** Race day's two laps. */
  lap: Lap
  baselineLap: Lap
  /** The declared and the real lap on the usual day, s. */
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

/** "0.42 s up", "0.10 s down" or "level" against the old car. */
function gapText(s: number): string {
  if (Math.abs(s) < 0.005) return t('replay.level')
  return t(s > 0 ? 'replay.up' : 'replay.down', { s: fixed(Math.abs(s), 2) })
}

const kmh = (v: number) => fixed(v * 3.6, 0)

function noteText(n: CarNote, input: CarReplayInput): string {
  switch (n.kind) {
    case 'start':
      return t('cr.note.start', { client: input.client })
    case 'slowest':
      return t('cr.note.slowest', { mine: kmh(n.speed), old: kmh(n.oldSpeed) })
    case 'porpoise':
      return t('cr.note.porpoise', { speed: kmh(n.speed) })
    case 'top':
      return t('cr.note.top', { mine: kmh(n.speed), old: kmh(n.oldSpeed) })
    case 'finish':
      return t('cr.note.finish', { time: fixed(n.time, 2), gap: gapText(n.oldTime - n.time) })
  }
}

/** Play the replay over everything; it removes itself when done. */
export async function playCarReplay(input: CarReplayInput): Promise<void> {
  const { createReplayView } = await import('../render/replayScene')
  const mine = carRide(input.circuit, input.lap)
  const old = carRide(input.circuit, input.baselineLap)
  const duration = carDuration(input.lap, input.baselineLap)
  const notes = carNotes(input.circuit, input.lap, input.baselineLap)
  const length = input.lap.length

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
  const clockR = readout(t('replay.clock'))
  const speed = readout(t('replay.speed'))
  const gap = readout(t('cr.gap'))
  const reads = el('div', 'replay-reads')
  reads.append(clockR.box, speed.box, gap.box)
  const said = el('p', 'replay-line')
  said.setAttribute('aria-live', 'polite')
  // Metres round the lap: both cars as dots.
  const strip = el('div', 'replay-strip')
  strip.setAttribute('aria-hidden', 'true')
  const dotOld = el('span', 'replay-dot is-old')
  const dotMine = el('span', 'replay-dot is-mine')
  strip.append(dotOld, dotMine)
  const legend = el('p', 'replay-legend')
  legend.append(el('span', 'replay-key is-mine'), t('cr.legend.mine'), el('span', 'replay-key is-old'), t('cr.legend.old'))
  const end = el('div', 'replay-end')
  end.hidden = true
  const verdict = el('p', 'replay-predicted', t('cr.predicted', { pred: fixed(input.predicted, 2), real: fixed(input.actual, 2) }))
  const next = el('button', 'shop-order', t('cr.debrief'))
  next.type = 'button'
  end.append(verdict, next)
  panel.append(reads, said, strip, legend, end)
  root.append(stage, top, panel)
  document.body.append(root)

  const reduce = reducedMotion()
  const view = createReplayView(stage, { still: reduce, car: true })
  const panelWatch = new ResizeObserver(() => view.setInset(panel.offsetHeight))
  panelWatch.observe(panel)
  view.setCourse(mine.course, { windFromDeg: 0, calm: true })
  view.setRiders(input.design, input.setup)

  let raf = 0
  let started = 0
  let last = 0
  let shown = -1
  let closed = false

  function draw(time: number, dt: number) {
    const me = trackAt(mine, time)
    const them = trackAt(old, time)
    view.place(me, them, reduce ? 1e3 : dt)
    view.render()
    clockR.value.textContent = `${fixed(Math.min(time, input.lap.time), 2)} s`
    speed.value.textContent = `${kmh(me.speed)} km/h`
    // The gap at the spot you've reached: when their car got there, against when yours did.
    const theirs = me.done ? input.baselineLap.time : timeAt(old, me.distance)
    gap.value.textContent = gapText(theirs - Math.min(time, input.lap.time))
    dotMine.style.left = `${(me.distance / length) * 100}%`
    dotOld.style.left = `${(them.distance / length) * 100}%`
    let idx = -1
    for (let i = 0; i < notes.length; i++) if (notes[i]!.t <= time) idx = i
    if (idx !== shown && idx >= 0) {
      shown = idx
      said.textContent = noteText(notes[idx]!, input)
      // The commentator says it too (PR 14b).
      commentate('car', notes[idx]!.kind, finishGain(notes[idx]!))
    }
  }

  function finish() {
    cancelAnimationFrame(raf)
    draw(duration, 1e3)
    skip.hidden = true
    end.hidden = false
    next.focus()
  }

  function tick(now: number) {
    if (closed) return
    if (!started) started = last = now
    const dt = (now - last) / 1000
    last = now
    const time = ((now - started) / 1000) * (duration / CAR_REPLAY.seconds)
    if (time >= duration) {
      finish()
      return
    }
    draw(time, dt)
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
  raf = requestAnimationFrame(tick)
}
