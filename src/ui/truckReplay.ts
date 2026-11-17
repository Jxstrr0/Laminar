/**
 * The fuel-run replay (PR 9h): the trial day down the client's route from
 * behind your truck, the fleet's old truck as a see-through twin in the
 * next lane, fast-forwarded, with a live readout (distance, the wind's
 * angle on the truck, your litres so far, and the saving so far) and a
 * commentator's line at the moments that matter. At the end it shows your
 * declared fuel figure next to the real one, then hands over to the fuel
 * trial's debrief. Every number comes from the day's two fuel runs.
 */
import { TRUCK_REPLAY } from '../data/replay'
import type { Route } from '../data/routes'
import { t } from '../data/strings'
import type { TruckDesign } from '../data/truck'
import { timeAt, trackAt, windFeel } from '../sim/replay'
import type { FuelRun, RouteDay } from '../sim/truck'
import { litresAt, truckDuration, truckNotes, truckRide, type TruckNote } from '../sim/truckReplay'
import { fixed } from './format'
import { commentate } from '../audio/voice'

export interface TruckReplayInput {
  client: string
  event: string
  route: Route
  /** Your truck as it ran (cut back to the road code, skirts gone if they cracked), and the fleet's old one. */
  design: TruckDesign
  setup: TruckDesign
  day: RouteDay
  run: FuelRun
  baselineRun: FuelRun
  /** The skirts cracked on the gravel yard. */
  cracked: boolean
  /** The declared and the real wind-averaged fuel figure, litres per 100 km. */
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

/** "4.2 % less", "1.0 % more" or "level" against the old truck. */
function savingText(pct: number): string {
  if (Math.abs(pct) < 0.05) return t('replay.level')
  return t(pct > 0 ? 'tr.less' : 'tr.more', { pct: fixed(Math.abs(pct), 1) })
}

function noteText(n: TruckNote, input: TruckReplayInput): string {
  switch (n.kind) {
    case 'start':
      return n.cracked ? t('tr.note.cracked', { client: input.client }) : t('tr.note.start', { client: input.client })
    case 'cross':
      return t('tr.note.cross', { yaw: fixed(n.yawDeg, 0), saving: savingText(n.saving) })
    case 'climb':
      return t('tr.note.climb', { kmh: fixed(n.speed * 3.6, 0) })
    case 'finish':
      return t('tr.note.finish', { mine: fixed(n.litres, 1), old: fixed(n.oldLitres, 1), saving: savingText(n.saving) })
  }
}

/** Play the replay over everything; it removes itself when done. */
export async function playTruckReplay(input: TruckReplayInput): Promise<void> {
  const { createReplayView } = await import('../render/replayScene')
  const mine = truckRide(input.route, input.run)
  const old = truckRide(input.route, input.baselineRun)
  const duration = truckDuration(input.run, input.baselineRun)
  const notes = truckNotes(input.route, input.run, input.baselineRun, input.cracked)
  const length = input.run.distance

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
  const dist = readout(t('replay.distance'))
  const wind = readout(t('replay.wind'))
  const fuel = readout(t('tr.fuel'))
  const saving = readout(t('tr.saving'))
  const reads = el('div', 'replay-reads')
  reads.append(dist.box, wind.box, fuel.box, saving.box)
  const said = el('p', 'replay-line')
  said.setAttribute('aria-live', 'polite')
  // Kilometres along the route: both trucks as dots.
  const strip = el('div', 'replay-strip')
  strip.setAttribute('aria-hidden', 'true')
  const dotOld = el('span', 'replay-dot is-old')
  const dotMine = el('span', 'replay-dot is-mine')
  strip.append(dotOld, dotMine)
  const legend = el('p', 'replay-legend')
  legend.append(el('span', 'replay-key is-mine'), t('tr.legend.mine'), el('span', 'replay-key is-old'), t('tr.legend.old'))
  const end = el('div', 'replay-end')
  end.hidden = true
  const verdict = el('p', 'replay-predicted', t('tr.predicted', { pred: fixed(input.predicted, 1), real: fixed(input.actual, 1) }))
  const next = el('button', 'shop-order', t('tr.debrief'))
  next.type = 'button'
  end.append(verdict, next)
  panel.append(reads, said, strip, legend, end)
  root.append(stage, top, panel)
  document.body.append(root)

  const reduce = reducedMotion()
  const view = createReplayView(stage, { still: reduce, truck: true })
  const panelWatch = new ResizeObserver(() => view.setInset(panel.offsetHeight))
  panelWatch.observe(panel)
  view.setCourse(mine.course, { windFromDeg: input.day.windFromDeg, calm: input.day.windSpeed < 0.3 })
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
    dist.value.textContent = `${fixed(me.distance / 1000, 1)} km`
    wind.value.textContent = t(`replay.wind.${windFeel(me.heading, input.day.windFromDeg)}`, { yaw: fixed(Math.abs(me.yawDeg), 0) })
    // Litres so far, and the saving over the same stretch of road (the old truck's litres at the spot you've reached).
    const mineL = litresAt(input.run, time)
    const atSameSpot = litresAt(input.baselineRun, me.done ? input.baselineRun.time : timeAt(old, me.distance))
    fuel.value.textContent = `${fixed(mineL, 1)} L`
    saving.value.textContent = atSameSpot > 0 ? savingText((1 - mineL / atSameSpot) * 100) : '—'
    dotMine.style.left = `${(me.distance / length) * 100}%`
    dotOld.style.left = `${(them.distance / length) * 100}%`
    let idx = -1
    for (let i = 0; i < notes.length; i++) if (notes[i]!.t <= time) idx = i
    if (idx !== shown && idx >= 0) {
      // Each moment passed since the last frame gets its sound and the commentator's call, in order, so two
      // landing in one frame both play (PR 13u); at most the last two, so a long pause doesn't fire a pile at once.
      for (let k = Math.max(shown + 1, idx - 1); k <= idx; k++) commentate('truck', notes[k]!.kind)
      shown = idx
      said.textContent = noteText(notes[idx]!, input)
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
    const time = ((now - started) / 1000) * (duration / TRUCK_REPLAY.seconds)
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
