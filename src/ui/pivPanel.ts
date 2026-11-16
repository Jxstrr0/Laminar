/**
 * The PIV's panel over the 3D view (PR 10ah): the colour scale with its
 * numbers, the wake's speed loss, and the hint with a "Change this" jump to
 * the slider on the Shape screen. The slice itself is drawn in the scene.
 */
import { PIV_PALETTE } from '../data/piv'
import { t, type StringKey } from '../data/strings'
import type { ControlId } from '../sim/designDiff'
import type { PivHint } from '../sim/pivHint'
import { pivGradient } from '../render/pivScale'
import { fixed } from './format'
import { glossaryTerm } from './glossary'

export interface PivPanel {
  /** The colour scale, over the 3D view next to the slice. */
  legend: HTMLElement
  /** The speed loss and the hint, a row in the sheet so the model stays in view. */
  box: HTMLElement
  /** Show or hide both. */
  setShown(on: boolean): void
  /** The latest reading, or null while the fan is too slow to light the sheet. */
  show(reading: { loss: number; hint: PivHint | null } | null): void
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

/** A share as a percentage with one decimal: 0.084 → "8.4 %". */
const percent = (share: number, digits = 1) => `${fixed(share * 100, digits)}\u00a0%`

/** A slider's name as the Shape screen labels it. */
const controlName = (id: ControlId) => t(`ctl.${id}` as StringKey)

export function createPivPanel(onChange: (control: ControlId) => void): PivPanel {
  // Over the view: the scale, a bar from still air to the tunnel's speed with
  // numbered ticks, so it never relies on colour alone.
  const legend = el('div', 'piv-legend')
  legend.hidden = true
  const title = el('p', 'piv-title')
  title.append(glossaryTerm('piv', t('piv.title')))
  const bar = el('div', 'piv-bar')
  bar.style.background = pivGradient('to right')
  bar.setAttribute('role', 'img')
  bar.setAttribute('aria-label', t('piv.scaleName'))
  const ticks = el('div', 'piv-ticks')
  ticks.setAttribute('aria-hidden', 'true')
  for (const tick of PIV_PALETTE.ticks) {
    const s = el('span', 'piv-tick', percent(tick, 0))
    s.style.left = `${(tick * 100).toFixed(0)}%`
    ticks.append(s)
  }
  legend.append(title, bar, ticks)

  // In the sheet: the speed loss, the hint and its jump.
  const box = el('div', 'piv-box')
  box.hidden = true
  const words = el('div', 'piv-words')
  const loss = el('p', 'piv-loss')
  loss.setAttribute('aria-live', 'polite')
  const hint = el('p', 'piv-hint')
  words.append(loss, hint)
  const change = el('button', 'save-btn piv-change', t('piv.change'))
  change.type = 'button'
  change.hidden = true
  let target: ControlId | null = null
  change.addEventListener('click', () => {
    if (target) onChange(target)
  })
  box.append(words, change)

  let last = ''
  return {
    legend,
    box,
    setShown(on) {
      if (legend.hidden === on) legend.hidden = !on
      if (box.hidden === on) box.hidden = !on
    },
    show(reading) {
      const pct = reading ? percent(reading.loss) : ''
      const h = reading?.hint ?? null
      const name = h ? controlName(h.control) : ''
      const lossText = reading ? t('piv.loss', { pct }) : t('piv.wait')
      const hintText = !reading ? '' : h ? t('piv.hint', { control: name, pct: percent(h.gain, h.gain < 0.01 ? 1 : 0) }) : t('piv.tidy')
      // Only redraw (and only let the live region speak) when the words change.
      const key = `${lossText}|${hintText}`
      if (key === last) return
      last = key
      loss.textContent = lossText
      if (reading) loss.setAttribute('aria-label', t('piv.lossName', { pct }))
      else loss.removeAttribute('aria-label')
      hint.textContent = hintText
      target = h?.control ?? null
      change.hidden = !h
      if (h) change.setAttribute('aria-label', t('piv.changeName', { control: name }))
    },
  }
}
