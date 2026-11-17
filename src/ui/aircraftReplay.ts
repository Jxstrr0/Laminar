/**
 * The light aircraft's test day in 3D (PR 10v; Kelbo chose speed runs and
 * the stall check, 16 November 2026). First the inspector slows your plane
 * high over Belyanka until the wing lets go, with its airspeed and nose
 * angle against the certified stall speed. Past the limit, a cut to the
 * plane parked: grounded. Signed off, both planes fly a timed low pass over
 * the measured kilometre, abreast at the start, each with a stopwatch.
 * Then your declared cruise next to the real one, and the test-day debrief.
 * Every number comes from test day's two flights.
 */
import type { AircraftDesign } from '../data/aircraft'
import { AIRCRAFT_REPLAY as R } from '../data/replay'
import { t } from '../data/strings'
import { KMH } from '../sim/aircraft'
import type { TestFlight } from '../sim/aircraftJob'
import { aircraftClips, aircraftFrames, aircraftNotes, aircraftPlayTime, aircraftShow, checkAirspeed, stopwatch, type AircraftNote } from '../sim/aircraftReplay'
import { clipClock } from '../sim/planeReplay'
import { fixed } from './format'
import { commentate } from '../audio/voice'

export interface AircraftReplayInput {
  client: string
  event: string
  /** Your plane and the client's own. */
  design: AircraftDesign
  setup: AircraftDesign
  /** Both planes' flights on test day. */
  flight: TestFlight
  baselineFlight: TestFlight
  /** The declared cruise on the usual day, and the real one (null if the inspector won't sign it off), km/h. */
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

/** A readout whose label changes between the check and the passes. */
function readout(): { box: HTMLElement; label: HTMLElement; value: HTMLElement } {
  const box = el('div', 'replay-read')
  const label = el('span', 'replay-read-label')
  const value = el('span', 'replay-read-value')
  box.append(label, value)
  return { box, label, value }
}

const kmhText = (v: number) => `${fixed(v, 0)} km/h`
const secs = (s: number) => `${fixed(s, 2)} s`

function noteText(n: AircraftNote, input: AircraftReplayInput): string {
  switch (n.kind) {
    case 'check':
      return t('tdr.note.check', { client: input.client })
    case 'break':
      return t(n.passes ? 'tdr.note.breakPass' : 'tdr.note.breakFail', { stall: fixed(n.stall, 1), limit: fixed(n.limit, 0) })
    case 'grounded':
      return t('tdr.note.grounded')
    case 'pass':
      return t('tdr.note.pass')
    case 'cross': {
      const vars = { time: fixed(n.time, 2), kmh: fixed(n.kmh, 1), gap: fixed(n.gap, 2) }
      if (n.mine) return t(n.first ? 'tdr.note.mineFirst' : 'tdr.note.mineSecond', vars)
      return t(n.first ? 'tdr.note.oldFirst' : 'tdr.note.oldSecond', vars)
    }
  }
}

/** Play test day over everything; it removes itself when done. */
export async function playAircraftReplay(input: AircraftReplayInput): Promise<void> {
  const { createReplayView } = await import('../render/replayScene')
  const show = aircraftShow(input.design, input.flight, input.baselineFlight)
  const clips = aircraftClips(show)
  const playTime = aircraftPlayTime(clips)
  const notes = aircraftNotes(show)
  const reduce = reducedMotion()

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
  const reads = [readout(), readout(), readout(), readout()]
  const grid = el('div', 'replay-reads has-lap')
  grid.append(...reads.map((r) => r.box))
  const said = el('p', 'replay-line')
  said.setAttribute('aria-live', 'polite')
  // The strip: an airspeed tape with the certified limit marked through the check; the measured course with both markers on the passes.
  const strip = el('div', 'replay-strip')
  strip.setAttribute('aria-hidden', 'true')
  const tickA = el('span', 'replay-tick')
  const tickB = el('span', 'replay-tick')
  const dotOld = el('span', 'replay-dot is-old')
  const dotMine = el('span', 'replay-dot is-mine')
  strip.append(tickA, tickB, dotOld, dotMine)
  const legend = el('p', 'replay-legend')
  const end = el('div', 'replay-end')
  end.hidden = true
  const verdict = el(
    'p',
    'replay-predicted',
    input.actual === null
      ? t('tdr.predictedStall', { pred: fixed(input.predicted, 1) })
      : t('tdr.predicted', { pred: fixed(input.predicted, 1), real: fixed(input.actual, 1) }),
  )
  const next = el('button', 'shop-order', t('tdr.debrief'))
  next.type = 'button'
  end.append(verdict, next)
  panel.append(grid, said, strip, legend, end)
  root.append(stage, top, panel)
  document.body.append(root)

  const view = createReplayView(stage, { still: reduce, airfield: true })
  const panelWatch = new ResizeObserver(() => view.setInset(panel.offsetHeight))
  panelWatch.observe(panel)
  view.setRiders(input.design, input.setup)

  // The airspeed tape runs from a little under the limit up to the check's start.
  const tapeLow = Math.min(show.stall, show.limit) - 15
  const tapeAt = (kmh: number) => `${Math.min(100, Math.max(0, ((kmh - tapeLow) / (R.check.from - tapeLow)) * 100))}%`
  // The passes' strip runs from the run-in's start to the run-out's end.
  const passLen = R.pass.runIn + R.pass.course + R.pass.runOut
  const passAt = (x: number) => `${Math.min(100, Math.max(0, ((x + R.pass.runIn) / passLen) * 100))}%`

  let phase: 'check' | 'after' | null = null
  /** Labels, ticks and legend for the part of the day on screen. */
  function setPhase(p: 'check' | 'after') {
    if (p === phase) return
    phase = p
    const labels =
      p === 'check'
        ? [t('tdr.airspeed'), t('tdr.nose'), t('tdr.limit'), t('tdr.inspector')]
        : show.passes
          ? [t('tdr.yourWatch'), t('tdr.yourSpeed'), t('tdr.theirWatch'), t('tdr.theirSpeed')]
          : [t('tdr.airspeed'), t('tdr.nose'), t('tdr.limit'), t('tdr.inspector')]
    reads.forEach((r, i) => (r.label.textContent = labels[i]!))
    const passing = p === 'after' && show.passes
    tickA.style.left = passing ? passAt(0) : tapeAt(show.limit)
    tickB.hidden = !passing
    tickB.style.left = passAt(R.pass.course)
    dotOld.hidden = !passing
    legend.replaceChildren(el('span', 'replay-key is-mine'), t('tdr.legend.mine'))
    if (passing) legend.append(el('span', 'replay-key is-old'), t('tdr.legend.old'))
    else legend.append(` · ${t('tdr.legend.limit')}`)
  }

  let raf = 0
  let started = 0
  let last = 0
  let shown = -1
  let clipShown = -1
  let closed = false

  function draw(time: number, dt: number) {
    const f = aircraftFrames(show, time)
    // Reduced motion: the break is shown without the plane rocking (the airspeed and the words still tell it).
    const pose = reduce && time >= show.stallAt && time < show.afterAt ? { ...f.mine.pose, pitch: 0, bank: 0 } : f.mine.pose
    view.setPlanes(pose, f.old.pose)
    view.setShown(f.mine.visible, f.old.visible)
    view.place(f.mine.point, f.old.point, dt)
    view.render()
    const after = time >= show.afterAt
    setPhase(after ? 'after' : 'check')
    const [a, b, c, d] = reads as [ReturnType<typeof readout>, ReturnType<typeof readout>, ReturnType<typeof readout>, ReturnType<typeof readout>]
    if (after && show.passes) {
      const watch = (mine: boolean) => {
        const w = stopwatch(show, mine, time)
        return w ? secs(w.time) : secs(0)
      }
      a.value.textContent = watch(true)
      b.value.textContent = kmhText(show.mineSpeed * KMH)
      c.value.textContent = watch(false)
      d.value.textContent = kmhText(show.oldSpeed * KMH)
      dotMine.style.left = passAt(f.mine.point.x)
      dotOld.style.left = passAt(f.old.point.x)
    } else {
      const speed = after ? 0 : checkAirspeed(show, time)
      a.value.textContent = after ? t('tdr.parked') : kmhText(speed)
      const deg = Math.round((f.mine.pose.pitch * 180) / Math.PI)
      b.value.textContent = after ? '—' : t(deg < 0 ? 'tdr.noseDown' : 'tdr.noseUp', { deg: Math.abs(deg) })
      c.value.textContent = kmhText(show.limit)
      d.value.textContent = time < show.stallAt ? t('tdr.watching') : t(show.passes ? 'tdr.signed' : 'tdr.notSigned')
      dotMine.style.left = tapeAt(after ? show.stall : speed)
    }
    let idx = -1
    for (let i = 0; i < notes.length; i++) if (notes[i]!.t <= time) idx = i
    if (idx !== shown && idx >= 0) {
      // Each moment passed since the last frame gets its sound and the commentator's call, in order, so two
      // landing in one frame both play (PR 13u); at most the last two, so a long pause doesn't fire a pile at once.
      for (let k = Math.max(shown + 1, idx - 1); k <= idx; k++) commentate('aircraft', notes[k]!.kind)
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
