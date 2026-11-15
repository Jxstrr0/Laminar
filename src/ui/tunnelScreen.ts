/**
 * The tunnel screen (PR 0): the 3D test section above, a bottom sheet below
 * with the fan slider and live readouts.
 *
 * The sim runs on a fixed 60 Hz step; the screen draws whenever the browser
 * gives it a frame and shows whatever the sim says.
 */
import { AIR } from '../data/air'
import { REFERENCE_SPHERE, UNIVERSITY_TUNNEL } from '../data/tunnel'
import { t } from '../data/strings'
import { circleArea, dragForce, dynamicPressure, reynolds } from '../sim/air'
import { fanAtRest, setFanTarget, stepFan, type FanState } from '../sim/fan'
import type { TunnelView } from '../render/tunnelScene'
import { fixed, scientific } from './format'

/** The sim's fixed time step, in seconds. */
const STEP = 1 / 60

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

function readout(label: string): { box: HTMLElement; value: HTMLElement; sub: HTMLElement } {
  const box = el('div', 'readout')
  const value = el('div', 'readout-value', '0')
  const sub = el('div', 'readout-sub')
  box.append(el('div', 'readout-label', label), value, sub)
  return { box, value, sub }
}

export function startTunnelScreen(app: HTMLElement, view: TunnelView): void {
  const spec = UNIVERSITY_TUNNEL
  let fan: FanState = fanAtRest()

  // --- Header
  const header = el('header', 'top-bar')
  const titleBlock = el('div', 'title-block')
  titleBlock.append(el('h1', 'wordmark', t('game.title')), el('p', 'place', t('tunnel.place')))
  header.append(titleBlock)

  // --- Bottom sheet
  const sheet = el('section', 'sheet')
  sheet.setAttribute('aria-label', t('fan.label'))

  const fanRow = el('div', 'fan-row')
  const fanLabel = el('label', 'fan-label', t('fan.label'))
  fanLabel.htmlFor = 'fan-slider'
  const fanTarget = el('span', 'fan-target')
  const slider = el('input', 'fan-slider')
  slider.id = 'fan-slider'
  slider.type = 'range'
  slider.min = '0'
  slider.max = String(spec.topSpeed)
  slider.step = String(spec.sliderStep)
  slider.value = '0'
  const offBtn = el('button', 'fan-off', t('fan.off'))
  offBtn.type = 'button'
  const fanHead = el('div', 'fan-head')
  fanHead.append(fanLabel, fanTarget)
  fanRow.append(fanHead, slider, offBtn)

  const grid = el('div', 'readouts')
  const speedR = readout(t('read.speed'))
  const qR = readout(t('read.q'))
  const reR = readout(t('read.re'))
  const dragR = readout(t('read.drag'))
  grid.append(speedR.box, qR.box, reR.box, dragR.box)
  reR.sub.textContent = `${fixed(REFERENCE_SPHERE.diameter * 100, 0)} cm sphere`
  dragR.sub.textContent = t('read.dragNote', { cd: fixed(REFERENCE_SPHERE.dragCoefficient, 2) })

  const foot = el('div', 'sheet-foot')
  const version = el('span', 'version', `v${__GAME_VERSION__} · ${__BUILD_SHA__} · ${__BUILD_DATE__}`)
  foot.append(el('span', 'hint', t('hint.orbit')), version)

  sheet.append(fanRow, grid, foot)
  app.append(header, sheet)

  // Keep the 3D sphere centred in the space above the sheet.
  const sheetObserver = new ResizeObserver(() => view.setSheetHeight(sheet.offsetHeight))
  sheetObserver.observe(sheet)
  view.setSheetHeight(sheet.offsetHeight)

  const showTarget = () => {
    fanTarget.textContent = t('fan.target', { target: `${fixed(fan.target, 1)} m/s` })
    slider.setAttribute('aria-valuetext', `${fixed(fan.target, 1)} metres per second`)
    offBtn.disabled = fan.target === 0
  }
  slider.addEventListener('input', () => {
    fan = setFanTarget(fan, Number(slider.value), spec)
    showTarget()
  })
  offBtn.addEventListener('click', () => {
    fan = setFanTarget(fan, 0, spec)
    slider.value = '0'
    showTarget()
  })
  // Desktop: arrow keys already move a focused slider; Space stops the fan anywhere else.
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' && document.activeElement !== slider && document.activeElement?.tagName !== 'BUTTON') {
      e.preventDefault()
      offBtn.click()
    }
  })
  showTarget()

  const area = circleArea(REFERENCE_SPHERE.diameter)
  let shownSpeed = -1
  const updateReadouts = () => {
    // Only touch the page when the number on screen would change.
    const rounded = Math.round(fan.speed * 10) / 10
    if (rounded === shownSpeed) return
    shownSpeed = rounded
    const q = dynamicPressure(AIR.density, fan.speed)
    speedR.value.textContent = `${fixed(fan.speed, 1)} m/s`
    speedR.sub.textContent = `${fixed(fan.speed * 3.6, 0)} km/h`
    qR.value.textContent = `${fixed(q, 0)} Pa`
    qR.sub.textContent = '½ρV²'
    reR.value.textContent = scientific(reynolds(AIR.density, fan.speed, REFERENCE_SPHERE.diameter, AIR.viscosity))
    dragR.value.textContent = `${fixed(dragForce(q, REFERENCE_SPHERE.dragCoefficient, area), 1)} N`
  }

  // --- Loop: fixed sim steps, one draw per browser frame.
  let last = performance.now()
  let carry = 0
  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.25)
    last = now
    carry += dt
    while (carry >= STEP) {
      fan = stepFan(fan, STEP, spec)
      carry -= STEP
    }
    updateReadouts()
    view.frame(fan.speed, dt)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
