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
 * Every fan-up to fan-down is a run (src/sim/run.ts): the balance logs a
 * sample four times a second, and the run is billed in rubles for the fan's
 * power plus a fee. The sheet shows the bill as it grows, and its tabs swap
 * the readouts for live charts of this run against the last one, or for the
 * session's runs: tap two to compare them against the balance's noise.
 *
 * The tunnel has hidden quirks (src/sim/quirks.ts): blockage, turbulent air
 * and the mount's own drag all creep into every reading. A tare run (the
 * mount with the model off) measures the mount; calibration runs with the
 * sphere, held up against the book, show the crisis coming early and the
 * blockage. The Calibrate tab gathers what the runs have found, and the
 * rider's CdA readout takes off whatever is known.
 *
 * Over the 3D view sit the flow instruments: a smoke wand, a smoke rake,
 * tufts and a dark backdrop. They read a flow field built from the model's
 * own drag at tunnel speed, rebuilt (at most four times a second) as the
 * yaw, the air speed or the design changes.
 *
 * The sim runs on a fixed 60 Hz step; the screen draws whenever the browser
 * gives it a frame and shows whatever the sim says.
 */
import { AIR } from '../data/air'
import type { GlossaryId } from '../data/glossary'
import { TUFT_VIZ } from '../data/flowViz'
import { DEMO_MODEL_SEED, STANDARD_MODEL } from '../data/model'
import { SKELETON } from '../data/pose'
import { CALIBRATION, CRANK_DIAL, DEMO_TUNNEL_SEED, REFERENCE_SPHERE, REFERENCE_WHEEL, RUN_RECORDING, RUN_STATS, TUNNEL_BILLING, UNIVERSITY_QUIRKS, UNIVERSITY_TUNNEL } from '../data/tunnel'
import { t, type StringKey } from '../data/strings'
import { dynamicPressure, reynolds } from '../sim/air'
import { bodyDrag, shapeDrag, type Regime } from '../sim/aero/drag'
import { fanAtRest, setFanTarget, stepFan, type FanState } from '../sim/fan'
import { modelFlowField, tufts as tuftsOf } from '../sim/flow/field'
import {
  bookCurve,
  calibrate,
  correct,
  corrections,
  latestTare,
  NO_CORRECTIONS,
  spokeShare,
  tareModel,
  WHEEL_RUN,
  wheelCheck,
  type Calibration,
  type Corrections,
  type WheelCheck,
} from '../sim/calibration'
import { describeShape, scaleShape } from '../sim/geom/body'
import { cyclistShape, referenceWheel } from '../sim/geom/cyclist'
import { riderPose } from '../sim/geom/pose'
import { sphere } from '../sim/geom/shapes'
import { Rng } from '../sim/rng'
import type { CyclistDesign } from '../data/cyclist'
import { changedControls } from '../sim/designDiff'
import { compareRuns, headlineCompare, headlineGroup, legCycle, poolRuns, yawGroups, type YawGroup } from '../sim/runStats'
import { addSample, newRecorder, runCost, stepRecorder, type Recorder, type Run, type RunSample } from '../sim/run'
import { setYawTarget, stepTurntable, turntableAtRest, type TurntableState } from '../sim/turntable'
import { rollQuirks, type MountKind } from '../sim/quirks'
import { prepareExact, prepareModel, readBalance, readTare, tunnelTurbulence, type PreparedModel, type TunnelSpec } from '../sim/views'
import type { TunnelView } from '../render/tunnelScene'
import { createChart, describeLast, type ChartPoint } from './chart'
import { designStore } from './designStore'
import { fixed, scientific } from './format'
import { glossaryTerm } from './glossary'

/** The glossary entry for each drag regime word. */
const REGIME_TERM: Record<Regime, GlossaryId> = { laminar: 'laminar', mixed: 'dragCrisis', turbulent: 'turbulent' }

/** The sim's fixed time step, in seconds. */
const STEP = 1 / 60

type Mount = 'rider' | 'sphere' | 'wheel'
type View = 'readouts' | 'time' | 'yaw' | 'cal' | 'runs'
const VIEWS: { value: View; key: StringKey }[] = [
  { value: 'readouts', key: 'view.readouts' },
  { value: 'time', key: 'view.time' },
  { value: 'yaw', key: 'view.yaw' },
  { value: 'cal', key: 'view.cal' },
  { value: 'runs', key: 'view.runs' },
]
/** What holds each model. */
const MOUNT_KIND: Record<Mount, MountKind> = { rider: 'posts', sphere: 'sting', wheel: 'posts' }
/** How a run's model is named in the list. */
const RUN_MODEL: Record<string, StringKey> = {
  rider: 'mount.rider',
  sphere: 'mount.sphere',
  [WHEEL_RUN]: 'mount.wheel',
  [tareModel('sting')]: 'mount.tareSting',
  [tareModel('posts')]: 'mount.tarePosts',
}

/** A tare is a small drag area: it needs a digit more than a model's. */
const TARE_DIGITS = 5

