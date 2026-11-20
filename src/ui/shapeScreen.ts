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
import { DEFAULT_TRUCK, FAIRING_MISS, FLEET_TRUCK, GRAVEL_YARD, TRUCK_RANGE, type TruckDesign } from '../data/truck'
import { CAR_CLASS, CAR_DESK, CAR_RANGE, STOCK_CAR, type CarClass, type CarDesign } from '../data/car'
import { RECORD_DESK, RECORD_RANGE, STOCK_RECORD, type RecordClass, type RecordDesign } from '../data/record'
import { crossHeld, sideCentre, sightLoss, thrustKept } from '../sim/record'
import { DRONE_DESK, DRONE_RANGE, STOCK_DRONE, type DroneDesign } from '../data/drone'
import { AIRCRAFT_BODY, AIRCRAFT_DESK, AIRCRAFT_RANGE, STOCK_AIRCRAFT, type AircraftDesign } from '../data/aircraft'
import { stallFix } from '../sim/aircraft'
import { POD_BODY, POD_BUFFET, POD_DESK, POD_RANGE, STOCK_POD, type PodDesign } from '../data/pod'
import { PLANE_BODY, PLANE_CLASS, PLANE_DESK, PLANE_GUST, PLANE_RANGE, STOCK_PLANE, type PlaneDesign } from '../data/plane'
import { courseDensity, droneMass, steadyTilt, topSpeed } from '../sim/drone'
import { carAero, checkCarRules, circuitDensity, heatLoss, porpoiseSpeed, type CarRuleBreak } from '../sim/car'
import { checkTruckRules, roofMismatch, skirtGap, truckParts, type TruckRuleBreak } from '../sim/truck'
import { truckLength } from '../sim/geom/truck'
import { checkSledRules, sightMargin, type SledRuleBreak } from '../sim/bobsled'
import { sledLength } from '../sim/geom/bobsled'
import { bookName } from './export'
import { t, type StringKey } from '../data/strings'
import type { RuleBreak } from '../sim/cyclist'
import type { FixTarget } from '../sim/failure'
import { bobDeskEstimate, carDeskEstimate, deskEstimate, droneDeskEstimate, jumpDeskEstimate, planeDeskEstimate, aircraftDeskEstimate, podDeskEstimate, recordDeskEstimate, truckDeskEstimate } from '../sim/desk'
import { jumperReadouts } from '../sim/jumper'
import type { ControlId } from '../sim/designDiff'
import { designPose, designReadouts, designShape, isAircraft, isBobsled, isCar, isCyclist, isDrone, isJumper, isPlane, isPod, isRecord, isSkater, isTruck, type Design } from '../sim/design'
import { availableHandles, dragHandle, handleDef, handlePoint } from '../sim/geom/handles'
import { ruleVolumes } from '../sim/geom/ruleBox'
import { briefTemplate, firmEffects, rulesFor, currentAircraftRun, currentPodRun, currentCarRun, currentDroneRun, currentPlaneRun, currentRecordRun, currentEvent, currentJumpEvent, currentTruckEvent, currentTruckRun } from '../sim/career'
import { cracksOnGravel, roadLegal } from '../sim/truckJob'
import type { Highlight, ShapeView } from '../render/shapeScene'
import type { GlossaryId } from '../data/glossary'
import type { HandleId, HandleParam } from '../data/handles'
import { careerStore } from './careerStore'
import { designStore } from './designStore'
import { fixed } from './format'
import { openGlossaryIndex, glossaryTerm } from './glossary'
import { scrollFade } from './scrollFade'

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
/** Which truck slider each road code break jumps to, and the part that glows red. */
const TRUCK_BREAK: Record<TruckRuleBreak['part'], { id: string; look: Highlight }> = {
  'trailer.tail': { id: 'tk-boatTail', look: 'boat-tail' },
  'trailer.skirts': { id: 'tk-skirts', look: 'skirts' },
}

