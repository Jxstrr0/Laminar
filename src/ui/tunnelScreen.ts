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
import { CALIBRATION, CRANK_DIAL, REFERENCE_SPHERE, REFERENCE_WHEEL, RUN_RECORDING, RUN_STATS, TUNNEL_BILLING } from '../data/tunnel'
import { t, type StringKey } from '../data/strings'
import { dynamicPressure, reynolds } from '../sim/air'
import { bodyDrag, shapeDrag, type Regime } from '../sim/aero/drag'
import { fanAtRest, setFanTarget, stepFan, type FanState } from '../sim/fan'
import { modelFlowField, tufts as tuftsOf } from '../sim/flow/field'
import { readTaps, tapExtremes, tapLayout } from '../sim/flow/taps'
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
import { referenceWheel } from '../sim/geom/cyclist'
import { sphere } from '../sim/geom/shapes'
import { Rng } from '../sim/rng'
import { designPose, designShape, isBobsled, isJumper, type Design } from '../sim/design'
import { forecastRun, prepareSled, sledEvent } from '../sim/sledTunnel'
import type { SledEvent } from '../sim/sledJob'
import type { BobsledDesign } from '../data/bobsled'
import { sledForecast } from './sledForecast'
import { FLIGHT_ATTITUDE, JUMP_TUNNEL, PITCH } from '../data/jumper'
import { correctJumper, forecastJump, isJumperRun, jumperReadings, prepareJumper, readJumper, type JumperFix, type JumpForecast, type PreparedJumper } from '../sim/jumpTunnel'
import type { JumpEvent } from '../sim/jumper'
import { jumpForecast } from './jumpForecast'
import type { LabState } from '../sim/lab'
import { changedControls } from '../sim/designDiff'
import { compareRuns, headlineCompare, headlineGroup, legCycle, poolRuns, yawGroups, type YawGroup } from '../sim/runStats'
import { addSample, newRecorder, runCost, runTunnel, stepRecorder, type Recorder, type Run, type RunSample } from '../sim/run'
import { setYawTarget, stepTurntable, turntableAtRest, type TurntableSpec, type TurntableState } from '../sim/turntable'
import type { MountKind } from '../sim/quirks'
import type { TunnelBuild, TunnelId, TunnelSetup } from '../sim/facility'
import { FAILURE } from '../data/failure'
import { fixFor, repairQuote, stepStrain, strains, wobbleOf, type Failure, type FailurePart, type Strain, type StrainClock } from '../sim/failure'
import { gaussian } from '../sim/noise'
import { createSheet, type Sheet } from './sheet'
import { modelSpecOf, quote, reynoldsRatio, type ModelOrder } from '../sim/modelShop'
import { fixedDrag, prepareExact, prepareModel, readBalance, readTare, tunnelTurbulence, type EventSpec, type PreparedModel, type TunnelSpec } from '../sim/views'
import type { TunnelView } from '../render/tunnelScene'
import { createChart, describeLast, type ChartPoint } from './chart'
import { openModelShop, type ShopContext } from './modelShop'
import { partChanges, postureChanged, swapCost, swapParts } from '../sim/remodel'
import { createCpLegend } from './cpLegend'
import { designStore } from './designStore'
import { fixed, scientific } from './format'
import { glossaryTerm } from './glossary'

/** The glossary entry for each drag regime word. */
const REGIME_TERM: Record<Regime, GlossaryId> = { laminar: 'laminar', mixed: 'dragCrisis', turbulent: 'turbulent' }

/** The sim's fixed time step, in seconds. */
const STEP = 1 / 60
/** How long a broken part flies before the break sheet slides up, ms. */
const BREAK_SHEET_DELAY_MS = 1600

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

/** What the tunnel needs from the rest of the game. */
export interface TunnelHooks {
  /** Something worth saving changed: a run ended, a model was ordered, the crank was set. */
  onChange(): void
  /** A run finished: bill it. */
  onRun(run: Run): void
  /** The career's seed, which sets each tunnel's hidden quirks. */
  tunnelSeed: number
  /** The tunnel the firm tests in today (the university's, or your own once it's open) and its upgrades. */
  tunnel(): TunnelSetup
  /** The event the design is being built for (the job's). */
  event(): EventSpec
  /** The jump a ski jumper is forecast on (the job's hill and day). */
  jumpEvent(): JumpEvent
  /** The race a bobsled is forecast on (the job's track, or Belogor between jobs). */
  sledRace(): SledEvent
  /** The model shop's view of the job. */
  shop(): ShopContext
  /** A model was ordered: charge it and spend its days. */
  onOrder(price: number, days: number): void
  /** Parts were swapped on the model: charge the fee. */
  onSwap(price: number): void
  /** A broken model goes for repair: charge it and spend its days. False if the job hasn't the days. */
  onRepair(price: number, days: number): boolean
  /** "Change this" after a break: open Shape at the helmet or the wheels. */
  goFix(where: 'helmet' | 'wheels'): void
}

export interface TunnelControl {
  setActive(active: boolean): void
  /** The lab's lasting state now, for the save (a run in progress isn't in it). */
  lab(): LabState
}

