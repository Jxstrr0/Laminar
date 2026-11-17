/**
 * The Cp map's colour scale (plan section 11): CP_PALETTE's diverging stops,
 * blue for suction through pale grey at 0 to coral for pressure. The 3D taps,
 * the paint on the model (cpSurface.ts) and the DOM legend all read colours
 * from here, so they always agree.
 */
import { CP_PALETTE } from '../data/flowViz'

const STEPS = CP_PALETTE.suction.length

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** The arm's stops from the middle outwards: grey, then lighter to darker. */
const SUCTION = [CP_PALETTE.neutral, ...[...CP_PALETTE.suction].reverse()].map(rgb)
const PRESSURE = [CP_PALETTE.neutral, ...CP_PALETTE.pressure].map(rgb)

/** A Cp reading's colour as 0–1 RGB (clamped to the scale's ends). */
export function cpRgb(cp: number): [number, number, number] {
  const arm = cp < 0 ? SUCTION : PRESSURE
  const end = cp < 0 ? CP_PALETTE.min : CP_PALETTE.max
  const f = Math.min(1, Math.max(0, cp / end)) * STEPS
  const i = Math.min(STEPS - 1, Math.floor(f))
  const t = f - i
  const a = arm[i]!
  const b = arm[i + 1]!
  return [0, 1, 2].map((k) => (a[k]! + (b[k]! - a[k]!) * t) / 255) as [number, number, number]
}

/** Where a Cp sits along the legend bar, 0 (strongest suction) to 1. */
export function cpPosition(cp: number): number {
  return Math.min(1, Math.max(0, (cp - CP_PALETTE.min) / (CP_PALETTE.max - CP_PALETTE.min)))
}

/** The legend bar's CSS gradient, with each stop where its Cp falls. */
export function cpGradient(direction = 'to right'): string {
  const stops: string[] = []
  CP_PALETTE.suction.forEach((c, i) => stops.push(`${c} ${(cpPosition((CP_PALETTE.min * (STEPS - i)) / STEPS) * 100).toFixed(1)}%`))
  stops.push(`${CP_PALETTE.neutral} ${(cpPosition(0) * 100).toFixed(1)}%`)
  CP_PALETTE.pressure.forEach((c, i) => stops.push(`${c} ${(cpPosition((CP_PALETTE.max * (i + 1)) / STEPS) * 100).toFixed(1)}%`))
  return `linear-gradient(${direction}, ${stops.join(', ')})`
}