/** Seconds as m:ss. */
function clock(seconds: number): string {
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const MOUNTS: { value: Mount; key: StringKey }[] = [
  { value: 'rider', key: 'mount.riderShort' },
  { value: 'sphere', key: 'mount.sphere' },
  { value: 'wheel', key: 'mount.wheel' },
]

/** What the corrections cover, as words: "posts, blockage and still wheels". */
function fixWords(fix: Corrections): string {
  const list = [fix.tare !== null ? t('fix.tare') : '', fix.blockage !== null ? t('fix.blockage') : '', fix.wheels !== null ? t('fix.wheels') : ''].filter(Boolean)
  return list.length < 2 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')}${t('fix.and')}${list[list.length - 1]}`
}

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
  // The tunnel as the balance reads it, hidden quirks and all.
  const tunnel: TunnelSpec = { ...UNIVERSITY_TUNNEL, quirks: rollQuirks(UNIVERSITY_QUIRKS, DEMO_TUNNEL_SEED) }
  const airTurbulence = tunnelTurbulence(tunnel)
  const sectionArea = spec.section.width * spec.section.height
  let fan: FanState = fanAtRest()
  let table: TurntableState = turntableAtRest()
  let mount: Mount = 'rider'
  /** A tare run: the model off, the mount alone. */
  let tare = false
  // The calibration sphere, made exactly: a reference body has no build errors.
  const sphereModel = prepareExact({ bodies: [sphere('calibration-sphere', REFERENCE_SPHERE.diameter)] })
  const ball = sphereModel.shape.bodies[0]!
  const radius = REFERENCE_SPHERE.diameter / 2
  // The reference wheel, made exactly at the model's scale: read still on the posts, and spinning in the book.
  const wheelModel = prepareExact(scaleShape(referenceWheel(false), STANDARD_MODEL.scale))
  const wheelSpinning = describeShape(scaleShape(referenceWheel(true), STANDARD_MODEL.scale))

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
    const i = MOUNTS.findIndex((m) => m.value === mount)
    const next = MOUNTS[(i + (e.key === 'ArrowRight' ? 1 : MOUNTS.length - 1)) % MOUNTS.length]!.value
    setMount(next)
    mountButtons[MOUNTS.findIndex((m) => m.value === next)]!.focus()
  })
  const tareBtn = el('button', 'chip tare-chip', t('mount.tare'))
  tareBtn.type = 'button'
  tareBtn.setAttribute('aria-pressed', 'false')
  tareBtn.setAttribute('aria-label', t('mount.tareName'))
  tareBtn.title = t('mount.tareName')
  tareBtn.addEventListener('click', () => setTare(!tare))
  mountRow.append(mountLabel, mountGroup, tareBtn)

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

  // The crank angle of the rider model's fixed legs, picked from a list in the yaw row's head.
  let crank: number = SKELETON.crankDeg[0]!
  const crankBox = el('span', 'crank-box')
  const crankLabel = el('label', 'crank-label', t('crank.label'))
  const crankSel = el('select', 'crank-select')
  crankSel.id = 'crank-select'
  crankLabel.htmlFor = crankSel.id
  crankSel.title = t('crank.name')
  for (let deg = CRANK_DIAL.min; deg <= CRANK_DIAL.max; deg += CRANK_DIAL.step) {
    const option = el('option', undefined, `${deg}°`)
    option.value = String(deg)
    crankSel.append(option)
  }
  crankSel.value = String(crank)
  crankSel.addEventListener('change', () => setCrank(Number(crankSel.value)))
  crankBox.append(crankLabel, crankSel)
  yawCtl.target.before(crankBox)

  // Readouts for the rider model.
  const riderGrid = el('div', 'readouts')
  const rSpeed = readout(t('read.speed'), 'airSpeed')
  const rYaw = readout(t('read.yaw'), 'yaw')
  const rDrag = readout(t('read.modelDrag'), 'forceBalance')
  const rCdA = readout(t('read.cda'), 'cda')
  riderGrid.append(rSpeed.box, rYaw.box, rDrag.box, rCdA.box)
  rCdA.sub.textContent = t('read.cdaRaw', { scale: fixed(1 / STANDARD_MODEL.scale, 0) })

  // Readouts for the sphere.
  const sphereGrid = el('div', 'readouts')
  const speedR = readout(t('read.speed'), 'airSpeed')
  const qR = readout(t('read.q'), 'dynamicPressure')
  const reR = readout(t('read.re'), 'reynolds')
  const dragR = readout(t('read.drag'), 'drag')
  sphereGrid.append(speedR.box, qR.box, reR.box, dragR.box)
  reR.sub.textContent = `${fixed(REFERENCE_SPHERE.diameter * 100, 0)} cm sphere`

  // Readouts for the reference wheel.
  const wheelGrid = el('div', 'readouts')
  const wSpeed = readout(t('read.speed'), 'airSpeed')
  const wDrag = readout(t('read.modelDrag'), 'drag')
  const wCdA = readout(t('read.wheelCdA'), 'staticWheels')
  const wBook = readout(t('read.book'), 'calibration')
  wheelGrid.append(wSpeed.box, wDrag.box, wCdA.box, wBook.box)
  wCdA.sub.textContent = t('read.wheelNote', { scale: fixed(1 / STANDARD_MODEL.scale, 0), spokes: REFERENCE_WHEEL.spokes })
  wBook.sub.textContent = t('read.bookNote')

  // Readouts for a tare run: the mount alone.
  const tareGrid = el('div', 'readouts')
  const tSpeed = readout(t('read.speed'), 'airSpeed')
  const tQ = readout(t('read.q'), 'dynamicPressure')
  const tDrag = readout(t('read.mountDrag'), 'sting')
  const tSoFar = readout(t('read.tare'), 'tare')
  tareGrid.append(tSpeed.box, tQ.box, tDrag.box, tSoFar.box)
  tQ.sub.textContent = '½ρV²'

  // The drag note ("Cd {cd} · {regime}") keeps its regime word as a glossary
  // term, so it is built once from the template and its slots updated in place.
  const cdText = document.createTextNode('')
  const regimeTerm = glossaryTerm('laminar', '')
  dragR.sub.append(
    ...t('read.dragNote')
      .split(/(\{\w+\})/)
      .map((part) => (part === '{cd}' ? cdText : part === '{regime}' ? regimeTerm : document.createTextNode(part))),
  )

  // The run and its bill.
  const runLine = el('div', 'run-line')
  const runNow = el('span', 'run-now')
  const runTotal = el('span', 'run-total')
  runLine.append(runNow, runTotal)
  runLine.setAttribute('aria-live', 'off')

  // Tabs: readouts, or a live chart in the same space.
  const viewBar = el('div', 'tabs view-tabs')
  viewBar.setAttribute('role', 'tablist')
  viewBar.setAttribute('aria-label', t('view.tabs'))
  const viewButtons = VIEWS.map((v) => {
    const b = el('button', 'tab', t(v.key))
    b.type = 'button'
    b.id = `view-${v.value}`
    b.setAttribute('role', 'tab')
    b.addEventListener('click', () => selectView(v.value))
    viewBar.append(b)
    return b
  })
  const chartBox = el('div', 'chart-box')
  chartBox.setAttribute('role', 'tabpanel')
  const chartCaption = el('p', 'chart-caption')
  const chart = createChart(chartCaption)
  chartBox.append(chart.canvas, chartCaption)

  // Runs: the session's runs, and A against B.
  const runsBox = el('div', 'runs-box')
  runsBox.setAttribute('role', 'tabpanel')
  runsBox.setAttribute('aria-labelledby', 'view-runs')
  const compareBox = el('div', 'compare')
  const verdict = el('p', 'compare-verdict')
  verdict.setAttribute('aria-live', 'polite')
  const detail = el('p', 'compare-detail')
  const changed = el('p', 'compare-detail')
  // The chart's own words go on the canvas label; the caption shown keeps
  // "noise band" as a tappable glossary term, with the count updated in place.
  const compareChart = createChart(el('span'))
  const compareCaption = el('p', 'chart-caption')
  const countText = document.createTextNode('')
  compareCaption.append(
    ...t('runs.chart')
      .split(/(noise band|\{count\})/)
      .map((part) => (part === 'noise band' ? glossaryTerm('noiseBand', part) : part === '{count}' ? countText : document.createTextNode(part))),
  )
  compareBox.append(verdict, detail, changed, compareChart.canvas, compareCaption)
  // Calibrate: the sphere against the book, and what the tunnel has given away.
  const calBox = el('div', 'runs-box cal-box')
  calBox.setAttribute('role', 'tabpanel')
  calBox.setAttribute('aria-labelledby', 'view-cal')
  const calChart = createChart(el('span'))
  // "the book" stays a tappable glossary term in the caption.
  const calCaption = el('p', 'chart-caption')
  calCaption.append(
    ...t('cal.chart')
      .split(/(the book)/)
      .map((part) => (part === 'the book' ? glossaryTerm('calibration', part) : document.createTextNode(part))),
  )
  const calLines = {
    tare: el('p', 'compare-detail'),
    crisis: el('p', 'compare-detail'),
    block: el('p', 'compare-detail'),
    posts: el('p', 'compare-detail'),
    wheel: el('p', 'compare-detail'),
  }
  calLines.crisis.setAttribute('aria-live', 'polite')
  calBox.append(calChart.canvas, calCaption, calLines.tare, calLines.crisis, calLines.block, calLines.posts, calLines.wheel)

  const runsHint = el('p', 'runs-hint')
  const runList = el('ul', 'run-list')
  // This design's record: repeat runs pooled at each crank angle, and the pedalling average.
  const poolBox = el('div', 'compare pool')
  const poolTitle = el('p', 'compare-verdict', t('pool.title'))
  const poolRows = el('div')
  const poolCycle = el('p', 'compare-detail pool-note')
  const poolFix = el('p', 'compare-detail pool-note')
  poolBox.append(poolTitle, poolRows, poolCycle, poolFix)
  runsBox.append(poolBox, compareBox, runsHint, runList)

  const foot = el('div', 'sheet-foot')
  const version = el('span', 'version', `v${__GAME_VERSION__} · ${__BUILD_SHA__} · ${__BUILD_DATE__}`)
  const footHint = el('span', 'hint', t('hint.orbit'))
  foot.append(footHint, version)

  // Flow instruments: toggle chips over the 3D view, just above the sheet.
  type Inst = 'wand' | 'rake' | 'tufts' | 'dark'
  const inst: Record<Inst, boolean> = { wand: false, rake: false, tufts: false, dark: false }
  const instBar = el('div', 'instruments')
  instBar.setAttribute('role', 'group')
  instBar.setAttribute('aria-label', t('inst.label'))
  for (const id of ['wand', 'rake', 'tufts', 'dark'] as const) {
    const b = el('button', 'chip', t(`inst.${id}`))
    b.type = 'button'
    b.setAttribute('aria-pressed', 'false')
    b.setAttribute('aria-label', t(`inst.${id}Name`))
    b.title = t(`inst.${id}Name`)
    b.addEventListener('click', () => {
      inst[id] = !inst[id]
      b.setAttribute('aria-pressed', String(inst[id]))
      applyInstruments()
    })
    instBar.append(b)
  }

  sheet.append(mountRow, fanCtl.row, yawCtl.row, runLine, viewBar, riderGrid, sphereGrid, wheelGrid, tareGrid, chartBox, calBox, runsBox, foot)
  app.append(header, sheet, instBar)

  // Keep the 3D model centred in the space above the sheet.
  const sheetObserver = new ResizeObserver(() => {
    view.setSheetHeight(sheet.offsetHeight)
    app.style.setProperty('--sheet-h', `${sheet.offsetHeight}px`)
  })
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

  // --- The air for the instruments.
  let modelVersion = 0
  let flowKey = ''
  let flowAge = Infinity
  const anyFlow = () => inst.wand || inst.rake || inst.tufts
  function applyInstruments() {
    view.setInstruments({ ...inst })
    setText(footHint, t(inst.wand && mount === 'rider' ? 'hint.wand' : 'hint.orbit'))
    flowKey = ''
    flowAge = Infinity
  }
  /** Rebuild the field when the setting has moved on, no more than four times a second. */
  function updateFlow(dt: number) {
    flowAge += dt
    if (mount !== 'rider' || tare || !prepared || !anyFlow()) return
    // Below reading speed the drag regime is the slow-air one; the drawing slows the smoke itself.
    const speed = Math.max(spec.readFrom, fan.speed)
    const key = `${modelVersion}|${Math.round(table.angle)}|${Math.round(speed / 2)}|${inst.tufts}`
    if (key === flowKey || flowAge < 0.25) return
    flowKey = key
    flowAge = 0
    const flow = { density: AIR.density, viscosity: AIR.viscosity, speed, turbulence: airTurbulence }
    const field = modelFlowField(designStore.get(), prepared.shape, flow, table.angle, { seed: DEMO_MODEL_SEED, crankDeg: crank })
    view.setFlow(field, inst.tufts ? tuftsOf(field, { spacing: TUFT_VIZ.spacing }) : [])
  }

  // --- Runs: the recorder, the session's finished runs and the bill.
  let rec: Recorder = newRecorder()
  const runs: Run[] = []
  let view_: View = 'readouts'
  let chartDirty = true
  /** After a model swap the fan coasts down; no new run starts until it stops. */
  let coasting = false
  new ResizeObserver(() => (chartDirty = true)).observe(chart.canvas)
  /** Runs picked for comparison, by id: A first, then B. */
  let picks: number[] = []
  /** The design each rider run tested, by run id, so the report can say what changed. */
  const designs = new Map<number, CyclistDesign>()
  /** The crank angle of each rider run. */
  const cranks = new Map<number, number>()
  let runsDirty = true
  new ResizeObserver(() => (runsDirty = true)).observe(compareChart.canvas)
  new ResizeObserver(() => (runsDirty = true)).observe(calChart.canvas)
  /** What the runs have found out about the tunnel, and the rider's corrections from it. */
  let cal: Calibration = calibrate([], ball, sectionArea)
  let fix: Corrections = NO_CORRECTIONS
  /** The reference wheel against the book, once the posts are tared. */
  let wheel: WheelCheck | null = null
  /** What comes off the reference wheel's own readings: the posts and its (small) blockage. */
  let wheelFix: Corrections = NO_CORRECTIONS
  const refreshCal = () => {
    cal = calibrate(runs, ball, sectionArea)
    const posts = latestTare(runs, 'posts')
    wheelFix = corrections(cal, posts, wheelModel.shape.frontalArea, sectionArea)
    wheel = wheelFix.tare !== null ? wheelCheck(runs, wheelSpinning, wheelFix.tare, wheelFix.blockage) : null
    if (!prepared) {
      fix = NO_CORRECTIONS
      return
    }
    // With no wheel drive the rider's still spokes read low: add back the reference wheel's gap, scaled by its spokes.
    const wheels = wheel?.trusted && !spec.wheelDrive ? wheel.gap * spokeShare(prepared.shape, wheelSpinning) : null
    fix = corrections(cal, posts, prepared.shape.frontalArea, sectionArea, wheels)
  }
  /** The run name for what's on the mount now. */
  const runModel = () => (tare ? tareModel(MOUNT_KIND[mount]) : mount === 'wheel' ? WHEEL_RUN : mount)
  const yawAxes = {
    x: { label: t('axis.yaw'), unit: '°', digits: 0, min: spec.turntable.min, max: spec.turntable.max },
    y: { label: t('axis.cda'), unit: 'm²', digits: 3 },
  }

  /** End the run in progress (the model is being swapped) and stop the fan. */
  function endRun() {
    if (rec.run) {
      runs.push(rec.run)
      rec = { ...rec, run: null }
      runsDirty = true
      refreshCal()
    }
    coasting = true
    fan = setFanTarget(fan, 0, spec)
    fanCtl.input.value = '0'
    showTargets()
    chartDirty = true
  }

  /** One balance sample of whatever is on the mount, or null below reading speed. */
  function takeSample(): Omit<RunSample, 't'> | null {
    const q = dynamicPressure(AIR.density, fan.speed)
    if (fan.speed < spec.readFrom) return null
    if (tare) {
      const cdA = readTare(tunnel, { speed: fan.speed, yawDeg: 0, mount: MOUNT_KIND[mount] }, balanceRng)
      return { speed: fan.speed, yawDeg: 0, cdA, cyA: 0, dragN: q * cdA, steady: fan.speed === fan.target }
    }
    if (mount === 'sphere') {
      const r = readBalance(sphereModel, tunnel, { speed: fan.speed, yawDeg: 0, mount: 'sting' }, balanceRng)
      return { speed: fan.speed, yawDeg: 0, cdA: r.cdA, cyA: 0, dragN: q * r.modelCdA, steady: fan.speed === fan.target }
    }
    if (mount === 'wheel') {
      const r = readBalance(wheelModel, tunnel, { speed: fan.speed, yawDeg: 0, mount: 'posts' }, balanceRng)
      return { speed: fan.speed, yawDeg: 0, cdA: r.modelCdA, cyA: 0, dragN: q * r.modelCdA, steady: fan.speed === fan.target }
    }
    if (!prepared) return null
    const r = readBalance(prepared, tunnel, { speed: fan.speed, yawDeg: table.angle, mount: 'posts' }, balanceRng)
    const steady = fan.speed === fan.target && table.angle === table.target
    return { speed: fan.speed, yawDeg: table.angle, cdA: r.cdA, cyA: r.cyA, dragN: q * r.modelCdA, steady }
  }

  function showRun() {
    const live = rec.run
    const done = runs[runs.length - 1]
    if (live && live.model === 'rider' && !designs.has(live.id)) {
      designs.set(live.id, structuredClone(designStore.get()))
      cranks.set(live.id, crank)
    }
    if (live) setText(runNow, t('run.live', { id: live.id, time: clock(live.duration), cost: fixed(runCost(live), 0) }))
    else if (done) setText(runNow, t('run.last', { id: done.id, time: clock(done.duration), cost: fixed(runCost(done), 0) }))
    else setText(runNow, t('run.idle', { fee: fixed(TUNNEL_BILLING.perRun, 0) }))
    const total = runs.reduce((sum, r) => sum + runCost(r), live ? runCost(live) : 0)
    setText(runTotal, runs.length || live ? t('run.session', { total: fixed(total, 0) }) : '')
  }

  /** The yaw sweep only means something with the rider on the turntable. */
  const yawOpen = () => mount === 'rider' && !tare

  function selectView(next: View) {
    if (next === 'yaw' && !yawOpen()) next = 'readouts'
    view_ = next
    VIEWS.forEach((v, i) => {
      const on = v.value === view_
      viewButtons[i]!.setAttribute('aria-selected', String(on))
      viewButtons[i]!.tabIndex = on ? 0 : -1
    })
    viewButtons[2]!.hidden = !yawOpen()
    const reading = view_ === 'readouts'
    riderGrid.hidden = !(reading && mount === 'rider' && !tare)
    sphereGrid.hidden = !(reading && mount === 'sphere' && !tare)
    wheelGrid.hidden = !(reading && mount === 'wheel' && !tare)
    tareGrid.hidden = !(reading && tare)
    chartBox.hidden = view_ !== 'time' && view_ !== 'yaw'
    chartBox.setAttribute('aria-labelledby', `view-${view_}`)
    calBox.hidden = view_ !== 'cal'
    runsBox.hidden = view_ !== 'runs'
    chartDirty = true
    runsDirty = true
  }
  viewBar.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const open = VIEWS.filter((_, i) => !viewButtons[i]!.hidden)
    const i = open.findIndex((v) => v.value === view_)
    const next = open[(i + (e.key === 'ArrowRight' ? 1 : open.length - 1)) % open.length]!.value
    selectView(next)
    viewButtons[VIEWS.findIndex((v) => v.value === next)]!.focus()
  })

  function drawChart() {
    if (view_ === 'readouts' || view_ === 'runs' || !chartDirty) return
    chartDirty = false
    // This run bold and the last one faint; with the fan off, the last two.
    const same = runs.filter((r) => r.model === runModel()).reverse()
    const [bold, faint] = rec.run ? [rec.run.samples, same[0]?.samples ?? []] : [same[0]?.samples ?? [], same[1]?.samples ?? []]
    if (view_ === 'time') {
      const pts = (s: RunSample[]): ChartPoint[] => s.map((p) => ({ x: p.t, y: p.dragN }))
      const axes = { x: { label: t('axis.time'), unit: 's', digits: 0, min: 0 }, y: { label: t('axis.drag'), unit: 'N', digits: 1, min: 0 } }
      chart.draw({
        ...axes,
        series: [{ points: pts(faint), mark: 'faint' }, { points: pts(bold), mark: 'dot', latest: true }],
        caption: describeLast(axes, pts(bold), t('chart.emptyTime')),
      })
    } else {
      // Only points taken with the fan and table settled: CdA against yaw, not against a moving table.
      const pts = (s: RunSample[]): ChartPoint[] => s.filter((p) => p.steady).map((p) => ({ x: p.yawDeg, y: p.cdA }))
      chart.draw({
        ...yawAxes,
        series: [{ points: pts(faint), mark: 'faint' }, { points: pts(bold), mark: 'dot', latest: true }],
        caption: describeLast(yawAxes, pts(bold), t('chart.emptyYaw')),
      })
    }
  }

  // --- The Runs tab: the list, and A against B.
  const groupWords = (g: YawGroup | null, digits: number) =>
    g
      ? t('runs.rowCdA', { cda: fixed(g.mean, digits), band: fixed(g.band, digits), yaw: fixed(g.yawDeg, 0), speed: fixed(g.speed, 0), n: g.n })
      : t('runs.rowNone')

  function togglePick(id: number) {
    if (picks.includes(id)) picks = picks.filter((p) => p !== id)
    else picks = picks.length < 2 ? [...picks, id] : [picks[0]!, id]
    runsDirty = true
  }

  function drawRuns() {
    if (view_ !== 'runs' || !runsDirty) return
    runsDirty = false
    // The list, newest first. Rebuilt only when something changed.
    runList.replaceChildren(
      ...[...runs].reverse().map((run) => {
        const li = el('li')
        const b = el('button', 'run-item')
        b.type = 'button'
        const slot = picks.indexOf(run.id)
        b.setAttribute('aria-pressed', String(slot >= 0))
        const badge = el('span', 'run-badge', slot === 0 ? 'A' : slot === 1 ? 'B' : '')
        const text = el('span', 'run-text')
        const model = t(RUN_MODEL[run.model] ?? 'mount.rider')
        text.append(
          el('span', 'run-title', t('runs.row', { id: run.id, model, time: clock(run.duration), cost: fixed(runCost(run), 0) })),
          el('span', 'run-sub', groupWords(headlineGroup(yawGroups(run)), run.model.startsWith('tare') || run.model === WHEEL_RUN ? TARE_DIGITS : 4)),
        )
        b.append(badge, text)
        b.addEventListener('click', () => togglePick(run.id))
        li.append(b)
        return li
      }),
    )
    setText(runsHint, runs.length === 0 ? t('runs.empty') : picks.length < 2 ? t('runs.pick') : '')
    runsHint.hidden = runsHint.textContent === ''
    drawPool()

    const a = runs.find((r) => r.id === picks[0])
    const b = runs.find((r) => r.id === picks[1])
    compareBox.hidden = !a || !b
    if (!a || !b) return
    if (a.model !== b.model) {
      setText(verdict, t('runs.otherModel'))
      detail.hidden = changed.hidden = true
    } else {
      const head = headlineCompare(compareRuns(a, b))
      if (!head) setText(verdict, t('runs.noShared'))
      else {
        const slots = { delta: fixed(Math.abs(head.delta), 4), band: fixed(head.band, 4), yaw: fixed(head.yawDeg, 0) }
        setText(verdict, t(head.verdict === 'lower' ? 'runs.lower' : head.verdict === 'higher' ? 'runs.higher' : head.verdict === 'noise' ? 'runs.noise' : 'runs.tooFew', slots))
        setText(detail, t('runs.detail', { a: fixed(head.a.mean, 4), bandA: fixed(head.a.band, 4), b: fixed(head.b.mean, 4), bandB: fixed(head.b.band, 4) }))
      }
      detail.hidden = !head
      const da = designs.get(a.id)
      const db = designs.get(b.id)
      const list = da && db ? changedControls(da, db).map((id) => t(`ctl.${id}`)) : []
      if (cranks.get(a.id) !== cranks.get(b.id)) list.push(t('crank.changed'))
      changed.hidden = !da || !db
      setText(changed, list.length ? t('runs.changed', { list: list.join(', ') }) : t('runs.same'))
    }
    // A and B side by side by yaw, each mean with its noise band; B nudged right so the bars don't hide each other.
    const pts = (groups: YawGroup[], nudge: number): ChartPoint[] =>
      groups.map((g) => ({ x: g.yawDeg + nudge, y: g.mean, lo: g.mean - g.band, hi: g.mean + g.band }))
    const ga = yawGroups(a)
    const gb = yawGroups(b)
    const shared = a.model === b.model ? compareRuns(a, b).length : 0
    countText.data = String(shared)
    compareChart.draw({
      ...yawAxes,
      series: [{ points: pts(ga, -0.4), mark: 'dot' }, { points: pts(gb, 0.4), mark: 'ring' }],
      caption: `${verdict.textContent} · ${t('runs.chart', { count: shared })}`,
    })
  }

  /** This design's runs, pooled at each crank angle, with corrections taken off. */
  function drawPool() {
    const now = designStore.get()
    const byCrank = new Map<number, Run[]>()
    for (const run of runs) {
      const d = designs.get(run.id)
      const c = cranks.get(run.id)
      if (run.model !== 'rider' || !d || c === undefined || changedControls(d, now).length > 0) continue
      byCrank.set(c, [...(byCrank.get(c) ?? []), run])
    }
    poolBox.hidden = byCrank.size === 0 || !prepared
    if (poolBox.hidden || !prepared) return
    const s2 = prepared.scale * prepared.scale
    const fixCdA = (v: number) => correct(v * s2, fix) / s2
    const fixBand = (v: number) => v / (fix.blockage ?? 1)
    const cycle = legCycle(byCrank)
    poolRows.replaceChildren(
      ...[...byCrank.entries()]
        .sort((p, q) => p[0] - q[0])
        .map(([c, list]) => {
          // At the pedalling average's setting if there is one, else this angle's own headline.
          const pooled = poolRuns(list)
          const g = cycle ? cycle.angles.find((a) => a.crankDeg === c)?.pooled : headlineGroup(pooled.filter((p) => p.trusted))
          const row = el('p', 'compare-detail')
          if (!g) row.textContent = `${c}° · ${t('runs.rowNone')}`
          else {
            const p = g
            row.textContent =
              t('pool.row', {
                crank: c,
                cda: fixed(fixCdA(p.mean), 4),
                band: fixed(fixBand(p.band), 4),
                runs: p.runs === 1 ? t('pool.run') : t('pool.runs', { n: p.runs }),
              }) +
              (p.spread !== null ? t('pool.spread', { spread: fixed(fixBand(p.spread), 4) }) : '') +
              (cycle ? '' : t('pool.at', { yaw: fixed(p.yawDeg, 0), speed: fixed(p.speed, 0) }))
          }
          return row
        }),
    )
    setText(poolTitle, cycle ? t('pool.titleAt', { yaw: fixed(cycle.yawDeg, 0), speed: fixed(cycle.speed, 0) }) : t('pool.title'))
    const more = cycle ? Math.max(0, RUN_STATS.legAngles - cycle.angles.length) : 0
    setText(
      poolCycle,
      !cycle
        ? t('pool.one')
        : t(cycle.enough ? 'pool.cycle' : 'pool.cycleFew', { k: cycle.angles.length, cda: fixed(fixCdA(cycle.mean), 4), band: fixed(fixBand(cycle.band), 4), more }),
    )
    const words = fixWords(fix)
    setText(poolFix, words ? t('pool.fixed', { list: words }) : t('pool.raw'))
  }

  /** Set the model's legs to a crank angle: the fan stops while the tunnel is opened. */
  function setCrank(deg: number) {
    if (deg === crank) return
    crank = deg
    placeModel()
  }

  function placeModel() {
    if (mount === 'sphere') {
      view.setModel({ kind: 'sphere', tare })
      return
    }
    if (mount === 'wheel') {
      view.setModel({ kind: 'wheel', scale: modelSpec.scale, tare })
      return
    }
    if (prepared) endRun()
    const design = designStore.get()
    prepared = prepareModel(cyclistShape(design, { crankDeg: crank, staticWheels: !spec.wheelDrive }), modelSpec)
    refreshCal()
    modelVersion++
    view.setFlow(null, [])
    view.setModel({ kind: 'rider', state: { design, pose: riderPose(design, crank), broken: [], strained: [] }, scale: modelSpec.scale, tare })
    runsDirty = true
    designDirty = false
  }

  /** Show the controls that fit what's on the mount. */
  function showMount() {
    mountButtons.forEach((b, i) => {
      const on = MOUNTS[i]!.value === mount
      b.setAttribute('aria-checked', String(on))
      b.tabIndex = on ? 0 : -1
    })
    tareBtn.setAttribute('aria-pressed', String(tare))
    yawCtl.row.hidden = !yawOpen()
    crankBox.hidden = !yawOpen()
    instBar.hidden = !yawOpen()
    shown.cdA = shown.dragN = shown.sideN = 0
    placeModel()
    selectView(view_)
  }

  function setMount(next: Mount) {
    if (next === mount && prepared) return
    if (rec.run) endRun()
    mount = next
    showMount()
  }

  /** Take the model off for a tare run, or put it back. Either way the run in progress ends. */
  function setTare(on: boolean) {
    if (rec.run) endRun()
    tare = on
    showMount()
  }

  /** The readout's displayed value settles like a real balance display, so noise is a wobble, not a flicker. */
  const settle = (dt: number) => (shown.dragN === 0 ? 1 : 1 - Math.exp(-dt / spec.displaySettle))
  const showSpeed = (box: { value: HTMLElement; sub: HTMLElement }) => {
    setText(box.value, `${fixed(fan.speed, 1)} m/s`)
    setText(box.sub, `${fixed(fan.speed * 3.6, 0)} km/h`)
  }
  const updateSphere = (dt: number) => {
    const q = dynamicPressure(AIR.density, fan.speed)
    showSpeed(speedR)
    setText(qR.value, `${fixed(q, 0)} Pa`)
    setText(qR.sub, '½ρV²')
    setText(reR.value, scientific(reynolds(AIR.density, fan.speed, REFERENCE_SPHERE.diameter, AIR.viscosity)))

    // The sim's own view of the flow (in this tunnel's air) names the regime and places the smoke's separation.
    const drag = bodyDrag(ball, { ...AIR, speed: fan.speed, turbulence: airTurbulence })
    setText(regimeTerm, t(`regime.${drag.regime}` as const))
    regimeTerm.dataset.g = REGIME_TERM[drag.regime]
    const cos = Math.min(1, Math.max(-1, 1 - drag.lines.top.separationX / radius))
    view.setSeparation((Math.acos(cos) * 180) / Math.PI)

    // The numbers are the balance's, sting and all.
    if (fan.speed < spec.readFrom) {
      shown.dragN = shown.cdA = 0
      setText(dragR.value, '–')
      cdText.data = '–'
      return
    }
    const r = readBalance(sphereModel, tunnel, { speed: fan.speed, yawDeg: 0, mount: 'sting' }, balanceRng)
    const k = settle(dt)
    shown.dragN += (q * r.modelCdA - shown.dragN) * k
    shown.cdA += (r.modelCdA - shown.cdA) * k
    setText(dragR.value, `${fixed(shown.dragN, 1)} N`)
    cdText.data = fixed(shown.cdA / ball.frontalArea, 2)
  }

  const updateTare = (dt: number) => {
    const q = dynamicPressure(AIR.density, fan.speed)
    showSpeed(tSpeed)
    setText(tQ.value, `${fixed(q, 0)} Pa`)
    const live = rec.run?.model === runModel() ? rec.run : null
    const so = live ? latestTare([live], MOUNT_KIND[mount]) : null
    setText(tSoFar.value, so ? `${fixed(so.mean, TARE_DIGITS)} m²` : '–')
    setText(tSoFar.sub, so && so.n > 1 ? t('read.tareNote', { band: fixed(so.band, TARE_DIGITS), n: so.n }) : t('read.tareWait'))
    if (fan.speed < spec.readFrom) {
      shown.dragN = shown.cdA = 0
      setText(tDrag.value, '–')
      setText(tDrag.sub, t('read.mountDragNote', { cda: '–' }))
      return
    }
    const cdA = readTare(tunnel, { speed: fan.speed, yawDeg: 0, mount: MOUNT_KIND[mount] }, balanceRng)
    const k = settle(dt)
    shown.dragN += (q * cdA - shown.dragN) * k
    shown.cdA += (cdA - shown.cdA) * k
    setText(tDrag.value, `${fixed(shown.dragN, 2)} N`)
    setText(tDrag.sub, t('read.mountDragNote', { cda: fixed(shown.cdA, TARE_DIGITS) }))
  }

  const updateWheel = (dt: number) => {
    showSpeed(wSpeed)
    const q = dynamicPressure(AIR.density, fan.speed)
    if (fan.speed < spec.readFrom) {
      shown.dragN = shown.cdA = 0
      setText(wDrag.value, '–')
      setText(wDrag.sub, '')
      setText(wCdA.value, '–')
      setText(wBook.value, '–')
      return
    }
    // The book's figure is the reference wheel spinning in calm air, with no posts.
    const book = shapeDrag(wheelSpinning, { ...AIR, speed: fan.speed, turbulence: 0 }).cdA
    setText(wBook.value, `${fixed(book, TARE_DIGITS)} m²`)
    const r = readBalance(wheelModel, tunnel, { speed: fan.speed, yawDeg: 0, mount: 'posts' }, balanceRng)
    const k = settle(dt)
    shown.dragN += (q * r.modelCdA - shown.dragN) * k
    shown.cdA += (r.modelCdA - shown.cdA) * k
    setText(wDrag.value, `${fixed(shown.dragN, 2)} N`)
    setText(wDrag.sub, t('read.withPosts'))
    // With the posts tared, the wheel's own drag; the book has no posts.
    const words = fixWords(wheelFix)
    if (!words) {
      setText(wCdA.value, `${fixed(shown.cdA, TARE_DIGITS)} m²`)
      setText(wCdA.sub, t('read.wheelNote', { scale: fixed(1 / modelSpec.scale, 0), spokes: REFERENCE_WHEEL.spokes }))
      wCdA.sub.title = ''
    } else {
      setText(wCdA.value, `${fixed(correct(shown.cdA, wheelFix), TARE_DIGITS)} m²`)
      setText(wCdA.sub, t('read.cdaFixed', { raw: fixed(shown.cdA, TARE_DIGITS) }))
      wCdA.sub.title = t('read.fixedFor', { list: words })
    }
  }

  // --- The Calibrate tab.
  const book = bookCurve(ball)
  const calAxes = {
    x: { label: t('axis.re'), unit: '×10⁵', digits: 1, min: 0 },
    y: { label: t('axis.cd'), unit: '', digits: 2, min: 0 },
  }
  function drawCal() {
    if (view_ !== 'cal' || !runsDirty) return
    runsDirty = false
    const scale = fixed(1 / modelSpec.scale, 0)
    const sting = cal.tare
    setText(calLines.tare, !sting ? t('cal.tareNone') : !sting.trusted ? t('cal.tareFew', { id: sting.runId }) : t('cal.tare', { cda: fixed(sting.mean, TARE_DIGITS), band: fixed(sting.band, TARE_DIGITS), id: sting.runId }))
    const crisis = cal.crisis
    setText(
      calLines.crisis,
      crisis && cal.turbulence !== null
        ? t('cal.crisis', { re: scientific(crisis.re), book: scientific(crisis.bookRe), tu: fixed(cal.turbulence * 100, 1) })
        : cal.points.length === 0
          ? t('cal.empty')
          : t('cal.crisisNone'),
    )
    const b = cal.blockage
    const riderFactor = fix.blockage
    setText(
      calLines.block,
      b && riderFactor !== null
        ? t('cal.block', { pct: fixed((b.ratio - 1) * 100, 1), band: fixed(b.band * 100, 1), scale, rider: fixed((riderFactor - 1) * 100, 1) })
        : !sting?.trusted
          ? t('cal.blockTare')
          : crisis
            ? t('cal.blockFew', { speed: fixed((crisis.re * CALIBRATION.subcritical * AIR.viscosity) / (AIR.density * REFERENCE_SPHERE.diameter), 0) })
            : '',
    )
    calLines.block.hidden = calLines.block.textContent === ''
    const posts = latestTare(runs, 'posts')
    setText(
      calLines.posts,
      !posts
        ? t('cal.postsNone')
        : !posts.trusted
          ? t('cal.postsFew', { id: posts.runId })
          : t('cal.posts', { cda: fixed(posts.mean, TARE_DIGITS), band: fixed(posts.band, TARE_DIGITS), id: posts.runId }),
    )
    const share = prepared ? spokeShare(prepared.shape, wheelSpinning) : 0
    const postsTare = posts?.trusted ? posts : null
    const wheelRuns = runs.filter((r) => r.model === WHEEL_RUN)
    const ww = wheel
    setText(
      calLines.wheel,
      spec.wheelDrive
        ? ''
        : wheelRuns.length === 0
          ? t('cal.wheelNone')
          : !postsTare
            ? t('cal.wheelTare')
            : !ww || !ww.trusted
              ? t('cal.wheelFew', { id: wheelRuns[wheelRuns.length - 1]!.id })
              : t(share > 0 ? 'cal.wheel' : 'cal.wheelDiscs', {
                  gap: fixed(ww.gap, TARE_DIGITS),
                  band: fixed(ww.band, TARE_DIGITS),
                  book: fixed(ww.book, TARE_DIGITS),
                  rider: fixed((ww.gap * share) / (modelSpec.scale * modelSpec.scale), 4),
                }),
    )
    calLines.wheel.hidden = calLines.wheel.textContent === ''
    // The book as faint dots, your readings bold with their noise bands.
    const mine: ChartPoint[] = cal.points.map((p) => ({ x: p.re / 1e5, y: p.cd, lo: p.cd - p.band, hi: p.cd + p.band }))
    calChart.draw({
      ...calAxes,
      series: [
        { points: book.filter((_, i) => i % 2 === 0).map((p) => ({ x: p.re / 1e5, y: p.cd })), mark: 'faint' },
        { points: mine, mark: 'dot' },
      ],
      caption: [t('cal.chart'), calLines.crisis.textContent].join(' · '),
    })
  }

  const updateRider = (dt: number) => {
    if (!prepared) return
    showSpeed(rSpeed)
    setText(rYaw.value, `${fixed(table.angle, 1)}°`)
    if (fan.speed < spec.readFrom) {
      shown.cdA = shown.dragN = shown.sideN = 0
      setText(rYaw.sub, t('read.sideNote', { force: '–' }))
      setText(rDrag.value, '–')
      setText(rDrag.sub, t('read.modelDragNote', { re: '–' }))
      setText(rCdA.value, '–')
      return
    }
    const r = readBalance(prepared, tunnel, { speed: fan.speed, yawDeg: table.angle, mount: 'posts' }, balanceRng)
    const q = dynamicPressure(AIR.density, fan.speed)
    const s2 = prepared.scale * prepared.scale
    const k = settle(dt)
    shown.cdA += (r.cdA - shown.cdA) * k
    shown.dragN += (q * r.modelCdA - shown.dragN) * k
    shown.sideN += (q * Math.abs(r.cyA) * s2 - shown.sideN) * k
    setText(rYaw.sub, t('read.sideNote', { force: `${fixed(shown.sideN, 1)} N` }))
    setText(rDrag.value, `${fixed(shown.dragN, 1)} N`)
    setText(rDrag.sub, t('read.modelDragNote', { re: scientific(r.reynolds) }))
    // The CdA takes off whatever the tare and calibration runs have found.
    const words = fixWords(fix)
    if (!words) {
      setText(rCdA.value, `${fixed(shown.cdA, 3)} m²`)
      setText(rCdA.sub, t('read.cdaRaw', { scale: fixed(1 / prepared.scale, 0) }))
      rCdA.sub.title = ''
    } else {
      setText(rCdA.value, `${fixed(correct(shown.cdA * s2, fix) / s2, 3)} m²`)
      setText(rCdA.sub, t('read.cdaFixed', { raw: fixed(shown.cdA, 3) }))
      rCdA.sub.title = t('read.fixedFor', { list: words })
    }
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
      if (coasting && fan.speed < RUN_RECORDING.endBelow) coasting = false
      const step = coasting ? { recorder: rec, sampleDue: false, finished: null } : stepRecorder(rec, fan.speed, STEP, runModel())
      rec = step.recorder
      if (step.finished) {
        runs.push(step.finished)
        refreshCal()
        chartDirty = true
        runsDirty = true
      }
      if (step.sampleDue) {
        const sample = takeSample()
        if (sample) {
          rec = addSample(rec, sample)
          chartDirty = true
        }
      }
      carry -= STEP
    }
    if (mount === 'rider' && designDirty) placeModel()
    if (tare) updateTare(dt)
    else if (mount === 'rider') {
      updateRider(dt)
      updateFlow(dt)
    } else if (mount === 'wheel') updateWheel(dt)
    else updateSphere(dt)
    showRun()
    drawChart()
    drawRuns()
    drawCal()
    view.setYaw(yawOpen() ? table.angle : 0)
    view.frame(fan.speed, dt)
    raf = requestAnimationFrame(loop)
  }
  setMount('rider')
  applyInstruments()
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
