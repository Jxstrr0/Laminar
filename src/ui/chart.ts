/**
 * A small live chart on a canvas: points from the balance, plotted as they
 * arrive. Plain 2D canvas, coloured from the CSS tokens so it follows the
 * light and dark themes. Every chart also says its latest value in words
 * (the caption and the canvas's label), so nothing rests on colour alone.
 */

export interface ChartPoint {
  x: number
  y: number
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
  /** This run's points, drawn bold. */
  current: ChartPoint[]
  /** The last run's points, drawn faint for comparison. */
  previous: ChartPoint[]
  /** What to say when there's nothing to draw yet. */
  empty: string
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
    const fmt = (v: number, a: ChartAxis) => v.toLocaleString('en-CA', { minimumFractionDigits: a.digits, maximumFractionDigits: a.digits })
    const withUnit = (v: number, a: ChartAxis) => (a.unit === '°' ? `${fmt(v, a)}°` : `${fmt(v, a)} ${a.unit}`)
    const last = spec.current[spec.current.length - 1]
    const words = last
      ? `${spec.y.label} ${withUnit(last.y, spec.y)} at ${spec.x.label.toLowerCase()} ${withUnit(last.x, spec.x)} · ${spec.current.length} points`
      : spec.empty
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

    const all = [...spec.current, ...spec.previous]
    const fit = (axis: ChartAxis, pick: (p: ChartPoint) => number): [number, number] => {
      let lo = axis.min ?? Math.min(...all.map(pick))
      let hi = axis.max ?? Math.max(...all.map(pick))
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
    const [y0, y1] = fit(spec.y, (p) => p.y)

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

    // The last run, faint; this run, bold; the newest point ringed.
    const dots = (pts: ChartPoint[], colour: string, r: number) => {
      ctx.fillStyle = colour
      for (const p of pts) {
        ctx.beginPath()
        ctx.arc(px(p.x), py(p.y), r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 0.45
    dots(spec.previous, token('--muted'), 2)
    ctx.globalAlpha = 1
    dots(spec.current, token('--accent'), 2.5)
    if (last) {
      ctx.strokeStyle = token('--accent')
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(px(last.x), py(last.y), 5.5, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  return { canvas, draw }
}
