/**
 * Small number helpers for the sim. Plain + - * / only, so they give the same
 * answer on every device.
 */
import { PI } from './det'

export const DEG = PI / 180

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

export function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** 0 below edge0, 1 above edge1, a smooth S between. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/**
 * Value of y at x on a polyline through (xs, ys), xs ascending. Flat beyond
 * the ends.
 */
export function interp(xs: readonly number[], ys: readonly number[], x: number): number {
  const n = xs.length
  if (n === 0) return 0
  if (x <= (xs[0] as number)) return ys[0] as number
  if (x >= (xs[n - 1] as number)) return ys[n - 1] as number
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if ((xs[mid] as number) <= x) lo = mid
    else hi = mid
  }
  const x0 = xs[lo] as number
  const x1 = xs[hi] as number
  const t = x1 > x0 ? (x - x0) / (x1 - x0) : 1
  return lerp(ys[lo] as number, ys[hi] as number, t)
}
