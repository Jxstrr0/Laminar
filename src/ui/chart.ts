/**
 * A small live chart on a canvas: points from the balance, plotted as they
 * arrive. Plain 2D canvas, coloured from the CSS tokens so it follows the
 * light and dark themes. Every chart also says its latest value in words
 * (the caption and the canvas's label), so nothing rests on colour alone.
 */

export interface ChartPoint {
  x: number
  y: number
  /** Ends of an error bar (a noise band), drawn when given. */
  lo?: number
  hi?: number
}

/**
 * How a series is drawn. Marks differ in shape as well as colour, so A and B
 * read apart without relying on colour.
 * - dot: bold filled dots (this run, or run A)
 * - ring: hollow rings (run B)
 * - faint: small grey dots (the last run, for comparison)
 */
export interface ChartSeries {
  points: ChartPoint[]
  mark: 'dot' | 'ring' | 'faint'
  /** Ring the newest point. */
  latest?: boolean
}

export interface ChartAxis {
  label: string
  unit: string
  digits: number
  /** Fixed ends; leave out to fit the data. */
  min?: number
  max?: number
}

export interface ChartSpec {
  x: ChartAxis
  y: ChartAxis
  series: ChartSeries[]
  /** The chart in words: shown under it and read out by screen readers. */
  caption: string
}

function fmt(v: number, a: ChartAxis): string {
  return v.toLocaleString('en-CA', { minimumFractionDigits: a.digits, maximumFractionDigits: a.digits })
}

/** A value with its unit ("0.236 m²", "15°"). */
export function withUnit(v: number, a: ChartAxis): string {
  return a.unit === '°' ? `${fmt(v, a)}°` : `${fmt(v, a)} ${a.unit}`
}

/** "CdA 0.236 m² at yaw 15° · 28 points", or `empty` with no points. */
export function describeLast(spec: Pick<ChartSpec, 'x' | 'y'>, points: readonly ChartPoint[], empty: string): string {
  const last = points[points.length - 1]
  if (!last) return empty
  return `${spec.y.label} ${withUnit(last.y, spec.y)} at ${spec.x.label.toLowerCase()} ${withUnit(last.x, spec.x)} · ${points.length} points`
}

/** Round, readable tick values covering min..max. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min]
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const ticks: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Number(v.toFixed(10)))
  return ticks
}

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'
}

export function createChart(caption: HTMLElement): { canvas: HTMLCanvasElement; draw(spec: ChartSpec): void } {
  const canvas = document.createElement('canvas')
  canvas.className = 'chart'
  canvas.setAttribute('role', 'img')
  const ctx = canvas.getContext('2d')

  function draw(spec: ChartSpec) {
    const words = spec.caption
    if (caption.textContent !== words) caption.textContent = words
    canvas.setAttribute('aria-label', words)
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w === 0 || h === 0) return
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const yOf = (p: ChartPoint) => p.y
    const all = spec.series.flatMap((s) => s.points)
    const fit = (axis: ChartAxis, pick: (p: ChartPoint) => number): [number, number] => {
      let lo = axis.min ?? Math.min(...all.map(pick), ...(pick === yOf ? all.map((p) => p.lo ?? p.y) : []))
      let hi = axis.max ?? Math.max(...all.map(pick), ...(pick === yOf ? all.map((p) => p.hi ?? p.y) : []))
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) [lo, hi] = [axis.min ?? 0, axis.max ?? 1]
      if (hi - lo < 1e-9) {
        const pad = Math.abs(hi) * 0.05 || 1
        if (axis.min === undefined) lo -= pad
        if (axis.max === undefined) hi += pad
      } else {
        const pad = (hi - lo) * 0.12
        if (axis.min === undefined) lo -= pad
        if (axis.max === undefined) hi += pad
      }
      return [lo, hi]
    }
    const [x0, x1] = fit(spec.x, (p) => p.x)
    const [y0, y1] = fit(spec.y, yOf)

    const font = getComputedStyle(document.documentElement).getPropertyValue('--font-num').trim() || 'monospace'
    ctx.font = `10px ${font}`
    const yTicks = niceTicks(y0, y1)
    const left = Math.max(...yTicks.map((v) => ctx.measureText(fmt(v, spec.y)).width)) + 8
    const pad = { left, right: 8, top: 8, bottom: 18 }
    const px = (x: number) => pad.left + ((x - x0) / (x1 - x0)) * (w - pad.left - pad.right)
    const py = (y: number) => h - pad.bottom - ((y - y0) / (y1 - y0)) * (h - pad.top - pad.bottom)

    // Grid and tick labels.
    ctx.strokeStyle = token('--line')
    ctx.fillStyle = token('--muted')
    ctx.lineWidth = 1
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'right'
    for (const v of yTicks) {
      const y = Math.round(py(v)) + 0.5
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.stroke()
      ctx.fillText(fmt(v, spec.y), pad.left - 4, y)
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (const v of niceTicks(x0, x1, 5)) {
      const x = Math.round(px(v)) + 0.5
      ctx.beginPath()
      ctx.moveTo(x, pad.top)
      ctx.lineTo(x, h - pad.bottom)
      ctx.stroke()
      ctx.fillText(fmt(v, spec.x), x, h - pad.bottom + 4)
    }

    // Faint series first, so the bold ones sit on top.
    // Isobar (PR 13f): data in the pressure colours, dots blue and rings coral, so
    // A and B in a comparison differ by colour as well as by mark.
    const dotColour = token('--cp-lo')
    const ringColour = token('--cp-hi')
    const order = [...spec.series].sort((p, q) => Number(q.mark === 'faint') - Number(p.mark === 'faint'))
    for (const series of order) {
      const faint = series.mark === 'faint'
      const colour = faint ? token('--muted') : series.mark === 'ring' ? ringColour : dotColour
      ctx.globalAlpha = faint ? 0.45 : 1
      ctx.strokeStyle = colour
      ctx.fillStyle = colour
      for (const p of series.points) {
        const x = px(p.x)
        const y = py(p.y)
        if (p.lo !== undefined && p.hi !== undefined) {
          // The noise band as an error bar with small caps.
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(x, py(p.lo))
          ctx.lineTo(x, py(p.hi))
          ctx.moveTo(x - 3, py(p.lo))
          ctx.lineTo(x + 3, py(p.lo))
          ctx.moveTo(x - 3, py(p.hi))
          ctx.lineTo(x + 3, py(p.hi))
          ctx.stroke()
        }
        ctx.beginPath()
        if (series.mark === 'ring') {
          ctx.lineWidth = 1.75
          ctx.fillStyle = token('--panel')
          ctx.arc(x, y, 3.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = colour
        } else {
          ctx.arc(x, y, faint ? 2 : 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      const last = series.points[series.points.length - 1]
      if (series.latest && last) {
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(px(last.x), py(last.y), 5.5, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }

  return { canvas, draw }
}
