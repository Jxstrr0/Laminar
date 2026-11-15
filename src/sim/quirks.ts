/**
 * A tunnel's hidden quirks (plan section 7.2). Each tunnel draws its own from
 * seeded ranges, so two careers get different tunnels but a save always gets
 * the same one. The balance reads through them (src/sim/views.ts); the
 * player finds them with tare runs and calibration (src/sim/calibration.ts).
 *
 * The cycling slice's tunnel has three so far:
 * - blockage: readings high by (1 + k·A/C)², A the model's frontal area and
 *   C the test section's;
 * - turbulent air, which brings transition (and the sphere's drag crisis)
 *   on early;
 * - the mount's own drag, read along with the model.
 */
import { Rng } from './rng'

/** What holds the model: the sphere's sting, or the posts clamping a rider model's axles. */
export type MountKind = 'sting' | 'posts'

export interface TunnelQuirks {
  /** Blockage constant k. */
  blockage: number
  /** Turbulence intensity of the test-section air (a fraction). */
  turbulence: number
  /** Each mount's drag area at model size, m². */
  mountCdA: Record<MountKind, number>
}

interface Range {
  readonly min: number
  readonly max: number
}

export interface QuirkRanges {
  readonly blockage: Range
  readonly turbulence: Range
  readonly mount: Readonly<Record<MountKind, Range>>
}

/** Draw a tunnel's quirks from its ranges. Same seed, same tunnel. */
export function rollQuirks(ranges: QuirkRanges, seed: number): TunnelQuirks {
  const rng = new Rng(seed).fork('tunnel-quirks')
  const pick = (r: Range) => rng.range(r.min, r.max)
  return {
    blockage: pick(ranges.blockage),
    turbulence: pick(ranges.turbulence),
    mountCdA: { sting: pick(ranges.mount.sting), posts: pick(ranges.mount.posts) },
  }
}

/** How much blockage inflates a reading: (1 + k·A/C)². */
export function blockageFactor(k: number, frontalArea: number, sectionArea: number): number {
  const e = (k * frontalArea) / sectionArea
  return (1 + e) * (1 + e)
}
