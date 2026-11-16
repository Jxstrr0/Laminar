/**
 * The Jobs screen (plan section 10, the brief board): the firm's money and
 * date, the job in hand with its days left, and the briefs on offer. A brief
 * is won with a sealed bid (price and promise) against one rival firm;
 * winning puts the client's current setup on the bench. Delivering runs the
 * event and pays the fee.
 */
import { BID, CAREER, PROMISE, TRACK, type BriefTemplate } from '../data/briefs'
import { REPUTATION } from '../data/reputation'
import type { CyclistDesign } from '../data/cyclist'
import { t } from '../data/strings'
import {
  bidScore,
  briefTemplate,
  deliver,
  eventOf,
  placeBid,
  waitForBriefs,
  type Brief,
  type BidResult,
  type Delivery,
} from '../sim/career'
import { deskEstimate } from '../sim/desk'
import { correlationScore, reputationOf } from '../sim/reputation'
import type { FixTarget } from '../sim/failure'
import { cyclistShape } from '../sim/geom/cyclist'
import { careerStore } from './careerStore'
import { designStore } from './designStore'
import { careerDate, fixed, pct, raceTime, rubles, rublesShort, shortTime } from './format'
import { glossaryTerm } from './glossary'
import { GUIDE_STEPS, currentStep, guideOn, hideGuide, stepDone } from '../sim/guide'
import { playReplay } from './replayOverlay'
import { createSheet, type Sheet } from './sheet'
import { twoTap } from './twoTap'

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
    const b = briefTemplate(job.brief.id)!
    const design = designStore.get()
    const desk = deskEstimate(cyclistShape(design), eventOf(job.brief), job.brief.seed, JSON.stringify(design))
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

  /** The race-day replay for a delivery, then `after`. */
  function replay(d: Delivery, design: CyclistDesign, after: () => void) {
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
      lap: b.event.indoor ? TRACK.lap : undefined,
      onDone: after,
    })
  }

  function showDelivery(d: Delivery, design: CyclistDesign) {
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
      fact(
        glossaryTerm('reputation', t('race.reputation')),
        t('race.repChange', { after: db.reputation.after, change: signed(db.reputation.after - db.reputation.before) }),
      ),
    )
    const parts: HTMLElement[] = [
      el('p', 'shop-intro', t('race.intro', { client: b.client, event: b.event.name, km: fixed(km(b), 0) })),
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
    if (db.fade) trouble(t('race.fade', { client: b.client, time: shortTime(db.fade.lost) }), db.fade.fix, t('race.fix.position'))
    if (db.baseline.lostToGusts > 0) parts.push(el('p', 'shop-note', t('race.oldGusts', { time: shortTime(db.baseline.lostToGusts) })))
    parts.push(el('p', 'shop-note', t('race.readNote')))
    const again = button('save-btn quiet', t('race.replay'))
    again.addEventListener('click', () => {
      result?.close()
      replay(d, design, () => showDelivery(d, design))
    })
    parts.push(again)
    result.body.replaceChildren(...parts)
    result.open()
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
    const promise = stepper('bid-promise', String(b.target), '%', t('bid.promiseLess'), t('bid.promiseMore'), (dir) => {
      const v = Number(promise.input.value) || b.target
      const next = Math.round(v / BID.promiseStep) * BID.promiseStep + dir * BID.promiseStep
      promise.input.value = String(Math.min(BID.promiseMax, Math.max(BID.promiseMin, next)))
      update()
    })
    promise.input.step = String(BID.promiseStep)
    promise.input.min = String(BID.promiseMin)
    promise.input.max = String(BID.promiseMax)
    const priceLabel = el('label', 'shop-label', t('bid.price'))
    priceLabel.htmlFor = price.input.id
    const promiseLabel = el('label', 'shop-label', t('bid.promise'))
    promiseLabel.htmlFor = promise.input.id
    const worth = el('p', 'shop-note')
    worth.setAttribute('aria-live', 'polite')
    const status = el('p', 'shop-note')
    status.setAttribute('aria-live', 'polite')
    const worthOf = Math.round((((b.fee.min + b.fee.max) / 2) * BID.pointValue) / 100) * 100
    function update() {
      const p = Number(price.input.value) || brief.fee
      worth.textContent = t('bid.worth', { worth: rubles(worthOf), cost: rubles(Math.round((p * PROMISE.perPoint) / 100) * 100) })
    }
    price.input.addEventListener('input', update)
    update()
    const seal = button('shop-order', t('bid.seal'))
    seal.addEventListener('click', () => {
      const p = Number(price.input.value)
      const q = Number(promise.input.value)
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
      el('p', 'shop-note', t('bid.ask', { pct: pct(b.target) })),
      worth,
      status,
      seal,
    )
    bidSheet.open()
  }

  function showBids(r: BidResult) {
    bidsSheet ??= createSheet({ cls: 'bids', title: t('bids.title'), closeLabel: t('bids.close') })
    const id = r.state.job?.brief.id ?? r.state.lost[r.state.lost.length - 1]!
    const verdict = el('p', `race-verdict ${r.won ? 'is-met' : 'is-missed'}`, t(r.won ? (r.rival ? 'bids.won' : 'bids.solo') : 'bids.lost'))
    const facts = el('div', 'job-facts')
    facts.append(fact(t('bids.yourPrice'), rubles(r.mine.price)), fact(t('bids.yourPromise'), t('board.promiseValue', { pct: pct(r.mine.promise) })))
    if (r.rival) {
      facts.append(
        fact(t('bids.theirPrice'), rubles(r.rival.price)),
        fact(t('bids.theirPromise'), t('board.promiseValue', { pct: pct(r.rival.promise) })),
        fact(glossaryTerm('reputation', t('bids.yourRep')), String(r.myRep)),
        fact(glossaryTerm('reputation', t('bids.theirRep')), String(r.rivalRep)),
        fact(t('bids.yourValue'), rubles(bidScore(id, r.mine, r.myRep))),
        fact(t('bids.theirValue'), rubles(bidScore(id, r.rival, r.rivalRep))),
      )
    }
    const parts: HTMLElement[] = [verdict, facts]
    if (r.rival)
      parts.push(
        el('p', 'shop-note', t('bids.how', { worth: rubles(r.worth), max: rubles(briefTemplate(id)!.fee.max), rep: String(Math.round(1 / REPUTATION.bidPerPoint)) })),
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

  function emptyCard(): HTMLElement {
    const card = el('li', 'job-card')
    const wait = button('save-btn', t('board.wait'))
    wait.addEventListener('click', () => careerStore.set(waitForBriefs(careerStore.get())))
    const actions = el('div', 'job-actions')
    actions.append(wait)
    card.append(el('p', 'job-who', t('board.empty')), actions)
    return card
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
      fact(t('board.promise'), t('board.promiseValue', { pct: pct(job.promise) })),
      fact(t('board.daysLeft'), t('board.daysOf', { left: job.daysLeft, days: job.brief.days })),
      fact(t('board.fee'), rubles(job.brief.fee)),
      fact(t('board.spent'), rubles(job.spent)),
      fact(t('board.raceDay'), careerDate(career.day + job.daysLeft, CAREER.start)),
    )
    const actions = el('div', 'job-actions')
    const shape = button('save-btn quiet guide-shape', t('board.toShape'))
    shape.addEventListener('click', () => go('shape'))
    const send = button('save-btn guide-deliver', t('board.deliver'))
    send.addEventListener('click', openDeliver)
    actions.append(shape, send)
    card.append(
      head,
      el('p', 'job-client', b.client),
      el('p', 'job-event', `${b.event.name} · ${fixed(km(b), 0)} km`),
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
    facts.append(
      fact(t('board.wants'), t('board.promiseValue', { pct: pct(b.target) })),
      fact(t('board.feeRange'), `${rublesShort(b.fee.min)}–${rublesShort(b.fee.max)}`),
      fact(t('board.days'), String(brief.days)),
      fact(t('board.course'), `${fixed(km(b), 0)} km`),
      fact(t('board.wind'), b.event.indoor ? t('board.indoors') : `~${fixed(b.event.windSpeed, 0)} m/s`),
      fact(t('board.power'), `${fixed(b.rider.power, 0)} W`),
      fact(t('board.where'), b.event.place),
    )
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

  function render() {
    if (!dirty) return
    dirty = false
    const career = careerStore.get()
    const firm = el('section', 'firm-strip')
    firm.setAttribute('aria-label', t('board.firmName'))
    const money = el('p', 'firm-money', rubles(career.money))
    money.classList.toggle('over', career.money < 0)
    // The firm's name: reputation and correlation score, both from the record of finished jobs.
    const corr = correlationScore(career.history)
    const name = el('div', 'firm-name')
    name.append(
      fact(glossaryTerm('reputation', t('board.reputation')), t('board.outOf', { n: reputationOf(career.history) })),
      fact(glossaryTerm('correlationScore', t('board.correlation')), corr === null ? t('board.noRecord') : t('board.outOf', { n: corr })),
    )
    firm.append(
      money,
      el('p', 'firm-date', t(career.jobsDone === 1 ? 'board.dateOne' : 'board.date', { date: careerDate(career.day, CAREER.start), jobs: career.jobsDone })),
      name,
    )
    const now = jobCard()
    const boardHead = el('h2', 'board-heading', t('board.title'))
    const list = el('ul', 'job-list')
    // The job in hand has its own card above; the rest of the board waits.
    for (const brief of career.board) if (brief.id !== career.job?.brief.id) list.append(briefCard(brief, !!career.job))
    if (career.board.length === 0 && !career.job) list.append(emptyCard())
    const intro = el('p', 'shop-note', t(career.job ? 'board.oneAtATime' : 'board.intro'))
    const guide = guideCard()
    page.replaceChildren(firm, ...(guide ? [guide] : []), ...(now ? [now] : []), boardHead, intro, list)
  }

  return {
    setActive(on) {
      active = on
      if (on) render()
    },
  }
}
