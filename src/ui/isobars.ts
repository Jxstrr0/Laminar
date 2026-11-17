/**
 * The background isobars (Isobar, PR 13f): faint, wobbly closed contour lines
 * behind the Jobs page, like a pressure chart. Drawn once from a fixed seed so
 * they're the same on every visit, and never animated. Purely decoration:
 * hidden from screen readers and never in the way of a tap.
 */
const NS = 'http://www.w3.org/2000/svg'

/** A tiny seeded random source (mulberry32): the same lines every time. Not the sim's RNG. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = Math.imul(a ^ (a >>> 15), 1 | a)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/** A smooth closed path through points (Catmull-Rom turned into cubic Béziers). */
function smoothLoop(pts: [number, number][]): string {
  const n = pts.length
  const p = (i: number) => pts[((i % n) + n) % n] as [number, number]
  let d = `M${p(0)[0].toFixed(1)} ${p(0)[1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const [x0, y0] = p(i - 1)
    const [x1, y1] = p(i)
    const [x2, y2] = p(i + 1)
    const [x3, y3] = p(i + 2)
    const c1 = [x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6]
    const c2 = [x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6]
    d += `C${c1[0]!.toFixed(1)} ${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)} ${c2[1]!.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
  }
  return d + 'Z'
}

/** Rings of nested loops round each centre: [x, y, first radius, rings, colour class]. */
const CENTRES: [number, number, number, number, string][] = [
  [70, 150, 46, 4, 'iso-lo'],
  [340, 420, 58, 4, 'iso-violet'],
  [90, 720, 52, 4, 'iso-lo'],
  [330, 860, 22, 3, 'iso-hi'],
]

export function isobarLayer(): SVGSVGElement {
  const rand = seeded(1611)
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('class', 'isobars')
  svg.setAttribute('viewBox', '0 0 400 900')
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  for (const [cx, cy, r0, rings, cls] of CENTRES) {
    // Each centre has its own wobble, shared by its rings so they nest without crossing.
    const w2 = 0.12 + rand() * 0.1
    const w3 = 0.05 + rand() * 0.07
    const p2 = rand() * Math.PI * 2
    const p3 = rand() * Math.PI * 2
    const stretch = 0.75 + rand() * 0.5
    for (let k = 0; k < rings; k++) {
      const r = r0 * (1 + k * 0.62)
      const pts: [number, number][] = []
      const n = 28
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        const rr = r * (1 + w2 * Math.sin(2 * a + p2 + k * 0.15) + w3 * Math.sin(3 * a + p3))
        pts.push([cx + rr * Math.cos(a) * stretch, cy + rr * Math.sin(a)])
      }
      const path = document.createElementNS(NS, 'path')
      path.setAttribute('class', cls)
      path.setAttribute('d', smoothLoop(pts))
      svg.append(path)
    }
  }
  return svg
}
