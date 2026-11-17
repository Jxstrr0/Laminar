/**
 * The tunnel's dials (Isobar, PR 13g): a semicircle you drag along, with − / +
 * steppers under it. The fan's dial fills teal up to the set speed and shows
 * the fan's actual speed as a thin mark while it ramps; the yaw dial points a
 * needle.
 *
 * A native range input stays underneath, hidden but focusable, and it is the
 * one true value: the dial only draws it and sets it. So the keyboard, screen
 * readers and every bit of tunnel code that reads or sets the range carry on
 * as before.
 */
import { watchRange } from './range'

const NS = 'http://www.w3.org/2000/svg'
/** The arc's centre and radius in the drawing's own units (it scales to fit). */
const CX = 70
const CY = 70
const R = 60
/** Hold a stepper: the first repeat after this long, then this many steps a second. */
const HOLD_DELAY_MS = 400
const HOLD_RATE = 8

export interface Dial {
  /** The whole dial: the drawing, the value in the middle and the steppers. */
  root: HTMLElement
  /** The row under the dial for its action button (Fan off, Square on). */
  actions: HTMLElement
  /** The fan's actual speed on the same scale as the value; null hides the mark. */
  setActual(value: number | null): void
  /** Rename the steppers when the dial changes job (yaw, pitch, drop…). */
  setLabels(labels: { less: string; more: string }): void
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  return node
}

/** A point on a circle round the dial's centre: p 0 is the left end, 1 the right. */
function at(p: number, r: number): [number, number] {
  const a = Math.PI * (1 - p)
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)]
}

const ARC = `M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`

/**
 * Draw `input` as a dial. `centre` is the element that shows the value in the
 * middle (the tunnel writes its text); `kind` picks a teal fill or a needle.
 */
