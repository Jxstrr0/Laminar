/**
 * Finding the tunnel's quirks (plan section 7.2), the way a tunnel engineer
 * does: tare runs measure each mount's own drag, and calibration runs with
 * the sphere are held up against the book (a smooth sphere in calm air,
 * from the aero model).
 *
 * - The drag crisis comes early in turbulent air. Where the sphere's Cd
 *   falls through the middle of its drop, against where the book says it
 *   should, tells how turbulent the tunnel's air is.
 * - Before the crisis the sphere's Cd hardly moves with speed or
 *   turbulence, so any gap to the book there (once the sting's tare is
 *   off) is blockage. That gives the blockage constant k, and from it the
 *   correction for any model by its frontal area.
 *
 * Every figure comes from the player's own noisy readings, so a careless
 * sweep gives a rough answer. Nothing here reads the hidden quirks.
 */
import { AIR } from '../data/air'
import { TRANSITION } from '../data/aero'
import { CALIBRATION, RUN_STATS } from '../data/tunnel'
import { bodyDrag } from './aero/drag'
import { detExp, detLog } from './det'
import type { BodyDescriptor } from './geom/body'
import { blockageFactor, type MountKind } from './quirks'
import type { Run } from './run'

/** The run name for a tare run of a mount. */
export function tareModel(mount: MountKind): string {
  return `tare-${mount}`
}

interface Stats {
  n: number
  mean: number
  /** Half-width of the noise band on the mean (z standard errors). */
  band: number
}

function stats(values: readonly number[]): Stats {
  const n = values.length
  const mean = values.reduce((sum, v) => sum + v, 0) / n
  const variance = n > 1 ? values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / (n - 1) : 0
  return { n, mean, band: n > 1 ? (RUN_STATS.z * Math.sqrt(variance)) / Math.sqrt(n) : 0 }
}

export interface Tare extends Stats {
  mount: MountKind
  /** The run it came from. */
  runId: number
  /** Enough readings to use. */
  trusted: boolean
}

/**
 * A mount's tare from its latest tare run: the mean of its settled readings,
 * m² at model size. The mount's drag doesn't change with speed, so readings
 * at every speed pool together.
 */
export function latestTare(runs: readonly Run[], mount: MountKind): Tare | null {
  for (let i = runs.length - 1; i >= 0; i--) {
    const run = runs[i]!
    if (run.model !== tareModel(mount)) continue
    const values = run.samples.filter((s) => s.steady).map((s) => s.cdA)
    if (values.length === 0) continue
    const s = stats(values)
    return { ...s, mount, runId: run.id, trusted: s.n >= RUN_STATS.minSamples }
  }
  return null
}

/** The book: a smooth sphere's Cd in perfectly calm air at an air speed. */
export function bookCd(ball: BodyDescriptor, speed: number): number {
  return bodyDrag(ball, { density: AIR.density, viscosity: AIR.viscosity, speed, turbulence: 0 }).cd
}

/** Reynolds number of the sphere at an air speed. */
export function sphereRe(ball: BodyDescriptor, speed: number): number {
  return (AIR.density * speed * ball.length) / AIR.viscosity
}

export interface CurvePoint {
  re: number
  cd: number
}

/** The book curve over the fan's range. */
export function bookCurve(ball: BodyDescriptor): CurvePoint[] {
  const { from, to, step } = CALIBRATION.book
  const out: CurvePoint[] = []
  for (let v = from; v <= to + 1e-9; v += step) out.push({ re: sphereRe(ball, v), cd: bookCd(ball, v) })
  return out
}

export interface SpherePoint extends CurvePoint {
  speed: number
  n: number
  /** Noise band on the Cd. */
  band: number
  /** The book's Cd at the same Reynolds number. */
  book: number
  trusted: boolean
}

/**
 * The sphere's settled readings from every sphere run, grouped by air speed,
 * as Cd. With a tare, the sting's drag is taken off first.
 */
