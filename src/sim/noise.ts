/**
 * Bell-curve noise from the seeded generator (Box–Muller, with det maths so
 * every device draws the same numbers).
 */
import { detCos, detLog, PI } from './det'
import type { Rng } from './rng'

/** A normal draw with mean 0 and standard deviation 1. */
export function gaussian(rng: Rng): number {
  let u = rng.next()
  if (u < 1e-12) u = 1e-12
  const v = rng.next()
  return Math.sqrt(-2 * detLog(u)) * detCos(2 * PI * v)
}
