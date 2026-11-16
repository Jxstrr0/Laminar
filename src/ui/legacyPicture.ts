/**
 * The legacy card as a picture to share (Kelbo, 16 November 2026: "Picture to
 * share"). Draws the career's legacy on a 1080 × 1350 canvas in Laminar's own
 * look (colours read from the CSS variables, so it follows the theme), then
 * hands the PNG to the phone's share sheet, or saves it where sharing files
 * isn't possible. Only the credit line is a studio piece (Space Grotesk).
 */
import type { Legacy } from '../sim/legacy'
import { CAREER } from '../data/briefs'
import { t } from '../data/strings'
import { careerDate, fixed, rubles } from './format'
import { downloadBlob } from '../persist/backup'

/** The picture's size, px (4:5 portrait, the shape phones show best). */
export const PICTURE = { width: 1080, height: 1350, margin: 80 }

const UI = "'Instrument Sans', system-ui, sans-serif"
const NUM = "'Spline Sans Mono', ui-monospace, monospace"
const STUDIO = "'Space Grotesk', system-ui, sans-serif"

/**
 * Splits `text` into lines no wider than `max`, breaking at spaces (a single
 * word wider than `max` gets a line to itself). At most `limit` lines; the
 * last one ends with "…" if text was left over.
 */
export function wrapLines(text: string, max: number, measure: (s: string) => number, limit = Infinity): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && measure(next) > max) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  if (lines.length <= limit) return lines
  const kept = lines.slice(0, limit)
  let last = kept[limit - 1] ?? ''
  while (last && measure(`${last}…`) > max) last = last.slice(0, -1).trimEnd()
  kept[limit - 1] = `${last}…`
  return kept
}

/** The best-job line, in the cut's own units: % of drag, metres further, or seconds quicker. */
export function bestText(best: NonNullable<Legacy['best']>): string {
  const key = best.unit === 'm' ? 'end.bestJump' : best.unit === 's' ? 'end.bestSled' : 'end.best'
  return t(key, { client: best.client, event: best.event, cut: fixed(best.cut, best.unit === 's' ? 2 : 1) })
}

/** A file name for the picture: "laminar-legacy-strela-aero-works.png". */
export function pictureFileName(firm: string): string {
  const slug = firm
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `laminar-legacy${slug ? `-${slug}` : ''}.png`
}

