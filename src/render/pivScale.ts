/**
 * The PIV slice's colours (PR 10ah): the air's speed as a share of the
 * tunnel's, through PIV_PALETTE's stops. The legend and the 3D sheet share
 * this, so the bar always matches the picture.
 */
import { PIV_PALETTE } from '../data/piv'

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const STOPS = PIV_PALETTE.stops.map(hex)

/** RGB, 0 to 255, for a speed share (clamped to 0–1). */
export function pivRgb(ratio: number): [number, number, number] {
  const r = Math.min(1, Math.max(0, ratio))
  const at = PIV_PALETTE.at
  let i = 0
  while (i < at.length - 2 && r > (at[i + 1] as number)) i++
  const a = at[i] as number
  const b = at[i + 1] as number
  const f = b > a ? (r - a) / (b - a) : 0
  const p = STOPS[i]!
  const q = STOPS[i + 1]!
  return [0, 1, 2].map((k) => Math.round(p[k]! + (q[k]! - p[k]!) * f)) as [number, number, number]
}

/** A CSS gradient through the stops, for the legend bar. */
export function pivGradient(direction: string): string {
  const parts = PIV_PALETTE.stops.map((c, i) => `${c} ${((PIV_PALETTE.at[i] as number) * 100).toFixed(0)}%`)
  return `linear-gradient(${direction}, ${parts.join(', ')})`
}
