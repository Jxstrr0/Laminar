/**
 * The CFD Cluster's panel in the tunnel sheet (PR 12c): a Run button, the
 * progress, the second drag estimate with the change since the last run, and
 * a side-on slice of the simulated flow with a numbered colour scale. Runs
 * are free and are never saved: the last one is kept only for this visit, so
 * the next design has something to compare with.
 */
import { CFD } from '../data/cfd'
import { PIV_PALETTE } from '../data/piv'
import { t } from '../data/strings'
import type { RiderState } from '../render/riderFigure'
import { pivGradient, pivRgb } from '../render/pivScale'
import { runCfd, type CfdResult } from './cfdRun'
import { fixed } from './format'
import { glossaryTerm } from './glossary'

/** What's on the mount now: null when there's nothing the CFD can run on. */
export interface CfdSetup {
  state: RiderState
  yawDeg: number
  /** Changes whenever the model or its yaw does, so an old answer is marked stale. */
  key: string
}

export interface CfdPanel {
  box: HTMLElement
  /** Show or hide it; hiding stops a run. */
  setShown(on: boolean): void
  /** Called each frame with the setup's key, to mark an answer from an older setting. */
  setKey(key: string): void
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

const percent = (share: number, digits = 1) => `${fixed(share * 100, digits)}\u00a0%`

/** The last finished run this visit: what the next one is compared with. */
let previous: { cdA: number; key: string } | null = null

export function createCfdPanel(setup: () => CfdSetup | null): CfdPanel {
  const box = el('div', 'cfd-box')
  box.hidden = true
  const head = el('div', 'cfd-head')
  const title = el('p', 'cfd-title')
  title.append(glossaryTerm('cfd', t('up.cfd')))
  const run = el('button', 'save-btn cfd-run', t('cfd.run'))
  run.type = 'button'
  head.append(title, run)

  const status = el('p', 'cfd-status', t('cfd.idle'))
  status.setAttribute('aria-live', 'polite')
  const meter = el('progress', 'cfd-meter')
  meter.max = 1
  meter.value = 0
  meter.hidden = true
  meter.setAttribute('aria-label', t('cfd.progressName'))
  const reading = el('p', 'cfd-reading')
  const delta = el('p', 'cfd-delta')
  const stale = el('p', 'cfd-stale', t('cfd.stale'))
  stale.hidden = true

  // The slice, with its scale underneath: numbers, never colour alone.
  const figure = el('figure', 'cfd-figure')
  figure.hidden = true
  const canvas = el('canvas', 'cfd-slice')
  canvas.width = CFD.grid.nx
  canvas.height = CFD.grid.nz
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', t('cfd.sliceName'))
  const scale = el('div', 'cfd-scale')
  const bar = el('div', 'piv-bar')
  bar.style.background = pivGradient('to right')
  bar.setAttribute('role', 'img')
  bar.setAttribute('aria-label', t('cfd.scaleName'))
  const ticks = el('div', 'piv-ticks')
  ticks.setAttribute('aria-hidden', 'true')
  for (const tick of PIV_PALETTE.ticks) {
    const s = el('span', 'piv-tick', percent(tick, 0))
    s.style.left = `${(tick * 100).toFixed(0)}%`
    ticks.append(s)
  }
  scale.append(bar, ticks)
  const caption = el('figcaption', 'cfd-caption', t('cfd.caption'))
  figure.append(canvas, scale, caption)
  const bias = el('p', 'cfd-bias', t('cfd.bias'))

  box.append(head, status, meter, reading, delta, stale, figure, bias)

  let running = false
  let stopping = false
  let shownKey = ''

  function draw(result: CfdResult) {
    const { w, h, speed, body } = result.slice
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(w, h)
    // The model in the theme's grey: no blue in it, so it stands apart from both slow and fast air.
    const grey = getComputedStyle(box).getPropertyValue('--muted').trim()
    const solid = /^#[0-9a-f]{6}$/i.test(grey) ? [1, 3, 5].map((k) => parseInt(grey.slice(k, k + 2), 16)) : [90, 104, 117]
    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) {
        const src = x + w * z
        // Canvas rows run top down; the grid's run from the floor up.
        const dst = (x + w * (h - 1 - z)) * 4
        const rgb = body[src] ? solid : pivRgb(speed[src]!)
        img.data[dst] = rgb[0]!
        img.data[dst + 1] = rgb[1]!
        img.data[dst + 2] = rgb[2]!
        img.data[dst + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  async function start() {
    const now = setup()
    if (!now || running) return
    running = true
    stopping = false
    run.textContent = t('cfd.stop')
    meter.hidden = false
    meter.value = 0
    stale.hidden = true
    const outcome = await runCfd(
      now.state,
      now.yawDeg,
      (p) => {
        meter.value = p.done
        status.textContent = p.stage === 'cells' ? t('cfd.cells') : t('cfd.solving', { pct: percent(p.done, 0) })
      },
      () => stopping,
    )
    running = false
    meter.hidden = true
    run.textContent = t('cfd.again')
    if (!outcome.ok) {
      status.textContent =
        outcome.why === 'slow' ? t('cfd.slow', { min: String(outcome.minutes ?? 0) }) : outcome.why === 'stopped' ? t('cfd.stopped') : outcome.why === 'empty' ? t('cfd.empty') : t('cfd.device')
      return
    }
    const { result } = outcome
    status.textContent = t('cfd.done', { yaw: fixed(now.yawDeg, 0) })
    reading.textContent = t('cfd.result', { cda: fixed(result.cdA, 3) })
    if (previous && previous.key !== now.key) {
      const change = result.cdA / previous.cdA - 1
      delta.textContent = t('cfd.delta', { sign: change > 0 ? '+' : change < 0 ? '−' : '±', pct: percent(Math.abs(change)), cda: fixed(previous.cdA, 3) })
    } else delta.textContent = t('cfd.first')
    previous = { cdA: result.cdA, key: now.key }
    shownKey = now.key
    figure.hidden = false
    draw(result)
  }

  run.addEventListener('click', () => {
    if (running) stopping = true
    else void start()
  })

  return {
    box,
    setShown(on) {
      if (box.hidden !== on) return
      box.hidden = !on
      if (!on && running) stopping = true
    },
    setKey(key) {
      const old = shownKey !== '' && key !== shownKey
      if (stale.hidden === old) stale.hidden = !old
    },
  }
}
