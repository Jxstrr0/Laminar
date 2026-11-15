/**
 * Run statistics for the run report (plan section 7.3): is a change real,
 * or is it the balance's noise? Each run's settled readings are grouped by
 * yaw; each group has a mean CdA and a noise band (±z standard errors).
 * Two runs are compared at the yaws they share, and a difference only
 * counts when it is wider than both bands combined.
 *
 * Repeat readings average the balance's noise down, but never the model's
 * own build errors: those are the same in every run of the same model.
 */
import { RUN_STATS } from '../data/tunnel'
import type { Run, RunSample } from './run'

export interface YawGroup {
  yawDeg: number
  /** Air speed the readings were taken at, m/s. */
  speed: number
  /** Settled readings at this yaw. */
  n: number
  /** Mean full-size CdA, m². */
  mean: number
  /** Spread of single readings (standard deviation), m². */
  sd: number
  /** Half-width of the noise band on the mean (z standard errors), m². */
  band: number
  /** Enough readings to trust the band. */
  trusted: boolean
}

export type Verdict = 'lower' | 'higher' | 'noise' | 'tooFew'

export interface YawCompare {
  yawDeg: number
  a: YawGroup
  b: YawGroup
  /** B minus A, m². Negative means B has less drag. */
  delta: number
  /** Half-width of the combined noise band on the difference, m². */
  band: number
  verdict: Verdict
}

const sameSetting = (yawA: number, speedA: number, yawB: number, speedB: number) =>
  Math.abs(yawA - yawB) <= RUN_STATS.yawTolerance && Math.abs(speedA - speedB) <= RUN_STATS.speedTolerance

/**
 * Settled readings grouped by setting (yaw and air speed: drag changes a
 * little with speed too), in yaw order.
 */
export function yawGroups(run: Pick<Run, 'samples'>): YawGroup[] {
  const buckets: { yaw: number; speed: number; values: number[] }[] = []
  for (const s of run.samples as RunSample[]) {
    if (!s.steady) continue
    let bucket = buckets.find((b) => sameSetting(b.yaw, b.speed, s.yawDeg, s.speed))
    if (!bucket) {
      bucket = { yaw: s.yawDeg, speed: s.speed, values: [] }
      buckets.push(bucket)
    }
    bucket.values.push(s.cdA)
  }
  return buckets
    .map(({ yaw, speed, values }) => {
      const n = values.length
      const mean = values.reduce((sum, v) => sum + v, 0) / n
      const variance = n > 1 ? values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / (n - 1) : 0
      const sd = Math.sqrt(variance)
      return { yawDeg: yaw, speed, n, mean, sd, band: n > 1 ? (RUN_STATS.z * sd) / Math.sqrt(n) : 0, trusted: n >= RUN_STATS.minSamples }
    })
    .sort((p, q) => p.yawDeg - q.yawDeg || p.speed - q.speed)
}

/** Compare run B against run A at every setting both runs settled at. */
export function compareRuns(a: Pick<Run, 'samples'>, b: Pick<Run, 'samples'>): YawCompare[] {
  const groupsB = yawGroups(b)
  const out: YawCompare[] = []
  for (const ga of yawGroups(a)) {
    const gb = groupsB.find((g) => sameSetting(g.yawDeg, g.speed, ga.yawDeg, ga.speed))
    if (!gb) continue
    const delta = gb.mean - ga.mean
    const band = Math.sqrt(ga.band * ga.band + gb.band * gb.band)
    const verdict: Verdict = !ga.trusted || !gb.trusted ? 'tooFew' : Math.abs(delta) <= band ? 'noise' : delta < 0 ? 'lower' : 'higher'
    out.push({ yawDeg: ga.yawDeg, a: ga, b: gb, delta, band, verdict })
  }
  return out
}

/** Which of two settings to headline: nearer square on, then faster. */
function better(p: Pick<YawGroup, 'yawDeg' | 'speed'>, q: Pick<YawGroup, 'yawDeg' | 'speed'>): boolean {
  const dy = Math.abs(p.yawDeg) - Math.abs(q.yawDeg)
  return dy < -RUN_STATS.yawTolerance || (dy <= RUN_STATS.yawTolerance && p.speed > q.speed)
}

/** The comparison to headline: square on if both runs have it, else the yaw nearest it. */
export function headlineCompare(list: readonly YawCompare[]): YawCompare | null {
  let best: YawCompare | null = null
  for (const c of list) if (!best || better(c.a, best.a)) best = c
  return best
}

/** A run's headline group, by the same rule. */
export function headlineGroup(groups: readonly YawGroup[]): YawGroup | null {
  let best: YawGroup | null = null
  for (const g of groups) if (!best || better(g, best)) best = g
  return best
}
