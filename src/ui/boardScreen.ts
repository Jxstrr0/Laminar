/**
 * The Jobs screen (plan section 10, the brief board): the firm's money and
 * date, the job in hand with its days left, and the briefs on offer. Taking
 * a brief puts the client's current setup on the bench; delivering runs the
 * event and pays the fee.
 */
import { CAREER, type BriefTemplate } from '../data/briefs'
import { t } from '../data/strings'
import { acceptBrief, briefTemplate, deliver, type Brief, type Delivery } from '../sim/career'
import { careerStore } from './careerStore'
import { designStore } from './designStore'
import { careerDate, fixed, raceTime, rubles } from './format'
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

  let result: Sheet | null = null
  function showDelivery(d: Delivery) {
    result ??= createSheet({ cls: 'raceday', title: t('race.title'), closeLabel: t('race.close') })
    const b = briefTemplate(d.job.brief.id)!
    const r = d.result
    const facts = el('div', 'job-facts')
    facts.append(
      fact(t('race.time'), raceTime(r.time)),
      fact(t('race.speed'), `${fixed((r.distance / r.time) * 3.6, 1)} km/h`),
      fact(t('race.air'), `${fixed(r.temperature, 0)} °C`),
      fact(t('race.wind'), `${fixed(r.windSpeed, 1)} m/s`),
      fact(t('race.power'), `${fixed(r.power, 0)} W`),
      fact(t('race.paid'), rubles(d.paid)),
    )
    result.body.replaceChildren(
      el('p', 'shop-intro', t('race.intro', { client: b.client, event: b.event.name, km: fixed(km(b), 0) })),
      facts,
      el('p', 'shop-note', t('race.note')),
    )
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
      fact(t('board.daysLeft'), t('board.daysOf', { left: job.daysLeft, days: job.brief.days })),
      fact(t('board.fee'), rubles(job.brief.fee)),
      fact(t('board.spent'), rubles(job.spent)),
      fact(t('board.raceDay'), careerDate(career.day + job.daysLeft, CAREER.start)),
    )
    const actions = el('div', 'job-actions')
    const shape = button('save-btn quiet', t('board.toShape'))
    shape.addEventListener('click', () => go('shape'))
    const words = t('board.deliver')
    const send = button('save-btn', words)
    twoTap(send, words, t('board.deliverConfirm'), () => {
      const d = deliver(careerStore.get(), designStore.get())
      if (!d) return
      careerStore.set(d.state)
      showDelivery(d)
    })
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
