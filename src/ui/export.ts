/**
 * Export on screen (PR 11g): the country tag and note on a brief from
 * abroad, and the name of the cycling rulebook a design is checked against.
 * Which country a brief is from, and its rules, come from src/data/export.ts.
 */
import type { BriefTemplate } from '../data/briefs'
import { COUNTRIES } from '../data/export'
import type { CyclingRules } from '../data/rules'
import { t, type StringKey } from '../data/strings'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

/** A rulebook's name for the rule-break lines: "TCF time-trial rules", "GCU time-trial rules". */
export const bookName = (rules: CyclingRules) => t(`book.${rules.id}` as StringKey)

/** The country tag for a brief's top line, or null for a Tarnovian client. */
export function countryTag(b: BriefTemplate): HTMLElement | null {
  return b.country ? el('span', 'save-slot-tag country-tag', COUNTRIES[b.country].name) : null
}

/**
 * A note under a brief from abroad: what the country is like, the rulebook
 * a rider is checked against there (ski jumpers have none), and that the
 * result won't count for a Tarnovian record.
 */
export function countryNote(b: BriefTemplate): HTMLElement | null {
  if (!b.country) return null
  const { blurb, federation, short } = COUNTRIES[b.country]
  const note = el('p', 'shop-note country-note', blurb)
  if (!b.event.jump) note.append(' ', t('exp.ridden', { federation, short }))
  note.append(' ', t('exp.noRecords'))
  return note
}
