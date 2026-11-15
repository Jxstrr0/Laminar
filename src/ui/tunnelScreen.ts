/**
 * The tunnel screen: the 3D test section above, a bottom sheet below with the
 * model switch, fan and yaw controls and live balance readouts.
 *
 * Two things can stand in the test section:
 * - **Your rider**: a scale model of the design from the Shape screen, on the
 *   yaw turntable. The readouts are the balance's: the aero model run on the
 *   model at tunnel speed, with its small build errors and the balance's
 *   seeded noise (plan section 6.8), scaled up to full size for the CdA.
 * - **The sphere**: the calibration sphere on its sting, with the drag crisis
 *   and the smoke wake that follows the separation line the sim finds.
 *
 * The sim runs on a fixed 60 Hz step; the screen draws whenever the browser
 * gives it a frame and shows whatever the sim says.
 */
import { AIR } from '../data/air'
import type { GlossaryId } from '../data/glossary'
import { DEMO_MODEL_SEED, STANDARD_MODEL } from '../data/model'
import { REFERENCE_SPHERE, UNIVERSITY_TUNNEL } from '../data/tunnel'
import { t, type StringKey } from '../data/strings'
import { dynamicPressure, reynolds } from '../sim/air'
import { bodyDrag, type Regime } from '../sim/aero/drag'
import { fanAtRest, setFanTarget, stepFan, type FanState } from '../sim/fan'
import { describeBody } from '../sim/geom/body'
import { cyclistShape } from '../sim/geom/cyclist'
import { riderPose } from '../sim/geom/pose'
import { sphere } from '../sim/geom/shapes'
import { Rng } from '../sim/rng'
import { setYawTarget, stepTurntable, turntableAtRest, type TurntableState } from '../sim/turntable'
import { prepareModel, readBalance, type PreparedModel } from '../sim/views'
import type { TunnelView } from '../render/tunnelScene'
import { designStore } from './designStore'
import { fixed, scientific } from './format'
import { glossaryTerm } from './glossary'

/** The glossary entry for each drag regime word. */
const REGIME_TERM: Record<Regime, GlossaryId> = { laminar: 'laminar', mixed: 'dragCrisis', turbulent: 'turbulent' }

/** The sim's fixed time step, in seconds. */
const STEP = 1 / 60

type Mount = 'rider' | 'sphere'
const MOUNTS: { value: Mount; key: StringKey }[] = [
  { value: 'rider', key: 'mount.rider' },
  { value: 'sphere', key: 'mount.sphere' },
]

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

/** Only touch the page when the text on screen would change. */
function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text
}

function readout(label: string, term: GlossaryId): { box: HTMLElement; value: HTMLElement; sub: HTMLElement } {
  const box = el('div', 'readout')
  const value = el('div', 'readout-value', '0')
  const sub = el('div', 'readout-sub')
  const labelBox = el('div', 'readout-label')
  labelBox.append(glossaryTerm(term, label))
  box.append(labelBox, value, sub)
  return { box, value, sub }
}

/** A labelled range slider with its "Set …" readout, like the fan's. */
function rangeRow(id: string, label: string, range: { min: number; max: number; step: number }) {
  const row = el('div', 'fan-row')
  const lab = el('label', 'fan-label', label)
  lab.htmlFor = id
  const target = el('span', 'fan-target')
  const input = el('input', 'fan-slider')
  input.id = id
  input.type = 'range'
  input.min = String(range.min)
  input.max = String(range.max)
  input.step = String(range.step)
  input.value = '0'
  const head = el('div', 'fan-head')
  head.append(lab, target)
  row.append(head, input)
  return { row, input, target }
}

