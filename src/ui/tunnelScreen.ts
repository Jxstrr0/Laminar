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
import { REFERENCE_SPHERE, RUN_RECORDING, TUNNEL_BILLING, UNIVERSITY_TUNNEL } from '../data/tunnel'
import { t, type StringKey } from '../data/strings'
import { dynamicPressure, reynolds } from '../sim/air'
import { bodyDrag, type Regime } from '../sim/aero/drag'
import { fanAtRest, setFanTarget, stepFan, type FanState } from '../sim/fan'
import { modelFlowField, tufts as tuftsOf } from '../sim/flow/field'
import { describeBody } from '../sim/geom/body'
import { cyclistShape } from '../sim/geom/cyclist'
import { riderPose } from '../sim/geom/pose'
import { sphere } from '../sim/geom/shapes'
import { Rng } from '../sim/rng'
import type { CyclistDesign } from '../data/cyclist'
import { changedControls } from '../sim/designDiff'
import { compareRuns, headlineCompare, headlineGroup, yawGroups, type YawGroup } from '../sim/runStats'
import { addSample, newRecorder, runCost, stepRecorder, type Recorder, type Run, type RunSample } from '../sim/run'
import { setYawTarget, stepTurntable, turntableAtRest, type TurntableState } from '../sim/turntable'
import { prepareModel, readBalance, type PreparedModel } from '../sim/views'
import type { TunnelView } from '../render/tunnelScene'
import { createChart, describeLast, type ChartPoint } from './chart'
import { designStore } from './designStore'
import { fixed, scientific } from './format'
import { glossaryTerm } from './glossary'

/** The glossary entry for each drag regime word. */
const REGIME_TERM: Record<Regime, GlossaryId> = { laminar: 'laminar', mixed: 'dragCrisis', turbulent: 'turbulent' }

/** The sim's fixed time step, in seconds. */
const STEP = 1 / 60

type Mount = 'rider' | 'sphere'
type View = 'readouts' | 'time' | 'yaw' | 'runs'
const VIEWS: { value: View; key: StringKey }[] = [
  { value: 'readouts', key: 'view.readouts' },
  { value: 'time', key: 'view.time' },
  { value: 'yaw', key: 'view.yaw' },
  { value: 'runs', key: 'view.runs' },
]