export function createDial(input: HTMLInputElement, centre: HTMLElement, kind: 'fill' | 'needle', labels: { less: string; more: string }): Dial {
  const root = document.createElement('div')
  root.className = `dial dial-${kind}`
  const face = document.createElement('div')
  face.className = 'dial-face'

  const svg = svgEl('svg', { class: 'dial-svg', viewBox: '0 0 140 76', 'aria-hidden': 'true', focusable: 'false' })
  svg.append(svgEl('path', { class: 'dial-track', d: ARC }))
  // Seven ticks inside the track, the middle one longer.
  for (let i = 0; i <= 6; i++) {
    const p = i / 6
    const [x0, y0] = at(p, i === 3 ? 40 : 44)
    const [x1, y1] = at(p, 49)
    svg.append(svgEl('line', { class: 'dial-tick', x1: x0.toFixed(1), y1: y0.toFixed(1), x2: x1.toFixed(1), y2: y1.toFixed(1) }))
  }
  const fill = svgEl('path', { class: 'dial-fill', d: ARC, pathLength: '100' })
  const needle = svgEl('line', { class: 'dial-needle' })
  const knob = svgEl('circle', { class: 'dial-knob', r: '7' })
  const actual = svgEl('line', { class: 'dial-actual' })
  if (kind === 'fill') svg.append(fill, actual)
  else svg.append(needle)
  svg.append(knob)
  centre.classList.add('dial-value')
  centre.setAttribute('aria-hidden', 'true')
  face.append(svg, centre)

  // The hidden range sits inside the dial, so its label still points at it.
  input.classList.add('dial-input')
  const steppers = document.createElement('div')
  steppers.className = 'dial-steppers'
  const less = stepper('−', labels.less, -1)
  const more = stepper('+', labels.more, 1)
  const actions = document.createElement('div')
  actions.className = 'dial-actions'
  steppers.append(less, actions, more)
  root.append(face, input, steppers)

  const num = (v: string, fallback: number) => (v === '' ? fallback : Number(v))
  const range = () => {
    const min = num(input.min, 0)
    const max = num(input.max, 100)
    const step = num(input.step, 1) || 1
    return { min, max, step }
  }
  const fraction = (v: number) => {
    const { min, max } = range()
    return max > min ? Math.min(1, Math.max(0, (v - min) / (max - min))) : 0
  }

  function draw() {
    const p = fraction(Number(input.value))
    fill.setAttribute('stroke-dasharray', `${(p * 100).toFixed(2)} 200`)
    fill.style.visibility = p > 0.001 ? 'visible' : 'hidden'
    const [kx, ky] = at(p, R)
    knob.setAttribute('cx', kx.toFixed(1))
    knob.setAttribute('cy', ky.toFixed(1))
    const [nx0, ny0] = at(p, 24)
    const [nx1, ny1] = at(p, 50)
    needle.setAttribute('x1', nx0.toFixed(1))
    needle.setAttribute('y1', ny0.toFixed(1))
    needle.setAttribute('x2', nx1.toFixed(1))
    needle.setAttribute('y2', ny1.toFixed(1))
    root.classList.toggle('is-disabled', input.disabled)
    less.disabled = input.disabled || Number(input.value) <= range().min
    more.disabled = input.disabled || Number(input.value) >= range().max
  }
  watchRange(input, draw)

  /** Set the range as the player would, so the tunnel hears an input event. */
  function setValue(v: number, final: boolean) {
    const { min, max, step } = range()
    const snapped = Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step))
    // Tidy the float (0.1 + 0.2) so the range accepts it as a step.
    const tidy = Number(snapped.toFixed(6))
    if (tidy !== Number(input.value)) {
      input.value = String(tidy)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    if (final) input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  // Drag along the arc. Only the drawing takes the gesture, so the sheet still scrolls elsewhere.
  let dragging = false
  const fromPointer = (e: PointerEvent) => {
    const box = svg.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * 140
    const y = ((e.clientY - box.top) / box.height) * 76
    // Below the baseline, hold to whichever end is nearer.
    const a = y > CY ? (x < CX ? Math.PI : 0) : Math.atan2(CY - y, x - CX)
    const { min, max } = range()
    return min + (1 - a / Math.PI) * (max - min)
  }
  svg.addEventListener('pointerdown', (e) => {
    if (input.disabled) return
    dragging = true
    svg.setPointerCapture(e.pointerId)
    setValue(fromPointer(e), false)
    e.preventDefault()
  })
  svg.addEventListener('pointermove', (e) => {
    if (dragging) setValue(fromPointer(e), false)
  })
  const endDrag = () => {
    if (!dragging) return
    dragging = false
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }
  svg.addEventListener('pointerup', endDrag)
  svg.addEventListener('pointercancel', endDrag)
  // Focus shows on the dial, since the range itself is hidden.
  input.addEventListener('focus', () => root.classList.toggle('has-focus', input.matches(':focus-visible')))
  input.addEventListener('keydown', () => root.classList.add('has-focus'))
  input.addEventListener('blur', () => root.classList.remove('has-focus'))

  function stepper(text: string, name: string, dir: 1 | -1): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'dial-step'
    b.textContent = text
    b.setAttribute('aria-label', name)
    let timer = 0
    let byPointer = false
    const once = () => setValue(Number(input.value) + dir * range().step, false)
    const stop = () => {
      window.clearTimeout(timer)
      window.clearInterval(timer)
      timer = 0
    }
    // Hold to repeat, about eight steps a second.
    b.addEventListener('pointerdown', (e) => {
      if (b.disabled) return
      byPointer = true
      b.setPointerCapture(e.pointerId)
      once()
      timer = window.setTimeout(() => {
        timer = window.setInterval(() => (b.disabled ? stop() : once()), 1000 / HOLD_RATE)
      }, HOLD_DELAY_MS)
    })
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) b.addEventListener(ev, stop)
    // The keyboard (and a screen reader's double tap) gives a click with no pointer first.
    b.addEventListener('click', () => {
      if (byPointer) {
        byPointer = false
        return
      }
      once()
    })
    return b
  }

  return {
    root,
    actions,
    setLabels(next) {
      less.setAttribute('aria-label', next.less)
      more.setAttribute('aria-label', next.more)
    },
    setActual(value) {
      if (value === null || kind !== 'fill') {
        actual.style.visibility = 'hidden'
        return
      }
      const p = fraction(value)
      const [x0, y0] = at(p, R - 9)
      const [x1, y1] = at(p, R + 9)
      actual.setAttribute('x1', x0.toFixed(1))
      actual.setAttribute('y1', y0.toFixed(1))
      actual.setAttribute('x2', x1.toFixed(1))
      actual.setAttribute('y2', y1.toFixed(1))
      actual.style.visibility = 'visible'
    },
  }
}