/** The label and value pairs on the picture, two to a row. */
function stats(L: Legacy): [string, string][] {
  const rows: [string, string][] = [
    [t('end.jobsDone'), String(L.jobs)],
    [t('end.promises'), String(L.kept)],
    [t('board.reputation'), t('board.outOf', { n: L.reputation })],
    [t('board.correlation'), L.correlation === null ? t('board.noRecord') : t('board.outOf', { n: L.correlation })],
    [t('end.earned'), rubles(L.earned)],
    [t('end.money'), rubles(L.money)],
    [t('end.tunnel'), t(L.ownTunnel ? 'end.yes' : 'end.no')],
  ]
  if (L.broke > 0) rows.push([t('end.broke'), String(L.broke)])
  return rows
}

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/** Streamlines over a teardrop: the game's namesake, drawn across the top. */
function drawFlow(g: CanvasRenderingContext2D, accent: string, body: string): void {
  const { width } = PICTURE
  const cx = width * 0.6
  const cy = 250
  g.save()
  g.fillStyle = body
  g.beginPath()
  g.ellipse(cx, cy, 130, 50, 0, Math.PI / 2, (3 * Math.PI) / 2)
  g.bezierCurveTo(cx + 100, cy - 50, cx + 260, cy - 5, cx + 290, cy)
  g.bezierCurveTo(cx + 260, cy + 5, cx + 100, cy + 50, cx, cy + 50)
  g.fill()
  g.strokeStyle = accent
  g.lineWidth = 3
  g.lineCap = 'round'
  for (let k = -4; k <= 4; k++) {
    if (k === 0) continue
    const y0 = cy + k * 24
    // Lines near the body bend round it more than the far ones.
    const bend = (Math.sign(k) * 70) / Math.abs(k)
    g.globalAlpha = 0.25 + 0.5 / Math.abs(k)
    g.beginPath()
    g.moveTo(0, y0)
    g.bezierCurveTo(cx - 260, y0, cx - 160, y0 + bend, cx, y0 + bend)
    g.bezierCurveTo(cx + 180, y0 + bend, cx + 260, y0, width, y0)
    g.stroke()
  }
  g.restore()
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** Draws the legacy picture on a fresh canvas. */
export function drawLegacy(L: Legacy): HTMLCanvasElement {
  const { width, height, margin } = PICTURE
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const g = c.getContext('2d')
  if (!g) return c
  const col = {
    bg: token('--bg', '#F5F7F9'),
    panel: token('--panel', '#FFFFFF'),
    panel2: token('--panel-2', '#E6EBEF'),
    line: token('--line', '#D3DAE0'),
    ink: token('--ink', '#13202B'),
    muted: token('--muted', '#5A6875'),
    accent: token('--accent', '#2456E8'),
  }
  g.fillStyle = col.bg
  g.fillRect(0, 0, width, height)
  drawFlow(g, col.accent, col.panel2)

  g.textBaseline = 'alphabetic'
  g.fillStyle = col.ink
  g.font = `700 44px ${UI}`
  g.letterSpacing = '8px'
  g.fillText('LAMINAR', margin, 100)
  g.letterSpacing = '0px'

  // The card: lay the text out first, so the card fits it.
  const top = 390
  const pad = 56
  const x = margin + pad
  const inner = width - 2 * x
  const fits = (s: string) => g.measureText(s).width
  g.font = `700 60px ${UI}`
  const nameLines = wrapLines(L.firm, inner, fits, 2)
  g.font = `600 30px ${UI}`
  const bestLines = L.best ? wrapLines(bestText(L.best), inner, fits, 3) : []
  const rows = stats(L)
  const rowH = 88
  const statsTop = top + 76 + nameLines.length * 72 + 48 + 24
  const statsEnd = statsTop + Math.ceil(rows.length / 2) * rowH
  const bottom = statsEnd + (bestLines.length ? 28 + bestLines.length * 42 : 0) + 48

  roundRect(g, margin, top, width - 2 * margin, bottom - top, 28)
  g.fillStyle = col.panel
  g.fill()
  g.strokeStyle = col.line
  g.lineWidth = 2
  g.stroke()
  g.fillStyle = col.accent
  roundRect(g, margin, top, width - 2 * margin, 10, 5)
  g.fill()

  let y = top + 76
  g.fillStyle = col.accent
  g.font = `700 28px ${UI}`
  g.letterSpacing = '4px'
  g.fillText(t('end.kicker').toUpperCase(), x, y)
  g.letterSpacing = '0px'

  g.fillStyle = col.ink
  g.font = `700 60px ${UI}`
  for (const line of nameLines) {
    y += 72
    g.fillText(line, x, y)
  }
  y += 48
  g.fillStyle = col.muted
  g.font = `400 28px ${UI}`
  const span = t(L.ending?.why === 'year2040' ? 'end.span2040' : 'end.spanRetired', {
    from: careerDate(L.fromDay, CAREER.start),
    to: careerDate(L.toDay, CAREER.start),
  })
  g.fillText(wrapLines(span, inner, fits, 1)[0] ?? '', x, y)

  // Two columns of numbers.
  const colW = inner / 2
  rows.forEach(([label, value], i) => {
    const cx = x + (i % 2) * colW
    const ry = statsTop + Math.floor(i / 2) * rowH
    g.fillStyle = col.muted
    g.font = `400 26px ${UI}`
    g.fillText(wrapLines(label, colW - 24, fits, 1)[0] ?? '', cx, ry + 36)
    g.fillStyle = col.ink
    g.font = `500 38px ${NUM}`
    g.fillText(wrapLines(value, colW - 24, fits, 1)[0] ?? '', cx, ry + 80)
  })

  if (bestLines.length) {
    y = statsEnd + 14
    g.strokeStyle = col.line
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + inner, y)
    g.stroke()
    y += 14
    g.fillStyle = col.ink
    g.font = `600 30px ${UI}`
    for (const line of bestLines) {
      y += 42
      g.fillText(line, x, y)
    }
  }

  // Footer: the game's address, then the studio credit.
  g.fillStyle = col.muted
  g.font = `400 28px ${NUM}`
  g.fillText(t('end.site'), margin, height - 90)
  g.font = `500 26px ${STUDIO}`
  g.fillText(t('end.credit'), margin, height - 48)
  return c
}

export type ShareResult = 'shared' | 'saved' | 'cancelled' | 'failed'

/** Draws the picture and shares it (or saves it where the browser can't share files). */
export async function shareLegacy(L: Legacy): Promise<ShareResult> {
  try {
    // Canvas text only uses a web font once it has loaded.
    await Promise.all([`700 60px ${UI}`, `400 28px ${UI}`, `600 30px ${UI}`, `500 38px ${NUM}`, `500 26px ${STUDIO}`].map((f) => document.fonts.load(f)))
  } catch {
    // Fall back to the system fonts named after each family.
  }
  const canvas = drawLegacy(L)
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'))
  if (!blob) return 'failed'
  const name = pictureFileName(L.firm)
  const file = new File([blob], name, { type: 'image/png' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: t('end.pictureTitle', { firm: L.firm }) })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // Sharing broke for another reason: save the file instead.
    }
  }
  downloadBlob(name, blob)
  return 'saved'
}
