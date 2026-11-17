/**
 * The quad race replay (PR 10h): race day's five laps of the club's gate
 * course from close behind your quad, the pilot's old quad as a
 * see-through twin alongside, sped up, with a live readout (the lap, the
 * race clock, your speed, and the gap to their quad at the same spot) and a
 * commentator's line at the moments that matter. Each quad leans as the
 * race says: forward pulling away, tipped back braking. A quad that
 * tumbles spins down onto the grass where it did. At the end it shows your
 * declared race next to the real one, then hands over to the club race's
 * debrief. Every number comes from race day's two races.
 */
import { DRONE_RACE, type DroneCourse, type DroneDesign } from '../data/drone'
import { DRONE_REPLAY } from '../data/replay'
import { t } from '../data/strings'
import type { DroneRace } from '../sim/drone'
import { droneClock, droneDuration, droneGates, dronePlayTime, droneLap, droneNotes, droneRide, lapAt, leanAt, type DroneNote, type DroneRide } from '../sim/droneReplay'
import { rideTime, timeAt, trackAt } from '../sim/replay'
import { fixed } from './format'
import { commentate, finishGain } from '../audio/voice'

export interface DroneReplayInput {
  client: string
  event: string
  course: DroneCourse
  /** Your quad and the pilot's old one. */
  design: DroneDesign
  setup: DroneDesign
  /** Race day's two races. */
  race: DroneRace
  baselineRace: DroneRace
  /** The declared race on the usual day, and the real one (null if it tumbled), s. */
  predicted: number
  actual: number | null
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

/** "0.42 s up", "0.10 s down" or "level" against the old quad. */
function gapText(s: number): string {
  if (Math.abs(s) < 0.005) return t('replay.level')
  return t(s > 0 ? 'replay.up' : 'replay.down', { s: fixed(Math.abs(s), 2) })
}

const kmh = (v: number) => fixed(v * 3.6, 0)

function noteText(n: DroneNote, input: DroneReplayInput): string {
  switch (n.kind) {
    case 'start':
      return t('qr.note.start', { client: input.client, laps: DRONE_RACE.laps })
    case 'top':
      return t('qr.note.top', { mine: kmh(n.speed), old: kmh(n.oldSpeed) })
    case 'hot':
      return t('qr.note.hot', { s: fixed(n.t, 0) })
    case 'tumble':
      return t(n.braking ? 'qr.note.tumbleBraking' : 'qr.note.tumbleFlying', { speed: kmh(n.speed) })
    case 'finish':
      return n.time === null ? t('qr.note.oldFinish', { time: fixed(n.oldTime, 2) }) : t('qr.note.finish', { time: fixed(n.time, 2), gap: gapText(n.oldTime - n.time) })
  }
}

/** How far through a tumble's fall a quad is at race time `time`: 0 flying, 1 on the grass. */
function fallAt(ride: DroneRide, time: number, reduce: boolean): number {
  if (ride.tumbledAt === null || time < ride.tumbledAt) return 0
  return reduce ? 1 : Math.min(1, (time - ride.tumbledAt) / DRONE_REPLAY.tumble.seconds)
}

/** Play the replay over everything; it removes itself when done. */
export async function playDroneReplay(input: DroneReplayInput): Promise<void> {
  const { createReplayView } = await import('../render/replayScene')
  const mine = droneRide(input.course, input.race)
  const old = droneRide(input.course, input.baselineRace)
  const duration = droneDuration(mine, old)
  const playTime = dronePlayTime(mine, old)
  const notes = droneNotes(input.race, input.baselineRace, mine, old)
  const mineEnd = rideTime(mine)
  const oldEnd = rideTime(old)
  // The whole race's length (the old quad flies it all, or as far as it got).
  const lap = droneLap(input.course).reduce((s, p) => s + p.length, 0)
  const length = lap * DRONE_RACE.laps

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
  const lapR = readout(t('qr.lap'))
  const clockR = readout(t('replay.clock'))
  const speed = readout(t('replay.speed'))
  const gap = readout(t('qr.gap'))
  const reads = el('div', 'replay-reads has-lap')
  reads.append(lapR.box, clockR.box, speed.box, gap.box)
  const said = el('p', 'replay-line')
  said.setAttribute('aria-live', 'polite')
  // The whole race as a strip, a tick where each lap starts: both quads as dots.
  const strip = el('div', 'replay-strip')
  strip.setAttribute('aria-hidden', 'true')
  for (let k = 1; k < DRONE_RACE.laps; k++) {
    const tick = el('span', 'replay-tick')
    tick.style.left = `${(k / DRONE_RACE.laps) * 100}%`
    strip.append(tick)
  }
  const dotOld = el('span', 'replay-dot is-old')
  const dotMine = el('span', 'replay-dot is-mine')
  strip.append(dotOld, dotMine)
  const legend = el('p', 'replay-legend')
  legend.append(el('span', 'replay-key is-mine'), t('qr.legend.mine'), el('span', 'replay-key is-old'), t('qr.legend.old'))
  const end = el('div', 'replay-end')
  end.hidden = true
  const verdict = el(
    'p',
    'replay-predicted',
    input.actual === null ? t('qr.predictedTumble', { pred: fixed(input.predicted, 2) }) : t('qr.predicted', { pred: fixed(input.predicted, 2), real: fixed(input.actual, 2) }),
  )
  const next = el('button', 'shop-order', t('qr.debrief'))
  next.type = 'button'
  end.append(verdict, next)
  panel.append(reads, said, strip, legend, end)
  root.append(stage, top, panel)
  document.body.append(root)

  const reduce = reducedMotion()
  const view = createReplayView(stage, { still: reduce, drone: true })
  const panelWatch = new ResizeObserver(() => view.setInset(panel.offsetHeight))
  panelWatch.observe(panel)
  view.setCourse(droneLap(input.course), { windFromDeg: 0, calm: true, gates: droneGates(input.course) })
  view.setRiders(input.design, input.setup)

  let raf = 0
  let started = 0
  let last = 0
  let shown = -1
  let closed = false

  function draw(time: number, dt: number) {
    const me = trackAt(mine, time)
    const them = trackAt(old, time)
    // Falling, a quad keeps the lean it tumbled at.
    view.setQuads(
      { lean: leanAt(mine, Math.min(time, mineEnd)), fall: fallAt(mine, time, reduce) },
      { lean: leanAt(old, Math.min(time, oldEnd)), fall: fallAt(old, time, reduce) },
    )
    view.place(me, them, reduce ? 1e3 : dt)
    view.render()
    const out = mine.tumbledAt !== null && time >= mine.tumbledAt
    lapR.value.textContent = t('qr.lapValue', { lap: lapAt(input.course, me.distance), laps: DRONE_RACE.laps })
    clockR.value.textContent = `${fixed(Math.min(time, out ? time : mineEnd), 2)} s`
    speed.value.textContent = out ? t('qr.out') : `${kmh(me.speed)} km/h`
    // The gap at the spot you've reached: when their quad got there, against when yours did.
    if (out) gap.value.textContent = t('qr.out')
    else {
      const theirs = me.done ? oldEnd : timeAt(old, me.distance)
      gap.value.textContent = gapText(theirs - Math.min(time, mineEnd))
    }
    dotMine.style.left = `${(me.distance / length) * 100}%`
    dotOld.style.left = `${(them.distance / length) * 100}%`
    let idx = -1
    for (let i = 0; i < notes.length; i++) if (notes[i]!.t <= time) idx = i
    if (idx !== shown && idx >= 0) {
      shown = idx
      said.textContent = noteText(notes[idx]!, input)
      // The commentator says it too (PR 14b).
      commentate('drone', notes[idx]!.kind, finishGain(notes[idx]!))
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
    const s = (now - started) / 1000
    if (s >= playTime) {
      finish()
      return
    }
    draw(droneClock(mine, s), dt)
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
