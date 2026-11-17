/**
 * The Cp map's legend (Isobar, PR 13i): a white pill with "Cp" on top, a slim
 * colour bar (suction on the left, pressure on the right) with numbered ticks
 * under it, and the highest and lowest readings the taps took, with where.
 * The numbers carry the reading, so the map never relies on colour alone. It
 * sits at the side of the 3D view to keep the model clear on a phone.
 */
import { CP_PALETTE } from '../data/flowViz'
import { STRINGS, t, type StringKey } from '../data/strings'
import type { TapExtremes } from '../sim/flow/taps'
import { cpGradient, cpPosition } from '../render/cpScale'
import { fixed } from './format'
import { glossaryTerm } from './glossary'

/** A Cp with its sign, using a true minus: +0.96, −1.21, 0.00. */
export function signedCp(cp: number, digits = 2): string {
  const text = fixed(Math.abs(cp), digits)
  if (Number(text) === 0) return text
  return `${cp < 0 ? '−' : '+'}${text}`
}

/** A body id (thigh-1, upper-arm-2) as a part name the player reads. */
export function partName(bodyId: string): string {
  const base = bodyId.replace(/-\d+$/, '')
  const key = `part.${base}`
  return key in STRINGS ? t(key as StringKey) : base.replace(/-/g, ' ')
}

export interface CpLegend {
  root: HTMLElement
  /** The latest scan's extremes, or null while the fan is too slow to read. */
  show(extremes: TapExtremes | null): void
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = cls
  return node
}

export function createCpLegend(): CpLegend {
  const root = el('div', 'cp-legend')
  root.hidden = true

  const title = el('p', 'cp-title')
  title.append(glossaryTerm('cp', t('cp.title')))

  const scale = el('div', 'cp-scale')
  const bar = el('div', 'cp-bar')
  bar.style.background = cpGradient('to right')
  bar.setAttribute('role', 'img')
  bar.setAttribute('aria-label', t('cp.legend', { min: signedCp(CP_PALETTE.min, 1), max: signedCp(CP_PALETTE.max, 1) }))
  const ticks = el('div', 'cp-ticks')
  ticks.setAttribute('aria-hidden', 'true')
  for (const tick of CP_PALETTE.ticks) {
    const s = el('span', 'cp-tick')
    s.textContent = signedCp(tick, 1)
    s.style.left = `${(cpPosition(tick) * 100).toFixed(1)}%`
    ticks.append(s)
  }
  scale.append(bar, ticks)

  const high = el('p', 'cp-line')
  const low = el('p', 'cp-line')

  root.append(title, scale, high, low)

  let last = ''
  return {
    root,
    show(x) {
      const key = x ? `${x.pressure.cp.toFixed(2)}|${x.pressure.bodyId}|${x.suction.cp.toFixed(2)}|${x.suction.bodyId}` : ''
      if (key === last && high.textContent) return
      last = key
      if (!x) {
        high.textContent = t('cp.fanUp')
        low.textContent = ''
        low.hidden = true
        return
      }
      low.hidden = false
      high.textContent = t('cp.high', { cp: signedCp(x.pressure.cp), part: partName(x.pressure.bodyId) })
      low.textContent = t('cp.low', { cp: signedCp(x.suction.cp), part: partName(x.suction.bodyId) })
    },
  }
}
