/**
 * The Shape screen (plan section 10): the rider in 3D above, a sheet below
 * with live readouts (desk estimate, comfort, frontal area, rules) and the
 * controls in three tabs. Every change rebuilds the design, the readouts
 * and the figure from the same numbers.
 */
import {
  COMFORT,
  DEFAULT_CYCLIST,
  DESK,
  PART_RANGE,
  POSTURE_RANGE,
  type CyclistDesign,
} from '../data/cyclist'
import { DEFAULT_SKATER, SKATER_RANGE, type SkaterDesign } from '../data/skater'
import { DEFAULT_JUMPER, FLIGHT_ATTITUDE, JUMPER_RANGE, PITCH, type JumperDesign } from '../data/jumper'
import { BOBSLED_RANGE, DEFAULT_BOBSLED, SLED, type BobsledDesign } from '../data/bobsled'
import { TRACKS } from '../data/tracks'
import { checkSledRules, sightMargin, type SledRuleBreak } from '../sim/bobsled'
import { sledLength } from '../sim/geom/bobsled'
import { TCF_TIME_TRIAL } from '../data/rules'
import { t, type StringKey } from '../data/strings'
import type { RuleBreak } from '../sim/cyclist'
import type { FixTarget } from '../sim/failure'
import { bobDeskEstimate, deskEstimate, jumpDeskEstimate } from '../sim/desk'
import { jumperReadouts } from '../sim/jumper'
import { crewEffects } from '../sim/staff'
import { designPose, designReadouts, designShape, isBobsled, isCyclist, isJumper, isSkater, type Design } from '../sim/design'
import { availableHandles, dragHandle, handleDef, handlePoint } from '../sim/geom/handles'
import { ruleVolumes } from '../sim/geom/ruleBox'
import { briefTemplate, currentEvent, currentJumpEvent } from '../sim/career'
import type { Highlight, ShapeView } from '../render/shapeScene'
import type { GlossaryId } from '../data/glossary'
import type { HandleId, HandleParam } from '../data/handles'
import { careerStore } from './careerStore'
import { designStore } from './designStore'
import { fixed } from './format'
import { openGlossaryIndex, glossaryTerm } from './glossary'

type Tab = 'position' | 'kit' | 'bike'
type PostureKey = keyof CyclistDesign['posture']
type SkaterKey = keyof SkaterDesign['posture']
type JumperKey = keyof JumperDesign['posture']

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

function readout(label: string, term: GlossaryId): { box: HTMLElement; value: HTMLElement; sub: HTMLElement } {
  const box = el('div', 'readout')
  const value = el('div', 'readout-value', '–')
  const sub = el('div', 'readout-sub')
  const labelBox = el('div', 'readout-label')
  labelBox.append(glossaryTerm(term, label))
  box.append(labelBox, value, sub)
  return { box, value, sub }
}

const BREAK_HIGHLIGHT: Record<RuleBreak['part'], Highlight> = {
  helmet: 'helmet',
  'posture.handReach': 'hands',
  'posture.handHeight': 'hands',
  'wheels.front': 'front-wheel',
  frame: 'frame',
}
const STRAIN_HIGHLIGHT: Record<PostureKey | SkaterKey, Highlight> = {
  trunkDeg: 'torso',
  kneeDeg: 'legs',
  torsoDeg: 'torso',
  headDrop: 'head',
  armWidth: 'arms',
  handReach: 'arms',
  handHeight: 'arms',
}
/** Which tab and control each rule break jumps to. */
const BREAK_TARGET: Record<RuleBreak['part'], { tab: Tab; id: string }> = {
  helmet: { tab: 'kit', id: 'ctl-tail' },
  'posture.handReach': { tab: 'position', id: 'ctl-handReach' },
  'posture.handHeight': { tab: 'position', id: 'ctl-handHeight' },
  'wheels.front': { tab: 'bike', id: 'ctl-front' },
  frame: { tab: 'bike', id: 'ctl-frame' },
}
/** Which tab holds each handle number's slider. */
const PARAM_TAB: Record<HandleParam, Tab> = {
  torsoDeg: 'position',
  headDrop: 'position',
  armWidth: 'position',
  handReach: 'position',
  handHeight: 'position',
  tail: 'kit',
}