/** Seconds as m:ss. */
function clock(seconds: number): string {
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
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
  const runsHint = el('p', 'runs-hint')
  const runList = el('ul', 'run-list')
  runsBox.append(compareBox, runsHint, runList)

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

  sheet.append(mountRow, fanCtl.row, yawCtl.row, runLine, viewBar, riderGrid, sphereGrid, chartBox, runsBox, foot)
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
    if (mount !== 'rider' || !prepared || !anyFlow()) return
    // Below reading speed the drag regime is the slow-air one; the drawing slows the smoke itself.
    const speed = Math.max(spec.readFrom, fan.speed)
    const key = `${modelVersion}|${Math.round(table.angle)}|${Math.round(speed / 2)}|${inst.tufts}`
    if (key === flowKey || flowAge < 0.25) return
    flowKey = key
    flowAge = 0
    const flow = { density: AIR.density, viscosity: AIR.viscosity, speed, turbulence: spec.turbulence }
    const field = modelFlowField(designStore.get(), prepared.shape, flow, table.angle, { seed: DEMO_MODEL_SEED })
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
  let runsDirty = true
  new ResizeObserver(() => (runsDirty = true)).observe(compareChart.canvas)
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
    if (mount === 'sphere') {
      const d = bodyDrag(ball, { ...AIR, speed: fan.speed, turbulence: spec.turbulence })
      return { speed: fan.speed, yawDeg: 0, cdA: d.cdA, cyA: 0, dragN: q * d.cdA, steady: fan.speed === fan.target }
    }
    if (!prepared || fan.speed < spec.readFrom) return null
    const r = readBalance(prepared, spec, { speed: fan.speed, yawDeg: table.angle }, balanceRng)
    const steady = fan.speed === fan.target && table.angle === table.target
    return { speed: fan.speed, yawDeg: table.angle, cdA: r.cdA, cyA: r.cyA, dragN: q * r.modelCdA, steady }
  }

  function showRun() {
    const live = rec.run
    const done = runs[runs.length - 1]
    if (live && mount === 'rider' && !designs.has(live.id)) designs.set(live.id, structuredClone(designStore.get()))
    if (live) setText(runNow, t('run.live', { id: live.id, time: clock(live.duration), cost: fixed(runCost(live), 0) }))
    else if (done) setText(runNow, t('run.last', { id: done.id, time: clock(done.duration), cost: fixed(runCost(done), 0) }))
    else setText(runNow, t('run.idle', { fee: fixed(TUNNEL_BILLING.perRun, 0) }))
    const total = runs.reduce((sum, r) => sum + runCost(r), live ? runCost(live) : 0)
    setText(runTotal, runs.length || live ? t('run.session', { total: fixed(total, 0) }) : '')
  }

  function selectView(next: View) {
    if (next === 'yaw' && mount !== 'rider') next = 'readouts'
    view_ = next
    VIEWS.forEach((v, i) => {
      const on = v.value === view_
      viewButtons[i]!.setAttribute('aria-selected', String(on))
      viewButtons[i]!.tabIndex = on ? 0 : -1
    })
    viewButtons[2]!.hidden = mount !== 'rider'
    riderGrid.hidden = !(view_ === 'readouts' && mount === 'rider')
    sphereGrid.hidden = !(view_ === 'readouts' && mount === 'sphere')
    chartBox.hidden = view_ === 'readouts' || view_ === 'runs'
    chartBox.setAttribute('aria-labelledby', `view-${view_}`)
    runsBox.hidden = view_ !== 'runs'
    chartDirty = true
    runsDirty = true
    if (view_ === 'readouts') shownSpeed = -1
  }
  viewBar.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const open = VIEWS.filter((v) => v.value !== 'yaw' || mount === 'rider')
    const i = open.findIndex((v) => v.value === view_)
    const next = open[(i + (e.key === 'ArrowRight' ? 1 : open.length - 1)) % open.length]!.value
    selectView(next)
    viewButtons[VIEWS.findIndex((v) => v.value === next)]!.focus()
  })

  function drawChart() {
    if (view_ === 'readouts' || view_ === 'runs' || !chartDirty) return
    chartDirty = false
    // This run bold and the last one faint; with the fan off, the last two.
    const same = runs.filter((r) => r.model === mount).reverse()
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
  const groupWords = (g: YawGroup | null) =>
    g
      ? t('runs.rowCdA', { cda: fixed(g.mean, 4), band: fixed(g.band, 4), yaw: fixed(g.yawDeg, 0), speed: fixed(g.speed, 0), n: g.n })
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
        const model = t(run.model === 'sphere' ? 'mount.sphere' : 'mount.rider')
        text.append(
          el('span', 'run-title', t('runs.row', { id: run.id, model, time: clock(run.duration), cost: fixed(runCost(run), 0) })),
          el('span', 'run-sub', groupWords(headlineGroup(yawGroups(run)))),
        )
        b.append(badge, text)
        b.addEventListener('click', () => togglePick(run.id))
        li.append(b)
        return li
      }),
    )
    setText(runsHint, runs.length === 0 ? t('runs.empty') : picks.length < 2 ? t('runs.pick') : '')
    runsHint.hidden = runsHint.textContent === ''

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
      const list = da && db ? changedControls(da, db) : []
      changed.hidden = a.model !== 'rider' || !da || !db
      setText(changed, list.length ? t('runs.changed', { list: list.map((id) => t(`ctl.${id}`)).join(', ') }) : t('runs.same'))
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

  function placeModel() {
    if (mount === 'sphere') {
      view.setModel({ kind: 'sphere' })
      return
    }
    if (prepared) endRun()
    const design = designStore.get()
    prepared = prepareModel(cyclistShape(design), modelSpec)
    modelVersion++
    view.setFlow(null, [])
    view.setModel({ kind: 'rider', state: { design, pose: riderPose(design), broken: [], strained: [] }, scale: modelSpec.scale })
    designDirty = false
  }

  function setMount(next: Mount) {
    if (next === mount && prepared) return
    if (rec.run) endRun()
    mount = next
    mountButtons.forEach((b, i) => {
      const on = MOUNTS[i]!.value === mount
      b.setAttribute('aria-checked', String(on))
      b.tabIndex = on ? 0 : -1
    })
    yawCtl.row.hidden = mount !== 'rider'
    instBar.hidden = mount !== 'rider'
    shownSpeed = -1
    placeModel()
    selectView(view_)
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
      if (coasting && fan.speed < RUN_RECORDING.endBelow) coasting = false
      const step = coasting ? { recorder: rec, sampleDue: false, finished: null } : stepRecorder(rec, fan.speed, STEP, mount)
      rec = step.recorder
      if (step.finished) {
        runs.push(step.finished)
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
    if (mount === 'rider') {
      if (designDirty) placeModel()
      updateRider(dt)
      updateFlow(dt)
    } else updateSphere()
    showRun()
    drawChart()
    drawRuns()
    view.setYaw(mount === 'rider' ? table.angle : 0)
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
