/**
 * The survey-day highlights (PR 10o; Kelbo chose highlights in 3D, 16
 * November 2026): survey day's two flights over the wheat from behind your
 * plane, the client's plane as a see-through twin alongside. A survey runs
 * most of two hours, so it plays in clips: the launch and the first turn,
 * the day's big gust on a turn (slowed down: a plane held too loosely spins
 * into the crop), and the planes gliding down at their reserve. A live
 * readout gives the distance flown, your battery, their plane and the
 * survey's clock; the commentator says what each clip shows. At the end it
 * shows your declared range next to the real one, then hands over to the
 * survey-day debrief. Every number comes from survey day's two flights.
 */
import type { PlaneDesign } from '../data/plane'
import type { Weather } from '../data/skies'
import { t } from '../data/strings'
import type { SurveyDay, SurveyFlight } from '../sim/planeJob'
import { clipClock, clipsPlayTime, planePose, planeRide, surveyClips, surveyNotes, type SurveyNote } from '../sim/planeReplay'
import { trackAt } from '../sim/replay'
import { fixed } from './format'
import { commentate } from '../audio/voice'

export interface PlaneReplayInput {
  client: string
  event: string
  /** Your plane and the client's own. */
  design: PlaneDesign
  setup: PlaneDesign
  /** Survey day, and both planes' flights on it. */
  day: SurveyDay
  flight: SurveyFlight
  baselineFlight: SurveyFlight
  /** The declared range on the usual day, and the real one (null if the usual gust stalls it), km. */
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

/** A survey's clock, h:mm:ss. */
function clockText(seconds: number): string {
  const s = Math.floor(seconds)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`
}

function noteText(n: SurveyNote, input: PlaneReplayInput): string {
  switch (n.kind) {
    case 'launch':
      return t('svr.note.launch', { client: input.client })
    case 'later':
      return t('svr.note.later', { km: fixed(n.km, 0) })
    case 'gust': {
      const gust = kmh(n.gust)
      const limit = kmh(n.limit)
      if (!n.mine) return t(n.old === false ? 'svr.note.gustBothStall' : 'svr.note.gustStall', { gust, limit })
      return t(n.old === false ? 'svr.note.gustOldStall' : 'svr.note.gustRide', { gust, limit })
    }
    case 'landOld':
      return t('svr.note.landOld', { km: fixed(n.km, 1) })
    case 'end': {
      const gain = n.km - n.oldKm
      if (n.stalled) return t(n.oldStalled ? 'svr.note.endBothStall' : 'svr.note.endStall', { km: fixed(n.km, 1), old: fixed(n.oldKm, 1) })
      return t(gain >= 0 ? 'svr.note.endFurther' : 'svr.note.endShorter', { km: fixed(n.km, 1), gain: fixed(Math.abs(gain), 1) })
    }
  }
}

/** Play the highlights over everything; they remove themselves when done. */
export async function playPlaneReplay(input: PlaneReplayInput): Promise<void> {
  const { createReplayView } = await import('../render/replayScene')
  const cls = input.design.class
  const mine = planeRide(cls, input.flight)
  const old = planeRide(cls, input.baselineFlight)
  const clips = surveyClips(mine, old, input.day)
  const playTime = clipsPlayTime(clips)
  const notes = surveyNotes(mine, old, input.day, input.flight, clips)
  // The strip's length: as far as either plane flew.
  const length = Math.max(mine.end, old.end)

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
  const flown = readout(t('svr.flown'))
  const battery = readout(t('svr.battery'))
  const theirs = readout(t('svr.theirs'))
  const clockR = readout(t('svr.clock'))
  const reads = el('div', 'replay-reads has-lap')
  reads.append(clockR.box, flown.box, battery.box, theirs.box)
  const said = el('p', 'replay-line')
  said.setAttribute('aria-live', 'polite')
  // The whole survey as a strip, a tick where the day's big gust came: both planes as dots.
  const strip = el('div', 'replay-strip')
  strip.setAttribute('aria-hidden', 'true')
  const gustTick = el('span', 'replay-tick')
  gustTick.style.left = `${Math.min(100, ((input.day.gustAt * 1000) / length) * 100)}%`
  strip.append(gustTick)
  const dotOld = el('span', 'replay-dot is-old')
  const dotMine = el('span', 'replay-dot is-mine')
  strip.append(dotOld, dotMine)
  const legend = el('p', 'replay-legend')
  legend.append(el('span', 'replay-key is-mine'), t('svr.legend.mine'), el('span', 'replay-key is-old'), t('svr.legend.old'))
  const end = el('div', 'replay-end')
  end.hidden = true
  const verdict = el(
    'p',
    'replay-predicted',
    input.actual === null ? t('svr.predictedStall', { pred: fixed(input.predicted, 1) }) : t('svr.predicted', { pred: fixed(input.predicted, 1), real: fixed(input.actual, 1) }),
  )
  const next = el('button', 'shop-order', t('svr.debrief'))
  next.type = 'button'
  end.append(verdict, next)
  panel.append(reads, said, strip, legend, end)
  root.append(stage, top, panel)
  document.body.append(root)

  const reduce = reducedMotion()
  const view = createReplayView(stage, { still: reduce, survey: true, weather: input.weather })
  const panelWatch = new ResizeObserver(() => view.setInset(panel.offsetHeight))
  panelWatch.observe(panel)
  view.setCourse(mine.course, { windFromDeg: 0, calm: true })
  view.setRiders(input.design, input.setup)

  let raf = 0
  let started = 0
  let last = 0
  let shown = -1
  let clipShown = -1
  let closed = false

  /** How far a plane had got at `time`, km, and whether it's down yet. */
  const reached = (end: number, speed: number, time: number) => Math.min(time * speed, end) / 1000

  function draw(time: number, dt: number) {
    const me = trackAt(mine, time)
    const them = trackAt(old, time)
    // Reduced motion: a stalled plane is shown already down, no spin.
    const pose = (ride: typeof mine) => {
      const p = planePose(ride, time)
      return reduce && ride.stalledAt !== null && time >= ride.stalledAt ? { ...p, height: 0, spin: 0 } : p
    }
    view.setPlanes(pose(mine), pose(old))
    view.place(me, them, dt)
    view.render()
    const myKm = reached(mine.end, mine.speed, time)
    const oldKm = reached(old.end, old.speed, time)
    clockR.value.textContent = clockText(time)
    flown.value.textContent = `${fixed(myKm, 1)} km`
    const myDown = time * mine.speed >= mine.end
    // Battery left: the share of the charge's range still to fly (a plane that spun in has no say).
    battery.value.textContent = myDown && mine.stalledAt !== null ? t('svr.down') : `${fixed(Math.max(0, 1 - myKm / input.flight.range) * 100, 0)} %`
    const oldDown = time * old.speed >= old.end
    // Down, it says how (the commentator and the strip say where): a long value would be cut off on a phone.
    theirs.value.textContent = oldDown ? t(old.stalledAt !== null ? 'svr.theirsSpun' : 'svr.theirsDown') : `${fixed(oldKm, 1)} km`
    dotMine.style.left = `${((myKm * 1000) / length) * 100}%`
    dotOld.style.left = `${((oldKm * 1000) / length) * 100}%`
    let idx = -1
    for (let i = 0; i < notes.length; i++) if (notes[i]!.t <= time) idx = i
    if (idx !== shown && idx >= 0) {
      // Each moment passed since the last frame gets its sound and the commentator's call, in order, so two
      // landing in one frame both play (PR 13u); at most the last two, so a long pause doesn't fire a pile at once.
      for (let k = Math.max(shown + 1, idx - 1); k <= idx; k++) commentate('plane', notes[k]!.kind)
      shown = idx
      said.textContent = noteText(notes[idx]!, input)
    }
  }

  function finish() {
    cancelAnimationFrame(raf)
    draw(clips[clips.length - 1]!.to, 1e3)
    skip.hidden = true
    end.hidden = false
    next.focus()
  }

  function tick(now: number) {
    if (closed) return
    if (!started) started = last = now
    let dt = (now - last) / 1000
    last = now
    const s = (now - started) / 1000
    if (s >= playTime) {
      finish()
      return
    }
    const at = clipClock(clips, s)
    // A cut to the next clip: the camera jumps straight there rather than swinging round.
    if (at.clip !== clipShown) {
      if (clipShown >= 0) dt = 1e3
      clipShown = at.clip
    }
    draw(at.time, dt)
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
