/**
 * A small progress ring (Isobar, PR 13f): a teal arc on a pale track, for the
 * firm's reputation. It's decoration beside the number, which stays as text.
 */
const NS = 'http://www.w3.org/2000/svg'

/** A ring filled to `fraction` (0 to 1), `size` CSS pixels across. */
export function ring(fraction: number, size = 30): SVGSVGElement {
  const r = 12
  const length = 2 * Math.PI * r
  const f = Math.min(1, Math.max(0, fraction))
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('class', 'ring')
  svg.setAttribute('viewBox', '0 0 30 30')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const circle = (cls: string) => {
    const c = document.createElementNS(NS, 'circle')
    c.setAttribute('class', cls)
    c.setAttribute('cx', '15')
    c.setAttribute('cy', '15')
    c.setAttribute('r', String(r))
    return c
  }
  const arc = circle('ring-arc')
  // Start at twelve o'clock and go clockwise.
  arc.setAttribute('stroke-dasharray', `${(f * length).toFixed(2)} ${length.toFixed(2)}`)
  arc.setAttribute('transform', 'rotate(-90 15 15)')
  svg.append(circle('ring-track'), arc)
  return svg
}
