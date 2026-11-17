/**
 * The sensor pod's range day (PR 10af; Kelbo chose the sensor's-eye view,
 * 16 November 2026). The pod's picture of the Stepnoy steppe slides by
 * under a fixed crosshair: it shakes with the pod's buffet, and past the
 * ministry's limit it blurs and the run is called off. Beside it, both
 * pods' clocks on station run until each patrol ends. Then your declared
 * hours next to the real ones, and the range-day debrief. A plain 2D view:
 * no 3D scene to load.
 */
import { POD_REPLAY as R } from '../data/replay'
import { t } from '../data/strings'
import type { PodFlight } from '../sim/podJob'
import { podClocks, podNotes, podShow, steppe, type PodNote } from '../sim/podReplay'
import { fixed } from './format'
import { commentate } from '../audio/voice'

export interface PodReplayInput {
  client: string
  event: string
  /** Seeds the steppe's layout. */
  seed: number
  /** Both pods' patrols on range day. */
  flight: PodFlight
  baselineFlight: PodFlight
  /** The declared hours on station on the usual day, and the real ones (null if the run is rejected). */
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

const hoursText = (h: number) => `${fixed(h, 2)} h`

function noteText(n: PodNote, input: PodReplayInput): string {
  switch (n.kind) {
    case 'start':
      return t('rgr.note.start', { client: input.client })
    case 'buffet':
      return t(n.blurs ? 'rgr.note.blurs' : 'rgr.note.steady', { buffet: fixed(n.buffet, 2), limit: fixed(n.limit, 2) })
    case 'rejected':
      return t('rgr.note.rejected')
    case 'done':
      return t(n.mine ? 'rgr.note.mineDone' : 'rgr.note.oldDone', { hours: fixed(n.hours, 2) })
  }
}

/** The sensor picture's colours, from the style sheet (the same in both themes: it's a sensor's grey picture). */
function sensorColours() {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim() || '#888'
  return { bg: v('--sensor-bg'), fields: [v('--sensor-field-a'), v('--sensor-field-b'), v('--sensor-field-c')], road: v('--sensor-road'), hot: v('--sensor-hot') }
}

/** Play range day over everything; it removes itself when done. */
export function playPodReplay(input: PodReplayInput): void {
  const show = podShow(input.flight, input.baselineFlight)
  const notes = podNotes(show)
  const land = steppe(input.seed)
  const reduce = reducedMotion()
  const colours = sensorColours()

  const root = el('div', 'replay')
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-labelledby', 'replay-title')
  const stage = el('div', 'replay-stage sensor-stage')
  const canvas = el('canvas', 'replay-canvas sensor-picture')
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', t(show.rejected ? 'rgr.pictureBlurred' : 'rgr.pictureSteady'))
  const reticle = el('div', 'sensor-reticle')
  reticle.setAttribute('aria-hidden', 'true')
  const tag = el('p', 'sensor-tag', t('rgr.tag'))
  tag.setAttribute('aria-hidden', 'true')
  stage.append(canvas, reticle, tag)
  const top = el('div', 'replay-top')
  const title = el('h2', 'replay-title', input.event)
  title.id = 'replay-title'
  const skip = el('button', 'chip replay-skip', t('replay.skip'))
  skip.type = 'button'
  skip.setAttribute('aria-label', t('replay.skipName'))
  top.append(title, skip)

  const panel = el('section', 'replay-panel')
  const mine = readout(t('rgr.mine'))
  const old = readout(t('rgr.old'))
  const buffet = readout(t('rgr.buffet'))
  const picture = readout(t('rgr.picture'))
  const grid = el('div', 'replay-reads pod-reads')
  grid.append(mine.box, old.box, buffet.box, picture.box)
  const said = el('p', 'replay-line')
  said.setAttribute('aria-live', 'polite')
  // Two bars: each pod's time on station, against the longer patrol.
  const bars = el('div', 'pod-bars')
  bars.setAttribute('aria-hidden', 'true')
  const barMine = el('span', 'pod-bar-fill is-mine')
  const barOld = el('span', 'pod-bar-fill is-old')
  for (const [label, fill] of [
    [t('rgr.mine'), barMine],
    [t('rgr.old'), barOld],
  ] as const) {
    const row = el('div', 'pod-bar')
    const track = el('span', 'pod-bar-track')
    track.append(fill)
    row.append(el('span', 'pod-bar-label', label), track)
    bars.append(row)
  }
  const end = el('div', 'replay-end')
  end.hidden = true
  const verdict = el(
    'p',
    'replay-predicted',
    input.actual === null
      ? t('rgr.predictedRejected', { pred: fixed(input.predicted, 2) })
      : t('rgr.predicted', { pred: fixed(input.predicted, 2), real: fixed(input.actual, 2) }),
  )
  const next = el('button', 'shop-order', t('rgr.debrief'))
  next.type = 'button'
  end.append(verdict, next)
  panel.append(grid, said, bars, end)
  root.append(stage, top, panel)
  document.body.append(root)

  // The picture fills the space above the panel.
  const fit = () => {
    stage.style.bottom = `${panel.offsetHeight}px`
    const r = stage.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.max(1, Math.round(r.width * dpr))
    canvas.height = Math.max(1, Math.round(r.height * dpr))
  }
  const watch = new ResizeObserver(fit)
  watch.observe(panel)
  watch.observe(root)
  fit()
  buffet.value.textContent = `${fixed(show.buffet, 2)} / ${fixed(show.limit, 2)}`

  /** The steppe, slid by `drift`, shaken by (dx, dy). */
  function paint(time: number) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    const tile = Math.max(w, h) * 1.3
    const slide = ((reduce ? 0 : time) * R.drift * (w / 360)) % tile
    // The shake: a quick wobble that's never quite the same twice. A steady pod barely moves; reduced motion holds it still.
    const amp = reduce ? 0 : show.shake * (w / 360)
    const dx = amp * (Math.sin(time * 23.1) + 0.5 * Math.sin(time * 41.7))
    const dy = amp * (Math.sin(time * 19.3 + 1) + 0.5 * Math.sin(time * 37.9))
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = colours.bg
    ctx.fillRect(0, 0, w, h)
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++) {
        const x0 = ox * tile - slide + dx + (w - tile) / 2
        const y0 = oy * tile + dy + (h - tile) / 2
        for (const f of land.fields) {
          ctx.fillStyle = colours.fields[Math.floor(f.tone * colours.fields.length)] ?? colours.bg
          ctx.fillRect(x0 + f.x * tile, y0 + f.y * tile, f.w * tile, f.h * tile)
        }
        ctx.strokeStyle = colours.road
        ctx.lineWidth = Math.max(1.5, w / 260)
        for (const r of land.roads) {
          ctx.beginPath()
          ctx.moveTo(x0, y0 + r.y0 * tile)
          ctx.lineTo(x0 + tile, y0 + r.y1 * tile)
          ctx.stroke()
        }
        ctx.fillStyle = colours.hot
        const s = Math.max(3, w / 90)
        for (const f of land.farms) ctx.fillRect(x0 + f.x * tile - s / 2, y0 + f.y * tile - s / 2, s, s)
      }
  }

  let raf = 0
  let started = 0
  let shown = -1
  let closed = false

  function draw(time: number) {
    // The blur comes in once the buffet is read out, and the picture stops when the run is called off.
    const blurring = show.rejected && time >= R.buffetAt
    canvas.style.filter = blurring ? `blur(${fixed(show.blur, 1)}px)` : ''
    paint(show.rejected ? Math.min(time, show.mineEnd) : time)
    const c = podClocks(show, time)
    mine.value.textContent = show.rejected && time >= show.mineEnd ? t('rgr.rejected') : hoursText(c.mine)
    old.value.textContent = hoursText(c.old)
    picture.value.textContent = t(time < R.buffetAt ? 'rgr.watching' : show.rejected ? 'rgr.blurred' : 'rgr.steady')
    picture.value.classList.toggle('warn', blurring)
    const longest = Math.max(show.mineHours, show.oldHours, 1e-9)
    barMine.style.width = `${(c.mine / longest) * 100}%`
    barOld.style.width = `${(c.old / longest) * 100}%`
    barMine.classList.toggle('is-stopped', show.rejected && time >= show.mineEnd)
    let idx = -1
    for (let i = 0; i < notes.length; i++) if (notes[i]!.t <= time) idx = i
    if (idx !== shown && idx >= 0) {
      shown = idx
      said.textContent = noteText(notes[idx]!, input)
      // The commentator says it too (PR 14b).
      commentate('pod', notes[idx]!.kind)
    }
  }

  function finish() {
    cancelAnimationFrame(raf)
    draw(show.end)
    skip.hidden = true
    end.hidden = false
    next.focus()
  }

  function tick(now: number) {
    if (closed) return
    if (!started) started = now
    const s = (now - started) / 1000
    if (s >= show.end + 1) {
      finish()
      return
    }
    draw(s)
    raf = requestAnimationFrame(tick)
  }

  function close() {
    if (closed) return
    closed = true
    cancelAnimationFrame(raf)
    document.removeEventListener('keydown', onKey)
    watch.disconnect()
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
