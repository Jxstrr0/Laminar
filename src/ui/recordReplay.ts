/**
 * The record-run replay (PR 9v): record day on the salt from behind your
 * car, the team's old car as a see-through twin beside it, both runs, the
 * long run-up fast and the timed kilometre slower. A live readout shows the
 * run, your speed and your speed through the timed kilometre; the
 * commentator speaks at the moments that matter. The chutes come out at the
 * end of each run, or early where the nose went light (it lifts first) or
 * the car wandered (it swings first). A jet car shows its Mach number, a
 * Mach cone off its nose past Mach 1, and a flash and a line at the
 * moment it goes through the sound barrier (PR 9z+). At the end it shows record day's
 * two-way means and your declared speed against the still day's, then hands
 * over to speed week's debrief. Every number comes from record day's runs.
 */
import type { RecordDesign } from '../data/record'
import type { Weather } from '../data/skies'
import { RECORD_RUN } from '../data/record'
import { RECORD_REPLAY, REPLAY } from '../data/replay'
import { t } from '../data/strings'
import { soundSpeed, type RecordAttempt, type RecordDay } from '../sim/record'
import { chutesAt, recordMach, recordNotes, recordRide, runClock, runTimeAt, saltCourse, type RecordNote, type RunIndex } from '../sim/recordReplay'
import { trackAt, type Ride } from '../sim/replay'
import { fixed } from './format'
import { commentate } from '../audio/voice'

