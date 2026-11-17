/**
 * The race-day replay (plan section 4, step 8): a full-screen 3D replay of
 * the time trial, your design against the client's old setup ridden in the
 * same air, with a live readout (race clock, distance, speed, wind, the gap)
 * and a commentator's line at the moments that matter. At the finish it
 * shows your prediction next to what the road read, then hands over to the
 * debrief. Every number comes from the field result; nothing is re-run.
 */
import type { Design } from '../sim/design'
import type { CourseSegment } from '../data/field'
import { REPLAY } from '../data/replay'
import { t } from '../data/strings'
import { gapAt, replayNotes, rideTime, trackAt, windFeel, type ReplayNote, type Ride, type WindFeel } from '../sim/replay'
import type { FieldResult } from '../sim/views'
import { fixed, raceTime } from './format'
import { commentate, voiceGap } from '../audio/voice'

export interface ReplayInput {
  client: string
  event: string
  course: readonly CourseSegment[]
  design: Design
  setup: Design
  result: FieldResult
  baseline: FieldResult
  predicted: number
  /** On the indoor track: the lap length, m. */
  lap?: number
  /** Raced on ice. */
  ice?: boolean
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

/** "12.3 s up", "4.0 s down" or "level", against the old setup. */
function gapText(gap: number): string {
  if (Math.abs(gap) < REPLAY.levelWithin) return t('replay.level')
  return t(gap > 0 ? 'replay.up' : 'replay.down', { s: fixed(Math.abs(gap), 1) })
}

const feel = (w: WindFeel) => t(`replay.feel.${w}`)

function noteText(n: ReplayNote, input: ReplayInput): string {
  switch (n.kind) {
    case 'start':
      return n.wind ? t('replay.note.start', { client: input.client, wind: feel(n.wind) }) : t('replay.note.startStill', { client: input.client })
    case 'bell':
      return t('replay.note.bell', { gap: gapText(n.gap) })
    case 'turn':
      return t('replay.note.turn', { km: fixed(n.km, 0), wind: feel(n.wind) })
    case 'half':
      return t('replay.note.half', { gap: gapText(n.gap) })
    case 'meet':
      return t('replay.note.meet', { gap: gapText(n.gap) })
    case 'finish':
      return t('replay.note.finish', { time: raceTime(input.result.time), gap: gapText(n.gap) })
    case 'gust':
      return t('replay.note.gust', { client: input.client })
    case 'fade':
      return t(input.design.sport === 'skating' ? 'replay.note.fadeSkater' : 'replay.note.fade', { client: input.client })
  }
}

/** A label over a value in the readout. */
function readout(label: string): { box: HTMLElement; value: HTMLElement } {
  const box = el('div', 'replay-read')
  const value = el('span', 'replay-read-value')
  box.append(el('span', 'replay-read-label', label), value)
  return { box, value }
}

/** Play the replay over everything; it removes itself when done. */
export async function playReplay(input: ReplayInput): Promise<void> {
  const { createReplayView } = await import('../render/replayScene')
  // Each ride on the course as that rider rode it (split where they sat up).
  const mine: Ride = { course: input.result.course, segments: input.result.segments }
  const old: Ride = { course: input.baseline.course, segments: input.baseline.segments }
  const length = input.course.reduce((s, c) => s + c.length, 0)
  const duration = Math.max(rideTime(mine), rideTime(old))
  const calm = input.result.windSpeed < REPLAY.calm
  const notes = replayNotes(mine, old, { windFromDeg: input.result.windFromDeg, calm, lap: input.lap })
  const laps = input.lap ? Math.round(length / input.lap) : 0
  const playSeconds = input.lap ? REPLAY.trackSeconds : REPLAY.seconds

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
  const dist = readout(t('replay.distance'))
  const speed = readout(t('replay.speed'))
  const wind = readout(t('replay.wind'))
  const gap = readout(t('replay.gap'))
  const reads = el('div', 'replay-reads')
  reads.append(clock.box, dist.box, speed.box, wind.box, gap.box)
  const line = el('p', 'replay-line')
  line.setAttribute('aria-live', 'polite')
  // Progress along the course: both riders as dots.
  const strip = el('div', 'replay-strip')
  strip.setAttribute('aria-hidden', 'true')
  // Ticks at each turn on the road, or at each lap on the track.
  const ticks: number[] = []
  if (input.lap) for (let d = input.lap; d < length - 1e-6; d += input.lap) ticks.push(d)
  else {
    let along = 0
    for (const seg of input.course.slice(0, -1)) ticks.push((along += seg.length))
  }
  for (const d of ticks) {
    const tick = el('span', 'replay-tick')
    tick.style.left = `${(d / length) * 100}%`
    strip.append(tick)
  }
  const dotOld = el('span', 'replay-dot is-old')
  const dotMine = el('span', 'replay-dot is-mine')
  strip.append(dotOld, dotMine)
  const legend = el('p', 'replay-legend')
  legend.append(el('span', 'replay-key is-mine'), t('replay.legend.mine'), el('span', 'replay-key is-old'), t('replay.legend.old'))
  const end = el('div', 'replay-end')
  end.hidden = true
  const verdict = el('p', 'replay-predicted', t('replay.predicted', { pred: fixed(input.predicted, 3), real: fixed(input.result.cdA, 3) }))
  const next = el('button', 'shop-order', t('replay.debrief'))
  next.type = 'button'
  end.append(verdict, next)
  panel.append(reads, line, strip, legend, end)
  root.append(stage, top, panel)
  document.body.append(root)

  const reduce = reducedMotion()
  const view = createReplayView(stage, { still: reduce })
  const panelWatch = new ResizeObserver(() => view.setInset(panel.offsetHeight))
  panelWatch.observe(panel)
  view.setCourse(input.course, { windFromDeg: input.result.windFromDeg, calm, lap: input.lap, ice: input.ice })
  view.setRiders(input.design, input.setup)

  let raf = 0
  let started = 0
  let last = 0
  let shown = -1
  let closed = false

  function draw(raceT: number, dt: number) {
    const me = trackAt(mine, raceT)
    const them = trackAt(old, raceT)
    view.place(me, them, reduce ? 1e3 : dt)
    view.render()
    clock.value.textContent = raceTime(Math.min(raceT, rideTime(mine)))
    dist.value.textContent = laps
      ? t('replay.lap', { n: Math.min(laps, Math.floor(me.distance / input.lap!) + 1), laps })
      : `${fixed(me.distance / 1000, 1)} km`
    speed.value.textContent = `${fixed(me.speed * 3.6, 1)} km/h`
    wind.value.textContent = calm
      ? t('replay.wind.still')
      : t(`replay.wind.${windFeel(me.heading, input.result.windFromDeg)}`, { yaw: fixed(Math.abs(me.yawDeg), 0) })
    gap.value.textContent = gapText(gapAt(mine, old, raceT))
    dotMine.style.left = `${(me.distance / length) * 100}%`
    dotOld.style.left = `${(them.distance / length) * 100}%`
    let idx = -1
    for (let i = 0; i < notes.length; i++) if (notes[i]!.t <= raceT) idx = i
    if (idx !== shown && idx >= 0) {
      // Each moment passed since the last frame gets its sound and the commentator's call, in order, so two
      // landing in one frame both play (PR 13u); at most the last two, so a long pause doesn't fire a pile at once.
      for (let k = Math.max(shown + 1, idx - 1); k <= idx; k++) commentate('ride', notes[k]!.kind, voiceGap(notes[k]!, input.baseline.time))
      shown = idx
      line.textContent = noteText(notes[idx]!, input)
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
    const raceT = ((now - started) / 1000) * (duration / playSeconds)
    if (raceT >= duration) {
      finish()
      return
    }
    draw(raceT, dt)
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