export function spherePoints(runs: readonly Run[], ball: BodyDescriptor, tare: Tare | null): SpherePoint[] {
  const buckets: { speed: number; values: number[] }[] = []
  for (const run of runs) {
    if (run.model !== 'sphere') continue
    for (const s of run.samples) {
      if (!s.steady) continue
      let b = buckets.find((x) => Math.abs(x.speed - s.speed) <= RUN_STATS.speedTolerance)
      if (!b) buckets.push((b = { speed: s.speed, values: [] }))
      b.values.push(s.cdA)
    }
  }
  const area = ball.frontalArea
  const off = tare ? tare.mean : 0
  const offBand = tare ? tare.band : 0
  return buckets
    .map(({ speed, values }) => {
      const s = stats(values)
      return {
        speed,
        re: sphereRe(ball, speed),
        cd: (s.mean - off) / area,
        band: Math.sqrt(s.band * s.band + offBand * offBand) / area,
        n: s.n,
        book: bookCd(ball, speed),
        trusted: s.n >= RUN_STATS.minSamples,
      }
    })
    .sort((p, q) => p.re - q.re)
}

/**
 * Where a curve's Cd falls through the middle of its drop, by Reynolds
 * number (in between two points, on a log scale). Null if it doesn't
 * cover a drop.
 */
export function crisisRe(points: readonly CurvePoint[]): number | null {
  if (points.length < 2) return null
  const cds = points.map((p) => p.cd)
  const hi = Math.max(...cds)
  const lo = Math.min(...cds)
  if (hi - lo < CALIBRATION.minDrop) return null
  const mid = (hi + lo) / 2
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    if (a.cd >= mid && b.cd < mid) {
      const f = (a.cd - mid) / (a.cd - b.cd)
      return detExp(detLog(a.re) + f * (detLog(b.re) - detLog(a.re)))
    }
  }
  return null
}

export interface Blockage {
  /** Measured over book before the crisis. */
  ratio: number
  /** Noise band on the ratio. */
  band: number
  /** The blockage constant k found from it (0 if the sphere read low). */
  k: number
  /** Settled readings it rests on. */
  n: number
}

export interface Calibration {
  points: SpherePoint[]
  /** The sting's tare, if one has been run. */
  tare: Tare | null
  /** Crisis Reynolds numbers: measured here, and the book's. */
  crisis: { re: number; bookRe: number } | null
  /** Turbulence intensity the early crisis points to (a fraction). */
  turbulence: number | null
  /** Needs a trusted tare and a crisis to know which readings come before it. */
  blockage: Blockage | null
}

/** Everything the sphere runs say about the tunnel. */
export function calibrate(runs: readonly Run[], ball: BodyDescriptor, sectionArea: number): Calibration {
  const tare = latestTare(runs, 'sting')
  const usable = tare && tare.trusted ? tare : null
  const points = spherePoints(runs, ball, usable)
  const trusted = points.filter((p) => p.trusted)
  const re = crisisRe(trusted)
  const bookRe = crisisRe(bookCurve(ball))
  const crisis = re !== null && bookRe !== null ? { re, bookRe } : null
  const turbulence = crisis ? Math.max(0, (crisis.bookRe / crisis.re - 1) / (TRANSITION.turbulencePerPercent * 100)) : null

  let blockage: Blockage | null = null
  if (usable && crisis) {
    const before = trusted.filter((p) => p.re < crisis.re * CALIBRATION.subcritical)
    const n = before.reduce((sum, p) => sum + p.n, 0)
    if (n >= CALIBRATION.minSubReadings) {
      // Weighted by readings: the mean ratio, and its band from each point's band.
      const ratio = before.reduce((sum, p) => sum + (p.n * p.cd) / p.book, 0) / n
      const band = Math.sqrt(before.reduce((sum, p) => sum + ((p.n * p.band) / p.book) * ((p.n * p.band) / p.book), 0)) / n
      const k = Math.max(0, ((Math.sqrt(ratio) - 1) * sectionArea) / ball.frontalArea)
      blockage = { ratio, band, k, n }
    }
  }
  return { points, tare, crisis, turbulence, blockage }
}

export interface Corrections {
  /** The mount's tare to take off, m² at model size. */
  tare: number | null
  /** The blockage factor to divide by. */
  blockage: number | null
}

/** What to take off a model's readings, from what the player has found so far. */
export function corrections(cal: Calibration, tare: Tare | null, frontalArea: number, sectionArea: number): Corrections {
  return {
    tare: tare && tare.trusted ? tare.mean : null,
    blockage: cal.blockage ? blockageFactor(cal.blockage.k, frontalArea, sectionArea) : null,
  }
}

/** A model's drag area with the corrections applied, m² at model size. */
export function correct(modelCdA: number, fix: Corrections): number {
  return (modelCdA - (fix.tare ?? 0)) / (fix.blockage ?? 1)
}