export interface RecordReplayInput {
  client: string
  event: string
  /** Your car and the team's old one. */
  design: RecordDesign
  setup: RecordDesign
  /** Record day's air, and both cars' attempts in it. */
  day: RecordDay
  attempt: RecordAttempt
  baselineAttempt: RecordAttempt
  /** The declared and the real two-way mean on the still day, m/s (real: null if the chutes came out there). */
  predicted: number
  actual: number | null
  /** Called when the replay closes, whether watched to the end or skipped. */
  /** The day's sky (PR 13bd), clear to overcast: from the day's wind, or its air against the venue's usual. */
  weather: Weather
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

const kmh = (v: number) => fixed(v * 3.6, 0)
/** A two-way mean, or "no time" if the chutes came out. */
const meanText = (v: number | null) => (v === null ? t('rr.noTime') : `${kmh(v)} km/h`)

/** The wind on a run, in words: in the face, behind, or still. */
function airText(head: number): string {
  if (Math.abs(head) < REPLAY.calm) return t('rr.air.still')
  return t(head > 0 ? 'rr.air.head' : 'rr.air.tail', { wind: fixed(Math.abs(head), 1) })
}

function noteText(n: RecordNote): string {
  switch (n.kind) {
    case 'start':
      return t(n.run === 0 ? 'rr.note.out' : 'rr.note.back', { air: airText(n.head) })
    case 'timed':
      return n.oldSpeed === null ? t('rr.note.timedAlone', { mine: kmh(n.speed) }) : t('rr.note.timed', { mine: kmh(n.speed), old: kmh(n.oldSpeed) })
    case 'through':
      return n.oldSpeed === null ? t('rr.note.throughAlone', { mine: kmh(n.speed) }) : t('rr.note.through', { mine: kmh(n.speed), old: kmh(n.oldSpeed) })
    case 'abort':
      return t(n.cause === 'lift' ? 'rr.note.light' : 'rr.note.wander', { speed: kmh(n.speed) })
    case 'oldAbort':
      return t(n.cause === 'lift' ? 'rr.note.oldLight' : 'rr.note.oldWander', { speed: kmh(n.speed) })
    case 'barrier':
      return t('rr.note.barrier', { speed: kmh(n.speed) })
  }
}

/** Where the wind blows from on a run, degrees (the course runs north, then back south), and whether there's any. */
function windOf(day: RecordDay, run: RunIndex): { windFromDeg: number; calm: boolean } {
  const along = run === 0 ? day.along : day.along + day.shift
  return { windFromDeg: (Math.atan2(day.cross, along) * 180) / Math.PI, calm: Math.hypot(along, day.cross) < REPLAY.calm }
}

const length = (ride: Ride) => ride.course.reduce((sum, seg) => sum + seg.length, 0)

/** Play the replay over everything; it removes itself when done. */
export async function playRecordReplay(input: RecordReplayInput): Promise<void> {
  const { createReplayView } = await import('../render/replayScene')
  const cls = input.design.class
  const runUp = RECORD_RUN.runUp[cls]
  // A jet car's run shows its Mach number, and the moment it goes through the sound barrier (PR 9z+).
  const jet = cls === 'jet'
  const sound = soundSpeed(input.day.temperature)
  const runs = ([0, 1] as const).map((i) => {
    const mineRun = input.attempt.runs[i]
    const oldRun = input.baselineAttempt.runs[i]
    const mine = recordRide(mineRun, i)
    const old = recordRide(oldRun, i)
    const head = i === 0 ? input.day.along : -(input.day.along + input.day.shift)
    const notes = recordNotes(i, mineRun, oldRun, head, cls, jet ? sound : undefined)
    const boom = notes.find((n) => n.kind === 'barrier')
    return { index: i, head, mineRun, mine, old, clock: runClock(mine, mineRun, old, cls, boom?.t), notes, chutes: chutesAt(mine, mineRun, cls) }
  })
  const [first, second] = runs as [(typeof runs)[0], (typeof runs)[0]]
  const secondFrom = first.clock.length + RECORD_REPLAY.turn
  const duration = secondFrom + second.clock.length
  const stripLength = Math.max(...runs.flatMap((r) => [length(r.mine), length(r.old)]))

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
  const runR = readout(t('rr.run'))
  const speed = readout(t('replay.speed'))
  const timed = readout(t('rr.timed'))
  const machR = readout(t('rr.mach'))
  const reads = el('div', 'replay-reads')
  reads.append(runR.box, speed.box, timed.box)
  if (jet) {
    reads.append(machR.box)
    reads.classList.add('has-mach')
  }
  const said = el('p', 'replay-line')
  said.setAttribute('aria-live', 'polite')
  // Metres down the course: both cars as dots, ticks at each end of the timed kilometre.
  const strip = el('div', 'replay-strip')
  strip.setAttribute('aria-hidden', 'true')
  for (const at of [runUp, runUp + RECORD_RUN.timed]) {
    const tick = el('span', 'replay-tick')
    tick.style.left = `${(at / stripLength) * 100}%`
    strip.append(tick)
  }
  const dotOld = el('span', 'replay-dot is-old')
  const dotMine = el('span', 'replay-dot is-mine')
  strip.append(dotOld, dotMine)
  const legend = el('p', 'replay-legend')
  legend.append(el('span', 'replay-key is-mine'), t('cr.legend.mine'), el('span', 'replay-key is-old'), t('cr.legend.old'))
  const end = el('div', 'replay-end')
  end.hidden = true
  const day = el('p', 'replay-predicted', t('rr.day', { mine: meanText(input.attempt.mean), old: meanText(input.baselineAttempt.mean) }))
  const verdict = el(
    'p',
    'replay-predicted',
    input.actual === null ? t('rr.predictedChutes', { pred: kmh(input.predicted) }) : t('rr.predicted', { pred: kmh(input.predicted), real: kmh(input.actual) }),
  )
  const next = el('button', 'shop-order', t('rr.debrief'))
  next.type = 'button'
  end.append(day, verdict, next)
  panel.append(reads, said, strip, legend, end)
  root.append(stage, top, panel)
  document.body.append(root)

  const reduce = reducedMotion()
  const view = createReplayView(stage, { still: reduce, record: true, weather: input.weather })
  const panelWatch = new ResizeObserver(() => view.setInset(panel.offsetHeight))
  panelWatch.observe(panel)

  /** The run on screen, so the course is laid only when it changes. */
  let laid: RunIndex | null = null
  function lay(run: RunIndex) {
    if (laid === run) return
    laid = run
    view.setCourse(saltCourse(run, cls), windOf(input.day, run))
    // Setting the cars again puts the camera straight behind them for the run back.
    view.setRiders(input.design, input.setup)
    shown = -1
  }

  let raf = 0
  let started = 0
  let last = 0
  let shown = -1
  let closed = false

  /** Draw the replay `time` seconds in (between the runs, the first run's end holds). */
  function draw(time: number, dt: number) {
    const r = time < secondFrom ? first : second
    const local = r === first ? Math.min(time, first.clock.length) : time - secondFrom
    lay(r.index)
    const at = runTimeAt(r.clock, local)
    const me = trackAt(r.mine, at)
    const them = trackAt(r.old, at)
    if (jet) {
      // Past the end the car is stopped: no Mach to show.
      const mach = me.done ? 0 : recordMach(me.speed, r.head, sound)
      view.setMach(mach, them.done ? 0 : recordMach(them.speed, r.head, sound))
      machR.value.textContent = fixed(mach, 2)
    }
    view.place(me, them, reduce ? 1e3 : dt)
    view.render()
    runR.value.textContent = t('rr.runValue', { n: r.index + 1 })
    speed.value.textContent = `${me.done ? 0 : kmh(me.speed)} km/h`
    timed.value.textContent = at < r.chutes ? '—' : r.mineRun.speed === null ? t('rd.chutes') : `${kmh(r.mineRun.speed)} km/h`
    dotMine.style.left = `${(me.distance / stripLength) * 100}%`
    dotOld.style.left = `${(them.distance / stripLength) * 100}%`
    let idx = -1
    for (let i = 0; i < r.notes.length; i++) if (r.notes[i]!.t <= at) idx = i
    if (idx !== shown && idx >= 0) {
      // Each moment passed since the last frame gets its sound and call, in order (PR 13u; see replayOverlay).
      for (let k = Math.max(shown + 1, idx - 1); k <= idx; k++) commentate('record', r.notes[k]!.kind, { jet })
      shown = idx
      const note = r.notes[idx]!
      said.textContent = noteText(note)
      // The boom: a white flash over the salt, unless motion is turned down (the line says it anyway).
      if (note.kind === 'barrier' && !reduce && dt < 1) {
        root.classList.remove('is-boom')
        void root.offsetWidth
        root.classList.add('is-boom')
      }
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
    const time = (now - started) / 1000
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
