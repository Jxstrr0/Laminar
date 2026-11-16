/**
 * The Jobs screen (plan section 10, the brief board): the firm's money and
 * date, the job in hand with its days left, and the briefs on offer. A brief
 * is won with a sealed bid (price and promise) against one rival firm;
 * winning puts the client's current setup on the bench. Delivering runs the
 * event and pays the fee.
 */
import { BID, CAREER, PROMISE, SLED_JOBS, TRACK, type BriefTemplate } from '../data/briefs'
import { BROKE, REPUTATION } from '../data/reputation'
import { RIVALS, RIVAL_IDS } from '../data/rivals'
import { OWN_BILLING, OWN_TUNNEL_BUILD, TUNNEL_UPGRADES, UPGRADE_IDS } from '../data/tunnel'
import { buildBlock, machineBlock, ownReadyDay, upgradeBlock, upgradeReadyDay } from '../sim/facility'
import { MACHINE_IDS, MACHINE_PRICE } from '../data/model'
import { designShape, isBobsled, isJumper, isSkater, isTruck, type Design } from '../sim/design'
import type { BobsledDesign } from '../data/bobsled'
import { GRAVEL_YARD, type TruckDesign } from '../data/truck'
import { ROUTES } from '../data/routes'
import { checkTruckRules, skirtGap } from '../sim/truck'
import { asRun, cracksOnGravel, roadLegal } from '../sim/truckJob'
import { playTruckReplay } from './truckReplay'
import { PITCH, type JumperDesign } from '../data/jumper'
import { HILLS } from '../data/hills'
import { jumpForecast } from './jumpForecast'
import { sledForecast } from './sledForecast'
import { truckForecast } from './truckForecast'
import { t } from '../data/strings'
import {
  bidScore,
  biddersFor,
  briefTemplate,
  buildOwnTunnel,
  buyMachine,
  firmName,
  firmReputation,
  nameFirm,
  retire,
  hireStaff,
  letStaffGo,
  orderUpgrade,
  deliver,
  deliverJump,
  deliverSled,
  deliverTruck,
  currentTruckRun,
  eventOf,
  isJumpBrief,
  isSledBrief,
  isTruckBrief,
  truckEventOf,
  sledEventOf,
  jumpEventOf,
  placeBid,
  waitForBriefs,
  type Bid,
  type Brief,
  type BidResult,
  type Delivery,
  type JumpDelivery,
  type SledDelivery,
  type TruckDelivery,
} from '../sim/career'
import { bobDeskEstimate, deskEstimate, jumpDeskEstimate, truckDeskEstimate } from '../sim/desk'
import { crewEffects, wagesPerDay } from '../sim/staff'
import type { Sale } from '../sim/broke'
import { legacyOf } from '../sim/legacy'
import { STAFF, STAFF_IDS, STAFF_ROLES, type StaffId } from '../data/staff'
import { DESK } from '../data/cyclist'
import { correlationScore } from '../sim/reputation'
import { rivalRecord } from '../sim/rivals'
import type { FixTarget } from '../sim/failure'
import { careerStore } from './careerStore'
import { designStore } from './designStore'
import { careerDate, fixed, pct, raceTime, rubles, rublesShort, shortTime } from './format'
import { glossaryTerm } from './glossary'
import { GUIDE_STEPS, currentStep, guideOn, hideGuide, stepDone } from '../sim/guide'
import { playReplay } from './replayOverlay'
import { playJumpReplay } from './jumpReplay'
import { playSledReplay } from './sledReplay'
import { createSheet, type Sheet } from './sheet'
import { twoTap } from './twoTap'
import { bestText, shareLegacy } from './legacyPicture'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

function button(cls: string, text: string): HTMLButtonElement {
  const b = el('button', cls, text)
  b.type = 'button'
  return b
}

const km = (b: BriefTemplate) => b.event.course.reduce((s, c) => s + c.length, 0) / 1000
/** The eight compass points, north first, for where a truck's wind blew from. */
const COMPASS = ['compass.0', 'compass.1', 'compass.2', 'compass.3', 'compass.4', 'compass.5', 'compass.6', 'compass.7'] as const
/** A truck route's length, km. */
const routeKm = (id: keyof typeof ROUTES) => ROUTES[id].legs.reduce((s, l) => s + l.length, 0) / 1000

/** A number box between − and + buttons (the Deliver and bid sheets). */
function stepper(id: string, value: string, unit: string, less: string, more: string, onStep: (dir: -1 | 1) => void) {
  const input = el('input', 'deliver-input')
  input.type = 'number'
  input.id = id
  input.inputMode = 'decimal'
  input.value = value
  const minus = button('save-btn quiet deliver-step', '−')
  minus.setAttribute('aria-label', less)
  minus.addEventListener('click', () => onStep(-1))
  const plus = button('save-btn quiet deliver-step', '+')
  plus.setAttribute('aria-label', more)
  plus.addEventListener('click', () => onStep(1))
  const row = el('div', 'deliver-row')
  row.append(minus, input, el('span', 'deliver-unit', unit), plus)
  return { row, input }
}

/** A label and a value, side by side in a card's facts grid. */
function fact(label: string | HTMLElement, value: string): HTMLElement {
  const box = el('div', 'job-fact')
  const name = el('span', 'job-fact-label')
  name.append(label)
  box.append(name, el('span', 'job-fact-value', value))
  return box
}

/** A promise in points as seconds off a bobsled run (a point is a tenth of a second): 5.7 → "0.57". */
const seconds = (n: number) => fixed(n * SLED_JOBS.pointSeconds, 2)

/** A promise in its own units: −x % drag, +x m on a ski jump, −x s off a bobsled run, or −x % fuel for a truck. */
function promiseText(id: string, n: number): string {
  if (isSledBrief(id)) return t('board.promiseSled', { s: seconds(n) })
  if (isTruckBrief(id)) return t('board.promiseTruck', { pct: pct(n) })
  return isJumpBrief(id) ? t('board.promiseJump', { m: pct(n) }) : t('board.promiseValue', { pct: pct(n) })
}

/** A change in reputation, signed: "+6", "−4", "±0". */
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `\u2212${-n}` : '\u00b10')

export interface BoardControl {
  setActive(active: boolean): void
}