/** How each posture slider shows its value. */
const POSTURE_FORMAT: Record<PostureKey, (v: number) => string> = {
  torsoDeg: (v) => `${fixed(v, 0)}°`,
  headDrop: (v) => `${fixed(v * 100, 0)} %`,
  armWidth: (v) => `${fixed(v * 100, 0)} cm`,
  handReach: (v) => `${fixed(v * 100, 0)} cm`,
  handHeight: (v) => `${v > 0 ? '+' : ''}${fixed(v * 100, 0)} cm`,
}
/** Which sled slider each Sliding Federation break jumps to. */
const SLED_BREAK_TARGET: Record<SledRuleBreak['part'], string> = {
  'sled.nose': 'bs-nose',
  'sled.tail': 'bs-tail',
  'sled.cowl': 'bs-cowl',
}

const JUMPER_FORMAT: Record<JumperKey, (v: number) => string> = {
  leanDeg: (v) => `${fixed(v, 0)}°`,
  vAngleDeg: (v) => `${fixed(v, 0)}°`,
}
const SKATER_FORMAT: Record<SkaterKey, (v: number) => string> = {
  trunkDeg: (v) => `${fixed(v, 0)}°`,
  kneeDeg: (v) => `${fixed(v, 0)}°`,
  headDrop: (v) => `${fixed(v * 100, 0)} %`,
}

export interface ScreenControl {
  setActive(active: boolean): void
}