/** Start the tunnel from the lab's saved state. */
export function startTunnelScreen(app: HTMLElement, view: TunnelView, saved: LabState, hooks: TunnelHooks): TunnelControl {
  const onChange = hooks.onChange
  let setup = hooks.tunnel()
  /** The tunnel's build: test section, fan, turntable, wheel drive (upgrades change it). */
  let spec: TunnelBuild = setup.build
  // The tunnel as the balance reads it, hidden quirks and all (each career's tunnels have their own).
  // It changes once, when your own tunnel opens (syncTunnel).
  let current: TunnelId = setup.id
  let tunnel: TunnelSpec = { ...spec, quirks: setup.quirks }
  let airTurbulence = tunnelTurbulence(tunnel)
  /** Runs made in the tunnel in use: only they say anything about its quirks. */
  const here = () => runs.filter((r) => runTunnel(r) === current)
  const sectionArea = spec.section.width * spec.section.height
  let fan: FanState = fanAtRest()
  let table: TurntableState = turntableAtRest()
  let mount: Mount = 'rider'
  /** A tare run: the model off, the mount alone. */
  let tare = false
  /** A ski jumper is on the bench model: it flies on a pitching sting, not on the posts. */
  let jumper = false
  let jumperModel: PreparedJumper | null = null
  /** The sting's pitch dial: the same turning control as the turntable, on its own range. */
  const pitchSpec: TurntableSpec = { ...JUMP_TUNNEL.pitch, rate: JUMP_TUNNEL.rate }
  /** The dial the angle row drives: yaw for a rider, pitch for a jumper. */
  const dial = () => (jumper ? pitchSpec : spec.turntable)
  /** Where the angle row's "level" button goes: square on, or the flight angle. */
  const home = () => (jumper ? FLIGHT_ATTITUDE.hold : 0)
  /** The track a sled is forecast on (the job's from PR 8o; Belogor until then). */
  const sledTrack = () => hooks.sledRace().track
  /** The event the model's Reynolds number is matched to: a sled's track at its usual speed, else the job's. */
  const reEvent = (): EventSpec => (isBobsled(modelDesign) ? sledEvent(sledTrack()) : hooks.event())
  /** What holds the model on the mount now. */
  const mountKind = (): MountKind => (mount === 'rider' && jumper ? 'sting' : MOUNT_KIND[mount])
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
  const place = el('p', 'place', t(current === 'own' ? 'tunnel.placeOwn' : 'tunnel.place'))
  titleBlock.append(el('h1', 'wordmark', t('game.title')), place)
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
  // The model shop opens from the fan row's head, for the rider model.
  const shopBtn = el('button', 'shop-open')
  shopBtn.type = 'button'
  shopBtn.title = t('shop.openName')
  shopBtn.setAttribute('aria-haspopup', 'dialog')
  fanCtl.target.before(shopBtn)
  const offBtn = el('button', 'fan-off', t('fan.off'))
  offBtn.type = 'button'
  fanCtl.row.append(offBtn)

  // Yaw turntable.
  const yawCtl = rangeRow('yaw-slider', t('yaw.label'), spec.turntable)
  const yawLabel = yawCtl.row.querySelector('label')!
  const squareBtn = el('button', 'fan-off', t('yaw.square'))
  squareBtn.type = 'button'
  yawCtl.row.append(squareBtn)

  // The crank angle of the rider model's fixed legs, picked from a list in the yaw row's head.
  let crank: number = saved.crank
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
  // A sled's run time down the track on what the balance reads, in the yaw's place (a sled runs straight).
  const rRun = readout(t('read.runForecast'), 'fixedFloor')
  riderGrid.append(rSpeed.box, rYaw.box, rRun.box, rDrag.box, rCdA.box)
  /** Last time the sled's run was flown on the reading, s ago (it's a march down the whole track). */
  let runAge = Infinity
  rCdA.sub.textContent = t('read.cdaRaw', { scale: fixed(1 / STANDARD_MODEL.scale, 0) })

  // Readouts for a ski jumper on the sting.
  const jumperGrid = el('div', 'readouts')
  const jSpeed = readout(t('read.speed'), 'airSpeed')
  const jPitch = readout(t('read.pitch'), 'angleOfAttack')
  const jLD = readout(t('read.ld'), 'liftToDrag')
  const jFc = readout(t('read.forecast'), 'staticMargin')
  jumperGrid.append(jSpeed.box, jPitch.box, jLD.box, jFc.box)

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
  type Inst = 'wand' | 'rake' | 'tufts' | 'taps' | 'dark'
  const inst: Record<Inst, boolean> = { wand: false, rake: false, tufts: false, taps: false, dark: false }
  const instChips = new Map<Inst, HTMLButtonElement>()
  const instBar = el('div', 'instruments')
  instBar.setAttribute('role', 'group')
  instBar.setAttribute('aria-label', t('inst.label'))
  for (const id of ['wand', 'rake', 'tufts', 'taps', 'dark'] as const) {
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
    instChips.set(id, b)
    instBar.append(b)
  }
  // The Cp chip only shows when the model on the mount has taps.
  const tapsChip = instChips.get('taps')!
  tapsChip.hidden = true
  const cpLegend = createCpLegend()

  sheet.append(mountRow, fanCtl.row, yawCtl.row, runLine, viewBar, riderGrid, jumperGrid, sphereGrid, wheelGrid, tareGrid, chartBox, calBox, runsBox, foot)
  app.append(header, sheet, instBar, cpLegend.root)

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
    squareBtn.disabled = table.target === home()
  }
  fanCtl.input.addEventListener('input', () => {
    if (locked()) fanCtl.input.value = '0'
    fan = setFanTarget(fan, Number(fanCtl.input.value), spec)
    showTargets()
  })
  offBtn.addEventListener('click', () => {
    fan = setFanTarget(fan, 0, spec)
    fanCtl.input.value = '0'
    showTargets()
  })
  yawCtl.input.addEventListener('input', () => {
    table = setYawTarget(table, Number(yawCtl.input.value), dial())
    showTargets()
  })
  squareBtn.addEventListener('click', () => {
    table = setYawTarget(table, home(), dial())
    yawCtl.input.value = String(home())
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
  /** The design the model on the mount was built of: it changes only with a new model or swapped parts. */
  let modelDesign = structuredClone(saved.modelDesign)
  /** The model on order: what the shop built, and which build it is (each build has its own errors). */
  let order: ModelOrder = { ...saved.order }
  let build = saved.build
  // How the model broke, until it's repaired or replaced (plan section 8).
  let broken: Failure | null = saved.broken
  /** Seconds each weak point has spent past its limit, and the worst one warning now. */
  let strainClock: StrainClock = {}
  let warn: Strain | null = null
  /** The model's load areas together at the last reading, m² at model size (the load on the mount per pascal): drag and side force on the posts, lift and drag on a jumper's sting. */
  let loadArea = 0
  let modelSpec = modelSpecOf(order, DEMO_MODEL_SEED + build)
  const showOrder = () => {
    const words = t('shop.open', { scale: order.scale })
    setText(shopBtn, words)
    shopBtn.setAttribute('aria-label', `${words}. ${t('shop.openName')}`)
  }
  showOrder()
  /** Taps come with the model: a new model without them puts the chip (and the map) away. */
  function showTapsChip() {
    tapsChip.hidden = !order.taps
    if (!order.taps && inst.taps) {
      inst.taps = false
      tapsChip.setAttribute('aria-pressed', 'false')
      applyInstruments()
    }
  }
  shopBtn.addEventListener('click', () => {
    const bench = designStore.get()
    const sled = isBobsled(bench)
    // A sled's model is matched to the track's speed, and only a sled can sit on a ground board.
    const ctx: ShopContext = { ...hooks.shop(), sled, ...(sled ? { event: sledEvent(sledTrack()) } : {}) }
    openModelShop(order, ctx, (next) => {
      const q = quote(next, ctx.hand)
      hooks.onOrder(q.price, q.days)
      order = next
      broken = null
      // The new model is built of the design on the bench now.
      modelDesign = structuredClone(designStore.get())
      build++
      modelSpec = modelSpecOf(order, DEMO_MODEL_SEED + build)
      showOrder()
      showTapsChip()
      placeModel()
      showStale()
      onChange()
    })
  })
  showTapsChip()

  // --- When the bench design has moved on from the model: swap parts, or order a new one.
  const staleBox = el('div', 'model-note')
  staleBox.setAttribute('role', 'status')
  staleBox.title = t('model.noteName')
  const staleText = el('p', 'model-note-text')
  const staleActions = el('div', 'model-note-actions')
  const swapBtn = el('button', 'save-btn guide-remodel')
  swapBtn.type = 'button'
  const newBtn = el('button', 'save-btn guide-remodel guide-new', t('model.newModel'))
  newBtn.type = 'button'
  staleActions.append(newBtn, swapBtn)
  staleBox.append(staleText, staleActions)
  app.append(staleBox)
  function showStale() {
    const bench = designStore.get()
    const parts = partChanges(modelDesign, bench)
    const moved = postureChanged(modelDesign, bench)
    staleBox.hidden = mount !== 'rider' || !!broken || (!moved && parts.length === 0)
    if (staleBox.hidden) return
    const list = parts.map((p) => t(`model.part.${p}` as StringKey)).join(', ')
    setText(staleText, moved ? t('model.moved') : t('model.parts', { list }))
    swapBtn.hidden = parts.length === 0
    // A new position needs a new model first; swapping parts is the lesser fix.
    swapBtn.classList.toggle('quiet', moved)
    setText(swapBtn, t(parts.length === 1 ? 'model.swapOne' : 'model.swap', { n: parts.length, price: fixed(swapCost(parts), 0) }))
    newBtn.hidden = !moved
  }
  swapBtn.addEventListener('click', () => {
    const bench = designStore.get()
    const parts = partChanges(modelDesign, bench)
    if (!parts.length) return
    hooks.onSwap(swapCost(parts))
    modelDesign = swapParts(modelDesign, bench)
    placeModel()
    showStale()
    onChange()
  })
  newBtn.addEventListener('click', () => shopBtn.click())
  designStore.subscribe(() => showStale())

  // --- Breaks (plan section 8): the warning bar, the broken model's note, the sheet.
  const warnBox = el('p', 'fail-warn')
  warnBox.setAttribute('role', 'alert')
  warnBox.hidden = true
  app.append(warnBox)
  let warnShown: FailurePart | null = null
  function showWarn() {
    const part = warn ? warn.part : null
    view.setStrain(warn ? (warn.level - FAILURE.warnAt) / (1 - FAILURE.warnAt) : 0)
    if (part === warnShown) return
    warnShown = part
    warnBox.hidden = !part
    if (part) setText(warnBox, t(`fail.warn.${part}` as StringKey))
  }
  const locked = () => !!broken && mount === 'rider' && !tare
  const brokenBox = el('div', 'model-note is-broken')
  brokenBox.setAttribute('role', 'status')
  const brokenText = el('p', 'model-note-text')
  const brokenActions = el('div', 'model-note-actions')
  const repairBtn = el('button', 'save-btn')
  repairBtn.type = 'button'
  const fixBtn = el('button', 'save-btn quiet')
  fixBtn.type = 'button'
  brokenActions.append(repairBtn, fixBtn)
  brokenBox.append(brokenText, brokenActions)
  brokenBox.hidden = true
  app.append(brokenBox)
  /** The repair as one price (screens included), and whether the job has the days for it. */
  function repairTerms(f: Failure) {
    const ctx = hooks.shop()
    const q = repairQuote(order, f, ctx.hand)
    return { ...q, total: q.price + q.screens, blocked: ctx.block(q.days) === 'noDays' }
  }
  function showBroken() {
    const on = locked()
    brokenBox.hidden = !on
    fanCtl.input.disabled = on
    offBtn.disabled = on
    if (!on || !broken) return
    const r = repairTerms(broken)
    setText(brokenText, r.blocked ? t('fail.noDays') : t('fail.note', { what: t(`fail.title.${broken.part}` as StringKey) }))
    setText(repairBtn, t('fail.repairBtn', { price: fixed(r.total, 0), days: r.days }))
    repairBtn.disabled = r.blocked
    setText(fixBtn, t(`fail.fix.${fixFor(broken)}` as StringKey))
  }
  function repair() {
    if (!broken) return
    const r = repairTerms(broken)
    if (r.blocked || !hooks.onRepair(r.total, r.days)) return
    broken = null
    breakSheet?.close()
    placeModel()
    showBroken()
    showStale()
    onChange()
  }
  function goFix() {
    if (!broken) return
    const where = fixFor(broken)
    breakSheet?.close()
    if (where === 'shop') shopBtn.click()
    else hooks.goFix(where)
  }
  repairBtn.addEventListener('click', repair)
  fixBtn.addEventListener('click', goFix)
  let breakSheet: Sheet | null = null
  function openBreakSheet(f: Failure, speed: number) {
    breakSheet ??= createSheet({ cls: 'breaks', title: t('fail.sheetTitle'), closeLabel: t('fail.close') })
    const r = repairTerms(f)
    const head = el('p', 'fail-head', t('fail.headline', { what: t(`fail.title.${f.part}` as StringKey), speed: fixed(speed, 1) }))
    const why = el('p', 'fail-why', t(`fail.why.${f.part}` as StringKey))
    const cost = el('p', 'fail-cost', r.screens ? t('fail.costScreens', { price: fixed(r.price, 0), days: r.days, screens: fixed(r.screens, 0) }) : t('fail.cost', { price: fixed(r.price, 0), days: r.days }))
    const actions = el('div', 'job-actions')
    const again = el('button', 'shop-order', t('fail.repairBtn', { price: fixed(r.total, 0), days: r.days }))
    again.type = 'button'
    again.disabled = r.blocked
    again.addEventListener('click', repair)
    const change = el('button', 'save-btn quiet', t(`fail.fix.${fixFor(f)}` as StringKey))
    change.type = 'button'
    change.addEventListener('click', goFix)
    actions.append(again, change)
    breakSheet.body.replaceChildren(head, why, cost, ...(r.blocked ? [el('p', 'fail-why', t('fail.noDays'))] : []), actions)
    breakSheet.open()
  }
  /** A part let go: the fan cuts, the run is marked, the part flies, and the sheet says why. */
  function breakModel(f: Failure) {
    const speed = fan.speed
    broken = f
    warn = null
    strainClock = {}
    showWarn()
    view.breakPart(f.part, true)
    view.setFlow(null, [])
    if (rec.run) rec = { ...rec, run: { ...rec.run, failure: f } }
    endRun()
    showBroken()
    onChange()
    // Let the part fly before the sheet covers the view (straight away with reduced motion).
    const wait = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : BREAK_SHEET_DELAY_MS
    setTimeout(() => {
      if (broken === f) openBreakSheet(f, speed)
    }, wait)
  }

  const balanceRng = Rng.from(saved.balanceRng)
  const shown = { cdA: 0, dragN: 0, sideN: 0 }

  // --- The air for the instruments.
  let modelVersion = 0
  let flowKey = ''
  let flowAge = Infinity
  const anyFlow = () => inst.wand || inst.rake || inst.tufts || inst.taps
  const tapsRng = new Rng(DEMO_MODEL_SEED).fork('taps')
  function applyInstruments() {
    view.setInstruments({ ...inst })
    setText(footHint, t(jumper && mount === 'rider' ? 'hint.jumper' : inst.wand && mount === 'rider' ? 'hint.wand' : 'hint.orbit'))
    flowKey = ''
    flowAge = Infinity
  }
  /** Rebuild the field when the setting has moved on, no more than four times a second. */
  function updateFlow(dt: number) {
    flowAge += dt
    const mapping = inst.taps && mount === 'rider' && !tare && !!prepared
    if (cpLegend.root.hidden === mapping) cpLegend.root.hidden = !mapping
    // The instruments read a rider's air; a jumper's plates come later.
    if (mount !== 'rider' || tare || !prepared || broken || jumper || !anyFlow()) return
    // Below reading speed the drag regime is the slow-air one; the drawing slows the smoke itself.
    const speed = Math.max(spec.readFrom, fan.speed)
    // The taps read only once there's air enough for the scanner (Cp is pressure over the dynamic pressure).
    const reading = fan.speed >= spec.readFrom
    const key = `${modelVersion}|${Math.round(table.angle)}|${Math.round(speed / 2)}|${inst.tufts}|${inst.taps}|${reading}`
    if (key === flowKey || flowAge < 0.25) return
    flowKey = key
    flowAge = 0
    const flow = { density: AIR.density, viscosity: AIR.viscosity, speed, turbulence: airTurbulence }
    const field = modelFlowField(modelDesign, prepared.shape, flow, table.angle, { seed: DEMO_MODEL_SEED, crankDeg: crank })
    view.setFlow(field, inst.tufts ? tuftsOf(field, { spacing: TUFT_VIZ.spacing }) : [])
    if (inst.taps) {
      const taps = reading ? tapLayout(field) : []
      const cps = readTaps(field, taps, tapsRng)
      view.setTaps(taps, cps)
      cpLegend.show(tapExtremes(taps, cps))
    }
  }

  // --- Runs: the recorder, the session's finished runs and the bill.
  let rec: Recorder = { ...newRecorder(), nextId: saved.nextRunId }
  const runs: Run[] = [...saved.runs]
  let view_: View = 'readouts'
  let chartDirty = true
  /** After a model swap the fan coasts down; no new run starts until it stops. */
  let coasting = false
  new ResizeObserver(() => (chartDirty = true)).observe(chart.canvas)
  /** Runs picked for comparison, by id: A first, then B. */
  let picks: number[] = []
  /** The design each rider run tested, by run id, so the report can say what changed. */
  const designs = new Map<number, Design>()
  /** The crank angle of each rider run. */
  const cranks = new Map<number, number>()
  /** Which build of the model each rider run used. */
  const builds = new Map<number, number>()
  for (const [id, note] of Object.entries(saved.notes)) {
    designs.set(Number(id), note.design)
    cranks.set(Number(id), note.crank)
    builds.set(Number(id), note.build)
  }
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
    forecastDirty = true
    const mine = here()
    cal = calibrate(mine, ball, sectionArea)
    const posts = latestTare(mine, 'posts')
    wheelFix = corrections(cal, posts, wheelModel.shape.frontalArea, sectionArea)
    wheel = wheelFix.tare !== null ? wheelCheck(mine, wheelSpinning, wheelFix.tare, wheelFix.blockage) : null
    if (!prepared) {
      fix = NO_CORRECTIONS
      return
    }
    // With no wheel drive the rider's still spokes read low: add back the reference wheel's gap, scaled by its spokes.
    const wheels = wheel?.trusted && !spec.wheelDrive ? wheel.gap * spokeShare(prepared.shape, wheelSpinning) : null
    fix = corrections(cal, posts, prepared.shape.frontalArea, sectionArea, wheels)
  }
  /**
   * Move to the tunnel in use if it has changed (your own tunnel opened while
   * a model was being made, or between visits). Never mid-run: the run in
   * progress finishes where it started. The new tunnel's quirks are unknown
   * again, so its calibration starts from scratch.
   */
  function syncTunnel() {
    if (rec.run) return
    const next = hooks.tunnel()
    if (next.key === setup.key) return
    const wheelsChanged = next.build.wheelDrive !== spec.wheelDrive
    setup = next
    spec = next.build
    current = next.id
    tunnel = { ...spec, quirks: next.quirks }
    airTurbulence = tunnelTurbulence(tunnel)
    place.textContent = t(current === 'own' ? 'tunnel.placeOwn' : 'tunnel.place')
    // A bigger fan or turntable widens the controls and the yaw chart.
    fanCtl.input.max = String(spec.topSpeed)
    yawCtl.input.min = String(dial().min)
    yawCtl.input.max = String(dial().max)
    yawAxes.x.min = spec.turntable.min
    yawAxes.x.max = spec.turntable.max
    // Driven wheels change the model itself (its spokes no longer read still).
    if (wheelsChanged && mount === 'rider') placeModel()
    else refreshCal()
    runsDirty = true
    chartDirty = true
  }
  /** The run name for what's on the mount now. */
  const runModel = () => (tare ? tareModel(mountKind()) : mount === 'wheel' ? WHEEL_RUN : mount)
  const pitchAxes = {
    x: { label: t('axis.pitch'), unit: '°', digits: 0, min: JUMP_TUNNEL.pitch.min, max: JUMP_TUNNEL.pitch.max },
    y: { label: t('axis.cla'), unit: 'm²', digits: 3 },
  }
  const yawAxes = {
    x: { label: t('axis.yaw'), unit: '°', digits: 0, min: spec.turntable.min, max: spec.turntable.max },
    y: { label: t('axis.cda'), unit: 'm²', digits: 3 },
  }

  /** End the run in progress (the model is being swapped) and stop the fan. */
  function endRun() {
    if (rec.run) {
      runs.push(rec.run)
      hooks.onRun(rec.run)
      rec = { ...rec, run: null }
      runsDirty = true
      refreshCal()
      onChange()
    }
    coasting = true
    fan = setFanTarget(fan, 0, spec)
    fanCtl.input.value = '0'
    showTargets()
    chartDirty = true
  }

  /** The buzz's extra scatter on one reading (1 when nothing warns). */
  function shake(): number {
    const w = wobbleOf(warn)
    return w > 0 ? 1 + w * gaussian(balanceRng) : 1
  }

  /** One balance sample of whatever is on the mount, or null below reading speed. */
  function takeSample(): Omit<RunSample, 't'> | null {
    const q = dynamicPressure(AIR.density, fan.speed)
    if (fan.speed < spec.readFrom) return null
    if (tare) {
      const cdA = readTare(tunnel, { speed: fan.speed, yawDeg: 0, mount: mountKind() }, balanceRng)
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
    const steady = fan.speed === fan.target && table.angle === table.target
    if (jumper && jumperModel) {
      // The sting's angle goes where a rider's yaw would; lift and the pitch moment ride along.
      const j = readJumper(jumperModel, tunnel, { speed: fan.speed, alphaDeg: table.angle, mount: 'sting' }, balanceRng)
      // A groaning sting shakes the balance too.
      const w = shake()
      return { speed: fan.speed, yawDeg: table.angle, cdA: j.cdA * w, cyA: 0, dragN: j.dragN * w, clA: j.clA * w, pitchA: j.pitchA * w, steady }
    }
    const r = readBalance(prepared, tunnel, { speed: fan.speed, yawDeg: table.angle, mount: 'posts' }, balanceRng)
    // A buzzing part shakes the balance: the trace wobbles before anything breaks.
    const w = shake()
    return { speed: fan.speed, yawDeg: table.angle, cdA: r.cdA * w, cyA: r.cyA * w, dragN: q * r.modelCdA * w, steady }
  }

  function showRun() {
    const live = rec.run
    const done = runs[runs.length - 1]
    if (live && live.model === 'rider' && !designs.has(live.id)) {
      designs.set(live.id, structuredClone(modelDesign))
      cranks.set(live.id, crank)
      builds.set(live.id, build)
    }
    if (live) setText(runNow, t('run.live', { id: live.id, time: clock(live.duration), cost: fixed(runCost(live), 0) }))
    else if (done) setText(runNow, t('run.last', { id: done.id, time: clock(done.duration), cost: fixed(runCost(done), 0) }))
    else setText(runNow, current === 'own' ? t('run.idleOwn') : t('run.idle', { fee: fixed(TUNNEL_BILLING.perRun, 0) }))
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
    setText(viewButtons[2]!, t(jumper ? 'view.pitch' : 'view.yaw'))
    const reading = view_ === 'readouts'
    riderGrid.hidden = !(reading && mount === 'rider' && !tare && !jumper)
    jumperGrid.hidden = !(reading && mount === 'rider' && !tare && jumper)
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
    } else if (jumper) {
      // Only points taken with the fan and sting settled: lift area against pitch.
      const pts = (s: RunSample[]): ChartPoint[] => s.filter((p) => p.steady && p.clA !== undefined).map((p) => ({ x: p.yawDeg, y: p.clA! }))
      chart.draw({
        ...pitchAxes,
        series: [{ points: pts(faint), mark: 'faint' }, { points: pts(bold), mark: 'dot', latest: true }],
        caption: describeLast(pitchAxes, pts(bold), t('chart.emptyPitch')),
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
  const groupWords = (g: YawGroup | null, digits: number, pitch = false) =>
    g
      ? t(pitch ? 'runs.rowPitch' : 'runs.rowCdA', { cda: fixed(g.mean, digits), band: fixed(g.band, digits), yaw: fixed(g.yawDeg, 0), speed: fixed(g.speed, 0), n: g.n })
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
        const jumped = isJumperRun(run)
        const model = t(jumped ? 'mount.jumper' : (RUN_MODEL[run.model] ?? 'mount.rider'))
        text.append(
          el('span', 'run-title', t('runs.row', { id: run.id, model, time: clock(run.duration), cost: fixed(runCost(run), 0) }) + (run.failure ? ` · ${t('fail.runTag')}` : '')),
          el('span', 'run-sub', groupWords(headlineGroup(yawGroups(run)), run.model.startsWith('tare') || run.model === WHEEL_RUN ? TARE_DIGITS : 4, jumped)),
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
      if (builds.get(a.id) !== builds.get(b.id)) list.push(t('model.changed'))
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
  /** This model's runs that pool together (same build, same design), by crank angle. */
  function poolable(now: Design): Map<number, Run[]> {
    const byCrank = new Map<number, Run[]>()
    for (const run of here()) {
      const d = designs.get(run.id)
      const c = cranks.get(run.id)
      if (run.model !== 'rider' || !d || c === undefined || builds.get(run.id) !== build || changedControls(d, now).length > 0) continue
      byCrank.set(c, [...(byCrank.get(c) ?? []), run])
    }
    return byCrank
  }
  /** A sled's reference run on its pooled, corrected reading, s (null until a run is steady enough to trust). */
  function sledPoolTime(sled: BobsledDesign, byCrank: Map<number, Run[]>): number | null {
    const only = [...byCrank.values()][0]
    if (!only || !prepared) return null
    const g = headlineGroup(poolRuns(only).filter((p) => p.trusted))
    if (!g) return null
    const s2 = prepared.scale * prepared.scale
    return forecastRun(correct(g.mean * s2, fix) / s2, sled, sledTrack()).time
  }
  let sledKey = ''
  let sledAge = Infinity
  /**
   * Keep the Deliver sheet's run time up to date (PR 8p), whichever tab is
   * open: worked out again when the runs, the build, the fixes, the board or
   * the track change, no more than twice a second.
   */
  function updateSledForecast(dt: number, now = false) {
    sledAge += dt
    if (!isBobsled(modelDesign) || (!now && sledAge < 0.5)) return
    sledAge = 0
    const sled = modelDesign
    const byCrank = poolable(sled)
    const ids = [...byCrank.values()].flat().map((r) => r.id)
    const key = JSON.stringify([ids, build, fix, sledTrack().id, order.board === true, rec.run?.id ?? null])
    if (key === sledKey) return
    sledKey = key
    const time = sledPoolTime(sled, byCrank)
    sledForecast.set(sled, sledTrack().id, time === null ? null : { time, board: order.board === true })
  }
  function drawPool() {
    if (jumper) {
      drawForecast()
      return
    }
    const now = modelDesign
    const byCrank = poolable(now)
    poolBox.hidden = byCrank.size === 0 || !prepared
    if (poolBox.hidden || !prepared) return
    // The jumper's forecast hides the cycle line; a rider's and a sled's use it.
    poolCycle.hidden = false
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
              t(isBobsled(now) ? 'pool.rowSled' : 'pool.row', {
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
    if (isBobsled(now)) {
      // A sled has no legs to crank: the pooled reading flies the reference run instead.
      const track = sledTrack()
      setText(poolTitle, t('pool.titleSled'))
      const time = sledPoolTime(now, byCrank)
      const run = time !== null ? t('pool.sledRun', { time: fixed(time, 2), track: t(`track.${track.id}`) }) : t('runs.rowNone')
      // The trap a sled model falls into (PR 8n): on the bare floor the runners read low.
      setText(poolCycle, order.board ? run : `${run} ${t('pool.sledFloor')}`)
      const words = fixWords(fix)
      setText(poolFix, words ? t('pool.fixed', { list: words }) : t('pool.raw'))
      return
    }
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
    onChange()
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
    const design = modelDesign
    setJumper(isJumper(design))
    jumperModel = isJumper(design) ? prepareJumper(design, modelSpec) : null
    forecastDirty = true
    prepared = isBobsled(design) ? prepareSled(design, modelSpec) : prepareModel(designShape(design, { crankDeg: crank, staticWheels: !spec.wheelDrive }), modelSpec)
    rYaw.box.hidden = isBobsled(design)
    rRun.box.hidden = !isBobsled(design)
    refreshCal()
    // The CdA's note names the model's scale before any reading (it changes with a new order).
    if (!fixWords(fix)) setText(rCdA.sub, t('read.cdaRaw', { scale: fixed(1 / modelSpec.scale, 0) }))
    modelVersion++
    view.setFlow(null, [])
    view.setTaps([], [])
    view.setModel({ kind: 'rider', state: { design, pose: designPose(design, crank), broken: [], strained: [] }, scale: modelSpec.scale, tare, board: order.board === true })
    // A model that broke before comes back with its part missing.
    if (broken && !tare) view.breakPart(broken.part, false)
    runsDirty = true
  }

  /**
   * A jumper on the bench model swaps the posts for the sting: the angle row
   * pitches instead of yawing, and the readouts read lift and the forecast.
   */
  function setJumper(on: boolean) {
    if (on === jumper) return
    jumper = on
    table = on ? { target: JUMP_TUNNEL.start, angle: JUMP_TUNNEL.start } : turntableAtRest()
    const d = dial()
    yawCtl.input.min = String(d.min)
    yawCtl.input.max = String(d.max)
    yawCtl.input.step = String(d.step)
    yawCtl.input.value = String(table.target)
    setText(yawLabel, t(on ? 'pitch.label' : 'yaw.label'))
    setText(squareBtn, t(on ? 'pitch.hold' : 'yaw.square'))
    setText(mountButtons[0]!, t(on ? 'mount.jumperShort' : 'mount.riderShort'))
    showTargets()
    applyInstruments()
  }

  // --- The jumper's forecast: this model's settled readings, corrected, flown on the job's hill.
  let forecast: JumpForecast | null = null
  let forecastDirty = true
  let forecastAge = Infinity
  let forecastEvent = ''
  /** What the calibration runs let you take off a jumper's readings: the sting's tare and the blockage. */
  const jumperFix = (): JumperFix => ({ tare: cal.tare?.trusted ? cal.tare.mean : null, blockageK: cal.blockage?.k ?? null })
  const jumperFixWords = (f: JumperFix) => {
    const list = [f.tare !== null ? t('fix.sting') : '', f.blockageK !== null ? t('fix.blockage') : ''].filter(Boolean)
    return list.join(t('fix.and'))
  }
  /** This model's runs in the tunnel in use, and the run going now. A jumper can't swap parts, so the build says it all. */
  function modelRuns(): Run[] {
    const list = here().filter((r) => r.model === 'rider' && builds.get(r.id) === build)
    if (rec.run && rec.run.model === 'rider' && runTunnel(rec.run) === current) list.push(rec.run)
    return list
  }
  /** Fly the forecast again when something new came in, no more than twice a second. */
  function updateForecast(dt: number) {
    forecastAge += dt
    // A new job means a new hill and day: fly the forecast again for it.
    const event = hooks.jumpEvent()
    const eventKey = JSON.stringify(event)
    if (eventKey !== forecastEvent) {
      forecastEvent = eventKey
      forecastDirty = true
    }
    if (!forecastDirty || forecastAge < 0.5 || !jumperModel) return
    forecastDirty = false
    forecastAge = 0
    const fix = jumperFix()
    const model = jumperModel
    const readings = jumperReadings(modelRuns()).map((r) => correctJumper(r, fix, model, sectionArea))
    forecast = forecastJump(readings, event)
    // The Deliver sheet starts the declared distance from it, for this model's design.
    if (isJumper(modelDesign)) jumpForecast.set(modelDesign, event, forecast)
    runsDirty = true
  }
  function showForecastReadout() {
    const f = forecast
    if (!f) {
      setText(jFc.value, '–')
      setText(jFc.sub, t('read.forecastNone'))
      return
    }
    setText(jFc.value, `${fixed(f.distance, 1)} m`)
    setText(
      jFc.sub,
      f.covered ? t('read.forecastNote', { margin: fixed(f.minMargin * 100, 1) }) : t('read.forecastWider', { from: fixed(f.need.from, 0), to: fixed(f.need.to, 0) }),
    )
  }
  /** The Runs tab's record for a jumper: the forecast in full. */
  function drawForecast() {
    poolBox.hidden = !prepared
    if (poolBox.hidden) return
    const ev = hooks.jumpEvent()
    setText(poolTitle, t('jump.title', { hill: t(`hill.${ev.hill.id}`) }))
    const f = forecast
    const lines: string[] = []
    if (!f) lines.push(t('jump.none'))
    else {
      const slots = { margin: fixed(f.minMargin * 100, 1), floor: fixed(PITCH.floor * 100, 0) }
      const range = { from: fixed(f.have.from, 0), to: fixed(f.have.to, 0), needFrom: fixed(f.need.from, 0), needTo: fixed(f.need.to, 0) }
      lines.push(
        t('jump.distance', { distance: fixed(f.distance, 1), size: fixed(ev.hill.hs, 0) }),
        t(f.minMargin < 0 ? 'jump.marginBad' : f.stable ? 'jump.margin' : 'jump.marginLow', slots),
        t(f.covered ? 'jump.cover' : 'jump.wider', range),
      )
      // The trap a jumper model does fall into (PR 8k): the helmet and boots, untaped.
      if (!order.trips) lines.push(t('jump.untaped'))
    }
    poolRows.replaceChildren(...lines.map((line) => el('p', 'compare-detail', line)))
    setText(poolCycle, '')
    poolCycle.hidden = true
    const words = jumperFixWords(jumperFix())
    setText(poolFix, words ? t('jump.fixed', { list: words }) : t('jump.raw'))
  }
  const updateJumper = (dt: number) => {
    if (!jumperModel) return
    updateForecast(dt)
    showForecastReadout()
    const reading = fan.speed >= spec.readFrom && !broken
    setText(jSpeed.value, `${fixed(fan.speed, 1)} m/s`)
    // The helmet and boots' Reynolds number against the hill's: the plates hardly care, they do.
    const pct = (fan.speed * jumperModel.scale * 100) / hooks.jumpEvent().hill.takeoffSpeed
    setText(jSpeed.sub, t('read.reMatch', { pct: reading ? fixed(pct, 0) : '–' }))
    setText(jPitch.value, `${fixed(table.angle, 1)}°`)
    if (!reading) {
      shown.cdA = shown.dragN = shown.sideN = 0
      setText(jPitch.sub, t('read.pitchNote', { force: '–' }))
      setText(jLD.value, '–')
      setText(jLD.sub, t('read.ldNote', { cla: '–', cda: '–' }))
      return
    }
    const r = readJumper(jumperModel, tunnel, { speed: fan.speed, alphaDeg: table.angle, mount: 'sting' }, balanceRng)
    // The load on the sting per pascal: lift and drag together, at model size.
    loadArea = Math.hypot(r.clA, r.cdA) * jumperModel.scale * jumperModel.scale
    const c = correctJumper(r, jumperFix(), jumperModel, sectionArea)
    // shown: dragN holds the model's lift, N; sideN the lift area; cdA the drag area.
    const k = settle(dt)
    shown.dragN += (r.liftN - shown.dragN) * k
    shown.sideN += (c.clA - shown.sideN) * k
    shown.cdA += (c.cdA - shown.cdA) * k
    setText(jPitch.sub, t('read.pitchNote', { force: `${fixed(shown.dragN, 0)} N` }))
    setText(jLD.value, shown.cdA > 0 ? fixed(shown.sideN / shown.cdA, 2) : '–')
    setText(jLD.sub, t('read.ldNote', { cla: fixed(shown.sideN, 2), cda: fixed(shown.cdA, 2) }))
  }

  /** Show the controls that fit what's on the mount. */
  function showMount() {
    mountButtons.forEach((b, i) => {
      const on = MOUNTS[i]!.value === mount
      b.setAttribute('aria-checked', String(on))
      b.tabIndex = on ? 0 : -1
    })
    tareBtn.setAttribute('aria-pressed', String(tare))
    // The model first: it says whether a jumper is on, which picks the controls.
    shown.cdA = shown.dragN = shown.sideN = 0
    placeModel()
    yawCtl.row.hidden = !yawOpen()
    crankBox.hidden = !yawOpen() || modelDesign.sport === 'skating' || isBobsled(modelDesign) || jumper
    shopBtn.hidden = !yawOpen()
    instBar.hidden = !yawOpen() || jumper
    showStale()
    showBroken()
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
      setText(wCdA.sub, t('read.wheelNote', { scale: fixed(1 / STANDARD_MODEL.scale, 0), spokes: REFERENCE_WHEEL.spokes }))
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
    const posts = latestTare(here(), 'posts')
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
    const wheelRuns = here().filter((r) => r.model === WHEEL_RUN)
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
    if (jumper) {
      updateJumper(dt)
      return
    }
    if (!prepared) return
    showSpeed(rSpeed)
    setText(rYaw.value, `${fixed(table.angle, 1)}°`)
    // Below reading speed, or with a broken model on the posts, there's nothing worth reading.
    if (fan.speed < spec.readFrom || broken) {
      shown.cdA = shown.dragN = shown.sideN = 0
      setText(rYaw.sub, t('read.sideNote', { force: '–' }))
      setText(rDrag.value, '–')
      setText(rDrag.sub, t('read.reMatch', { pct: '–' }))
      setText(rCdA.value, '–')
      setText(rRun.value, '–')
      setText(rRun.sub, t('read.runForecastWait'))
      return
    }
    const r = readBalance(prepared, tunnel, { speed: fan.speed, yawDeg: table.angle, mount: 'posts' }, balanceRng)
    loadArea = Math.hypot(r.forces.cdA + fixedDrag(prepared, table.angle), r.forces.cyA)
    const q = dynamicPressure(AIR.density, fan.speed)
    const s2 = prepared.scale * prepared.scale
    const k = settle(dt)
    const w = shake()
    shown.cdA += (r.cdA * w - shown.cdA) * k
    shown.dragN += (q * r.modelCdA * w - shown.dragN) * k
    shown.sideN += (q * Math.abs(r.cyA) * s2 * w - shown.sideN) * k
    setText(rYaw.sub, t('read.sideNote', { force: `${fixed(shown.sideN, 1)} N` }))
    setText(rDrag.value, `${fixed(shown.dragN, 1)} N`)
    // How near the model's Reynolds number is to the full-size rider's on the day (the Reynolds trap).
    setText(rDrag.sub, t('read.reMatch', { pct: fixed(reynoldsRatio(prepared, fan.speed, reEvent()) * 100, 0) }))
    rDrag.sub.title = t('read.modelDragNote', { re: scientific(r.reynolds) })
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
    // A sled: the reference run flown on this reading, four times a second.
    runAge += dt
    if (isBobsled(modelDesign) && runAge >= 0.25) {
      runAge = 0
      const cdA = words ? correct(shown.cdA * s2, fix) / s2 : shown.cdA
      const track = sledTrack()
      setText(rRun.value, `${fixed(forecastRun(cdA, modelDesign, track).time, 2)} s`)
      setText(rRun.sub, t('read.runForecastNote', { track: t(`track.${track.id}`) }))
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
    syncTunnel()
    while (carry >= STEP) {
      fan = stepFan(fan, STEP, spec)
      table = stepTurntable(table, STEP, spec.turntable)
      // The model's weak points, checked every fixed step (the tunnel always warns first).
      // A jumper's model hangs on a sting, which takes its lift as well as its drag.
      if (mount === 'rider' && !tare && prepared && !broken) {
        const loadN = dynamicPressure(AIR.density, fan.speed) * loadArea
        const step = stepStrain(strainClock, strains({ order, design: modelDesign }, fan.speed, loadN, setup.mountStrength), STEP)
        strainClock = step.clock
        warn = step.warn
        if (step.broke) breakModel(step.broke)
      } else warn = null
      if (coasting && fan.speed < RUN_RECORDING.endBelow) coasting = false
      const step = coasting ? { recorder: rec, sampleDue: false, finished: null } : stepRecorder(rec, fan.speed, STEP, runModel(), current)
      rec = step.recorder
      if (step.finished) {
        runs.push(step.finished)
        hooks.onRun(step.finished)
        refreshCal()
        onChange()
        chartDirty = true
        runsDirty = true
      }
      if (step.sampleDue) {
        const sample = takeSample()
        if (sample) {
          rec = addSample(rec, sample)
          chartDirty = true
          if (sample.clA !== undefined) forecastDirty = true
        }
      }
      carry -= STEP
    }
    showWarn()
    if (tare) updateTare(dt)
    else if (mount === 'rider') {
      updateRider(dt)
      updateFlow(dt)
    } else if (mount === 'wheel') updateWheel(dt)
    else updateSphere(dt)
    showRun()
    drawChart()
    updateSledForecast(dt)
    drawRuns()
    drawCal()
    view.setYaw(yawOpen() && !jumper ? table.angle : 0)
    if (jumper) view.setPitch(table.angle)
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
        syncTunnel()
        view.setSheetHeight(sheet.offsetHeight)
        last = performance.now()
        raf = requestAnimationFrame(loop)
      } else {
        cancelAnimationFrame(raf)
        // Leaving the tunnel: the Deliver sheet gets the latest run time.
        updateSledForecast(0, true)
      }
    },
    lab() {
      const notes: LabState['notes'] = {}
      for (const r of runs) {
        const design = designs.get(r.id)
        const c = cranks.get(r.id)
        const b = builds.get(r.id)
        if (design && c !== undefined && b !== undefined) notes[r.id] = { design, crank: c, build: b }
      }
      return {
        runs: [...runs],
        notes,
        order: { ...order },
        modelDesign: structuredClone(modelDesign),
        build,
        crank,
        nextRunId: rec.nextId,
        balanceRng: balanceRng.state,
        broken,
      }
    },
  }
}