export function startTunnelScreen(app: HTMLElement, view: TunnelView): { setActive(active: boolean): void } {
  const spec = UNIVERSITY_TUNNEL
  let fan: FanState = fanAtRest()
  let table: TurntableState = turntableAtRest()
  let mount: Mount = 'rider'

  // --- Header
  const header = el('header', 'top-bar')
  const titleBlock = el('div', 'title-block')
  titleBlock.append(el('h1', 'wordmark', t('game.title')), el('p', 'place', t('tunnel.place')))
  header.append(titleBlock)

  // --- Bottom sheet
  const sheet = el('section', 'sheet')
  sheet.setAttribute('aria-label', t('tunnel.sheet'))

  // Model switch.
  const mountRow = el('div', 'mount-row')
  const mountLabel = el('span', 'fan-label', t('mount.label'))
  mountLabel.id = 'mount-label'
  const mountGroup = el('div', 'segmented')
  mountGroup.setAttribute('role', 'radiogroup')
  mountGroup.setAttribute('aria-labelledby', mountLabel.id)
  const mountButtons = MOUNTS.map((m) => {
    const b = el('button', 'segment', t(m.key))
    b.type = 'button'
    b.setAttribute('role', 'radio')
    b.addEventListener('click', () => setMount(m.value))
    mountGroup.append(b)
    return b
  })
  mountGroup.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const next = mount === 'rider' ? 'sphere' : 'rider'
    setMount(next)
    mountButtons[MOUNTS.findIndex((m) => m.value === next)]!.focus()
  })
  mountRow.append(mountLabel, mountGroup)

  // Fan.
  const fanCtl = rangeRow('fan-slider', t('fan.label'), { min: 0, max: spec.topSpeed, step: spec.sliderStep })
  const offBtn = el('button', 'fan-off', t('fan.off'))
  offBtn.type = 'button'
  fanCtl.row.append(offBtn)

  // Yaw turntable.
  const yawCtl = rangeRow('yaw-slider', t('yaw.label'), spec.turntable)
  const squareBtn = el('button', 'fan-off', t('yaw.square'))
  squareBtn.type = 'button'
  yawCtl.row.append(squareBtn)

  // Readouts for the rider model.
  const riderGrid = el('div', 'readouts')
  const rSpeed = readout(t('read.speed'), 'airSpeed')
  const rYaw = readout(t('read.yaw'), 'yaw')
  const rDrag = readout(t('read.modelDrag'), 'forceBalance')
  const rCdA = readout(t('read.cda'), 'cda')
  riderGrid.append(rSpeed.box, rYaw.box, rDrag.box, rCdA.box)
  rCdA.sub.textContent = t('read.cdaNote', { scale: fixed(1 / STANDARD_MODEL.scale, 0) })

  // Readouts for the sphere.
  const sphereGrid = el('div', 'readouts')
  const speedR = readout(t('read.speed'), 'airSpeed')
  const qR = readout(t('read.q'), 'dynamicPressure')
  const reR = readout(t('read.re'), 'reynolds')
  const dragR = readout(t('read.drag'), 'drag')
  sphereGrid.append(speedR.box, qR.box, reR.box, dragR.box)
  reR.sub.textContent = `${fixed(REFERENCE_SPHERE.diameter * 100, 0)} cm sphere`

  // The drag note ("Cd {cd} · {regime}") keeps its regime word as a glossary
  // term, so it is built once from the template and its slots updated in place.
  const cdText = document.createTextNode('')
  const regimeTerm = glossaryTerm('laminar', '')
  dragR.sub.append(
    ...t('read.dragNote')
      .split(/(\{\w+\})/)
      .map((part) => (part === '{cd}' ? cdText : part === '{regime}' ? regimeTerm : document.createTextNode(part))),
  )

  const foot = el('div', 'sheet-foot')
  const version = el('span', 'version', `v${__GAME_VERSION__} · ${__BUILD_SHA__} · ${__BUILD_DATE__}`)
  foot.append(el('span', 'hint', t('hint.orbit')), version)

  sheet.append(mountRow, fanCtl.row, yawCtl.row, riderGrid, sphereGrid, foot)
  app.append(header, sheet)

  // Keep the 3D model centred in the space above the sheet.
  const sheetObserver = new ResizeObserver(() => view.setSheetHeight(sheet.offsetHeight))
  sheetObserver.observe(sheet)
  view.setSheetHeight(sheet.offsetHeight)

  // --- Controls
  const showTargets = () => {
    setText(fanCtl.target, t('fan.target', { target: `${fixed(fan.target, 1)} m/s` }))
    fanCtl.input.setAttribute('aria-valuetext', `${fixed(fan.target, 1)} metres per second`)
    offBtn.disabled = fan.target === 0
    setText(yawCtl.target, t('fan.target', { target: `${fixed(table.target, 0)}°` }))
    yawCtl.input.setAttribute('aria-valuetext', `${fixed(table.target, 0)} degrees`)
    squareBtn.disabled = table.target === 0
  }
  fanCtl.input.addEventListener('input', () => {
    fan = setFanTarget(fan, Number(fanCtl.input.value), spec)
    showTargets()
  })
  offBtn.addEventListener('click', () => {
    fan = setFanTarget(fan, 0, spec)
    fanCtl.input.value = '0'
    showTargets()
  })
  yawCtl.input.addEventListener('input', () => {
    table = setYawTarget(table, Number(yawCtl.input.value), spec.turntable)
    showTargets()
  })
  squareBtn.addEventListener('click', () => {
    table = setYawTarget(table, 0, spec.turntable)
    yawCtl.input.value = '0'
    showTargets()
  })
  // Desktop: arrow keys already move a focused slider; Space stops the fan anywhere else.
  window.addEventListener('keydown', (e) => {
    const focus = document.activeElement
    if (active && e.key === ' ' && !(focus instanceof HTMLInputElement) && focus?.tagName !== 'BUTTON') {
      e.preventDefault()
      offBtn.click()
    }
  })
  showTargets()

  // --- The rider model: rebuilt when the design changes, read by the balance.
  let prepared: PreparedModel | null = null
  let designDirty = true
  designStore.subscribe(() => (designDirty = true))
  const modelSpec = { ...STANDARD_MODEL, seed: DEMO_MODEL_SEED }
  const balanceRng = new Rng(DEMO_MODEL_SEED).fork('balance')
  const shown = { cdA: 0, dragN: 0, sideN: 0 }

  function placeModel() {
    if (mount === 'sphere') {
      view.setModel({ kind: 'sphere' })
      return
    }
    const design = designStore.get()
    prepared = prepareModel(cyclistShape(design), modelSpec)
    view.setModel({ kind: 'rider', state: { design, pose: riderPose(design), broken: [], strained: [] }, scale: modelSpec.scale })
    designDirty = false
  }

  function setMount(next: Mount) {
    mount = next
    mountButtons.forEach((b, i) => {
      const on = MOUNTS[i]!.value === mount
      b.setAttribute('aria-checked', String(on))
      b.tabIndex = on ? 0 : -1
    })
    riderGrid.hidden = mount !== 'rider'
    yawCtl.row.hidden = mount !== 'rider'
    sphereGrid.hidden = mount !== 'sphere'
    shownSpeed = -1
    placeModel()
  }

  const ball = describeBody(sphere('calibration-sphere', REFERENCE_SPHERE.diameter))
  const radius = REFERENCE_SPHERE.diameter / 2
  let shownSpeed = -1
  const updateSphere = () => {
    const rounded = Math.round(fan.speed * 10) / 10
    if (rounded === shownSpeed) return
    shownSpeed = rounded
    const q = dynamicPressure(AIR.density, fan.speed)
    speedR.value.textContent = `${fixed(fan.speed, 1)} m/s`
    speedR.sub.textContent = `${fixed(fan.speed * 3.6, 0)} km/h`
    qR.value.textContent = `${fixed(q, 0)} Pa`
    qR.sub.textContent = '½ρV²'
    reR.value.textContent = scientific(reynolds(AIR.density, fan.speed, REFERENCE_SPHERE.diameter, AIR.viscosity))

    const drag = bodyDrag(ball, { ...AIR, speed: fan.speed, turbulence: spec.turbulence })
    dragR.value.textContent = `${fixed(q * drag.cdA, 1)} N`
    cdText.data = fixed(drag.cd, 2)
    regimeTerm.textContent = t(`regime.${drag.regime}` as const)
    regimeTerm.dataset.g = REGIME_TERM[drag.regime]
    // Where the flow leaves the sphere, as an angle from its nose, for the smoke.
    const cos = Math.min(1, Math.max(-1, 1 - drag.lines.top.separationX / radius))
    view.setSeparation((Math.acos(cos) * 180) / Math.PI)
  }

  const updateRider = (dt: number) => {
    if (!prepared) return
    setText(rSpeed.value, `${fixed(fan.speed, 1)} m/s`)
    setText(rSpeed.sub, `${fixed(fan.speed * 3.6, 0)} km/h`)
    setText(rYaw.value, `${fixed(table.angle, 1)}°`)
    if (fan.speed < spec.readFrom) {
      shown.cdA = shown.dragN = shown.sideN = 0
      setText(rYaw.sub, t('read.sideNote', { force: '–' }))
      setText(rDrag.value, '–')
      setText(rDrag.sub, t('read.modelDragNote', { re: '–' }))
      setText(rCdA.value, '–')
      return
    }
    const r = readBalance(prepared, spec, { speed: fan.speed, yawDeg: table.angle }, balanceRng)
    const q = dynamicPressure(AIR.density, fan.speed)
    const s2 = prepared.scale * prepared.scale
    // The readout settles like a real balance's display, so noise is a wobble, not a flicker.
    const k = shown.cdA === 0 ? 1 : 1 - Math.exp(-dt / spec.displaySettle)
    shown.cdA += (r.cdA - shown.cdA) * k
    shown.dragN += (q * r.modelCdA - shown.dragN) * k
    shown.sideN += (q * Math.abs(r.cyA) * s2 - shown.sideN) * k
    setText(rYaw.sub, t('read.sideNote', { force: `${fixed(shown.sideN, 1)} N` }))
    setText(rDrag.value, `${fixed(shown.dragN, 1)} N`)
    setText(rDrag.sub, t('read.modelDragNote', { re: scientific(r.reynolds) }))
    setText(rCdA.value, `${fixed(shown.cdA, 3)} m²`)
  }

  // --- Loop: fixed sim steps, one draw per browser frame, only while shown.
  let last = performance.now()
  let carry = 0
  let active = false
  let raf = 0
  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.25)
    last = now
    carry += dt
    while (carry >= STEP) {
      fan = stepFan(fan, STEP, spec)
      table = stepTurntable(table, STEP, spec.turntable)
      carry -= STEP
    }
    if (mount === 'rider') {
      if (designDirty) placeModel()
      updateRider(dt)
    } else updateSphere()
    view.setYaw(mount === 'rider' ? table.angle : 0)
    view.frame(fan.speed, dt)
    raf = requestAnimationFrame(loop)
  }
  setMount('rider')
  return {
    setActive(on) {
      if (on === active) return
      active = on
      if (on) {
        view.setSheetHeight(sheet.offsetHeight)
        last = performance.now()
        raf = requestAnimationFrame(loop)
      } else cancelAnimationFrame(raf)
    },
  }
}
