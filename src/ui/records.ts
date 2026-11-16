/**
 * The Tarnovian records on screen (PR 11b): the board on the Jobs screen,
 * and the box a debrief shows when a job breaks one. The board itself comes
 * from the sim (src/sim/records.ts).
 */
import { CAREER } from '../data/briefs'
import { RECORD_RULES, RECORDS, type RecordId } from '../data/records'
import { t, type StringKey } from '../data/strings'
import { firmName, firmRecords, type CareerState } from '../sim/career'
import type { RecordMark } from '../sim/records'
import { careerDate, fixed } from './format'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

/** A record's name: "The hour". */
export const recordName = (id: RecordId) => t(`trec.${id}` as StringKey)

/** A mark with its unit, to the precision it's measured to: "51.30 km", "131.5 m", "32.6 L/100 km". */
export function recordValue(id: RecordId, value: number): string {
  const unit = RECORDS[id].unit
  // The scale is 10 or 100: one or two decimals.
  const digits = String(RECORD_RULES.scale[unit]).length - 1
  return t(`trec.${unit}` as StringKey, { n: fixed(value, digits) })
}

/** The records board for the Jobs screen. */
export function recordsCard(career: CareerState): HTMLElement {
  const card = el('section', 'rival-strip records')
  card.setAttribute('aria-labelledby', 'records-title')
  const head = el('h2', 'board-heading', t('trec.title'))
  head.id = 'records-title'
  card.append(head, el('p', 'shop-note', t('trec.intro')))
  const list = el('ul', 'record-list')
  for (const h of firmRecords(career)) {
    const row = el('li', `rival-row record-row${h.ours ? ' is-ours' : ''}`)
    const top = el('div', 'record-top')
    top.append(el('p', 'rival-name', recordName(h.id)), el('p', 'record-value', recordValue(h.id, h.value)))
    const who =
      h.ours && h.day !== null
        ? t('trec.ours', { holder: h.holder, date: careerDate(h.day, CAREER.start), firm: firmName(career) })
        : t('trec.standing', { holder: h.holder, year: RECORDS[h.id].year })
    row.append(top, el('p', 'job-who', who))
    // Your firm's records say so in words as well as the accent, never colour alone.
    if (h.ours) row.append(el('p', 'record-tag', t('trec.oursTag')))
    if (h.was) row.append(el('p', 'shop-note', t('trec.was', { value: recordValue(h.id, h.was.value), holder: h.was.holder })))
    else row.append(el('p', 'shop-note', t(`trec.how.${h.id}` as StringKey)))
    list.append(row)
  }
  card.append(list)
  return card
}

/** The debrief's box when a job broke a record: what it is now, and what it beat. */
export function recordBox(mark: RecordMark, after: CareerState): HTMLElement {
  const held = firmRecords(after).find((h) => h.id === mark.record)
  const box = el('section', 'race-record')
  box.setAttribute('aria-labelledby', 'record-new-title')
  const head = el('h3', 'race-record-title', t('trec.newTitle'))
  head.id = 'record-new-title'
  const was = held?.was ?? { holder: RECORDS[mark.record].holder, value: RECORDS[mark.record].value }
  box.append(
    head,
    el(
      'p',
      'shop-note',
      t('trec.newBody', {
        record: recordName(mark.record),
        value: recordValue(mark.record, mark.value),
        holder: held?.holder ?? '',
        was: recordValue(mark.record, was.value),
        wasHolder: was.holder,
      }),
    ),
  )
  return box
}
