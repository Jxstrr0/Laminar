/**
 * The R&D card on the Jobs screen (PR 11e): the four areas, each project's
 * price, days and what it changes, and a Start button (two taps) for the
 * one the firm can begin. One project runs at a time.
 */
import { CAREER } from '../data/briefs'
import { DESK } from '../data/cyclist'
import { RESEARCH, RESEARCH_AREAS, RESEARCH_IDS, type ResearchId } from '../data/research'
import type { StaffTrait } from '../data/staff'
import { t, type StringKey } from '../data/strings'
import { startResearch, type CareerState } from '../sim/career'
import { finishedResearch, researchBlock, researchReadyDay, researchUnderWay } from '../sim/research'
import { careerDate, fixed, rubles } from './format'
import { twoTap } from './twoTap'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

const name = (id: ResearchId) => t(`rnd.${id}` as StringKey)
/** A factor as a whole percentage change: 0.75 → "25", 1.3 → "30". */
const pctOf = (factor: number) => fixed(Math.abs(factor - 1) * 100, 0)

/** What a project changes, in words with its number. */
export function effectText(e: StaffTrait): string {
  if (e.deskLevel) return t('rnd.effect.desk', { pct: fixed(e.deskLevel * DESK.perLevel * 100, 0) })
  if (e.balanceNoise) return t('rnd.effect.noise', { pct: pctOf(e.balanceNoise) })
  if (e.modelPrice) return t('rnd.effect.price', { pct: pctOf(e.modelPrice) })
  if (e.modelDays) return t('rnd.effect.days', { pct: pctOf(e.modelDays) })
  if (e.mountStrength) return t('rnd.effect.mount', { pct: pctOf(e.mountStrength) })
  return ''
}

/** The card. `set` stores the career after a project starts. */
export function researchCard(career: CareerState, set: (next: CareerState) => void): HTMLElement {
  const card = el('section', 'job-card own-card')
  card.setAttribute('aria-labelledby', 'rd-title')
  const head = el('h2', 'job-client', t('rnd.title'))
  head.id = 'rd-title'
  card.append(head, el('p', 'job-who', t('rnd.intro')))
  const busy = researchUnderWay(career.research, career.day)
  if (busy) {
    const ready = researchReadyDay(career.research, busy)!
    card.append(el('p', 'shop-note', t('rnd.busy', { name: name(busy), date: careerDate(ready, CAREER.start) })))
  }
  for (const area of RESEARCH_AREAS) {
    card.append(el('h3', 'bids-firm', t(`rnd.area.${area}` as StringKey)))
    const list = el('ul', 'upgrade-list')
    for (const id of RESEARCH_IDS.filter((r) => RESEARCH[r].area === area)) {
      const p = RESEARCH[id]
      const row = el('li', 'upgrade')
      const title = el('p', 'upgrade-name', name(id))
      row.append(title, el('p', 'job-who', effectText(p.effect)))
      const ready = researchReadyDay(career.research, id)
      if (ready !== null && career.day >= ready) title.append(' ', el('span', 'save-slot-tag', t('rnd.done')))
      else if (ready !== null) row.append(el('p', 'shop-note', t('rnd.under', { date: careerDate(ready, CAREER.start) })))
      else {
        const block = researchBlock(career.research, career.day, career.money, id)
        // Say what comes first even while another project is under way.
        if (p.needs && !finishedResearch(career.research, career.day).includes(p.needs)) row.append(el('p', 'shop-note', t('rnd.needs', { first: name(p.needs) })))
        const line = el('div', 'upgrade-buy')
        const start = el('button', 'save-btn', t('rnd.start'))
        start.type = 'button'
        start.disabled = block !== null || !!career.ended
        if (!start.disabled) twoTap(start, t('rnd.start'), t('rnd.startConfirm', { price: rubles(p.price) }), () => set(startResearch(career, id)))
        line.append(el('span', 'upgrade-cost', t('rnd.cost', { price: rubles(p.price), days: p.days })), start)
        row.append(line)
      }
      list.append(row)
    }
    card.append(list)
  }
  return card
}
