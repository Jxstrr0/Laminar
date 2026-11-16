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
import { TCF_TIME_TRIAL } from '../data/rules'
import { t, type StringKey } from '../data/strings'
import { readouts, type RuleBreak } from '../sim/cyclist'
import { deskEstimate } from '../sim/desk'
import { cyclistShape } from '../sim/geom/cyclist'
import { availableHandles, dragHandle, handleDef, handlePoint } from '../sim/geom/handles'
import { riderPose } from '../sim/geom/pose'
import { ruleVolumes } from '../sim/geom/ruleBox'
import { briefTemplate, currentEvent } from '../sim/career'
import type { Highlight, ShapeView } from '../render/shapeScene'
import type { GlossaryId } from '../data/glossary'
import type { HandleId, HandleParam } from '../data/handles'
import { careerStore } from './careerStore'
import { designStore } from './designStore'
import { fixed } from './format'
import { openGlossaryIndex, glossaryTerm } from './glossary'

type Tab = 'position' | 'kit' | 'bike'
type PostureKey = keyof CyclistDesign['posture']

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
const STRAIN_HIGHLIGHT: Record<PostureKey, Highlight> = {
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

export interface ScreenControl {
  setActive(active: boolean): void
}

export function startShapeScreen(host: HTMLElement, view: ShapeView): ScreenControl {
  let design: CyclistDesign = structuredClone(designStore.get())
  let dirty = true
  /** The copy last handed to the tunnel, so a design set from elsewhere (a new job) can be told apart. */
  let sent: CyclistDesign | null = null
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
    place.textContent = who ? t('shape.placeJob', { client: who }) : t('shape.place')
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
  rulesR.sub.textContent = t('book.tcf-tt')
  grid.append(deskR.box, comfortR.box, frontalR.box, rulesR.box)

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
    const order: Tab[] = ['position', 'kit', 'bike']
    const i = order.indexOf(currentTab)
    const next = e.key === 'ArrowRight' ? order[(i + 1) % 3] : e.key === 'ArrowLeft' ? order[(i + 2) % 3] : null
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

  for (const key of Object.keys(POSTURE_RANGE) as PostureKey[]) {
    slider(panels.position, `ctl-${key}`, t(`ctl.${key}`), POSTURE_RANGE[key], () => design.posture[key], (v) => (design.posture[key] = v), POSTURE_FORMAT[key])
  }

  const pct = (v: number) => `${fixed(v * 100, 0)} %`
  choice(panels.kit, 'ctl-helmet', t('ctl.helmet'), [{ value: 'road', key: 'opt.road' }, { value: 'aero', key: 'opt.aero' }], () => design.helmet.kind, (v) => (design.helmet.kind = v))
  const tailRow = slider(panels.kit, 'ctl-tail', t('ctl.tail'), PART_RANGE.tail, () => design.helmet.tail, (v) => (design.helmet.tail = v), pct)
  slider(panels.kit, 'ctl-vents', t('ctl.vents'), PART_RANGE.vents, () => design.helmet.vents, (v) => (design.helmet.vents = v), pct)
  choice(panels.kit, 'ctl-fabric', t('ctl.fabric'), [{ value: 'smooth', key: 'opt.smooth' }, { value: 'textured', key: 'opt.textured' }], () => design.suit.fabric, (v) => (design.suit.fabric = v))
  toggle(panels.kit, 'ctl-armTrips', t('ctl.armTrips'), () => design.suit.armTrips, (v) => (design.suit.armTrips = v))

  choice(panels.bike, 'ctl-bars', t('ctl.bars'), [{ value: 'drops', key: 'opt.drops' }, { value: 'aero', key: 'opt.aeroBars' }], () => design.bars, (v) => (design.bars = v))
  const wheels = [
    { value: 'spoked', key: 'opt.spoked' },
    { value: 'deep', key: 'opt.deep' },
    { value: 'disc', key: 'opt.disc' },
  ] as const
  choice(panels.bike, 'ctl-front', t('ctl.front'), [...wheels], () => design.wheels.front, (v) => (design.wheels.front = v))
  choice(panels.bike, 'ctl-rear', t('ctl.rear'), [...wheels], () => design.wheels.rear, (v) => (design.wheels.rear = v))
  choice(panels.bike, 'ctl-frame', t('ctl.frame'), [{ value: 'round', key: 'opt.round' }, { value: 'kamm', key: 'opt.kamm' }], () => design.frame, (v) => (design.frame = v))

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
    design = structuredClone((job && briefTemplate(job.brief.id)?.setup) || DEFAULT_CYCLIST)
    selected = null
    syncAll()
    changed()
  })

  const syncAll = () => {
    syncers.forEach((s) => s())
    tailRow.hidden = design.helmet.kind !== 'aero'
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
  // "Change this" after a model broke in the tunnel (plan section 8): the tail, or the rear wheel.
  window.addEventListener('laminar:fix', (e) => {
    const where = (e as CustomEvent<'helmet' | 'wheels'>).detail
    jumpToControl(where === 'helmet' ? BREAK_TARGET.helmet : { tab: 'bike', id: 'ctl-rear' })
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
    const r = readouts(design, TCF_TIME_TRIAL)
    const shape = cyclistShape(design)
    // The desk estimate is for the job's event, with the job's own bias.
    const career = careerStore.get()
    const desk = deskEstimate(shape, currentEvent(career), career.job?.brief.seed ?? DESK.demoJobSeed, JSON.stringify(design))
    deskR.value.textContent = `${fixed(desk.value, 3)} m²`
    deskR.sub.textContent = t('read.deskNote', { spread: fixed((desk.high - desk.low) / 2, 3) })

    const c = r.comfort
    comfortR.value.textContent = c.holdable ? `${fixed(Math.max(0, 1 - c.strain / c.limit) * 100, 0)} %` : t('read.comfortOver')
    comfortR.value.classList.toggle('over', !c.holdable)
    comfortR.sub.textContent = t('read.comfortNote', { power: `−${fixed((1 - c.powerFactor) * 100, 1)} %` })
    meterFill.style.width = `${Math.min(100, (c.strain / c.limit) * 100)}%`
    meter.classList.toggle('warn', c.strain >= COMFORT.strainWarn * c.limit)
    meter.classList.toggle('over', !c.holdable)
    meter.setAttribute('aria-valuenow', fixed(c.strain, 2))

    frontalR.value.textContent = `${fixed(r.frontalArea, 3)} m²`
    frontalR.sub.textContent = t('read.frontalNote', { mass: fixed(r.mass, 1), price: fixed(r.price, 0) })

    rulesR.value.textContent = r.breaks.length === 0 ? t('read.legal') : r.breaks.length === 1 ? t('read.oneBreak') : t('read.breaks', { count: r.breaks.length })
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

    const strained = c.strain >= COMFORT.strainWarn * c.limit && c.worst ? [STRAIN_HIGHLIGHT[c.worst]] : []
    const pose = riderPose(design)
    view.show({
      design,
      pose,
      broken: r.breaks.map((b) => BREAK_HIGHLIGHT[b.part]),
      strained,
      handles: availableHandles(design).map((id) => ({ id, point: handlePoint(design, id, pose) })),
      selected,
      volumes: ruleVolumes(design, pose, TCF_TIME_TRIAL),
    })
  }

  // --- Drag handles: a pull moves the same numbers as the sliders.
  view.setHandleListener({
    begin(id) {
      selected = id
      changed()
    },
    move(id, target, project) {
      design = dragHandle(design, id, target, project)
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