/** Which car slider each rulebook break jumps to (by class, as the ranges differ), and the part that glows red. */
const CAR_BREAK: Record<CarRuleBreak['part'], { tab: Tab; control: string; look: Highlight }> = {
  'ride.front': { tab: 'position', control: 'rideFront', look: 'floor' },
  'ride.rear': { tab: 'position', control: 'rideRear', look: 'floor' },
  'rearWing.chord': { tab: 'kit', control: 'rearChord', look: 'rear-wing' },
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

/**
 * The Shape screen's element id for a control on this design (PR 10ah).
 * Ids are the sport's prefix and the control id, except a sled's nose and
 * tail, which are just "nose" and "tail".
 */
function controlDomId(design: Design, control: ControlId): string | null {
  if (isCar(design)) return `cr-${design.class}-${control}`
  if (isRecord(design)) return `rc-${design.class}-${control}`
  if (isBobsled(design)) return `bs-${control === 'sledNose' ? 'nose' : control === 'sledTail' ? 'tail' : control}`
  const prefix = isPod(design) ? 'sp' : isAircraft(design) ? 'ac' : isPlane(design) ? 'pl' : isDrone(design) ? 'dn' : isTruck(design) ? 'tk' : isJumper(design) ? 'jp' : isSkater(design) ? 'sk' : 'ctl'
  return `${prefix}-${control}`
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
  const spareTruck = structuredClone(DEFAULT_TRUCK)
  const tk = (): TruckDesign => (isTruck(design) ? design : spareTruck)
  // A car's sliders come in a set per class (their ranges differ); the other class's set writes to a spare.
  const spareCar: Record<CarClass, CarDesign> = { touring: structuredClone(STOCK_CAR.touring), open: structuredClone(STOCK_CAR.open) }
  const car = (cls: CarClass): CarDesign => (isCar(design) && design.class === cls ? design : spareCar[cls])
  // A record car's sliders come in a set per class too (the jet car's ranges are wider, and it has a waist).
  const spareRecord: Record<RecordClass, RecordDesign> = { streamliner: structuredClone(STOCK_RECORD.streamliner), jet: structuredClone(STOCK_RECORD.jet) }
  const rec = (cls: RecordClass): RecordDesign => (isRecord(design) && design.class === cls ? design : spareRecord[cls])
  /** A record slider's id in the set for this car's class. */
  const rcId = (name: string) => `rc-${isRecord(design) ? design.class : 'streamliner'}-${name}`
  // A racing quad's sliders (PR 10b); hidden ones write to a spare.
  const spareDrone = structuredClone(STOCK_DRONE.racer)
  const dn = (): DroneDesign => (isDrone(design) ? design : spareDrone)
  // A survey drone's sliders (PR 10j); hidden ones write to a spare.
  const sparePlane = structuredClone(STOCK_PLANE.survey)
  const pl = (): PlaneDesign => (isPlane(design) ? design : sparePlane)
  // A kit plane's sliders (PR 10q); hidden ones write to a spare.
  const spareAircraft = structuredClone(STOCK_AIRCRAFT.kit)
  const ac = (): AircraftDesign => (isAircraft(design) ? design : spareAircraft)
  // A sensor pod's sliders (PR 10z); hidden ones write to a spare.
  const sparePod = structuredClone(STOCK_POD.patrol)
  const sp = (): PodDesign => (isPod(design) ? design : sparePod)
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
    const plain = isPod(design) ? 'shape.placePod' : isAircraft(design) ? 'shape.placeAircraft' : isPlane(design) ? 'shape.placePlane' : isDrone(design) ? 'shape.placeDrone' : isRecord(design) ? (design.class === 'jet' ? 'shape.placeRecordJet' : 'shape.placeRecord') : isCar(design) ? (design.class === 'open' ? 'shape.placeCarOpen' : 'shape.placeCar') : isTruck(design) ? 'shape.placeTruck' : isJumper(design) ? 'shape.placeJumper' : isBobsled(design) ? (design.crew === 4 ? 'shape.placeBobsled4' : 'shape.placeBobsled') : 'shape.place'
    place.textContent = who ? t('shape.placeJob', { client: who }) : t(plain)
  }
  showPlace()
  header.append(titleBlock)

  // --- Sheet: readouts, rule breaks, tabs, controls.
  const sheet = el('section', 'sheet shape-sheet')
  // The readouts stay put (PR 13ay); only the rule breaks and the controls scroll, beneath them.
  const scroller = el('div', 'shape-scroll')
  scrollFade(scroller, 28)
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
  // A truck's sheet (PR 9b): the desk's fuel saving on the client's route, the drag area, and what the parts weigh.
  const truckDeskR = readout(t('read.desk'), 'fuelSaving')
  const truckDragR = readout(t('read.truckDrag'), 'cda')
  const partsR = readout(t('read.parts'), 'roadCode')
  const truckBoxes = [truckDeskR.box, truckDragR.box, partsR.box]
  // A racing car's sheet (PR 9j): the desk's lap-time gain, the downforce and drag, and the balance against the drivers' window.
  const carDeskR = readout(t('read.carDesk'), 'lapGain')
  const carDownR = readout(t('read.carDown'), 'downforce')
  const carBalR = readout(t('read.carBalance'), 'carBalance')
  const carBoxes = [carDeskR.box, carDownR.box, carBalR.box]
  // A record car's sheet (PR 9q): the desk's record speed, the nose's weight at speed, and whether it points straight.
  const recDeskR = readout(t('read.recordDesk'), 'recordSpeed')
  const noseR = readout(t('read.noseWeight'), 'noseLift')
  const straightR = readout(t('read.straight'), 'pointingStraight')
  const recBoxes = [recDeskR.box, noseR.box, straightR.box]
  // A racing quad's sheet (PR 10b): the desk's race time, its top speed and tilt, and how hard the air twists it.
  const dnDeskR = readout(t('read.droneDesk'), 'deskEstimate')
  const dnTopR = readout(t('read.droneTop'), 'quadTilt')
  const twistR = readout(t('read.twist'), 'pitchTwist')
  const droneBoxes = [dnDeskR.box, dnTopR.box, twistR.box]
  // A survey drone's sheet (PR 10j): the desk's range on a charge, how firmly it holds its nose, and the strongest gust it rides out on a turn.
  const plDeskR = readout(t('read.planeDesk'), 'surveyRange')
  const plMarginR = readout(t('read.planeMargin'), 'staticMargin')
  const gustR = readout(t('read.gustTurn'), 'gustStall')
  const planeBoxes = [plDeskR.box, plMarginR.box, gustR.box]
  // A kit plane's sheet (PR 10q): the desk's cruise speed, and the stall speed the inspector checks.
  const acDeskR = readout(t('read.aircraftDesk'), 'cruiseSpeed')
  const stallR = readout(t('read.stallSpeed'), 'stallSpeed')
  const aircraftBoxes = [acDeskR.box, stallR.box]
  // A sensor pod's sheet (PR 10z): the desk's hours on station, and the buffet the ministry checks.
  const podDeskR = readout(t('read.podDesk'), 'hoursOnStation')
  const buffetR = readout(t('read.buffet'), 'buffet')
  const podBoxes = [podDeskR.box, buffetR.box]
  grid.append(
    deskR.box, jumpDeskR.box, bobDeskR.box, truckDeskR.box, carDeskR.box, recDeskR.box, dnDeskR.box, plDeskR.box, acDeskR.box, podDeskR.box,
    comfortR.box, liftR.box, sledDragR.box, truckDragR.box, carDownR.box, noseR.box, dnTopR.box, plMarginR.box, stallR.box, buffetR.box,
    frontalR.box, marginR.box, sightR.box, partsR.box, carBalR.box, straightR.box, twistR.box, gustR.box,
    rulesR.box,
  )

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
  // The credits load only when asked for.
  const credits = el('button', 'text-button', t('shape.credits'))
  credits.type = 'button'
  credits.addEventListener('click', () => void import('./creditsSheet').then((m) => m.openCredits()))
  // The tutorial cards (PR 13ai) load only when asked for, too.
  const howTo = el('button', 'text-button', t('shape.howTo'))
  howTo.type = 'button'
  howTo.addEventListener('click', () => void import('./tour').then((m) => m.openTour()))
  const version = el('span', 'version', `v${__GAME_VERSION__} · ${__BUILD_SHA__} · ${__BUILD_DATE__}`)
  foot.append(reset, terms, howTo, credits, version)

  // Isobar (PR 13f): the readouts are cards of their own; the controls share one.
  const controlCard = el('div', 'card shape-controls')
  controlCard.append(tabBar, panelBox, foot)
  scroller.append(breaks, controlCard)
  sheet.append(grid, scroller)
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
  const tkBox = { position: box(panels.position), kit: box(panels.kit) }

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
  // The truck: the cab and the gap on the first tab, the trailer's parts on the second (tabs renamed for a truck).
  const cm = (v: number) => `${fixed(v * 100, 0)} cm`
  const offOr = (show: (v: number) => string) => (v: number) => (v <= 0 ? t('opt.off') : show(v))
  const pctOff = offOr((v) => `${fixed(v * 100, 0)} %`)
  slider(tkBox.position, 'tk-cabNose', t('ctl.cabNose'), TRUCK_RANGE.nose, () => tk().cab.nose, (v) => (tk().cab.nose = v), cm)
  slider(tkBox.position, 'tk-fairing', t('ctl.fairing'), TRUCK_RANGE.fairing, () => tk().cab.fairing, (v) => (tk().cab.fairing = v), offOr(metres))
  slider(tkBox.position, 'tk-extenders', t('ctl.extenders'), TRUCK_RANGE.extenders, () => tk().cab.extenders, (v) => (tk().cab.extenders = v), offOr(metres))
  slider(tkBox.position, 'tk-gapLength', t('ctl.gapLength'), TRUCK_RANGE.gap, () => tk().gap.length, (v) => (tk().gap.length = v), metres)
  slider(tkBox.position, 'tk-gapFill', t('ctl.gapFill'), TRUCK_RANGE.fill, () => tk().gap.fill, (v) => (tk().gap.fill = v), pctOff)
  slider(tkBox.kit, 'tk-skirts', t('ctl.skirts'), TRUCK_RANGE.skirts, () => tk().trailer.skirts, (v) => (tk().trailer.skirts = v), offOr(metres))
  slider(tkBox.kit, 'tk-boatTail', t('ctl.boatTail'), TRUCK_RANGE.tail, () => tk().trailer.tail, (v) => (tk().trailer.tail = v), offOr(metres))
  slider(tkBox.kit, 'tk-tailAngle', t('ctl.tailAngle'), TRUCK_RANGE.tailAngle, () => tk().trailer.tailAngle, (v) => (tk().trailer.tailAngle = v), (v) => `${fixed(v, 0)}°`)

  // The racing car: the floor (ride heights, diffuser, edge seal) on the first tab, the wings and cooling on the second.
  const crBox = {
    touring: { position: box(panels.position), kit: box(panels.kit) },
    open: { position: box(panels.position), kit: box(panels.kit) },
  }
  const deg = (v: number) => `${fixed(v, 0)}°`
  const cmFine = (v: number) => `${fixed(v * 100, 1)} cm`
  for (const cls of ['touring', 'open'] as const) {
    const R = CAR_RANGE[cls]
    const b = crBox[cls]
    const id = (name: string) => `cr-${cls}-${name}`
    slider(b.position, id('rideFront'), t('ctl.rideFront'), R.front, () => car(cls).ride.front, (v) => (car(cls).ride.front = v), cmFine)
    slider(b.position, id('rideRear'), t('ctl.rideRear'), R.rear, () => car(cls).ride.rear, (v) => (car(cls).ride.rear = v), cmFine)
    slider(b.position, id('diffuser'), t('ctl.diffuser'), R.diffuser, () => car(cls).diffuser, (v) => (car(cls).diffuser = v), deg)
    slider(b.position, id('floorEdge'), t('ctl.floorEdge'), R.floorEdge, () => car(cls).floorEdge, (v) => (car(cls).floorEdge = v), (v) => (v <= 0 ? t('opt.off') : `${fixed(v * 100, 0)} %`))
    // A touring car's front wing is a flap on its splitter.
    slider(b.kit, id('frontWing'), t(cls === 'touring' ? 'ctl.frontFlap' : 'ctl.frontWing'), R.frontWing, () => car(cls).frontWing, (v) => (car(cls).frontWing = v), deg)
    slider(b.kit, id('rearAngle'), t('ctl.rearAngle'), R.angle, () => car(cls).rearWing.angle, (v) => (car(cls).rearWing.angle = v), deg)
    slider(b.kit, id('rearChord'), t('ctl.rearChord'), R.chord, () => car(cls).rearWing.chord, (v) => (car(cls).rearWing.chord = v), cm)
    slider(b.kit, id('inlet'), t('ctl.inlet'), R.inlet, () => car(cls).inlet, (v) => (car(cls).inlet = v), (v) => `${fixed(v * 100, 0)} %`)
  }
  // The record car: the nose, the canopy (and a jet car's waist) on the first tab, the fin and the wheel fairings on the second.
  const rcBox: Record<RecordClass, { position: HTMLElement; kit: HTMLElement }> = {
    streamliner: { position: box(panels.position), kit: box(panels.kit) },
    jet: { position: box(panels.position), kit: box(panels.kit) },
  }
  for (const cls of ['streamliner', 'jet'] as const) {
    const RR = RECORD_RANGE[cls]
    const b = rcBox[cls]
    const id = (name: string) => `rc-${cls}-${name}`
    slider(b.position, id('noseLength'), t('ctl.noseLength'), RR.length, () => rec(cls).nose.length, (v) => (rec(cls).nose.length = v), (v) => `${fixed(v, 1)} m`)
    slider(b.position, id('noseDroop'), t('ctl.noseDroop'), RR.droop, () => rec(cls).nose.droop, (v) => (rec(cls).nose.droop = v), (v) => `${fixed(v, 1)}°`)
    slider(b.position, id('canopy'), t('ctl.canopy'), RR.canopy, () => rec(cls).canopy, (v) => (rec(cls).canopy = v), cm)
    // The jet car's waist (PR 9x): how far the body is pinched where the engine sits.
    if (cls === 'jet') slider(b.position, id('waist'), t('ctl.waist'), RR.waist, () => rec(cls).waist, (v) => (rec(cls).waist = v), (v) => (v <= 0 ? t('opt.off') : `${fixed(v * 100, 0)} %`))
    slider(b.kit, id('fin'), t('ctl.fin'), RR.fin, () => rec(cls).fin, (v) => (rec(cls).fin = v), (v) => (v <= 0 ? t('opt.off') : `${fixed(v, 2)} m²`))
    slider(b.kit, id('fairings'), t('ctl.fairings'), RR.fairings, () => rec(cls).fairings, (v) => (rec(cls).fairings = v), (v) => (v <= 0 ? t('opt.off') : `${fixed(v * 100, 0)} %`))
  }

  // The racing quad (PR 10b): the pod on the first tab, the arm fairings on the second.
  const dnBox = { position: box(panels.position), kit: box(panels.kit) }
  {
    const R = DRONE_RANGE.racer
    const offPct = (v: number) => (v <= 0 ? t('opt.off') : `${fixed(v * 100, 0)} %`)
    slider(dnBox.position, 'dn-podLength', t('ctl.podLength'), R.length, () => dn().pod.length, (v) => (dn().pod.length = v), (v) => `${fixed(v * 100, 0)} cm`)
    slider(dnBox.position, 'dn-podRake', t('ctl.podRake'), R.rake, () => dn().pod.rake, (v) => (dn().pod.rake = v), (v) => `${fixed(v, 0)}°`)
    slider(dnBox.position, 'dn-podVents', t('ctl.podVents'), R.vents, () => dn().pod.vents, (v) => (dn().pod.vents = v), offPct)
    slider(dnBox.kit, 'dn-armFairings', t('ctl.armFairings'), R.arms, () => dn().arms, (v) => (dn().arms = v), offPct)
  }

  // The survey drone (PR 10j): the fuselage and the tail on the first tab, the camera pod, the winglets and the wing's span (PR 10w) on the second.
  const plBox = { position: box(panels.position), kit: box(panels.kit) }
  {
    const R = PLANE_RANGE.survey
    const offPct = (v: number) => (v <= 0 ? t('opt.off') : `${fixed(v * 100, 0)} %`)
    const cm = (v: number) => `${fixed(v * 100, 0)} cm`
    const slide = (v: number) => {
      const d = fixed(Math.abs(v) * PLANE_BODY.pod.slide * 100, 0)
      return Math.abs(v) < 0.05 ? t('opt.centred') : t(v > 0 ? 'opt.forwardCm' : 'opt.aftCm', { cm: d })
    }
    slider(plBox.position, 'pl-planeNose', t('ctl.planeNose'), R.nose, () => pl().fuselage.nose, (v) => (pl().fuselage.nose = v), cm)
    slider(plBox.position, 'pl-tailCone', t('ctl.tailCone'), R.taper, () => pl().fuselage.taper, (v) => (pl().fuselage.taper = v), (v) => `${fixed(v * 100, 0)} %`)
    slider(plBox.position, 'pl-tailSize', t('ctl.tailSize'), R.tail, () => pl().tail, (v) => (pl().tail = v), (v) => `${fixed(v * 100, 0)} %`)
    slider(plBox.kit, 'pl-cameraDrop', t('ctl.cameraDrop'), R.drop, () => pl().camera.drop, (v) => (pl().camera.drop = v), (v) => (v <= 0 ? t('opt.flush') : `${fixed(v * 100, 0)} %`))
    slider(plBox.kit, 'pl-cameraFairing', t('ctl.cameraFairing'), R.fairing, () => pl().camera.fairing, (v) => (pl().camera.fairing = v), offPct)
    slider(plBox.kit, 'pl-cameraAt', t('ctl.cameraAt'), R.at, () => pl().camera.at, (v) => (pl().camera.at = v), slide)
    slider(plBox.kit, 'pl-winglets', t('ctl.winglets'), R.winglets, () => pl().winglets, (v) => (pl().winglets = v), (v) => (v <= 0 ? t('opt.off') : cm(v)))
    // The span in metres, tip to tip: the maker's is 2.1 m.
    slider(plBox.kit, 'pl-wingSpan', t('ctl.wingSpan'), R.span, () => pl().span, (v) => (pl().span = v), (v) => `${fixed(v * PLANE_CLASS.survey.span, 2)} m`)
  }

  // The kit plane (PR 10q): the nose and wheels on the first tab, the wing, struts and pod on the second.
  const acBox = { position: box(panels.position), kit: box(panels.kit) }
  {
    const R = AIRCRAFT_RANGE.kit
    const pct = (v: number) => `${fixed(v * 100, 0)} %`
    const offPct = (v: number) => (v <= 0 ? t('opt.off') : pct(v))
    const deg = (v: number) => (Math.abs(v) < 0.25 ? t('opt.straight') : t(v > 0 ? 'opt.toeIn' : 'opt.toeOut', { deg: fixed(Math.abs(v), 1) }))
    const slide = (v: number) => {
      const d = fixed(Math.abs(v) * AIRCRAFT_BODY.pod.slide * 100, 0)
      return Math.abs(v) < 0.05 ? t('opt.centred') : t(v > 0 ? 'opt.forwardCm' : 'opt.aftCm', { cm: d })
    }
    slider(acBox.position, 'ac-acCowling', t('ctl.acCowling'), R.cowling, () => ac().cowling, (v) => (ac().cowling = v), (v) => (v <= 0 ? t('opt.kit') : pct(v)))
    slider(acBox.position, 'ac-spats', t('ctl.spats'), R.spats, () => ac().spats, (v) => (ac().spats = v), offPct)
    slider(acBox.kit, 'ac-wingtips', t('ctl.wingtips'), R.wingtips, () => ac().wingtips, (v) => (ac().wingtips = v), (v) => (v <= 0 ? t('opt.rounded') : pct(v)))
    slider(acBox.kit, 'ac-strutFairing', t('ctl.strutFairing'), R.fairing, () => ac().struts.fairing, (v) => (ac().struts.fairing = v), offPct)
    slider(acBox.kit, 'ac-strutToe', t('ctl.strutToe'), R.toe, () => ac().struts.toe, (v) => (ac().struts.toe = v), deg)
    slider(acBox.kit, 'ac-acPodFairing', t('ctl.acPodFairing'), R.podFairing, () => ac().pod.fairing, (v) => (ac().pod.fairing = v), offPct)
    slider(acBox.kit, 'ac-acPodAt', t('ctl.acPodAt'), R.podAt, () => ac().pod.at, (v) => (ac().pod.at = v), slide)
  }

  // The sensor pod (PR 10z): the nose and tail on the first tab, the pylon's gap and the stagger on the second.
  const podBox = { position: box(panels.position), kit: box(panels.kit) }
  {
    const R = POD_RANGE.patrol
    const pct = (v: number) => `${fixed(v * 100, 0)} %`
    const cmText = (v: number) => `${fixed(v * 100, 0)} cm`
    const stagger = (v: number) => {
      const d = fixed(Math.abs(v) * POD_BODY.slide * 100, 0)
      return Math.abs(v) < 0.05 ? t('opt.centred') : t(v > 0 ? 'opt.forwardCm' : 'opt.aftCm', { cm: d })
    }
    slider(podBox.position, 'sp-senNose', t('ctl.senNose'), R.nose, () => sp().nose, (v) => (sp().nose = v), (v) => (v <= 0 ? t('opt.dome') : pct(v)))
    slider(podBox.position, 'sp-senTail', t('ctl.senTail'), R.tail, () => sp().tail, (v) => (sp().tail = v), (v) => (v <= 0 ? t('opt.cutOff') : pct(v)))
    slider(podBox.kit, 'sp-senGap', t('ctl.senGap'), R.gap, () => sp().gap, (v) => (sp().gap = v), cmText)
    slider(podBox.kit, 'sp-senAt', t('ctl.senAt'), R.at, () => sp().at, (v) => (sp().at = v), stagger)
  }

  /** Jump to a car slider by its name, in the set for the car's class. */
  const jumpToCar = (tab: Tab, control: string) => jumpToControl({ tab, id: `cr-${isCar(design) ? design.class : 'touring'}-${control}` })

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
    const plain = isPod(design) ? STOCK_POD[design.class] : isAircraft(design) ? STOCK_AIRCRAFT[design.class] : isPlane(design) ? STOCK_PLANE[design.class] : isDrone(design) ? STOCK_DRONE[design.class] : isRecord(design) ? STOCK_RECORD[design.class] : isCar(design) ? STOCK_CAR[design.class] : isTruck(design) ? { ...FLEET_TRUCK, trailerTop: design.trailerTop } : isJumper(design) ? DEFAULT_JUMPER : isBobsled(design) ? { ...DEFAULT_BOBSLED, crew: design.crew } : isSkater(design) ? DEFAULT_SKATER : DEFAULT_CYCLIST
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
    const trucking = isTruck(design)
    const racing = isCar(design)
    const recording = isRecord(design)
    const flying = isDrone(design)
    const surveying = isPlane(design)
    const piloting = isAircraft(design)
    const podding = isPod(design)
    const riding = !skating && !jumping && !sliding && !trucking && !racing && !recording && !flying && !surveying && !piloting && !podding
    for (const b of Object.values(cycBox)) b.hidden = !riding
    for (const b of Object.values(skBox)) b.hidden = !skating
    for (const b of Object.values(jpBox)) b.hidden = !jumping
    for (const b of Object.values(bsBox)) b.hidden = !sliding
    for (const b of Object.values(tkBox)) b.hidden = !trucking
    for (const cls of ['touring', 'open'] as const) for (const b of Object.values(crBox[cls])) b.hidden = !(isCar(design) && design.class === cls)
    for (const cls of ['streamliner', 'jet'] as const) for (const b of Object.values(rcBox[cls])) b.hidden = !(isRecord(design) && design.class === cls)
    for (const b of Object.values(dnBox)) b.hidden = !flying
    for (const b of Object.values(plBox)) b.hidden = !surveying
    for (const b of Object.values(acBox)) b.hidden = !piloting
    for (const b of Object.values(podBox)) b.hidden = !podding
    for (const b of bodyBoxes) b.hidden = jumping || sliding || trucking || racing || recording || flying || surveying || piloting || podding
    for (const b of droneBoxes) b.hidden = !flying
    for (const b of planeBoxes) b.hidden = !surveying
    for (const b of aircraftBoxes) b.hidden = !piloting
    for (const b of podBoxes) b.hidden = !podding
    for (const b of carBoxes) b.hidden = !racing
    for (const b of recBoxes) b.hidden = !recording
    for (const b of truckBoxes) b.hidden = !trucking
    for (const b of jumpBoxes) b.hidden = !jumping
    for (const b of bobBoxes) b.hidden = !sliding
    tabButtons.position.textContent = t(podding ? 'tab.noseTail' : piloting ? 'tab.noseWheels' : trucking ? 'tab.cab' : racing ? 'tab.floor' : recording || surveying ? 'tab.body' : flying ? 'tab.pod' : 'tab.position')
    tabButtons.kit.textContent = t(podding ? 'tab.pylon' : piloting ? 'tab.wingPod' : sliding ? 'tab.sled' : trucking ? 'tab.trailer' : racing ? 'tab.wings' : recording ? 'tab.finWheels' : flying ? 'tab.arms' : surveying ? 'tab.camera' : 'tab.kit')
    // Only riders have a bike: the tab goes for the others, and the sheet falls back to Position if it was open.
    tabButtons.bike.hidden = !riding
    if (!riding && currentTab === 'bike') selectTab('position')
    tailRow.hidden = cyc().helmet.kind !== 'aero'
    hint.textContent = t(podding ? 'hint.shapePod' : piloting ? 'hint.shapeAircraft' : surveying ? 'hint.shapePlane' : flying ? 'hint.shapeDrone' : recording ? (rec('jet') === design ? 'hint.shapeRecordJet' : 'hint.shapeRecord') : racing ? 'hint.shapeCar' : trucking ? 'hint.shapeTruck' : jumping ? 'hint.shapeJumper' : sliding ? 'hint.shapeBobsled' : skating ? 'hint.shapeSkater' : 'hint.shape')
    if (riding || skating) rulesR.sub.textContent = skating ? t('book.skating') : bookName(rulesFor(careerStore.get().job?.brief.id))
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
    if (isPod(design)) {
      // A sensor pod's fixes (PR 10z): the pylon's gap if named, otherwise the tail cone (what most often buffets).
      jumpToControl(where === 'senGap' ? { tab: 'kit', id: 'sp-senGap' } : { tab: 'position', id: 'sp-senTail' })
      return
    }
    if (isAircraft(design)) {
      // A kit plane's fixes (PR 10q): the part named, otherwise the wingtips (what most often lifts the stall speed).
      const ids: Partial<Record<FixTarget, { tab: Tab; id: string }>> = {
        acPodAt: { tab: 'kit', id: 'ac-acPodAt' },
        strutToe: { tab: 'kit', id: 'ac-strutToe' },
        acCowling: { tab: 'position', id: 'ac-acCowling' },
        spats: { tab: 'position', id: 'ac-spats' },
      }
      jumpToControl(ids[where] ?? { tab: 'kit', id: 'ac-wingtips' })
      return
    }
    if (isPlane(design)) {
      // A survey drone's fixes (PR 10j): the camera's drop or slide, the winglets or the nose if named, otherwise the tail.
      if (where === 'cameraDrop') jumpToControl({ tab: 'kit', id: 'pl-cameraDrop' })
      else if (where === 'cameraAt') jumpToControl({ tab: 'kit', id: 'pl-cameraAt' })
      else if (where === 'winglets') jumpToControl({ tab: 'kit', id: 'pl-winglets' })
      else if (where === 'planeNose') jumpToControl({ tab: 'position', id: 'pl-planeNose' })
      else jumpToControl({ tab: 'position', id: 'pl-tailSize' })
      return
    }
    if (isDrone(design)) {
      // A quad's fixes (PR 10b): the vents for heat, the fairings for the arms, the length if named, otherwise the pod's rake.
      if (where === 'podVents') jumpToControl({ tab: 'position', id: 'dn-podVents' })
      else if (where === 'armFairings') jumpToControl({ tab: 'kit', id: 'dn-armFairings' })
      else if (where === 'podLength') jumpToControl({ tab: 'position', id: 'dn-podLength' })
      else jumpToControl({ tab: 'position', id: 'dn-podRake' })
      return
    }
    if (isRecord(design)) {
      // A record car's fixes (PR 9q): the fin when it wandered, the canopy when the driver couldn't see, otherwise the nose's droop.
      if (where === 'fin') jumpToControl({ tab: 'kit', id: rcId('fin') })
      else if (where === 'canopy') jumpToControl({ tab: 'position', id: rcId('canopy') })
      else if (where === 'waist') jumpToControl({ tab: 'position', id: rcId('waist') })
      else jumpToControl({ tab: 'position', id: rcId('noseDroop') })
      return
    }
    if (isCar(design)) {
      // A car's fixes (PR 9j): the ride height for the floor, the inlets for heat, a wing for the balance.
      if (where === 'inlet') jumpToCar('kit', 'inlet')
      else if (where === 'frontWing') jumpToCar('kit', 'frontWing')
      else if (where === 'rearWing') jumpToCar('kit', 'rearAngle')
      else jumpToCar('position', 'rideFront')
      return
    }
    if (isTruck(design)) {
      // A truck's fixes (PR 9f): the boat-tail when the road code cut it back, otherwise the skirts.
      jumpToControl({ tab: 'kit', id: where === 'boatTail' ? 'tk-boatTail' : 'tk-skirts' })
      return
    }
    if (isBobsled(design)) {
      // A sled's fixes: the crew's tuck for anything about the crew, otherwise the cowling.
      if (where === 'helmet' || where === 'headDrop' || where === 'tuck') jumpToControl({ tab: 'position', id: 'bs-tuck' })
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

  // The PIV's "Change this" (PR 10ah) names a slider by its control id; each
  // sport's sliders carry a prefix (a car's and a record car's their class too).
  window.addEventListener('laminar:control', (e) => {
    const control = (e as CustomEvent<ControlId>).detail
    const id = controlDomId(design, control)
    const node = id ? document.getElementById(id) : null
    const panel = node?.closest<HTMLElement>('[id^="panel-"]')
    if (!node || !panel) return
    jumpToControl({ tab: panel.id.slice('panel-'.length) as Tab, id: node.id })
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
    if (isTruck(design)) {
      showTruck(design)
      return
    }
    if (isCar(design)) {
      showCar(design)
      return
    }
    if (isRecord(design)) {
      showRecord(design)
      return
    }
    if (isDrone(design)) {
      showDrone(design)
      return
    }
    if (isPlane(design)) {
      showPlane(design)
      return
    }
    if (isAircraft(design)) {
      showAircraft(design)
      return
    }
    if (isPod(design)) {
      showPod(design)
      return
    }
    // The job's own rulebook: the TCF's at home, the country's federation abroad (PR 11g).
    const rules = rulesFor(careerStore.get().job?.brief.id)
    const r = designReadouts(design, rules)
    const shape = designShape(design)
    // The desk estimate is for the job's event, with the job's own bias.
    const career = careerStore.get()
    const desk = deskEstimate(shape, currentEvent(career), career.job?.brief.seed ?? DESK.demoJobSeed, JSON.stringify(design), firmEffects(career).deskLevel)
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
        li.append(el('span', 'break-text', t(`rule.${b.rule}`, { value: show(b.value), limit: show(b.limit), book: bookName(rules) })))
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
      volumes: bike ? ruleVolumes(bike, pose, rules) : [],
    })
  }

  /** The jumper's sheet (PR 8d): the desk's reference jump, lift area and L/D, and the stability margin against its floor. */
  function showJumper(jumper: JumperDesign) {
    const career = careerStore.get()
    const event = currentJumpEvent(career)
    const desk = jumpDeskEstimate(jumper, event, career.job?.brief.seed ?? DESK.demoJobSeed, JSON.stringify(jumper), firmEffects(career).deskLevel)
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
    const desk = bobDeskEstimate(sled, track, career.job?.brief.seed ?? DESK.demoJobSeed, JSON.stringify(sled), firmEffects(career).deskLevel)
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

  /**
   * The truck's sheet (PR 9b): the desk's fuel saving on the client's route
   * against the truck they run now, the drag area straight on and in a
   * crosswind, what the parts weigh and cost, and the road code's limits
   * with a "change this" for each break.
   */
  function showTruck(truck: TruckDesign) {
    const career = careerStore.get()
    const job = career.job
    // Their route and their truck as it runs today: the job's, or the fleet's plain rig on the Mostograd run between jobs.
    const { route, old } = currentTruckRun(career, truck.trailerTop)
    const desk = truckDeskEstimate(truck, old, route, job?.brief.seed ?? DESK.demoJobSeed, JSON.stringify(truck), firmEffects(career).deskLevel)
    const signed = (v: number, digits: number) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), digits)}`
    truckDeskR.value.textContent = `${signed(desk.value, 1)} %`
    truckDeskR.sub.textContent = t('read.deskTruckNote', { spread: fixed((desk.high - desk.low) / 2, 1), fuel: fixed(desk.fuel, 1) })
    truckDragR.value.textContent = `${fixed(desk.cdA, 2)} m²`
    // A fairing that misses the trailer's roof says so; otherwise the drag in a crosswind, where the gap and underside bite.
    const miss = roofMismatch(truck)
    const missCm = fixed(Math.abs(miss) * 100, 0)
    truckDragR.sub.textContent =
      miss < -FAIRING_MISS ? t('read.fairingShort', { cm: missCm }) : miss > FAIRING_MISS ? t('read.fairingOver', { cm: missCm }) : t('read.truckDragNote', { yaw: fixed(desk.cdA10, 2) })
    const parts = truckParts(truck)
    partsR.value.textContent = `${fixed(parts.mass, 0)} kg`
    partsR.sub.textContent = t('read.partsNote', { price: fixed(parts.price, 0) })

    const rules = checkTruckRules(truck)
    rulesR.value.textContent = rules.length === 0 ? t('read.legal') : rules.length === 1 ? t('read.oneBreak') : t('read.breaks', { count: rules.length })
    rulesR.value.classList.toggle('over', rules.length > 0)
    rulesR.sub.textContent = t('read.truckKit', { length: fixed(truckLength(truck), 1), gap: fixed(skirtGap(truck), 2) })
    breaks.replaceChildren(
      ...rules.map((b) => {
        const li = el('li', 'break')
        const key = b.rule === 'tail' ? 'rule.truckTail' : 'rule.truckSkirts'
        li.append(el('span', 'break-text', t(key, { value: fixed(b.value, 2), limit: fixed(b.limit, 2), book: t('book.road') })))
        const fix = el('button', 'break-fix', t('rule.fix'))
        fix.type = 'button'
        fix.addEventListener('click', () => jumpToControl({ tab: 'kit', id: TRUCK_BREAK[b.part].id }))
        li.append(fix)
        return li
      }),
    )
    // Skirts too low for the client's gravel yard (PR 9g): legal on the road, but they'd crack there.
    const gravel = job !== null && cracksOnGravel(roadLegal(truck), currentTruckEvent(career))
    if (gravel) {
      const li = el('li', 'break warn')
      const client = briefTemplate(job.brief.id)?.client ?? ''
      li.append(el('span', 'break-text', t('rule.gravel', { client, limit: fixed(GRAVEL_YARD.minSkirtGap, 2), value: fixed(skirtGap(roadLegal(truck)), 2) })))
      const fix = el('button', 'break-fix', t('rule.fix'))
      fix.type = 'button'
      fix.addEventListener('click', () => jumpToControl({ tab: 'kit', id: TRUCK_BREAK['trailer.skirts'].id }))
      li.append(fix)
      breaks.append(li)
    }
    view.show({
      design: truck,
      pose: designPose(truck),
      // A part outside the road code glows red; a fairing that misses the trailer's roof, or skirts too low for a gravel yard, amber.
      broken: rules.map((b) => TRUCK_BREAK[b.part].look),
      strained: [...(Math.abs(miss) > FAIRING_MISS ? (['fairing'] as const) : []), ...(gravel ? (['skirts'] as const) : [])],
      handles: [],
      selected: null,
      volumes: [],
    })
  }

  /**
   * The racing car's sheet (PR 9j): the desk's lap-time gain on the circuit
   * against the car the team runs now, the downforce and drag at 200 km/h,
   * the balance against the drivers' window, and the Motor Racing
   * Federation's rule box. Porpoising, heat and a balance out of the window
   * are amber warnings with a "change this" each.
   */
  function showCar(c: CarDesign) {
    const career = careerStore.get()
    // The team's circuit and their car as it runs today: the job's, or a middling car at the Dolgo Ring between jobs.
    const { circuit, old } = currentCarRun(career, c.class)
    const desk = carDeskEstimate(c, old, circuit, career.job?.brief.seed ?? DESK.demoJobSeed, JSON.stringify(c), firmEffects(career).deskLevel)
    const signed = (v: number, digits: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fixed(Math.abs(v), digits)}`
    carDeskR.value.textContent = `${signed(desk.value, 2)} s`
    carDeskR.sub.textContent = t('read.deskCarNote', { spread: fixed((desk.high - desk.low) / 2, 2), circuit: t(`circuit.${circuit.id}`) })
    carDownR.value.textContent = `${fixed(desk.downKg, 0)} kg`
    carDownR.sub.textContent = t('read.carDownNote', { cda: fixed(desk.cdA, 2) })
    const w = CAR_CLASS[c.class].window
    const low = fixed(w.low * 100, 0)
    const high = fixed(w.high * 100, 0)
    const balPct = fixed(desk.balance * 100, 0)
    const balState = desk.balance < w.low ? 'low' : desk.balance > w.high ? 'high' : 'ok'
    carBalR.value.textContent = `${balPct} %`
    carBalR.value.classList.toggle('warn', balState !== 'ok')
    carBalR.sub.textContent = t(balState === 'low' ? 'read.carBalanceLow' : balState === 'high' ? 'read.carBalanceHigh' : 'read.carBalanceOk', { low, high })

    const rules = checkCarRules(c)
    rulesR.value.textContent = rules.length === 0 ? t('read.legal') : rules.length === 1 ? t('read.oneBreak') : t('read.breaks', { count: rules.length })
    rulesR.value.classList.toggle('over', rules.length > 0)
    const density = circuitDensity(circuit)
    const fast = carAero(c, CAR_DESK.readSpeed, density)
    rulesR.sub.textContent = t('read.carKit', { plank: fixed(Math.min(fast.front, fast.rear) * 100, 1) })
    const cmOf = (v: number) => fixed(v * 100, 1)
    breaks.replaceChildren(
      ...rules.map((b) => {
        const li = el('li', 'break')
        li.append(el('span', 'break-text', t(`rule.${b.rule}`, { value: cmOf(b.value), limit: cmOf(b.limit), book: t('book.tmrf') })))
        const fix = el('button', 'break-fix', t('rule.fix'))
        fix.type = 'button'
        fix.addEventListener('click', () => jumpToCar(CAR_BREAK[b.part].tab, CAR_BREAK[b.part].control))
        li.append(fix)
        return li
      }),
    )
    // Warnings, in amber: legal, but they cost the lap.
    const warn = (text: string, tab: Tab, control: string) => {
      const li = el('li', 'break warn')
      li.append(el('span', 'break-text', text))
      const fix = el('button', 'break-fix', t('rule.fix'))
      fix.type = 'button'
      fix.addEventListener('click', () => jumpToCar(tab, control))
      li.append(fix)
      breaks.append(li)
    }
    const porpoise = porpoiseSpeed(c, density)
    const strained: Highlight[] = []
    if (porpoise !== null) {
      warn(t('rule.porpoise', { speed: fixed(porpoise * 3.6, 0) }), 'position', 'rideFront')
      strained.push('floor')
    }
    const heat = heatLoss(c)
    if (heat > 0) {
      warn(t('rule.heat', { pct: fixed(heat * 100, 0) }), 'kit', 'inlet')
      strained.push('inlet')
    }
    if (balState !== 'ok') {
      warn(t('rule.balance', { pct: balPct, low, high }), 'kit', balState === 'low' ? 'frontWing' : 'rearAngle')
      strained.push(balState === 'low' ? 'front-wing' : 'rear-wing')
    }
    view.show({
      design: c,
      pose: designPose(c),
      broken: rules.map((b) => CAR_BREAK[b.part].look),
      strained,
      handles: [],
      selected: null,
      volumes: [],
    })
  }

  /**
   * The record car's sheet (PR 9q): the desk's record speed on the salt's
   * usual day against the team's car, how much of the nose's weight it
   * keeps at top speed with a moderate headwind, and the crosswind it holds
   * straight in. A light nose, a wander, a low canopy and the air starting
   * to squeeze are amber warnings with a "change this" each.
   */
  function showRecord(r: RecordDesign) {
    const career = careerStore.get()
    const { flat, old } = currentRecordRun(career, r.class)
    const desk = recordDeskEstimate(r, old, flat, career.job?.brief.seed ?? DESK.demoJobSeed, JSON.stringify(r), firmEffects(career).deskLevel)
    const kmh = (v: number) => fixed(v * 3.6, 0)
    const oldText = desk.old === null ? t('read.recordChutes') : `${kmh(desk.old)} km/h`
    if (desk.value === null) {
      recDeskR.value.textContent = t('read.recordChutes')
      recDeskR.sub.textContent = t('read.recordChutesNote')
    } else {
      recDeskR.value.textContent = `${kmh(desk.value)} km/h`
      const spread = desk.low !== null && desk.high !== null ? (desk.high - desk.low) / 2 : 0
      recDeskR.sub.textContent =
        r.class === 'jet' ? t('read.deskRecordNoteJet', { mach: fixed(desk.topMach, 2), spread: kmh(spread), old: oldText }) : t('read.deskRecordNote', { spread: kmh(spread), old: oldText })
    }
    recDeskR.value.classList.toggle('warn', desk.value === null)
    const kept = Math.max(0, desk.noseKept)
    noseR.value.textContent = `${fixed(kept * 100, 0)} %`
    noseR.sub.textContent = t('read.noseWeightNote', { speed: kmh(desk.top) })
    noseR.value.classList.toggle('warn', kept < RECORD_DESK.liftWarn)
    const held = crossHeld(r)
    const margin = sideCentre(r).margin
    straightR.value.textContent = held > 0 ? t('read.straightHolds', { cross: fixed(held, 1) }) : t('read.straightWanders')
    straightR.sub.textContent = margin > 0 ? t('read.straightNote', { pct: fixed(margin * 100, 1) }) : t('read.straightAhead')
    straightR.value.classList.toggle('warn', held < flat.spread.cross * 2)
    rulesR.value.textContent = t('read.recordRules')
    rulesR.value.classList.remove('over')
    rulesR.sub.textContent = t('read.recordRulesNote')

    // Warnings, in amber: each costs the record, or the run.
    breaks.replaceChildren()
    const strained: Highlight[] = []
    const warn = (text: string, id: string, tab: Tab, look: Highlight) => {
      const li = el('li', 'break warn')
      li.append(el('span', 'break-text', text))
      const fix = el('button', 'break-fix', t('rule.fix'))
      fix.type = 'button'
      fix.addEventListener('click', () => jumpToControl({ tab, id }))
      li.append(fix)
      breaks.append(li)
      if (!strained.includes(look)) strained.push(look)
    }
    if (desk.noseLight) warn(t('rule.noseLight', { speed: kmh(desk.noseLight.speed) }), rcId('noseDroop'), 'position', 'nose')
    else if (kept < RECORD_DESK.liftWarn) warn(t('rule.noseClose', { pct: fixed(kept * 100, 0) }), rcId('noseDroop'), 'position', 'nose')
    if (held <= 0) warn(t('rule.wander'), rcId('fin'), 'kit', 'fin')
    else if (held < flat.spread.cross * 2) warn(t('rule.crossLow', { cross: fixed(held, 1) }), rcId('fin'), 'kit', 'fin')
    const blind = sightLoss(r)
    if (blind > 0) warn(t('rule.sight', { pct: fixed(blind * 100, 0) }), rcId('canopy'), 'position', 'canopy')
    if (r.class === 'jet') {
      // A jet car (PR 9x): pinched past the engine's room it loses thrust; short of the barrier, the waist and a finer nose help.
      if (thrustKept(r) < 1) warn(t('rule.waistEngine', { pct: fixed((1 - thrustKept(r)) * 100, 0) }), rcId('waist'), 'position', 'waist')
      else if (desk.topMach < 1) warn(t('rule.barrier', { mach: fixed(desk.topMach, 2) }), rcId('waist'), 'position', 'waist')
    } else if (desk.top > desk.squeeze) warn(t('rule.squeeze', { speed: kmh(desk.squeeze) }), rcId('noseLength'), 'position', 'nose')
    view.show({
      design: r,
      pose: designPose(r),
      broken: [],
      strained,
      handles: [],
      selected: null,
      volumes: [],
    })
  }

  /**
   * The racing quad's sheet (PR 10b): the desk's race time at the club's
   * course against the club's quad, its top speed and the tilt it flies at
   * (and the angle its pod meets the air there), and the hardest the air
   * twists it over the race against what its motors hold. A tumble, a twist
   * close to the limit and closed vents are amber warnings with a "change
   * this" each. The quad is drawn tilted as it flies flat out.
   */
  /**
   * The sensor pod's sheet (PR 10z): the desk's hours on station
   * against the ministry's plane with its old pod, and the buffet against
   * the ministry's limit, with an amber warning and a "change this" to the
   * tail cone or the pylon's gap, whichever shakes it more.
   */
  function showPod(p: PodDesign) {
    const career = careerStore.get()
    const { range, old, oldSensor } = currentPodRun(career, p.class)
    const desk = podDeskEstimate(p, old, range, career.job?.brief.seed ?? DESK.demoJobSeed, JSON.stringify(p), firmEffects(career).deskLevel, oldSensor)
    podDeskR.value.textContent = `${fixed(desk.value, 2)} h`
    podDeskR.sub.textContent = t(oldSensor === 'new' ? 'read.deskPodNoteJob' : 'read.deskPodNote', { spread: fixed(((desk.high - desk.low) / 2) * 60, 0), old: fixed(desk.old, 2) })
    const b = desk.buffet
    const limit = fixed(POD_BUFFET.limit, 2)
    const close = b.index > POD_BUFFET.limit - POD_DESK.buffetClose
    buffetR.value.textContent = fixed(b.index, 2)
    buffetR.value.classList.toggle('warn', close)
    buffetR.sub.textContent = t('read.buffetNote', { limit, mass: fixed(desk.mass, 0) })
    rulesR.value.textContent = t(b.blurs ? 'read.blurs' : 'read.steady')
    rulesR.value.classList.toggle('over', b.blurs)
    rulesR.sub.textContent = t('read.steadyNote')

    // Warnings, in amber: a pod that blurs the sensor fails its range trials whatever its hours.
    breaks.replaceChildren()
    const strained: Highlight[] = []
    if (close) {
      const gap = b.cause === 'gap'
      const li = el('li', 'break warn')
      li.append(el('span', 'break-text', t(!b.blurs ? 'rule.buffetClose' : gap ? 'rule.buffetGap' : 'rule.buffetTail', { index: fixed(b.index, 2), limit })))
      const btn = el('button', 'break-fix', t('rule.fix'))
      btn.type = 'button'
      btn.addEventListener('click', () => jumpToControl(gap ? { tab: 'kit', id: 'sp-senGap' } : { tab: 'position', id: 'sp-senTail' }))
      li.append(btn)
      breaks.append(li)
      strained.push(gap ? 'pylon' : 'boat-tail')
    }
    view.show({ design: p, pose: designPose(p), broken: [], strained, handles: [], selected: null, volumes: [] })
  }

  /**
   * The kit plane's sheet (PR 10q): the desk's cruise speed over the
   * client's airfield against their plane as they fly it, and the stall speed
   * against the certified one (and its weight). A stall speed over the
   * certified one, or close to it, is an amber warning with a "change this"
   * to the tips or the pod, whichever lifted it more.
   */
  function showAircraft(p: AircraftDesign) {
    const career = careerStore.get()
    const { field, old } = currentAircraftRun(career, p.class)
    const desk = aircraftDeskEstimate(p, old, field, career.job?.brief.seed ?? DESK.demoJobSeed, JSON.stringify(p), firmEffects(career).deskLevel)
    acDeskR.value.textContent = `${fixed(desk.value, 0)} km/h`
    acDeskR.sub.textContent = t('read.deskAircraftNote', { spread: fixed((desk.high - desk.low) / 2, 0), old: fixed(desk.old, 0) })
    const close = desk.stall > desk.limit - AIRCRAFT_DESK.stallClose
    stallR.value.textContent = `${fixed(desk.stall, 1)} km/h`
    stallR.value.classList.toggle('warn', close)
    stallR.sub.textContent = t('read.stallNote', { limit: fixed(desk.limit, 0), mass: fixed(desk.mass, 0) })
    rulesR.value.textContent = t(desk.passes ? 'read.signsOff' : 'read.noSignOff')
    rulesR.value.classList.toggle('over', !desk.passes)
    rulesR.sub.textContent = t('read.signOffNote', { limit: fixed(desk.limit, 0) })

    // Warnings, in amber: a mod the inspector won't sign off gains nothing.
    breaks.replaceChildren()
    const strained: Highlight[] = []
    const fix = stallFix(p)
    const id = fix === 'acPodAt' ? 'ac-acPodAt' : 'ac-wingtips'
    const look: Highlight = fix === 'acPodAt' ? 'pod' : 'wingtips'
    if (close) {
      const li = el('li', 'break warn')
      li.append(el('span', 'break-text', t(desk.passes ? 'rule.stallClose' : 'rule.stallOver', { stall: fixed(desk.stall, 1), limit: fixed(desk.limit, 0) })))
      const btn = el('button', 'break-fix', t('rule.fix'))
      btn.type = 'button'
      btn.addEventListener('click', () => jumpToControl({ tab: 'kit', id }))
      li.append(btn)
      breaks.append(li)
      strained.push(look)
    }
    view.show({ design: p, pose: designPose(p), broken: [], strained, handles: [], selected: null, volumes: [] })
  }

  /**
   * The survey drone's sheet (PR 10j): the desk's range on a charge at the
   * client's site against their plane as sold, how firmly it holds its nose
   * (and its weight), and the strongest gust it rides out on a turn against
   * the site's usual one. A gust stall, a gust close to the limit, a nose
   * held loosely and a camera that sees the belly are amber warnings with a
   * "change this" each.
   */
  function showPlane(p: PlaneDesign) {
    const career = careerStore.get()
    const { site, old } = currentPlaneRun(career, p.class)
    const desk = planeDeskEstimate(p, old, site, career.job?.brief.seed ?? DESK.demoJobSeed, JSON.stringify(p), firmEffects(career).deskLevel)
    const kmh = (v: number) => fixed(v * 3.6, 0)
    plDeskR.value.textContent = `${fixed(desk.value, 0)} km`
    plDeskR.sub.textContent = t('read.deskPlaneNote', { spread: fixed((desk.high - desk.low) / 2, 0), old: fixed(desk.old, 0) })
    plMarginR.value.textContent = `${fixed(desk.margin * 100, 1)} %`
    plMarginR.value.classList.toggle('warn', desk.margin < PLANE_GUST.steady)
    plMarginR.sub.textContent = t('read.planeMarginNote', { mass: fixed(desk.mass, 2) })
    const close = desk.gustLimit < desk.gust * PLANE_DESK.gustClose
    gustR.value.textContent = desk.gustLimit <= 0 ? t('read.gustNone') : `${kmh(desk.gustLimit)} km/h`
    gustR.value.classList.toggle('warn', close)
    gustR.sub.textContent = t('read.gustTurnNote', { gust: kmh(desk.gust), bank: fixed(PLANE_CLASS[p.class].bank, 0) })
    rulesR.value.textContent = t(desk.cameraHigh ? 'read.cameraHigh' : 'read.cameraClear')
    rulesR.value.classList.toggle('over', desk.cameraHigh)
    rulesR.sub.textContent = t('read.cameraRuleNote', { pct: fixed(PLANE_CLASS[p.class].cameraMinDrop * 100, 0) })

    // Warnings, in amber: each costs the range, or the plane.
    breaks.replaceChildren()
    const strained: Highlight[] = []
    const warn = (text: string, id: string, tab: Tab, look: Highlight) => {
      const li = el('li', 'break warn')
      li.append(el('span', 'break-text', text))
      const fix = el('button', 'break-fix', t('rule.fix'))
      fix.type = 'button'
      fix.addEventListener('click', () => jumpToControl({ tab, id }))
      li.append(fix)
      breaks.append(li)
      if (!strained.includes(look)) strained.push(look)
    }
    if (desk.stalls) warn(t('rule.gustStall', { gust: kmh(desk.gust), limit: kmh(desk.gustLimit) }), 'pl-tailSize', 'position', 'fin')
    else if (close) warn(t('rule.gustClose', { limit: kmh(desk.gustLimit), gust: kmh(desk.gust) }), 'pl-tailSize', 'position', 'fin')
    if (!desk.stalls && desk.margin < PLANE_GUST.steady) warn(t('rule.marginLow', { pct: fixed(desk.margin * 100, 1) }), 'pl-tailSize', 'position', 'fin')
    if (desk.cameraHigh) warn(t('rule.cameraHigh', { pct: fixed(PLANE_CLASS[p.class].cameraMinDrop * 100, 0) }), 'pl-cameraDrop', 'kit', 'pod')
    view.show({ design: p, pose: designPose(p), broken: [], strained, handles: [], selected: null, volumes: [] })
  }

  function showDrone(q: DroneDesign) {
    const career = careerStore.get()
    const { course, old } = currentDroneRun(career, q.class)
    const desk = droneDeskEstimate(q, old, course, career.job?.brief.seed ?? DESK.demoJobSeed, JSON.stringify(q), firmEffects(career).deskLevel)
    const kmh = (v: number) => fixed(v * 3.6, 0)
    const signedDeg = (v: number) => `${v > 0.5 ? '+' : v < -0.5 ? '−' : ''}${fixed(Math.abs(v), 0)}`
    const oldText = desk.old === null ? t('read.droneTumbles') : `${fixed(desk.old, 1)} s`
    if (desk.value === null) {
      dnDeskR.value.textContent = t('read.droneTumbles')
      dnDeskR.sub.textContent = t('read.droneTumblesNote', { speed: kmh(desk.tumble?.speed ?? 0) })
    } else {
      dnDeskR.value.textContent = `${fixed(desk.value, 1)} s`
      const spread = desk.low !== null && desk.high !== null ? (desk.high - desk.low) / 2 : 0
      dnDeskR.sub.textContent = t('read.deskDroneNote', { spread: fixed(spread, 1), old: oldText })
    }
    dnDeskR.value.classList.toggle('warn', desk.value === null)
    dnTopR.value.textContent = `${kmh(desk.top)} km/h`
    dnTopR.sub.textContent = t('read.droneTopNote', { tilt: fixed((desk.tilt * 180) / Math.PI, 0), angle: signedDeg(desk.podAngle) })
    const share = desk.twist.share
    twistR.value.textContent = `${fixed(Math.min(share, 9.99) * 100, 0)} %`
    twistR.sub.textContent = t('read.twistNote', { speed: kmh(desk.twist.speed), when: t(desk.twist.braking ? 'read.twistBraking' : 'read.twistFlying') })
    twistR.value.classList.toggle('warn', share >= DRONE_DESK.twistWarn)
    rulesR.value.textContent = t('read.droneRules')
    rulesR.value.classList.remove('over')
    rulesR.sub.textContent = t('read.droneRulesNote', { mass: fixed(droneMass(q) * 1000, 0) })

    // Warnings, in amber: each costs the race, or the quad.
    breaks.replaceChildren()
    const strained: Highlight[] = []
    const warn = (text: string, id: string, tab: Tab, look: Highlight) => {
      const li = el('li', 'break warn')
      li.append(el('span', 'break-text', text))
      const fix = el('button', 'break-fix', t('rule.fix'))
      fix.type = 'button'
      fix.addEventListener('click', () => jumpToControl({ tab, id }))
      li.append(fix)
      breaks.append(li)
      if (!strained.includes(look)) strained.push(look)
    }
    if (desk.tumble) warn(t(desk.twist.braking ? 'rule.tumbleBraking' : 'rule.tumbleFlying', { speed: kmh(desk.tumble.speed) }), 'dn-podRake', 'position', 'pod')
    else if (share >= DRONE_DESK.twistWarn) warn(t('rule.twistClose', { pct: fixed(share * 100, 0) }), 'dn-podRake', 'position', 'pod')
    if (desk.hotAt !== null) warn(t('rule.droneHot', { at: fixed(desk.hotAt, 0), pct: fixed(desk.heat * 100, 0) }), 'dn-podVents', 'position', 'vents')
    // Drawn as it truly flies flat out (the sim's tilt, not the desk's guess at it).
    const density = courseDensity(course)
    view.show({
      design: q,
      pose: designPose(q),
      broken: [],
      strained,
      tilt: steadyTilt(q, topSpeed(q, density), density),
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