export function startShapeScreen(host: HTMLElement, view: ShapeView): ScreenControl {
  let design: Design = structuredClone(designStore.get())
  let dirty = true
  /** The copy last handed to the tunnel, so a design set from elsewhere (a new job) can be told apart. */
  let sent: Design | null = null
  // Each sport's controls read and write through these; the other sport's (hidden) controls get a spare copy.
  const spareCyclist = structuredClone(DEFAULT_CYCLIST)
  const spareSkater = structuredClone(DEFAULT_SKATER)
  const spareJumper = structuredClone(DEFAULT_JUMPER)
  const spareBobsled = structuredClone(DEFAULT_BOBSLED)
  const cyc = (): CyclistDesign => (isCyclist(design) ? design : spareCyclist)
  const sk = (): SkaterDesign => (isSkater(design) ? design : spareSkater)
  const jp = (): JumperDesign => (isJumper(design) ? design : spareJumper)
  const bs = (): BobsledDesign => (isBobsled(design) ? design : spareBobsled)
  let selected: HandleId | null = null

  // --- Header
  const header = el('header', 'top-bar')
  const titleBlock = el('div', 'title-block')
  const place = el('p', 'place')
  titleBlock.append(el('h1', 'wordmark', t('game.title')), place)
  /** The subtitle names the client while there's a job. */
  const showPlace = () => {
    const job = careerStore.get().job
    const who = job ? briefTemplate(job.brief.id)?.client : undefined
    const plain = isJumper(design) ? 'shape.placeJumper' : isBobsled(design) ? (design.crew === 4 ? 'shape.placeBobsled4' : 'shape.placeBobsled') : 'shape.place'
    place.textContent = who ? t('shape.placeJob', { client: who }) : t(plain)
  }
  showPlace()
  header.append(titleBlock)

  // --- Sheet: readouts, rule breaks, tabs, controls.
  const sheet = el('section', 'sheet shape-sheet')
  sheet.setAttribute('aria-label', t('shape.sheet'))
  const grid = el('div', 'readouts')
  const deskR = readout(t('read.desk'), 'deskEstimate')
  const comfortR = readout(t('read.comfort'), 'comfort')
  const meter = el('div', 'meter')
  const meterFill = el('div', 'meter-fill')
  meter.append(meterFill)
  meter.setAttribute('role', 'meter')
  meter.setAttribute('aria-label', t('read.comfort'))
  meter.setAttribute('aria-valuemin', '0')
  meter.setAttribute('aria-valuemax', String(COMFORT.riderLimit))
  comfortR.box.insertBefore(meter, comfortR.sub)
  const frontalR = readout(t('read.frontal'), 'frontalArea')
  const rulesR = readout(t('read.rules'), 'ruleBox')
  // A jumper's sheet reads the flight instead: desk distance, lift and stability.
  const jumpDeskR = readout(t('read.desk'), 'deskEstimate')
  const liftR = readout(t('read.lift'), 'lift')
  const marginR = readout(t('read.margin'), 'staticMargin')
  const bodyBoxes = [deskR.box, comfortR.box, frontalR.box]
  const jumpBoxes = [jumpDeskR.box, liftR.box, marginR.box]
  // A sled's sheet (PR 8m): the desk's run time, the drag area by part, and whether the driver can see.
  const bobDeskR = readout(t('read.desk'), 'deskEstimate')
  const sledDragR = readout(t('read.sledDrag'), 'cda')
  const sightR = readout(t('read.sight'), 'crewTuck')
  const bobBoxes = [bobDeskR.box, sledDragR.box, sightR.box]
  grid.append(deskR.box, jumpDeskR.box, bobDeskR.box, comfortR.box, liftR.box, sledDragR.box, frontalR.box, marginR.box, sightR.box, rulesR.box)

  const breaks = el('ul', 'breaks')
  breaks.setAttribute('aria-live', 'polite')

  const tabBar = el('div', 'tabs')
  tabBar.setAttribute('role', 'tablist')
  tabBar.setAttribute('aria-label', t('shape.tabs'))
  const panels: Record<Tab, HTMLElement> = {
    position: el('div', 'panel'),
    kit: el('div', 'panel'),
    bike: el('div', 'panel'),
  }
  const tabButtons = {} as Record<Tab, HTMLButtonElement>
  for (const tab of ['position', 'kit', 'bike'] as const) {
    const b = el('button', 'tab', t(`tab.${tab}`))
    b.type = 'button'
    b.id = `tab-${tab}`
    b.setAttribute('role', 'tab')
    b.setAttribute('aria-controls', `panel-${tab}`)
    b.addEventListener('click', () => selectTab(tab))
    tabButtons[tab] = b
    tabBar.append(b)
    const panel = panels[tab]
    panel.id = `panel-${tab}`
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', b.id)
  }
  const panelBox = el('div', 'panel-box')
  panelBox.append(panels.position, panels.kit, panels.bike)

  const foot = el('div', 'sheet-foot')
  const reset = el('button', 'text-button', t('shape.reset'))
  reset.type = 'button'
  const terms = el('button', 'text-button', t('shape.glossary'))
  terms.type = 'button'
  terms.addEventListener('click', () => openGlossaryIndex())
  const version = el('span', 'version', `v${__GAME_VERSION__} · ${__BUILD_SHA__} · ${__BUILD_DATE__}`)
  foot.append(reset, terms, version)

  sheet.append(grid, breaks, tabBar, panelBox, foot)
  host.append(header, sheet)

  // A one-line hint just above the sheet, over the 3D view.
  const hint = el('p', 'shape-hint', t('hint.shape'))
  host.append(hint)

  const sheetObserver = new ResizeObserver(() => {
    view.setSheetHeight(sheet.offsetHeight)
    host.style.setProperty('--sheet-h', `${sheet.offsetHeight}px`)
  })
  sheetObserver.observe(sheet)

  let currentTab: Tab = 'position'
  function selectTab(tab: Tab) {
    currentTab = tab
    for (const k of Object.keys(panels) as Tab[]) {
      panels[k].hidden = k !== tab
      tabButtons[k].setAttribute('aria-selected', String(k === tab))
      tabButtons[k].tabIndex = k === tab ? 0 : -1
    }
  }
  tabBar.addEventListener('keydown', (e) => {
    const order = (['position', 'kit', 'bike'] as const).filter((k) => !tabButtons[k].hidden)
    const i = order.indexOf(currentTab)
    const n = order.length
    const next = e.key === 'ArrowRight' ? order[(i + 1) % n] : e.key === 'ArrowLeft' ? order[(i + n - 1) % n] : null
    if (next) {
      selectTab(next)
      tabButtons[next].focus()
    }
  })
  selectTab('position')

  const changed = () => {
    dirty = true
  }

  // --- Controls
  const syncers: (() => void)[] = []

  function slider(panel: HTMLElement, id: string, label: string, range: { min: number; max: number; step: number }, get: () => number, set: (v: number) => void, show: (v: number) => string) {
    const row = el('div', 'control')
    const head = el('div', 'control-head')
    const lab = el('label', 'control-label', label)
    lab.htmlFor = id
    const val = el('span', 'control-value')
    head.append(lab, val)
    const input = el('input', 'control-slider')
    input.type = 'range'
    input.id = id
    input.min = String(range.min)
    input.max = String(range.max)
    input.step = String(range.step)
    input.addEventListener('input', () => {
      set(Number(input.value))
      val.textContent = show(get())
      input.setAttribute('aria-valuetext', show(get()))
      changed()
    })
    row.append(head, input)
    panel.append(row)
    syncers.push(() => {
      input.value = String(get())
      val.textContent = show(get())
      input.setAttribute('aria-valuetext', show(get()))
    })
    return row
  }

  function choice<T extends string>(panel: HTMLElement, id: string, label: string, options: { value: T; key: StringKey }[], get: () => T, set: (v: T) => void) {
    const row = el('div', 'control')
    const lab = el('div', 'control-label', label)
    lab.id = `${id}-label`
    const group = el('div', 'segmented')
    group.id = id
    group.setAttribute('role', 'radiogroup')
    group.setAttribute('aria-labelledby', lab.id)
    group.tabIndex = -1
    const buttons = options.map((o) => {
      const b = el('button', 'segment', t(o.key))
      b.type = 'button'
      b.setAttribute('role', 'radio')
      b.addEventListener('click', () => {
        set(o.value)
        sync()
        changed()
      })
      group.append(b)
      return b
    })
    const sync = () =>
      buttons.forEach((b, i) => {
        const on = options[i]!.value === get()
        b.setAttribute('aria-checked', String(on))
        b.tabIndex = on ? 0 : -1
      })
    row.append(lab, group)
    panel.append(row)
    syncers.push(sync)
    return row
  }

  function toggle(panel: HTMLElement, id: string, label: string, get: () => boolean, set: (v: boolean) => void) {
    const row = el('label', 'control control-toggle')
    const input = el('input', 'toggle')
    input.type = 'checkbox'
    input.id = id
    input.addEventListener('change', () => {
      set(input.checked)
      changed()
    })
    row.append(input, el('span', 'control-label', label))
    panel.append(row)
    syncers.push(() => (input.checked = get()))
  }

  // Each tab holds a box of cyclist controls and a box of skater controls; the design's sport shows one.
  const box = (panel: HTMLElement) => {
    const b = el('div', 'sport-controls')
    panel.append(b)
    return b
  }
  const cycBox = { position: box(panels.position), kit: box(panels.kit), bike: box(panels.bike) }
  const skBox = { position: box(panels.position), kit: box(panels.kit) }
  const jpBox = { position: box(panels.position), kit: box(panels.kit) }
  const bsBox = { position: box(panels.position), kit: box(panels.kit) }

  for (const key of Object.keys(POSTURE_RANGE) as PostureKey[]) {
    slider(cycBox.position, `ctl-${key}`, t(`ctl.${key}`), POSTURE_RANGE[key], () => cyc().posture[key], (v) => (cyc().posture[key] = v), POSTURE_FORMAT[key])
  }
  for (const key of Object.keys(SKATER_RANGE) as SkaterKey[]) {
    slider(skBox.position, `sk-${key}`, t(`ctl.${key}`), SKATER_RANGE[key], () => sk().posture[key], (v) => (sk().posture[key] = v), SKATER_FORMAT[key])
  }
  choice(skBox.position, 'sk-arms', t('ctl.arms'), [{ value: 'back', key: 'opt.armsBack' }, { value: 'swing', key: 'opt.armsSwing' }], () => sk().arms, (v) => (sk().arms = v))
  choice(skBox.kit, 'sk-hood', t('ctl.hood'), [{ value: 'cap', key: 'opt.cap' }, { value: 'hood', key: 'opt.hood' }], () => sk().hood, (v) => (sk().hood = v))
  choice(skBox.kit, 'sk-fabric', t('ctl.fabric'), [{ value: 'smooth', key: 'opt.smooth' }, { value: 'textured', key: 'opt.textured' }], () => sk().suit.fabric, (v) => (sk().suit.fabric = v))
  toggle(skBox.kit, 'sk-legTrips', t('ctl.legTrips'), () => sk().suit.legTrips, (v) => (sk().suit.legTrips = v))
  for (const key of Object.keys(JUMPER_FORMAT) as JumperKey[]) {
    slider(jpBox.position, `jp-${key}`, t(`ctl.${key}`), JUMPER_RANGE[key], () => jp().posture[key], (v) => (jp().posture[key] = v), JUMPER_FORMAT[key])
  }
  const roomy = (v: number) => (v <= 0 ? t('opt.suitTight') : t('opt.suitRoomy', { pct: fixed(v * 100, 0) }))
  slider(jpBox.kit, 'jp-bagginess', t('ctl.bagginess'), JUMPER_RANGE.bagginess, () => jp().suit.bagginess, (v) => (jp().suit.bagginess = v), roomy)
  // The sled: the crew's tuck on Position, the shell on the Kit tab (named Sled for a bobsled).
  const tuckShow = (v: number) => (v <= 0 ? t('opt.tuckLoose') : v >= 1 ? t('opt.tuckDeep') : `${fixed(v * 100, 0)} %`)
  const metres = (v: number) => `${fixed(v, 2)} m`
  slider(bsBox.position, 'bs-tuck', t('ctl.tuck'), BOBSLED_RANGE.tuck, () => bs().tuck, (v) => (bs().tuck = v), tuckShow)
  slider(bsBox.kit, 'bs-nose', t('ctl.sledNose'), BOBSLED_RANGE.nose, () => bs().sled.nose, (v) => (bs().sled.nose = v), metres)
  slider(bsBox.kit, 'bs-tail', t('ctl.sledTail'), BOBSLED_RANGE.tail, () => bs().sled.tail, (v) => (bs().sled.tail = v), metres)
  slider(bsBox.kit, 'bs-cowl', t('ctl.cowl'), BOBSLED_RANGE.cowl, () => bs().sled.cowl, (v) => (bs().sled.cowl = v), metres)

  const pct = (v: number) => `${fixed(v * 100, 0)} %`
  choice(cycBox.kit, 'ctl-helmet', t('ctl.helmet'), [{ value: 'road', key: 'opt.road' }, { value: 'aero', key: 'opt.aero' }], () => cyc().helmet.kind, (v) => (cyc().helmet.kind = v))
  const tailRow = slider(cycBox.kit, 'ctl-tail', t('ctl.tail'), PART_RANGE.tail, () => cyc().helmet.tail, (v) => (cyc().helmet.tail = v), pct)
  slider(cycBox.kit, 'ctl-vents', t('ctl.vents'), PART_RANGE.vents, () => cyc().helmet.vents, (v) => (cyc().helmet.vents = v), pct)
  choice(cycBox.kit, 'ctl-fabric', t('ctl.fabric'), [{ value: 'smooth', key: 'opt.smooth' }, { value: 'textured', key: 'opt.textured' }], () => cyc().suit.fabric, (v) => (cyc().suit.fabric = v))
  toggle(cycBox.kit, 'ctl-armTrips', t('ctl.armTrips'), () => cyc().suit.armTrips, (v) => (cyc().suit.armTrips = v))

  choice(cycBox.bike, 'ctl-bars', t('ctl.bars'), [{ value: 'drops', key: 'opt.drops' }, { value: 'aero', key: 'opt.aeroBars' }], () => cyc().bars, (v) => (cyc().bars = v))
  const wheels = [
    { value: 'spoked', key: 'opt.spoked' },
    { value: 'deep', key: 'opt.deep' },
    { value: 'disc', key: 'opt.disc' },
  ] as const
  choice(cycBox.bike, 'ctl-front', t('ctl.front'), [...wheels], () => cyc().wheels.front, (v) => (cyc().wheels.front = v))
  choice(cycBox.bike, 'ctl-rear', t('ctl.rear'), [...wheels], () => cyc().wheels.rear, (v) => (cyc().wheels.rear = v))
  choice(cycBox.bike, 'ctl-frame', t('ctl.frame'), [{ value: 'round', key: 'opt.round' }, { value: 'kamm', key: 'opt.kamm' }], () => cyc().frame, (v) => (cyc().frame = v))

  // Arrow keys move between options in a segmented group.
  sheet.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement
    if (!target.classList.contains('segment') || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return
    const sib = e.key === 'ArrowRight' ? target.nextElementSibling : target.previousElementSibling
    if (sib instanceof HTMLButtonElement) {
      sib.click()
      sib.focus()
    }
  })

  reset.addEventListener('click', () => {
    // Back to where the job started: the client's setup (or the plain starting design between jobs).
    const job = careerStore.get().job
    // A sled keeps its crew size: that's the job's, not a shape.
    const plain = isJumper(design) ? DEFAULT_JUMPER : isBobsled(design) ? { ...DEFAULT_BOBSLED, crew: design.crew } : isSkater(design) ? DEFAULT_SKATER : DEFAULT_CYCLIST
    design = structuredClone((job && briefTemplate(job.brief.id)?.setup) || plain)
    selected = null
    syncAll()
    changed()
  })

  const syncAll = () => {
    syncers.forEach((s) => s())
    showPlace()
    const skating = isSkater(design)
    const jumping = isJumper(design)
    const sliding = isBobsled(design)
    const riding = !skating && !jumping && !sliding
    for (const b of Object.values(cycBox)) b.hidden = !riding
    for (const b of Object.values(skBox)) b.hidden = !skating
    for (const b of Object.values(jpBox)) b.hidden = !jumping
    for (const b of Object.values(bsBox)) b.hidden = !sliding
    for (const b of bodyBoxes) b.hidden = jumping || sliding
    for (const b of jumpBoxes) b.hidden = !jumping
    for (const b of bobBoxes) b.hidden = !sliding
    tabButtons.kit.textContent = t(sliding ? 'tab.sled' : 'tab.kit')
    // Only riders have a bike: the tab goes for the others, and the sheet falls back to Position if it was open.
    tabButtons.bike.hidden = !riding
    if (!riding && currentTab === 'bike') selectTab('position')
    tailRow.hidden = cyc().helmet.kind !== 'aero'
    hint.textContent = t(jumping ? 'hint.shapeJumper' : sliding ? 'hint.shapeBobsled' : skating ? 'hint.shapeSkater' : 'hint.shape')
    if (!jumping && !sliding) rulesR.sub.textContent = t(skating ? 'book.skating' : 'book.tcf-tt')
  }
  syncAll()
  // A new job puts the client's setup on the bench: take it up.
  designStore.subscribe((d) => {
    if (d === sent) return
    design = structuredClone(d)
    selected = null
    syncAll()
    dirty = true
  })
  careerStore.subscribe(() => {
    showPlace()
    dirty = true
  })

  function jumpTo(part: RuleBreak['part']) {
    jumpToControl(BREAK_TARGET[part])
  }
  // "Change this" after a model broke in the tunnel, or after trouble on race day (plan sections 7 and 8).
  window.addEventListener('laminar:fix', (e) => {
    const where = (e as CustomEvent<FixTarget>).detail
    if (isBobsled(design)) {
      // A sled's fixes: the crew's tuck for anything about the crew, otherwise the cowling.
      if (where === 'helmet' || where === 'headDrop') jumpToControl({ tab: 'position', id: 'bs-tuck' })
      else jumpToControl({ tab: 'kit', id: 'bs-cowl' })
      return
    }
    if (isJumper(design)) {
      // A jumper's fixes: the lean or the V if named, otherwise the suit (where stability is won and lost).
      if (where === 'leanDeg' || where === 'vAngleDeg') jumpToControl({ tab: 'position', id: `jp-${where}` })
      else jumpToControl({ tab: 'kit', id: 'jp-bagginess' })
      return
    }
    if (isSkater(design)) {
      // A skater's fixes are all in the crouch (or the head cover, for a helmet-like fault).
      if (where === 'helmet') jumpToControl({ tab: 'kit', id: 'sk-hood' })
      else if (where === 'trunkDeg' || where === 'kneeDeg' || where === 'headDrop') jumpToControl({ tab: 'position', id: `sk-${where}` })
      else jumpToControl({ tab: 'position', id: 'sk-trunkDeg' })
      return
    }
    if (where === 'helmet') jumpToControl(BREAK_TARGET.helmet)
    else if (where === 'wheels') jumpToControl({ tab: 'bike', id: 'ctl-rear' })
    else if (where === 'front') jumpToControl(BREAK_TARGET['wheels.front'])
    else jumpToControl({ tab: 'position', id: `ctl-${where}` })
  })

  function jumpToControl(target: { tab: Tab; id: string }) {
    selectTab(target.tab)
    const node = document.getElementById(target.id)
    if (!node) return
    const row = node.closest('.control') ?? node
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    row.classList.remove('flash')
    void (row as HTMLElement).offsetWidth
    row.classList.add('flash')
    const focusable = node.matches('input') ? node : node.querySelector<HTMLElement>('[aria-checked="true"]')
    focusable?.focus({ preventScroll: true })
  }

  // --- Recompute everything from the design.
  function refresh() {
    syncAll()
    // The tunnel tests whatever is shaped here; it gets its own copy.
    sent = structuredClone(design)
    designStore.set(sent)
    if (isJumper(design)) {
      showJumper(design)
      return
    }
    if (isBobsled(design)) {
      showBobsled(design)
      return
    }
    const r = designReadouts(design, TCF_TIME_TRIAL)
    const shape = designShape(design)
    // The desk estimate is for the job's event, with the job's own bias.
    const career = careerStore.get()
    const desk = deskEstimate(shape, currentEvent(career), career.job?.brief.seed ?? DESK.demoJobSeed, JSON.stringify(design), crewEffects(career.crew).deskLevel)
    deskR.value.textContent = `${fixed(desk.value, 3)} m²`
    deskR.sub.textContent = t('read.deskNote', { spread: fixed((desk.high - desk.low) / 2, 3) })

    const c = r.comfort
    comfortR.value.textContent = c.holdable ? `${fixed(Math.max(0, 1 - c.strain / c.limit) * 100, 0)} %` : t('read.comfortOver')
    comfortR.value.classList.toggle('over', !c.holdable)
    // A skater's swinging arm can add more power than the crouch takes away.
    const change = (c.powerFactor - 1) * 100
    comfortR.sub.textContent = t('read.comfortNote', { power: `${change > 0 ? '+' : '−'}${fixed(Math.abs(change), 1)} %` })
    meterFill.style.width = `${Math.min(100, (c.strain / c.limit) * 100)}%`
    meter.classList.toggle('warn', c.strain >= COMFORT.strainWarn * c.limit)
    meter.classList.toggle('over', !c.holdable)
    meter.setAttribute('aria-valuenow', fixed(c.strain, 2))

    frontalR.value.textContent = `${fixed(r.frontalArea, 3)} m²`
    frontalR.sub.textContent = t('read.frontalNote', { mass: fixed(r.mass, 1), price: fixed(r.price, 0) })

    rulesR.value.textContent = isSkater(design) ? t('read.noRules') : r.breaks.length === 0 ? t('read.legal') : r.breaks.length === 1 ? t('read.oneBreak') : t('read.breaks', { count: r.breaks.length })
    rulesR.value.classList.toggle('over', r.breaks.length > 0)
    breaks.replaceChildren(
      ...r.breaks.map((b) => {
        const li = el('li', 'break')
        const show = (v: number | string) => (typeof v === 'number' ? fixed(v, 2) : v)
        li.append(el('span', 'break-text', t(`rule.${b.rule}`, { value: show(b.value), limit: show(b.limit), book: t('book.tcf-tt') })))
        const fix = el('button', 'break-fix', t('rule.fix'))
        fix.type = 'button'
        fix.addEventListener('click', () => jumpTo(b.part))
        li.append(fix)
        return li
      }),
    )

    const worst = c.worst as PostureKey | SkaterKey | null
    const strained = c.strain >= COMFORT.strainWarn * c.limit && worst ? [STRAIN_HIGHLIGHT[worst]] : []
    const pose = designPose(design)
    const bike = isCyclist(design) ? design : null
    view.show({
      design,
      pose,
      broken: r.breaks.map((b) => BREAK_HIGHLIGHT[b.part as RuleBreak['part']]),
      strained,
      // Handles and rule boxes are the cyclist's: skaters set the crouch with the sliders and have no kit rules.
      handles: bike ? availableHandles(bike).map((id) => ({ id, point: handlePoint(bike, id, pose) })) : [],
      selected,
      volumes: bike ? ruleVolumes(bike, pose, TCF_TIME_TRIAL) : [],
    })
  }

  /** The jumper's sheet (PR 8d): the desk's reference jump, lift area and L/D, and the stability margin against its floor. */
  function showJumper(jumper: JumperDesign) {
    const career = careerStore.get()
    const event = currentJumpEvent(career)
    const desk = jumpDeskEstimate(jumper, event, career.job?.brief.seed ?? DESK.demoJobSeed, JSON.stringify(jumper), crewEffects(career.crew).deskLevel)
    jumpDeskR.value.textContent = `${fixed(desk.value, 1)} m`
    jumpDeskR.sub.textContent = t('read.deskJumpNote', { spread: fixed((desk.high - desk.low) / 2, 1), hill: t(`hill.${event.hill.id}`) })
    const r = jumperReadouts(jumper)
    // Stability is judged at the flight's worst moment, as the promise will be.
    const margin = desk.minMargin
    liftR.value.textContent = `${fixed(r.liftArea, 2)} m²`
    liftR.sub.textContent = t('read.liftNote', { ld: fixed(r.lOverD, 2), alpha: fixed(FLIGHT_ATTITUDE.hold, 0) })
    const floor = fixed(PITCH.floor * 100, 0)
    const pct = margin * 100
    marginR.value.textContent = `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${fixed(Math.abs(pct), 1)} %`
    const state = margin < 0 ? 'bad' : margin < PITCH.floor ? 'low' : 'ok'
    marginR.value.classList.toggle('over', state !== 'ok')
    marginR.sub.textContent = t(state === 'bad' ? 'read.marginBad' : state === 'low' ? 'read.marginLow' : 'read.marginOk', { floor })
    rulesR.value.textContent = t('read.noRules')
    rulesR.value.classList.remove('over')
    rulesR.sub.textContent = t('read.jumpKit', { mass: fixed(r.mass, 1), price: fixed(r.price, 0) })
    breaks.replaceChildren()
    // The body glows amber under the floor and red past zero: that's where the trouble is.
    view.show({
      design: jumper,
      pose: designPose(jumper),
      broken: state === 'bad' ? ['torso'] : [],
      strained: state === 'low' ? ['torso'] : [],
      handles: [],
      selected: null,
      volumes: [],
    })
  }

  /**
   * The sled's sheet (PR 8m): the desk's run time down the track, its drag
   * area split by part, whether the driver can see over the cowling, and
   * the Sliding Federation's rule box with a "change this" for each break.
   */
  function showBobsled(sled: BobsledDesign) {
    const career = careerStore.get()
    const track = TRACKS.belogor
    const desk = bobDeskEstimate(sled, track, career.job?.brief.seed ?? DESK.demoJobSeed, JSON.stringify(sled), crewEffects(career.crew).deskLevel)
    bobDeskR.value.textContent = `${fixed(desk.value, 2)} s`
    bobDeskR.sub.textContent = t('read.deskBobNote', { spread: fixed((desk.high - desk.low) / 2, 2), track: t(`track.${track.id}`) })
    const d = desk.drag
    sledDragR.value.textContent = `${fixed(d.cdA, 3)} m²`
    // The split as shares: the crew over the cowling against the sled itself (hull, nose and runners).
    const crewShare = Math.round((d.crew / d.cdA) * 100)
    sledDragR.sub.textContent = t('read.sledDragNote', { crew: crewShare, sled: 100 - crewShare })
    const sight = sightMargin(sled)
    const cm = sight * 100
    sightR.value.textContent = `${cm > 0 ? '+' : cm < 0 ? '−' : ''}${fixed(Math.abs(cm), 0)} cm`
    sightR.value.classList.toggle('over', sight < 0)
    sightR.sub.textContent = t(sight < 0 ? 'read.sightBad' : 'read.sightOk')

    const rules = checkSledRules(sled)
    rulesR.value.textContent = rules.length === 0 ? t('read.legal') : rules.length === 1 ? t('read.oneBreak') : t('read.breaks', { count: rules.length })
    rulesR.value.classList.toggle('over', rules.length > 0)
    rulesR.sub.textContent = t('read.sledKit', { length: fixed(sledLength(sled), 2), mass: fixed(SLED.mass[sled.crew], 0), price: fixed(SLED.price[sled.crew], 0) })
    breaks.replaceChildren(
      ...rules.map((b) => {
        const li = el('li', 'break')
        li.append(el('span', 'break-text', t(b.rule === 'length' ? 'rule.sledLength' : 'rule.sledCowl', { value: fixed(b.value, 2), limit: fixed(b.limit, 2), book: t('book.tsf') })))
        const fix = el('button', 'break-fix', t('rule.fix'))
        fix.type = 'button'
        fix.addEventListener('click', () => jumpToControl({ tab: 'kit', id: SLED_BREAK_TARGET[b.part] }))
        li.append(fix)
        return li
      }),
    )
    view.show({
      design: sled,
      pose: designPose(sled),
      // The hull glows red outside the box; the driver's helmet amber when they can't see.
      broken: rules.length > 0 ? ['frame'] : [],
      strained: sight < 0 ? ['helmet'] : [],
      handles: [],
      selected: null,
      volumes: [],
    })
  }

  // --- Drag handles: a pull moves the same numbers as the sliders.
  view.setHandleListener({
    begin(id) {
      selected = id
      changed()
    },
    move(id, target, project) {
      if (isCyclist(design)) design = dragHandle(design, id, target, project)
      changed()
    },
    end(id, tapped) {
      // A tap shows the handle's slider, the precise way to set it.
      if (tapped) {
        const param = handleDef(id).params[0]!
        jumpToControl({ tab: PARAM_TAB[param], id: `ctl-${param}` })
      }
      changed()
    },
  })

  // --- Loop: recompute at most once a frame, draw every frame while shown.
  let active = false
  let raf = 0
  let last = 0
  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.25)
    last = now
    if (dirty) {
      dirty = false
      refresh()
    }
    view.frame(dt)
    raf = requestAnimationFrame(loop)
  }

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
