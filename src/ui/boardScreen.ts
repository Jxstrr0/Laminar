/**
 * The Jobs screen (plan section 10, the brief board): the firm's money and
 * date, the job in hand with its days left, and the briefs on offer. Taking
 * a brief puts the client's current setup on the bench; delivering runs the
 * event and pays the fee.
 */
import { CAREER, type BriefTemplate } from '../data/briefs'
import { t } from '../data/strings'
import { acceptBrief, briefTemplate, deliver, eventOf, type Brief, type Delivery } from '../sim/career'
import { deskEstimate } from '../sim/desk'
import { cyclistShape } from '../sim/geom/cyclist'
import { careerStore } from './careerStore'
import { designStore } from './designStore'
import { careerDate, fixed, raceTime, rubles } from './format'
import { glossaryTerm } from './glossary'
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

/** A label and a value, side by side in a card's facts grid. */
function fact(label: string, value: string): HTMLElement {
  const box = el('div', 'job-fact')
  box.append(el('span', 'job-fact-label', label), el('span', 'job-fact-value', value))
  return box
}

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
      const d = deliver(careerStore.get(), designStore.get(), predicted)
      if (!d) return
      deliverSheet?.close()
      careerStore.set(d.state)
      showDelivery(d)
    })
    deliverSheet.body.replaceChildren(
      el('p', 'shop-intro', t('deliver.intro', { client: b.client, event: b.event.name })),
      el('p', 'deliver-promise', t('deliver.promise', { pct: fixed(job.promise, 0) })),
      el('p', 'shop-note', t('deliver.promiseNote')),
      label,
      row,
      el('p', 'shop-note', t('deliver.deskNote', { desk: fixed(desk.value, 3), spread: fixed((desk.high - desk.low) / 2, 3) })),
      status,
      race,
    )
    deliverSheet.open()
  }

  function showDelivery(d: Delivery) {
    result ??= createSheet({ cls: 'raceday', title: t('race.title'), closeLabel: t('race.close') })
    const b = briefTemplate(d.job.brief.id)!
    const r = d.result
    const db = d.debrief
    const saved = db.timeSaved
    const verdict = el(
      'p',
      `race-verdict ${db.met ? 'is-met' : 'is-missed'}`,
      db.met
        ? t('race.kept', { got: fixed(db.achieved, 1), promised: fixed(db.promised, 0) })
        : t('race.missed', { short: fixed(db.shortfall, 1), got: fixed(db.achieved, 1), promised: fixed(db.promised, 0) }),
    )
    const pct = fixed(Math.abs(db.readError) * 100, 1)
    const facts = el('div', 'job-facts')
    facts.append(
      fact(t('race.time'), raceTime(r.time)),
      fact(t('race.vsOld'), t(saved >= 0 ? 'race.faster' : 'race.slower', { time: raceTime(Math.abs(saved)) })),
      fact(t('race.predicted'), `${fixed(db.predicted, 3)} m²`),
      fact(t('race.actual'), `${fixed(db.actual, 3)} m²`),
      fact(t('race.read'), t(`race.read.${db.read}`, { pct, dir: t(db.readError >= 0 ? 'race.high' : 'race.low') })),
      fact(t('race.speed'), `${fixed((r.distance / r.time) * 3.6, 1)} km/h`),
      fact(t('race.air'), `${fixed(r.temperature, 0)} °C`),
      fact(t('race.wind'), `${fixed(r.windSpeed, 1)} m/s`),
      fact(t('race.power'), `${fixed(r.power, 0)} W`),
      fact(t('race.fee'), rubles(d.job.brief.fee)),
      fact(t('race.penalty'), db.penalty ? `−${rubles(db.penalty)}` : rubles(0)),
      fact(t('race.paid'), rubles(d.paid)),
    )
    const parts: HTMLElement[] = [
      el('p', 'shop-intro', t('race.intro', { client: b.client, event: b.event.name, km: fixed(km(b), 0) })),
      verdict,
      facts,
    ]
    if (db.cause) parts.push(el('p', 'shop-note', t(db.cause === 'design' ? 'race.causeDesign' : 'race.causeDay')))
    parts.push(el('p', 'shop-note', t('race.readNote')))
    result.body.replaceChildren(...parts)
    result.open()
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
      fact(t('board.promise'), t('board.promiseValue', { pct: fixed(job.promise, 0) })),
      fact(t('board.daysLeft'), t('board.daysOf', { left: job.daysLeft, days: job.brief.days })),
      fact(t('board.fee'), rubles(job.brief.fee)),
      fact(t('board.spent'), rubles(job.spent)),
      fact(t('board.raceDay'), careerDate(career.day + job.daysLeft, CAREER.start)),
    )
    const actions = el('div', 'job-actions')
    const shape = button('save-btn quiet', t('board.toShape'))
    shape.addEventListener('click', () => go('shape'))
    const send = button('save-btn', t('board.deliver'))
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
      fact(t('board.wants'), t('board.promiseValue', { pct: fixed(b.target, 0) })),
      fact(t('board.fee'), rubles(brief.fee)),
      fact(t('board.days'), String(brief.days)),
      fact(t('board.course'), `${fixed(km(b), 0)} km`),
      fact(t('board.wind'), `~${fixed(b.event.windSpeed, 0)} m/s`),
      fact(t('board.power'), `${fixed(b.rider.power, 0)} W`),
      fact(t('board.where'), b.event.place),
    )
    card.append(top, el('p', 'job-who', b.who), el('blockquote', 'job-goal', b.goal), el('p', 'job-event', b.event.name), facts)
    const take = button('save-btn', t('board.take'))
    if (busy) {
      take.disabled = true
      take.textContent = t('board.busy')
    } else {
      twoTap(take, t('board.take'), t('board.takeConfirm'), () => {
        const next = acceptBrief(careerStore.get(), brief.id)
        if (next === careerStore.get()) return
        // The client's current setup goes on the bench: the job starts from how they ride now.
        designStore.set(structuredClone(b.setup))
        careerStore.set(next)
      })
    }
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
    firm.append(
      money,
      el('p', 'firm-date', t(career.jobsDone === 1 ? 'board.dateOne' : 'board.date', { date: careerDate(career.day, CAREER.start), jobs: career.jobsDone })),
    )
    const now = jobCard()
    const boardHead = el('h2', 'board-heading', t('board.title'))
    const list = el('ul', 'job-list')
    // The job in hand has its own card above; the rest of the board waits.
    for (const brief of career.board) if (brief.id !== career.job?.brief.id) list.append(briefCard(brief, !!career.job))
    const intro = el('p', 'shop-note', t(career.job ? 'board.oneAtATime' : 'board.intro'))
    page.replaceChildren(firm, ...(now ? [now] : []), boardHead, intro, list)
  }

  return {
    setActive(on) {
      active = on
      if (on) render()
    },
  }
}