/** `go` switches screens (the job card's "Shape the position" button). */
export function startBoardScreen(host: HTMLElement, go: (screen: 'shape') => void): BoardControl {
  host.classList.add('board-screen')
  const header = el('header', 'top-bar')
  const titleBlock = el('div', 'title-block')
  titleBlock.append(el('h1', 'wordmark', t('game.title')), el('p', 'place', t('board.place')))
  header.append(titleBlock)
  const page = el('main', 'board-page')
  host.append(header, page)

  let active = false
  let dirty = true
  /** The player tapped Rename on the firm strip. */
  let renaming = false
  careerStore.subscribe(() => {
    dirty = true
    if (active) render()
  })

  // --- Delivering: declare a prediction, then race day and the debrief.
  let deliverSheet: Sheet | null = null
  let result: Sheet | null = null

  /** The Deliver sheet: the promise, the design's desk estimate, and your declared CdA. */
  function openDeliver() {
    const career = careerStore.get()
    const job = career.job
    if (!job) return
    deliverSheet ??= createSheet({ cls: 'deliver', title: t('deliver.title'), closeLabel: t('deliver.close') })
    const bench = designStore.get()
    // A ski-jump job declares a distance instead (winning one puts a jumper on the bench).
    if (isJumpBrief(job.brief.id)) {
      if (isJumper(bench)) openDeliverJump(bench)
      return
    }
    // A bobsled job declares a run time.
    if (isSledBrief(job.brief.id)) {
      openDeliverSled(bench)
      return
    }
    // A truck job declares a fuel figure.
    if (isTruckBrief(job.brief.id)) {
      openDeliverTruck(bench)
      return
    }
    const b = briefTemplate(job.brief.id)!
    const design = designStore.get()
    const desk = deskEstimate(designShape(design), eventOf(job.brief), job.brief.seed, JSON.stringify(design), crewEffects(career.crew).deskLevel)
    const input = el('input', 'deliver-input')
    input.type = 'number'
    input.id = 'deliver-cda'
    input.inputMode = 'decimal'
    input.step = '0.001'
    input.min = '0.1'
    input.max = '0.6'
    input.value = fixed(desk.value, 3).replace(/,/g, '')
    const label = el('label', 'shop-label')
    label.htmlFor = input.id
    label.append(t('deliver.predict'), ' ', glossaryTerm('windAveragedCda', t('deliver.predictTerm')))
    const nudge = (d: number) => {
      const v = Number(input.value) || desk.value
      input.value = (Math.round((v + d) * 1000) / 1000).toFixed(3)
    }
    const minus = button('save-btn quiet deliver-step', '−')
    minus.setAttribute('aria-label', t('deliver.less'))
    minus.addEventListener('click', () => nudge(-0.001))
    const plus = button('save-btn quiet deliver-step', '+')
    plus.setAttribute('aria-label', t('deliver.more'))
    plus.addEventListener('click', () => nudge(0.001))
    const row = el('div', 'deliver-row')
    row.append(minus, input, el('span', 'deliver-unit', 'm²'), plus)
    const status = el('p', 'shop-note')
    status.setAttribute('aria-live', 'polite')
    const race = button('shop-order', t('deliver.race'))
    race.addEventListener('click', () => {
      const predicted = Number(input.value)
      if (!Number.isFinite(predicted) || predicted < 0.1 || predicted > 0.6) {
        status.textContent = t('deliver.bad')
        return
      }
      const design = designStore.get()
      const d = deliver(careerStore.get(), design, predicted)
      if (!d) return
      deliverSheet?.close()
      careerStore.set(d.state)
      // Race day plays out first; the debrief follows.
      replay(d, design, () => showDelivery(d, design))
    })
    deliverSheet.body.replaceChildren(
      el('p', 'shop-intro', t('deliver.intro', { client: b.client, event: b.event.name })),
      el('p', 'deliver-promise', t('deliver.promise', { pct: pct(job.promise) })),
      el('p', 'shop-note', t('deliver.promiseNote')),
      label,
      row,
      el('p', 'shop-note', t('deliver.deskNote', { desk: fixed(desk.value, 3), spread: fixed((desk.high - desk.low) / 2, 3) })),
      status,
      race,
    )
    deliverSheet.open()
  }

  /**
   * The Deliver sheet for a ski jump: the promise in metres, and the declared
   * reference jump, filled in from the tunnel's forecast for this design.
   */
  function openDeliverJump(design: JumperDesign) {
    const career = careerStore.get()
    const job = career.job
    if (!job || !deliverSheet) return
    const b = briefTemplate(job.brief.id)!
    const event = jumpEventOf(job.brief)!
    const forecast = jumpForecast.get(design, event)
    const desk = jumpDeskEstimate(design, event, job.brief.seed, JSON.stringify(design), crewEffects(career.crew).deskLevel)
    // Start from the tunnel's forecast if it flew one for this design, else the desk; never past the hill size.
    const start = Math.min(forecast ? forecast.counted : desk.value, event.hill.hs)
    const box = stepper('deliver-jump', fixed(start, 1).replace(/,/g, ''), 'm', t('deliver.lessJump'), t('deliver.moreJump'), (dir) => {
      const v = Number(box.input.value) || start
      box.input.value = (Math.round((v + dir * 0.5) * 10) / 10).toFixed(1)
    })
    box.input.step = '0.1'
    box.input.min = '20'
    box.input.max = '200'
    const label = el('label', 'shop-label', t('deliver.predictJump'))
    label.htmlFor = box.input.id
    const notes: HTMLElement[] = []
    if (forecast) {
      notes.push(el('p', 'shop-note', t('deliver.forecastNote', { distance: fixed(forecast.distance, 1), margin: fixed(forecast.minMargin * 100, 1) })))
      if (forecast.pastHs) notes.push(el('p', 'shop-note', t('deliver.forecastPast', { hs: fixed(event.hill.hs, 0) })))
      if (!forecast.covered) notes.push(el('p', 'shop-note', t('deliver.forecastWider')))
    } else notes.push(el('p', 'shop-note', t('deliver.noForecast', { desk: fixed(desk.value, 1), spread: fixed((desk.high - desk.low) / 2, 1) })))
    const status = el('p', 'shop-note')
    status.setAttribute('aria-live', 'polite')
    const go = button('shop-order', t('deliver.jump'))
    go.addEventListener('click', () => {
      const predicted = Number(box.input.value)
      if (!Number.isFinite(predicted) || predicted < 20 || predicted > 200) {
        status.textContent = t('deliver.badJump')
        return
      }
      const d = deliverJump(careerStore.get(), design, predicted)
      if (!d) return
      deliverSheet?.close()
      careerStore.set(d.state)
      // The jump plays out first; the debrief follows.
      replayJump(d, design, () => showJumpDelivery(d, design))
    })
    deliverSheet.body.replaceChildren(
      el('p', 'shop-intro', t('deliver.introJump', { client: b.client, event: b.event.name })),
      el('p', 'deliver-promise', t('deliver.promiseJump', { m: pct(job.promise) })),
      el('p', 'shop-note', t('deliver.promiseNoteJump', { floor: fixed(PITCH.floor * 100, 0), hs: fixed(event.hill.hs, 0) })),
      label,
      box.row,
      ...notes,
      status,
      go,
    )
    deliverSheet.open()
  }

  let jumpSheet: Sheet | null = null

  /** The jump replay for a delivery, then `after`. */
  function replayJump(d: JumpDelivery, design: JumperDesign, after: () => void) {
    const b = briefTemplate(d.job.brief.id)!
    void playJumpReplay({
      client: b.client,
      event: b.event.name,
      hill: d.event.hill,
      design,
      setup: b.setup as JumperDesign,
      day: d.debrief.day,
      baselineDay: d.debrief.baselineDay,
      predicted: d.debrief.predicted,
      actual: d.debrief.actual,
      onDone: after,
    })
  }

  /** Jump day: the promise judged on the reference jump, the jump on the day, and any trouble with its fix. */
  function showJumpDelivery(d: JumpDelivery, design: JumperDesign) {
    jumpSheet ??= createSheet({ cls: 'raceday', title: t('jd.title'), closeLabel: t('jd.close') })
    const b = briefTemplate(d.job.brief.id)!
    const db = d.debrief
    const hs = fixed(d.event.hill.hs, 0)
    const floor = fixed(PITCH.floor * 100, 0)
    const m = (x: number) => `${fixed(x, 1)} m`
    // A reference jump past HS shows where it would land and what counts.
    const ref = (r: JumpDelivery['debrief']['reference']) => (r.pastHs ? `${m(r.distance)} · ${t('jd.pastHs', { hs })}` : m(r.distance))
    const verdict = el(
      'p',
      `race-verdict ${db.met ? 'is-met' : 'is-missed'}`,
      db.met
        ? t('jd.kept', { got: fixed(db.achieved, 1), promised: pct(db.promised) })
        : t('jd.missed', { short: fixed(db.shortfall, 1), got: fixed(db.achieved, 1), promised: pct(db.promised) }),
    )
    const off = fixed(Math.abs(db.readError) * 100, 1)
    const facts = el('div', 'job-facts')
    facts.append(
      fact(t('jd.reference'), ref(db.reference)),
      fact(t('jd.oldReference'), ref(db.baselineReference)),
      fact(t('jd.margin'), t('jd.marginValue', { pct: fixed(db.reference.minMargin * 100, 1), floor })),
      fact(t('race.predicted'), m(db.predicted)),
      fact(t('jd.actual'), m(db.actual)),
      fact(t('race.read'), t(`race.read.${db.read}`, { pct: off, dir: t(db.readError >= 0 ? 'race.high' : 'race.low') })),
      fact(t('jd.day'), m(db.day.distance)),
      fact(t('jd.oldDay'), m(db.baselineDay.distance)),
      fact(t('race.air'), `${fixed(db.day.temperature, 0)} °C`),
      fact(t('jd.wind'), `${fixed(db.day.headwind, 1)} m/s`),
      fact(t('jd.takeoff'), `${fixed(db.day.takeoffSpeed * 3.6, 1)} km/h`),
      fact(t('race.fee'), rubles(d.job.brief.fee)),
      fact(t('race.penalty'), db.penalty ? `−${rubles(db.penalty)}` : rubles(0)),
      fact(t('race.paid'), rubles(d.paid)),
      ...(d.upkeep > 0 ? [fact(t('race.upkeep'), `−${rubles(d.upkeep)}`)] : []),
      ...(d.wages > 0 ? [fact(t('race.wages'), `−${rubles(d.wages)}`)] : []),
      fact(
        glossaryTerm('reputation', t('race.reputation')),
        t('race.repChange', { after: db.reputation.after, change: signed(db.reputation.after - db.reputation.before) }),
      ),
    )
    const parts: HTMLElement[] = [el('p', 'shop-intro', t('jd.intro', { client: b.client, event: b.event.name })), verdict, facts]
    if (db.cause) parts.push(el('p', 'shop-note', db.cause === 'pitch' ? t('jd.causePitch', { floor }) : t('jd.causeDesign')))
    // Trouble in the air, with a "change this" jump to the suit on Shape (plan section 7).
    if (db.trouble) {
      const box = el('div', 'race-trouble')
      const fix = button('save-btn quiet', t('jd.fix'))
      const target = db.trouble.fix
      fix.addEventListener('click', () => {
        jumpSheet?.close()
        go('shape')
        window.dispatchEvent(new CustomEvent<FixTarget>('laminar:fix', { detail: target }))
      })
      const text = t(db.trouble.kind === 'pitch' ? 'jd.pitch' : 'jd.wobble', { client: b.client, m: fixed(db.trouble.lost, 1) })
      box.append(el('p', 'race-trouble-text', text), fix)
      parts.push(box)
    } else if (db.day.trouble === 'long') parts.push(el('p', 'shop-note', t('jd.long', { client: b.client, hs })))
    parts.push(el('p', 'shop-note', t('jd.readNote')))
    if (d.sale) parts.push(brokeBox(d.sale, d.state.money))
    if (d.state.ended) parts.push(el('p', 'save-due', t('end.reached')))
    const again = button('save-btn quiet', t('race.replay'))
    again.addEventListener('click', () => {
      jumpSheet?.close()
      replayJump(d, design, () => showJumpDelivery(d, design))
    })
    parts.push(again)
    jumpSheet.body.replaceChildren(...parts)
    jumpSheet.open()
  }

  /** Run times in the sled sheets: hundredths, as the timing board shows them. */
  const secs = (x: number) => `${fixed(x, 2)} s`
  /** A temperature, never "−0 °C". */
  const deg = (x: number, digits: number) => `${fixed(Number(x.toFixed(digits)) || 0, digits)} °C`

  /**
   * The Deliver sheet for a bobsled (PR 8p): the promise in seconds, and the
   * declared reference run time, filled in from the tunnel's forecast for this
   * design, or the desk estimate until the tunnel has read one.
   */
  function openDeliverSled(design: Design) {
    const career = careerStore.get()
    const job = career.job
    if (!job || !deliverSheet) return
    const b = briefTemplate(job.brief.id)!
    const event = sledEventOf(job.brief)!
    const crew = t(`crew.${event.crew}`)
    // The job is for one crew size; a sled for another can't race it.
    if (!isBobsled(design) || design.crew !== event.crew) {
      deliverSheet.body.replaceChildren(el('p', 'shop-intro', t('deliver.wrongSled', { crew: crew.toLowerCase() })))
      deliverSheet.open()
      return
    }
    const sled: BobsledDesign = design
    const track = event.track
    const forecast = sledForecast.get(sled, track.id)
    const desk = bobDeskEstimate(sled, track, job.brief.seed, JSON.stringify(sled), crewEffects(career.crew).deskLevel)
    const start = forecast ? forecast.time : desk.value
    const box = stepper('deliver-sled', start.toFixed(2), 's', t('deliver.lessSled'), t('deliver.moreSled'), (dir) => {
      const v = Number(box.input.value) || start
      box.input.value = (Math.round(v * 100 + dir) / 100).toFixed(2)
    })
    box.input.step = '0.01'
    box.input.min = '30'
    box.input.max = '90'
    const label = el('label', 'shop-label', t('deliver.predictSled'))
    label.htmlFor = box.input.id
    const notes: HTMLElement[] = []
    if (forecast) {
      notes.push(el('p', 'shop-note', t('deliver.forecastSled', { time: fixed(forecast.time, 2) })))
      if (!forecast.board) notes.push(el('p', 'shop-note', t('deliver.forecastSledFloor')))
    } else notes.push(el('p', 'shop-note', t('deliver.noForecastSled', { desk: fixed(desk.value, 2), spread: fixed((desk.high - desk.low) / 2, 2) })))
    const status = el('p', 'shop-note')
    status.setAttribute('aria-live', 'polite')
    const go = button('shop-order', t('deliver.sled'))
    go.addEventListener('click', () => {
      const predicted = Number(box.input.value)
      if (!Number.isFinite(predicted) || predicted < 30 || predicted > 90) {
        status.textContent = t('deliver.badSled')
        return
      }
      const d = deliverSled(careerStore.get(), sled, predicted)
      if (!d) return
      deliverSheet?.close()
      careerStore.set(d.state)
      // The run plays out first; the debrief follows.
      replaySled(d, sled, () => showSledDelivery(d, sled))
    })
    deliverSheet.body.replaceChildren(
      el('p', 'shop-intro', t('deliver.introSled', { client: b.client, event: b.event.name })),
      el('p', 'deliver-promise', t('deliver.promiseSled', { s: seconds(job.promise) })),
      el('p', 'shop-note', t('deliver.promiseNoteSled', { track: t(`track.${track.id}`), crew: crew.toLowerCase() })),
      label,
      box.row,
      ...notes,
      status,
      go,
    )
    deliverSheet.open()
  }

  let sledSheet: Sheet | null = null

  /** The run replay for a sled delivery, then `after`. */
  function replaySled(d: SledDelivery, design: BobsledDesign, after: () => void) {
    const b = briefTemplate(d.job.brief.id)!
    void playSledReplay({
      client: b.client,
      event: b.event.name,
      track: d.event.track,
      design,
      setup: b.setup as BobsledDesign,
      day: d.debrief.day,
      baselineDay: d.debrief.baselineDay,
      predicted: d.debrief.predicted,
      actual: d.debrief.actual,
      onDone: after,
    })
  }

  /** Race day for a sled: the promise judged on the reference run, the run on the day, and any trouble with its fix. */
  function showSledDelivery(d: SledDelivery, design: BobsledDesign) {
    sledSheet ??= createSheet({ cls: 'raceday', title: t('sd.title'), closeLabel: t('sd.close') })
    const b = briefTemplate(d.job.brief.id)!
    const db = d.debrief
    const verdict = el(
      'p',
      `race-verdict ${db.met ? 'is-met' : 'is-missed'}`,
      db.met
        ? t('sd.kept', { got: seconds(db.achieved), promised: seconds(db.promised) })
        : t('sd.missed', { short: seconds(db.shortfall), got: seconds(db.achieved), promised: seconds(db.promised) }),
    )
    const off = fixed(Math.abs(db.readError) * 100, 1)
    const c = db.conditions
    const facts = el('div', 'job-facts')
    facts.append(
      fact(t('sd.reference'), secs(db.reference.time)),
      fact(t('sd.oldReference'), secs(db.baselineReference.time)),
      fact(t('race.predicted'), secs(db.predicted)),
      fact(t('race.read'), t(`race.read.${db.read}`, { pct: off, dir: t(db.readError >= 0 ? 'race.high' : 'race.low') })),
      fact(t('sd.day'), secs(db.day.time)),
      fact(t('sd.oldDay'), secs(db.baselineDay.time)),
      fact(t('sd.top'), `${fixed(db.day.topSpeed * 3.6, 1)} km/h`),
      fact(t('race.air'), deg(c.temperature, 0)),
      fact(t('sd.ice'), deg(c.iceTemp, 1)),
      fact(t('sd.wind'), `${fixed(c.headwind, 1)} m/s`),
      fact(t('sd.push'), `${fixed(c.pushSpeed * 3.6, 1)} km/h`),
      fact(t('race.fee'), rubles(d.job.brief.fee)),
      fact(t('race.penalty'), db.penalty ? `−${rubles(db.penalty)}` : rubles(0)),
      fact(t('race.paid'), rubles(d.paid)),
      ...(d.upkeep > 0 ? [fact(t('race.upkeep'), `−${rubles(d.upkeep)}`)] : []),
      ...(d.wages > 0 ? [fact(t('race.wages'), `−${rubles(d.wages)}`)] : []),
      fact(
        glossaryTerm('reputation', t('race.reputation')),
        t('race.repChange', { after: db.reputation.after, change: signed(db.reputation.after - db.reputation.before) }),
      ),
    )
    const parts: HTMLElement[] = [el('p', 'shop-intro', t('sd.intro', { client: b.client, event: b.event.name })), verdict, facts]
    if (db.cause) parts.push(el('p', 'shop-note', t(db.cause === 'sight' ? 'sd.causeSight' : 'sd.causeDesign')))
    // The driver steering late, with a "change this" jump to the cowling on Shape (plan section 7).
    if (db.blind) {
      const box = el('div', 'race-trouble')
      const fix = button('save-btn quiet', t('sd.fix'))
      const target = db.blind.fix
      fix.addEventListener('click', () => {
        sledSheet?.close()
        go('shape')
        window.dispatchEvent(new CustomEvent<FixTarget>('laminar:fix', { detail: target }))
      })
      box.append(el('p', 'race-trouble-text', t('sd.blind', { client: b.client, s: fixed(db.blind.lost, 2) })), fix)
      parts.push(box)
    }
    parts.push(el('p', 'shop-note', t('sd.readNote')))
    if (d.sale) parts.push(brokeBox(d.sale, d.state.money))
    if (d.state.ended) parts.push(el('p', 'save-due', t('end.reached')))
    const again = button('save-btn quiet', t('race.replay'))
    again.addEventListener('click', () => {
      sledSheet?.close()
      replaySled(d, design, () => showSledDelivery(d, design))
    })
    parts.push(again)
    sledSheet.body.replaceChildren(...parts)
    sledSheet.open()
  }

  /** Litres per 100 km, a tenth of a litre. */
  const per100 = (x: number) => t('td.per100', { fuel: fixed(x, 1) })

  /**
   * The Deliver sheet for a truck (PR 9f): the promise in per cent of fuel,
   * and the declared wind-averaged fuel figure, filled in from the tunnel's
   * forecast for this design, or the desk estimate until the tunnel has read
   * one. A part the road code forbids gets a warning: the depot cuts it back.
   * So do skirts too low for the fleet's gravel yard (PR 9g): they'll crack.
   */
  function openDeliverTruck(design: Design) {
    const career = careerStore.get()
    const job = career.job
    if (!job || !deliverSheet) return
    const b = briefTemplate(job.brief.id)!
    if (!isTruck(design)) {
      deliverSheet.body.replaceChildren(el('p', 'shop-intro', t('deliver.wrongTruck')))
      deliverSheet.open()
      return
    }
    const truck: TruckDesign = design
    const { route, old } = currentTruckRun(career, truck.trailerTop)
    const routeName = t(`route.${route.id}`)
    const forecast = truckForecast.get(truck, route.id)
    const desk = truckDeskEstimate(truck, old, route, job.brief.seed, JSON.stringify(truck), crewEffects(career.crew).deskLevel)
    const start = forecast ? forecast.fuel : desk.fuel
    const box = stepper('deliver-truck', start.toFixed(1), 'L/100 km', t('deliver.lessTruck'), t('deliver.moreTruck'), (dir) => {
      const v = Number(box.input.value) || start
      box.input.value = (Math.round(v * 10 + dir) / 10).toFixed(1)
    })
    box.input.step = '0.1'
    box.input.min = '15'
    box.input.max = '60'
    const label = el('label', 'shop-label', t('deliver.predictTruck'))
    label.htmlFor = box.input.id
    const notes: HTMLElement[] = []
    if (forecast) {
      notes.push(el('p', 'shop-note', t('deliver.forecastTruck', { fuel: fixed(forecast.fuel, 1), pct: fixed(forecast.saving, 1) })))
      if (!forecast.board) notes.push(el('p', 'shop-note', t('deliver.forecastTruckFloor')))
      if (!forecast.swept) notes.push(el('p', 'shop-note', t('deliver.forecastTruckStraight')))
    } else
      notes.push(el('p', 'shop-note', t('deliver.noForecastTruck', { fuel: fixed(desk.fuel, 1), pct: fixed(desk.value, 1), spread: fixed((desk.high - desk.low) / 2, 1) })))
    if (checkTruckRules(truck).length > 0) notes.push(el('p', 'save-due', t('deliver.truckBreaks')))
    const event = truckEventOf(job.brief)
    if (event && cracksOnGravel(roadLegal(truck), event))
      notes.push(el('p', 'save-due', t('deliver.gravel', { client: b.client, limit: fixed(GRAVEL_YARD.minSkirtGap, 2), gap: fixed(skirtGap(roadLegal(truck)), 2) })))
    const status = el('p', 'shop-note')
    status.setAttribute('aria-live', 'polite')
    const go = button('shop-order', t('deliver.truck'))
    go.addEventListener('click', () => {
      const predicted = Number(box.input.value)
      if (!Number.isFinite(predicted) || predicted < 15 || predicted > 60) {
        status.textContent = t('deliver.badTruck')
        return
      }
      const d = deliverTruck(careerStore.get(), truck, predicted)
      if (!d) return
      deliverSheet?.close()
      careerStore.set(d.state)
      // The fuel-run replay (PR 9h), then the debrief.
      void playTruckReplay({
        client: b.client,
        event: b.event.name,
        route: d.event.route,
        design: asRun(truck, d.event).truck,
        setup: b.setup as TruckDesign,
        day: d.debrief.day,
        run: d.debrief.run,
        baselineRun: d.debrief.baselineRun,
        cracked: d.debrief.cracked !== null,
        predicted: d.debrief.predicted,
        actual: d.debrief.actual,
        onDone: () => showTruckDelivery(d),
      })
    })
    deliverSheet.body.replaceChildren(
      el('p', 'shop-intro', t('deliver.introTruck', { client: b.client, route: routeName })),
      el('p', 'deliver-promise', t('deliver.promiseTruck', { pct: pct(job.promise) })),
      el('p', 'shop-note', t('deliver.promiseNoteTruck', { route: routeName })),
      label,
      box.row,
      ...notes,
      status,
      go,
    )
    deliverSheet.open()
  }

  let truckSheet: Sheet | null = null

  /** A trouble line on the fuel trial with a "change this" jump to that part on Shape. */
  function troubleBox(text: string, fixLabel: string, target: FixTarget): HTMLElement {
    const box = el('div', 'race-trouble')
    const fix = button('save-btn quiet', fixLabel)
    fix.addEventListener('click', () => {
      truckSheet?.close()
      go('shape')
      window.dispatchEvent(new CustomEvent<FixTarget>('laminar:fix', { detail: target }))
    })
    box.append(el('p', 'race-trouble-text', text), fix)
    return box
  }

  /** The fuel trial for a truck: the promise judged wind-averaged, the trial day, and any part the road code cut back with its fix. */
  function showTruckDelivery(d: TruckDelivery) {
    truckSheet ??= createSheet({ cls: 'raceday', title: t('td.title'), closeLabel: t('td.close') })
    const b = briefTemplate(d.job.brief.id)!
    const db = d.debrief
    const verdict = el(
      'p',
      `race-verdict ${db.met ? 'is-met' : 'is-missed'}`,
      db.met
        ? t('td.kept', { got: fixed(db.achieved, 1), promised: pct(db.promised) })
        : t('td.missed', { short: fixed(db.shortfall, 1), got: fixed(db.achieved, 1), promised: pct(db.promised) }),
    )
    const off = fixed(Math.abs(db.readError) * 100, 1)
    // The wind's direction as a compass word: eight points, north first.
    const from = t(COMPASS[Math.round(db.day.windFromDeg / 45) % 8]!)
    const facts = el('div', 'job-facts')
    facts.append(
      fact(t('td.fuel'), per100(db.actual)),
      fact(t('td.oldFuel'), per100(db.baseline)),
      fact(t('race.predicted'), per100(db.predicted)),
      fact(t('race.read'), t(`race.read.${db.read}`, { pct: off, dir: t(db.readError >= 0 ? 'race.high' : 'race.low') })),
      fact(t('td.day'), per100(db.run.per100)),
      fact(t('td.oldDay'), per100(db.baselineRun.per100)),
      fact(t('race.air'), deg(db.day.temperature, 0)),
      fact(t('td.wind'), t('td.windFrom', { speed: fixed(db.day.windSpeed, 1), from })),
      fact(t('race.fee'), rubles(d.job.brief.fee)),
      fact(t('race.penalty'), db.penalty ? `−${rubles(db.penalty)}` : rubles(0)),
      fact(t('race.paid'), rubles(d.paid)),
      ...(d.upkeep > 0 ? [fact(t('race.upkeep'), `−${rubles(d.upkeep)}`)] : []),
      ...(d.wages > 0 ? [fact(t('race.wages'), `−${rubles(d.wages)}`)] : []),
      fact(
        glossaryTerm('reputation', t('race.reputation')),
        t('race.repChange', { after: db.reputation.after, change: signed(db.reputation.after - db.reputation.before) }),
      ),
    )
    const parts: HTMLElement[] = [el('p', 'shop-intro', t('td.intro', { client: b.client, route: t(`route.${d.event.route.id}`) })), verdict, facts]
    if (db.cause) parts.push(el('p', 'shop-note', t(db.cause === 'gravel' ? 'td.causeGravel' : db.cause === 'roadCode' ? 'td.causeRoadCode' : 'td.causeDesign')))
    // Skirts that cracked on the gravel yard, with a jump to raise them (PR 9g).
    if (db.cracked) parts.push(troubleBox(t('td.cracked', { gap: fixed(db.cracked.gap, 2), limit: fixed(db.cracked.limit, 2) }), t('td.fixSkirts'), 'skirts'))
    // Each part the road code made the depot cut back, with a "change this" jump to it on Shape.
    for (const cut of db.cutBack) {
      const tail = cut.rule === 'tail'
      parts.push(troubleBox(t(tail ? 'td.cutTail' : 'td.cutSkirts', { value: fixed(cut.value, 2), limit: fixed(cut.limit, 2) }), t(tail ? 'td.fixTail' : 'td.fixSkirts'), tail ? 'boatTail' : 'skirts'))
    }
    parts.push(el('p', 'shop-note', t('td.readNote')))
    if (d.sale) parts.push(brokeBox(d.sale, d.state.money))
    if (d.state.ended) parts.push(el('p', 'save-due', t('end.reached')))
    truckSheet.body.replaceChildren(...parts)
    truckSheet.open()
  }

  /** The race-day replay for a delivery, then `after`. */
  function replay(d: Delivery, design: Design, after: () => void) {
    const b = briefTemplate(d.job.brief.id)!
    void playReplay({
      client: b.client,
      event: b.event.name,
      course: d.event.course,
      design,
      setup: b.setup,
      result: d.result,
      baseline: d.debrief.baseline,
      predicted: d.debrief.predicted,
      lap: b.event.indoor ? (b.event.lap ?? TRACK.lap) : undefined,
      ice: b.event.ice === true,
      onDone: after,
    })
  }

  function showDelivery(d: Delivery, design: Design) {
    result ??= createSheet({ cls: 'raceday', title: t('race.title'), closeLabel: t('race.close') })
    const b = briefTemplate(d.job.brief.id)!
    const r = d.result
    const db = d.debrief
    const saved = db.timeSaved
    const verdict = el(
      'p',
      `race-verdict ${db.met ? 'is-met' : 'is-missed'}`,
      db.met
        ? t('race.kept', { got: fixed(db.achieved, 1), promised: pct(db.promised) })
        : t('race.missed', { short: fixed(db.shortfall, 1), got: fixed(db.achieved, 1), promised: pct(db.promised) }),
    )
    const off = fixed(Math.abs(db.readError) * 100, 1)
    const facts = el('div', 'job-facts')
    facts.append(
      fact(t('race.time'), raceTime(r.time)),
      fact(t('race.vsOld'), t(saved >= 0 ? 'race.faster' : 'race.slower', { time: raceTime(Math.abs(saved)) })),
      fact(t('race.predicted'), `${fixed(db.predicted, 3)} m²`),
      fact(t('race.actual'), `${fixed(db.actual, 3)} m²`),
      fact(t('race.read'), t(`race.read.${db.read}`, { pct: off, dir: t(db.readError >= 0 ? 'race.high' : 'race.low') })),
      fact(t('race.speed'), `${fixed((r.distance / r.time) * 3.6, 1)} km/h`),
      fact(t('race.air'), `${fixed(r.temperature, 0)} °C`),
      fact(t('race.wind'), `${fixed(r.windSpeed, 1)} m/s`),
      fact(t('race.power'), `${fixed(r.power, 0)} W`),
      fact(t('race.fee'), rubles(d.job.brief.fee)),
      fact(t('race.penalty'), db.penalty ? `−${rubles(db.penalty)}` : rubles(0)),
      fact(t('race.paid'), rubles(d.paid)),
      ...(d.upkeep > 0 ? [fact(t('race.upkeep'), `−${rubles(d.upkeep)}`)] : []),
      ...(d.wages > 0 ? [fact(t('race.wages'), `−${rubles(d.wages)}`)] : []),
      fact(
        glossaryTerm('reputation', t('race.reputation')),
        t('race.repChange', { after: db.reputation.after, change: signed(db.reputation.after - db.reputation.before) }),
      ),
    )
    const parts: HTMLElement[] = [
      el('p', 'shop-intro', t(isSkater(design) ? 'race.introSkater' : 'race.intro', { client: b.client, event: b.event.name, km: fixed(km(b), 0) })),
      verdict,
      facts,
    ]
    if (db.cause) parts.push(el('p', 'shop-note', t(db.cause === 'design' ? 'race.causeDesign' : 'race.causeDay')))
    // Trouble on the road, each with a "change this" jump to the part on Shape (plan section 7).
    const trouble = (text: string, fix: FixTarget, label: string) => {
      const box = el('div', 'race-trouble')
      const jump = button('save-btn quiet', label)
      jump.addEventListener('click', () => {
        result?.close()
        go('shape')
        window.dispatchEvent(new CustomEvent<FixTarget>('laminar:fix', { detail: fix }))
      })
      box.append(el('p', 'race-trouble-text', text), jump)
      parts.push(box)
    }
    if (db.gusts) trouble(t('race.gusts', { client: b.client, time: shortTime(db.gusts.lost) }), db.gusts.fix, t('race.fix.front'))
    if (db.fade) trouble(t(isSkater(design) ? 'race.fadeSkater' : 'race.fade', { client: b.client, time: shortTime(db.fade.lost) }), db.fade.fix, t('race.fix.position'))
    if (db.baseline.lostToGusts > 0) parts.push(el('p', 'shop-note', t('race.oldGusts', { time: shortTime(db.baseline.lostToGusts) })))
    parts.push(el('p', 'shop-note', t('race.readNote')))
    if (d.sale) parts.push(brokeBox(d.sale, d.state.money))
    if (d.state.ended) parts.push(el('p', 'save-due', t('end.reached')))
    const again = button('save-btn quiet', t('race.replay'))
    again.addEventListener('click', () => {
      result?.close()
      replay(d, design, () => showDelivery(d, design))
    })
    parts.push(again)
    result.body.replaceChildren(...parts)
    result.open()
  }

  /** The soft landing after a job that left cash below zero: what was sold, and what's left to do. */
  function brokeBox(sale: Sale, money: number): HTMLElement {
    const box = el('section', 'race-broke')
    box.setAttribute('aria-labelledby', 'broke-title')
    const head = el('h3', 'race-broke-title', t('broke.title'))
    head.id = 'broke-title'
    box.append(head, el('p', 'shop-note', t('broke.intro', { dip: BROKE.dip, pct: fixed(BROKE.saleShare * 100, 0) })))
    if (sale.sold.length) {
      const list = el('div', 'job-facts')
      for (const { item, price } of sale.sold) {
        const name = item.kind === 'machine' ? t(`ws.${item.id}`) : item.kind === 'upgrade' ? t(`up.${item.id}`) : t('own.title')
        list.append(fact(name, `+${rubles(price)}`))
      }
      list.append(fact(t('broke.raised'), rubles(sale.total)))
      box.append(list)
      if (sale.sold.some((s) => s.item.kind === 'tunnel')) box.append(el('p', 'shop-note', t('broke.renting')))
    } else box.append(el('p', 'shop-note', t('broke.nothing')))
    if (money < 0) box.append(el('p', 'shop-note', t('broke.short', { rub: rubles(-money) })))
    return box
  }

  // --- Bidding: a sealed price and promise, then the bids opened.
  let bidSheet: Sheet | null = null
  let bidsSheet: Sheet | null = null

  function openBid(brief: Brief) {
    const b = briefTemplate(brief.id)!
    bidSheet ??= createSheet({ cls: 'deliver', title: t('bid.title'), closeLabel: t('bid.close') })
    const price = stepper('bid-price', String(brief.fee), '₽', t('bid.priceLess'), t('bid.priceMore'), (dir) => {
      const v = Number(price.input.value) || brief.fee
      price.input.value = String(Math.min(b.fee.max, Math.max(b.fee.min, Math.round(v / BID.priceStep) * BID.priceStep + dir * BID.priceStep)))
      update()
    })
    price.input.step = String(BID.priceStep)
    price.input.min = String(b.fee.min)
    price.input.max = String(b.fee.max)
    // A ski jump's promise is in metres, a bobsled's in seconds; everything else about the bid is the same.
    const jump = !!b.event.jump
    const sled = !!b.event.sled
    const truck = !!b.event.truck
    // The words for each kind of promise: '' for a road or track job, 'Jump', 'Sled' or 'Truck'.
    const kind = sled ? 'Sled' : jump ? 'Jump' : truck ? 'Truck' : ''
    // A sled's box shows seconds (a point is a tenth), stepping a hundredth; the bid itself stays in points.
    const shown = sled ? SLED_JOBS.pointSeconds : 1
    const step = (sled ? SLED_JOBS.promiseStep : BID.promiseStep) * shown
    const digits = sled ? 2 : 1
    const promise = stepper('bid-promise', sled ? seconds(b.target) : String(b.target), sled ? 's' : jump ? 'm' : '%', t(`bid.promiseLess${kind}`), t(`bid.promiseMore${kind}`), (dir) => {
      const v = Number(promise.input.value) || b.target * shown
      const next = Math.round(v / step) * step + dir * step
      const clamped = Math.min(BID.promiseMax * shown, Math.max(BID.promiseMin * shown, next))
      promise.input.value = sled ? clamped.toFixed(digits) : String(Math.round(clamped * 10) / 10)
      update()
    })
    promise.input.step = String(step)
    promise.input.min = String(BID.promiseMin * shown)
    promise.input.max = String(BID.promiseMax * shown)
    const priceLabel = el('label', 'shop-label', t('bid.price'))
    priceLabel.htmlFor = price.input.id
    const promiseLabel = el('label', 'shop-label', t(`bid.promise${kind}`))
    promiseLabel.htmlFor = promise.input.id
    const worth = el('p', 'shop-note')
    worth.setAttribute('aria-live', 'polite')
    const status = el('p', 'shop-note')
    status.setAttribute('aria-live', 'polite')
    const worthOf = Math.round((((b.fee.min + b.fee.max) / 2) * BID.pointValue) / 100) * 100
    function update() {
      const p = Number(price.input.value) || brief.fee
      worth.textContent = t(`bid.worth${kind}`, { worth: rubles(worthOf), cost: rubles(Math.round((p * PROMISE.perPoint) / 100) * 100) })
    }
    price.input.addEventListener('input', update)
    update()
    const seal = button('shop-order', t('bid.seal'))
    seal.addEventListener('click', () => {
      const p = Number(price.input.value)
      // Back from seconds to points for a sled (0.57 s → 5.7 points).
      const q = sled ? Math.round(Number(promise.input.value) * 100) / (100 * shown) : Number(promise.input.value)
      if (!Number.isFinite(p) || !Number.isFinite(q) || p <= 0 || q <= 0) {
        status.textContent = t('bid.bad')
        return
      }
      const r = placeBid(careerStore.get(), brief.id, { price: p, promise: q })
      if (!r) return
      bidSheet?.close()
      // Winning puts the client's current setup on the bench: the job starts from how they ride now.
      if (r.won) designStore.set(structuredClone(b.setup))
      careerStore.set(r.state)
      showBids(r)
    })
    bidSheet.body.replaceChildren(
      el('p', 'shop-intro', t(b.tutorial ? 'bid.introSolo' : 'bid.intro', { client: b.client })),
      priceLabel,
      price.row,
      el('p', 'shop-note', t('bid.priceNote', { min: rubles(b.fee.min), max: rubles(b.fee.max), fee: rubles(brief.fee) })),
      promiseLabel,
      promise.row,
      el(
        'p',
        'shop-note',
        sled ? t('bid.askSled', { s: seconds(b.target) }) : jump ? t('bid.askJump', { m: pct(b.target) }) : truck ? t('bid.askTruck', { pct: pct(b.target) }) : t('bid.ask', { pct: pct(b.target) }),
      ),
      worth,
      status,
      seal,
    )
    bidSheet.open()
  }

  function showBids(r: BidResult) {
    bidsSheet ??= createSheet({ cls: 'bids', title: t('bids.title'), closeLabel: t('bids.close') })
    const id = r.state.job?.brief.id ?? r.state.lost[r.state.lost.length - 1]!
    const contested = r.rivals.length > 0
    const verdictText = r.won ? t(contested ? 'bids.won' : 'bids.solo') : t('bids.lostTo', { firm: RIVALS[r.winner!].name })
    const verdict = el('p', `race-verdict ${r.won ? 'is-met' : 'is-missed'}`, verdictText)
    // One block of facts per firm: yours first, then each rival in the order they bid.
    const block = (name: string, bid: Bid, rep: number, best: boolean) => {
      const facts = el('div', 'job-facts')
      facts.append(
        fact(t('bids.price'), rubles(bid.price)),
        fact(t('bids.promise'), promiseText(id, bid.promise)),
        fact(glossaryTerm('reputation', t('board.reputation')), String(rep)),
        fact(t('bids.value'), rubles(bidScore(id, bid, rep))),
      )
      const head = el('h3', 'bids-firm', name)
      if (best) head.append(' ', el('span', 'save-slot-tag', t('bids.winner')))
      return [head, facts]
    }
    const parts: HTMLElement[] = [verdict, ...block(t('bids.you'), r.mine, r.myRep, contested && r.won)]
    for (const rb of r.rivals) parts.push(...block(RIVALS[rb.firm].name, rb.bid, rb.reputation, r.winner === rb.firm))
    if (contested)
      parts.push(
        el('p', 'shop-note', t(isSledBrief(id) ? 'bids.howSled' : isJumpBrief(id) ? 'bids.howJump' : isTruckBrief(id) ? 'bids.howTruck' : 'bids.how', { worth: rubles(r.worth), max: rubles(briefTemplate(id)!.fee.max), rep: String(Math.round(1 / REPUTATION.bidPerPoint)) })),
      )
    if (r.won) {
      parts.push(el('p', 'shop-note', t('bids.wonNote')))
      const toShape = button('shop-order', t('bids.toShape'))
      toShape.addEventListener('click', () => {
        bidsSheet?.close()
        go('shape')
      })
      parts.push(toShape)
    } else parts.push(el('p', 'shop-note', t(r.state.board.length > 0 ? 'bids.lostNote' : 'bids.lostEmpty')))
    bidsSheet.body.replaceChildren(...parts)
    bidsSheet.open()
  }

  /** The partner's card for the first job: what to do next, and the checklist. */
  function guideCard(): HTMLElement | null {
    const career = careerStore.get()
    const step = currentStep(career)
    if (!guideOn(career) || !step) return null
    const card = el('section', 'job-card guide-card')
    card.setAttribute('aria-labelledby', 'guide-title')
    const head = el('h2', 'board-heading', t('guide.title'))
    head.id = 'guide-title'
    const list = el('ol', 'guide-steps')
    list.setAttribute('aria-label', t('guide.name'))
    for (const s of GUIDE_STEPS) {
      const done = stepDone(career, s)
      const item = el('li', `guide-step${done ? ' is-done' : ''}${s === step ? ' is-next' : ''}`, t(`guide.step.${s}`))
      // Ticks are words for screen readers, not colour alone.
      if (done || s === step) item.append(el('span', 'sr-only', ` (${t(done ? 'guide.done' : 'guide.next')})`))
      list.append(item)
    }
    const hide = button('save-btn quiet', t('guide.hide'))
    twoTap(hide, t('guide.hide'), t('guide.hideConfirm'), () => careerStore.set(hideGuide(careerStore.get())))
    const actions = el('div', 'job-actions')
    actions.append(hide)
    card.append(head, el('p', 'guide-say', t(`guide.say.${step}`)), list, actions)
    return card
  }

  /** Your own tunnel: the pitch and the button while you save up, then its build, then that it's open. */
  function ownTunnelCard(): HTMLElement {
    const career = careerStore.get()
    const card = el('section', 'job-card own-card')
    card.setAttribute('aria-labelledby', 'own-title')
    const head = el('h2', 'job-client', t('own.title'))
    head.id = 'own-title'
    card.append(head)
    const ready = ownReadyDay(career.facility)
    if (ready === null) {
      const facts = el('div', 'job-facts')
      facts.append(
        fact(t('own.price'), rubles(OWN_TUNNEL_BUILD.price)),
        fact(t('own.build'), t('own.buildValue', { days: OWN_TUNNEL_BUILD.days })),
        fact(t('own.power'), t('own.powerValue', { rub: rubles(OWN_BILLING.perKWh) })),
        fact(t('own.upkeep'), t('own.upkeepValue', { rub: rubles(OWN_TUNNEL_BUILD.upkeepPerDay) })),
      )
      card.append(el('p', 'job-who', t('own.pitch', { days: OWN_TUNNEL_BUILD.days })), facts)
      const block = buildBlock(career.facility, career.money)
      if (block === 'money') {
        card.append(el('p', 'shop-note', t('own.toGo', { have: rubles(Math.max(0, career.money)), short: rubles(OWN_TUNNEL_BUILD.price - career.money) })))
      }
      const buy = button('save-btn', t('own.buy'))
      buy.disabled = block !== null
      if (!block) twoTap(buy, t('own.buy'), t('own.buyConfirm', { price: rubles(OWN_TUNNEL_BUILD.price) }), () => careerStore.set(buildOwnTunnel(careerStore.get())))
      const actions = el('div', 'job-actions')
      actions.append(buy)
      card.append(actions)
    } else if (career.day < ready) {
      const days = ready - career.day
      const date = careerDate(ready, CAREER.start)
      card.append(el('p', 'job-who', days === 1 ? t('own.buildingOne', { date }) : t('own.building', { date, days })))
    } else {
      card.append(el('p', 'job-who', t('own.open', { date: careerDate(ready, CAREER.start) })), el('p', 'shop-note', t('own.fresh')))
      card.append(...upgradeList())
    }
    return card
  }

  /** The workshop: machines to make your own models, each bought once. */
  function workshopCard(): HTMLElement {
    const career = careerStore.get()
    const card = el('section', 'job-card own-card')
    card.setAttribute('aria-labelledby', 'ws-title')
    const head = el('h2', 'job-client', t('ws.title'))
    head.id = 'ws-title'
    const list = el('ul', 'upgrade-list')
    for (const id of MACHINE_IDS) {
      const row = el('li', 'upgrade')
      const name = el('p', 'upgrade-name', t(`ws.${id}`))
      row.append(name, el('p', 'job-who', t(`ws.${id}What`)))
      const block = machineBlock(career.facility, career.money, id)
      if (block === 'owned') name.append(' ', el('span', 'save-slot-tag', t('ws.owned')))
      else {
        const line = el('div', 'upgrade-buy')
        const buy = button('save-btn', t('ws.buy'))
        buy.disabled = block !== null
        if (!block) twoTap(buy, t('ws.buy'), t('ws.buyConfirm', { price: rubles(MACHINE_PRICE[id]) }), () => careerStore.set(buyMachine(careerStore.get(), id)))
        line.append(el('span', 'upgrade-cost', rubles(MACHINE_PRICE[id])), buy)
        row.append(line)
      }
      list.append(row)
    }
    card.append(head, el('p', 'shop-note', t('ws.intro')), list)
    return card
  }

  /** What one person's trait does, in words with its number. */
  function traitText(id: StaffId): string {
    const tr = STAFF[id].trait
    const pct = (x: number) => fixed(Math.abs(x) * 100, 0)
    if (tr.modelDays !== undefined) return t('staff.trait.modelDays', { pct: pct(1 - tr.modelDays) })
    if (tr.modelPrice !== undefined) return t('staff.trait.modelPrice', { pct: pct(1 - tr.modelPrice) })
    if (tr.balanceNoise !== undefined) return t('staff.trait.balanceNoise', { pct: pct(1 - tr.balanceNoise) })
    if (tr.mountStrength !== undefined) return t('staff.trait.mountStrength', { pct: pct(tr.mountStrength - 1) })
    const level = tr.deskLevel ?? 0
    return t('staff.trait.deskLevel', { pct: pct(Math.min(1 - DESK.floor, DESK.perLevel * level)) })
  }

  /** The staff: one per role, hired and let go any time, paid for every day that passes. */
  function staffCard(): HTMLElement {
    const career = careerStore.get()
    const card = el('section', 'job-card own-card')
    card.setAttribute('aria-labelledby', 'staff-title')
    const head = el('h2', 'job-client', t('staff.title'))
    head.id = 'staff-title'
    card.append(head, el('p', 'shop-note', t('staff.intro')))
    const payroll = wagesPerDay(career.crew)
    if (payroll > 0) card.append(el('p', 'shop-note staff-payroll', t('staff.payroll', { rub: rubles(payroll) })))
    for (const role of STAFF_ROLES) {
      card.append(el('h3', 'staff-role', t(`staff.role.${role}`)))
      const list = el('ul', 'upgrade-list')
      for (const id of STAFF_IDS.filter((x) => STAFF[x].role === role)) {
        const p = STAFF[id]
        const row = el('li', 'upgrade')
        const name = el('p', 'upgrade-name', p.name)
        row.append(name, el('p', 'job-who', traitText(id)))
        const line = el('div', 'upgrade-buy')
        const holder = career.crew[role]
        const btn = button('save-btn', '')
        if (holder === id) {
          name.append(' ', el('span', 'save-slot-tag', t('staff.on')))
          btn.classList.add('quiet')
          btn.textContent = t('staff.letGo')
          twoTap(btn, t('staff.letGo'), t('staff.letGoConfirm', { name: p.name }), () => careerStore.set(letStaffGo(careerStore.get(), id)))
        } else if (holder) {
          btn.textContent = t('staff.hire')
          twoTap(btn, t('staff.hire'), t('staff.hireOver', { name: STAFF[holder].name }), () => careerStore.set(hireStaff(careerStore.get(), id)))
        } else {
          btn.textContent = t('staff.hire')
          btn.addEventListener('click', () => careerStore.set(hireStaff(careerStore.get(), id)))
        }
        line.append(el('span', 'upgrade-cost', t('staff.wage', { rub: rubles(p.wage) })), btn)
        row.append(line)
        list.append(row)
      }
      card.append(list)
    }
    return card
  }

  /** Your tunnel's upgrades: what each does, its price and days, and whether it's fitted. */
  function upgradeList(): HTMLElement[] {
    const career = careerStore.get()
    const list = el('ul', 'upgrade-list')
    for (const id of UPGRADE_IDS) {
      const u = TUNNEL_UPGRADES[id]
      const row = el('li', 'upgrade')
      const head = el('p', 'upgrade-name', t(`up.${id}`))
      const what = el('p', 'job-who', t(`up.${id}What`, { deg: TUNNEL_UPGRADES.turntable.yawRange, speed: TUNNEL_UPGRADES.fan.topSpeed }))
      row.append(head, what)
      const fitted = upgradeReadyDay(career.facility, id)
      if (fitted !== null && career.day >= fitted) head.append(' ', el('span', 'save-slot-tag', t('up.fitted')))
      else if (fitted !== null) row.append(el('p', 'shop-note', t('up.fitting', { date: careerDate(fitted, CAREER.start) })))
      else {
        const line = el('div', 'upgrade-buy')
        const buy = button('save-btn', t('up.buy'))
        const block = upgradeBlock(career.facility, career.day, career.money, id)
        buy.disabled = block !== null
        if (!block) twoTap(buy, t('up.buy'), t('up.buyConfirm', { price: rubles(u.price) }), () => careerStore.set(orderUpgrade(careerStore.get(), id)))
        line.append(el('span', 'upgrade-cost', t('up.cost', { price: rubles(u.price), days: u.days })), buy)
        row.append(line)
      }
      list.append(row)
    }
    return [el('h3', 'bids-firm', t('up.title')), el('p', 'shop-note', t('up.intro')), list]
  }

  function emptyCard(): HTMLElement {
    const card = el('li', 'job-card')
    const wait = button('save-btn', t('board.wait'))
    wait.addEventListener('click', () => careerStore.set(waitForBriefs(careerStore.get())))
    const actions = el('div', 'job-actions')
    actions.append(wait)
    card.append(el('p', 'job-who', t('board.empty')), actions)
    return card
  }

  /** The job card's event line: the hill for a jump, the crew and track for a sled, the course otherwise. */
  function eventLine(b: BriefTemplate): string {
    if (b.event.jump) return t('board.eventJump', { event: b.event.name, hs: fixed(HILLS[b.event.jump.hill].hs, 0) })
    if (b.event.sled) return t('board.eventSled', { event: b.event.name, track: t(`track.${b.event.sled.track}`) })
    if (b.event.truck) return t('board.eventTruck', { event: b.event.name, route: t(`route.${b.event.truck.route}`) })
    return `${b.event.name} · ${fixed(km(b), 0)} km`
  }

  function jobCard(): HTMLElement | null {
    const career = careerStore.get()
    const job = career.job
    if (!job) return null
    const b = briefTemplate(job.brief.id)!
    const card = el('section', 'job-card is-active')
    card.setAttribute('aria-labelledby', 'job-now-title')
    const head = el('h2', 'board-heading', t('board.onJob'))
    head.id = 'job-now-title'
    const used = job.brief.days - job.daysLeft
    const meter = el('div', 'meter job-days')
    meter.setAttribute('role', 'meter')
    meter.setAttribute('aria-label', t('board.daysName'))
    meter.setAttribute('aria-valuemin', '0')
    meter.setAttribute('aria-valuemax', String(job.brief.days))
    meter.setAttribute('aria-valuenow', String(job.daysLeft))
    const fill = el('div', 'meter-fill')
    fill.style.width = `${(job.daysLeft / job.brief.days) * 100}%`
    meter.append(fill)
    meter.classList.toggle('over', job.daysLeft === 0)
    const facts = el('div', 'job-facts')
    facts.append(
      fact(t('board.promise'), promiseText(job.brief.id, job.promise)),
      fact(t('board.daysLeft'), t('board.daysOf', { left: job.daysLeft, days: job.brief.days })),
      fact(t('board.fee'), rubles(job.brief.fee)),
      fact(t('board.spent'), rubles(job.spent)),
      // A truck job ends in a fuel trial, not a race.
      fact(t(isTruckBrief(job.brief.id) ? 'board.trialDay' : 'board.raceDay'), careerDate(career.day + job.daysLeft, CAREER.start)),
    )
    const actions = el('div', 'job-actions')
    const shape = button('save-btn quiet guide-shape', t(isTruckBrief(job.brief.id) ? 'board.toShapeTruck' : 'board.toShape'))
    shape.addEventListener('click', () => go('shape'))
    const send = button('save-btn guide-deliver', t('board.deliver'))
    send.addEventListener('click', openDeliver)
    actions.append(shape, send)
    card.append(
      head,
      el('p', 'job-client', b.client),
      el('p', 'job-event', eventLine(b)),
      meter,
      facts,
      el('p', 'shop-note', t(job.daysLeft === 0 ? 'board.outOfDays' : 'board.used', { used })),
      actions,
    )
    return card
  }

  function briefCard(brief: Brief, busy: boolean): HTMLElement {
    const b = briefTemplate(brief.id)!
    const card = el('li', 'job-card')
    const top = el('p', 'job-client', b.client)
    if (b.tutorial) top.append(' ', el('span', 'save-slot-tag', t('board.first')))
    if (b.small) top.append(' ', el('span', 'save-slot-tag quiet', t('board.small')))
    const facts = el('div', 'job-facts')
    // A ski jump shows its hill and the jumper's weight, a bobsled its track, crew and ice, where a race shows its course and power.
    // A truck shows its route and the trailer's height.
    const jump = b.event.jump
    const sled = b.event.sled
    const road = b.event.truck
    const where = jump
      ? fact(t('board.hill'), t('board.hillValue', { hill: t(`hill.${jump.hill}`), hs: fixed(HILLS[jump.hill].hs, 0) }))
      : sled
        ? fact(t('board.track'), t(`track.${sled.track}`))
        : road
          ? fact(t('board.route'), t('board.routeValue', { route: t(`route.${road.route}`), km: fixed(routeKm(road.route), 0) }))
          : fact(t('board.course'), `${fixed(km(b), 0)} km`)
    const who = jump
      ? fact(t('board.mass'), `${fixed(jump.mass, 0)} kg`)
      : sled && b.setup.sport === 'bobsled'
        ? fact(t('board.crew'), t(`crew.${b.setup.crew}`))
        : b.setup.sport === 'truck'
          ? fact(t('board.trailer'), `${fixed(b.setup.trailerTop, 2)} m`)
          : fact(t('board.power'), `${fixed(b.rider.power, 0)} W`)
    facts.append(
      fact(t('board.wants'), promiseText(brief.id, b.target)),
      fact(t('board.feeRange'), `${rublesShort(b.fee.min)}–${rublesShort(b.fee.max)}`),
      fact(t('board.days'), String(brief.days)),
      where,
      fact(t('board.wind'), b.event.indoor ? t('board.indoors') : `~${fixed(b.event.windSpeed, 0)} m/s`),
      ...(sled ? [fact(t('board.ice'), `${fixed(sled.iceTemp, 0)} °C`)] : []),
      who,
      ...(road?.gravel ? [fact(t('board.yard'), t('board.gravel', { gap: fixed(GRAVEL_YARD.minSkirtGap, 2) }))] : []),
      fact(t('board.where'), b.event.place),
    )
    const bidders = biddersFor(brief.id)
    if (bidders.length > 0) facts.append(fact(t('board.bidders'), bidders.map((f) => RIVALS[f].name).join(', ')))
    card.append(top, el('p', 'job-who', b.who), el('blockquote', 'job-goal', b.goal), el('p', 'job-event', b.event.name), facts)
    const take = button('save-btn guide-bid', t('board.take'))
    if (busy) {
      take.disabled = true
      take.textContent = t('board.busy')
    } else take.addEventListener('click', () => openBid(brief))
    const actions = el('div', 'job-actions')
    actions.append(take)
    card.append(actions)
    return card
  }

  /** Naming the firm: at the start of a career, and whenever Rename is tapped. */
  function nameCard(): HTMLElement {
    const career = careerStore.get()
    const card = el('section', 'job-card own-card name-card')
    card.setAttribute('aria-labelledby', 'name-title')
    const head = el('h2', 'job-client', t(career.firm ? 'name.renameTitle' : 'name.title'))
    head.id = 'name-title'
    const input = el('input', 'name-input')
    input.id = 'firm-name-input'
    input.type = 'text'
    input.maxLength = CAREER.firmNameMax
    input.value = firmName(career)
    input.autocomplete = 'off'
    input.setAttribute('autocapitalize', 'words')
    const label = el('label', 'shop-label', t('name.label'))
    label.htmlFor = input.id
    const keep = button('save-btn', t('name.keep'))
    const save = () => {
      renaming = false
      careerStore.set(nameFirm(careerStore.get(), input.value))
    }
    keep.addEventListener('click', save)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save()
    })
    card.append(head, el('p', 'shop-note', t('name.note')), label, input, keep)
    return card
  }

  /** The legacy card: the career's story, when it has ended. */
  function legacyCard(): HTMLElement {
    const career = careerStore.get()
    const L = legacyOf(career)
    const card = el('section', 'legacy-card')
    card.setAttribute('aria-labelledby', 'legacy-title')
    const head = el('h2', 'legacy-firm', L.firm)
    head.id = 'legacy-title'
    const span = t(L.ending?.why === 'year2040' ? 'end.span2040' : 'end.spanRetired', {
      from: careerDate(L.fromDay, CAREER.start),
      to: careerDate(L.toDay, CAREER.start),
    })
    const facts = el('div', 'job-facts')
    facts.append(
      fact(t('end.jobs'), t(L.kept === 1 ? 'end.keptOne' : 'end.kept', { jobs: L.jobs, kept: L.kept })),
      fact(glossaryTerm('reputation', t('board.reputation')), t('board.outOf', { n: L.reputation })),
      fact(glossaryTerm('correlationScore', t('board.correlation')), L.correlation === null ? t('board.noRecord') : t('board.outOf', { n: L.correlation })),
      fact(t('end.earned'), rubles(L.earned)),
      fact(t('end.money'), rubles(L.money)),
      fact(t('end.tunnel'), t(L.ownTunnel ? 'end.yes' : 'end.no')),
      ...(L.broke > 0 ? [fact(t('end.broke'), String(L.broke))] : []),
    )
    card.append(el('p', 'legacy-kicker', t('end.kicker')), head, el('p', 'firm-date', span), facts)
    if (L.best) card.append(el('p', 'legacy-best', bestText(L.best)))
    const share = button('save-btn', t('end.share'))
    const said = el('p', 'shop-note legacy-said')
    said.setAttribute('role', 'status')
    share.addEventListener('click', () => {
      share.disabled = true
      share.textContent = t('end.sharing')
      said.textContent = ''
      void shareLegacy(L).then((r) => {
        share.disabled = false
        share.textContent = t('end.share')
        if (r === 'shared') said.textContent = t('end.shared')
        else if (r === 'saved') said.textContent = t('end.saved')
        else if (r === 'failed') said.textContent = t('end.shareFailed')
      })
    })
    card.append(share, said, el('p', 'shop-note', t('end.next')))
    return card
  }

  /** Retiring: ends the career now (two taps), not while a job is in hand. */
  function retireCard(): HTMLElement {
    const career = careerStore.get()
    const card = el('section', 'job-card own-card')
    card.setAttribute('aria-labelledby', 'retire-title')
    const head = el('h2', 'job-client', t('end.retireTitle'))
    head.id = 'retire-title'
    const go = button('save-btn quiet', t('end.retire'))
    go.disabled = !!career.job
    if (!career.job) twoTap(go, t('end.retire'), t('end.retireConfirm'), () => careerStore.set(retire(careerStore.get())))
    card.append(head, el('p', 'shop-note', t(career.job ? 'end.retireJob' : 'end.retireNote', { end: careerDate(CAREER.endDay, CAREER.start) })), go)
    return card
  }

  function render() {
    if (!dirty) return
    dirty = false
    const career = careerStore.get()
    const firm = el('section', 'firm-strip')
    firm.setAttribute('aria-label', firmName(career))
    const title = el('div', 'firm-title')
    title.append(el('p', 'firm-title-name', firmName(career)))
    if (career.firm && !career.ended && !renaming) {
      const rename = button('link-btn', t('name.rename'))
      rename.addEventListener('click', () => {
        renaming = true
        dirty = true
        render()
        document.getElementById('firm-name-input')?.focus()
      })
      title.append(rename)
    }
    const money = el('p', 'firm-money', rubles(career.money))
    money.classList.toggle('over', career.money < 0)
    // The firm's name: reputation and correlation score, both from the record of finished jobs.
    const corr = correlationScore(career.history)
    const name = el('div', 'firm-name')
    name.append(
      fact(glossaryTerm('reputation', t('board.reputation')), t('board.outOf', { n: firmReputation(career) })),
      fact(glossaryTerm('correlationScore', t('board.correlation')), corr === null ? t('board.noRecord') : t('board.outOf', { n: corr })),
    )
    firm.append(
      title,
      money,
      el('p', 'firm-date', t(career.jobsDone === 1 ? 'board.dateOne' : 'board.date', { date: careerDate(career.day, CAREER.start), jobs: career.jobsDone })),
      name,
    )
    const rivals = el('section', 'rival-strip')
    rivals.setAttribute('aria-labelledby', 'rivals-title')
    const rivalsHead = el('h2', 'board-heading', t('board.rivals'))
    rivalsHead.id = 'rivals-title'
    rivals.append(rivalsHead)
    for (const firm of RIVAL_IDS) {
      const rec = rivalRecord(career.seed, firm, career.day)
      const row = el('div', 'rival-row')
      const facts = el('div', 'firm-name')
      facts.append(
        fact(t('board.reputation'), t('board.outOf', { n: rec.reputation })),
        fact(t('board.correlation'), t('board.outOf', { n: rec.correlation })),
      )
      row.append(el('p', 'rival-name', RIVALS[firm].name), el('p', 'job-who', RIVALS[firm].blurb), facts)
      rivals.append(row)
    }
    const now = jobCard()
    const boardHead = el('h2', 'board-heading', t('board.title'))
    const list = el('ul', 'job-list')
    // The job in hand has its own card above; the rest of the board waits.
    for (const brief of career.board) if (brief.id !== career.job?.brief.id) list.append(briefCard(brief, !!career.job))
    if (career.board.length === 0 && !career.job) list.append(emptyCard())
    const intro = el('p', 'shop-note', t(career.job ? 'board.oneAtATime' : 'board.intro'))
    const guide = guideCard()
    if (career.ended) {
      page.replaceChildren(firm, legacyCard())
      return
    }
    const naming = !career.firm || renaming ? [nameCard()] : []
    page.replaceChildren(
      firm,
      ...naming,
      ...(guide ? [guide] : []),
      ...(now ? [now] : []),
      boardHead,
      intro,
      list,
      staffCard(),
      workshopCard(),
      ownTunnelCard(),
      rivals,
      retireCard(),
    )
  }

  return {
    setActive(on) {
      active = on
      if (on) render()
    },
  }
}
