/**
 * Run statistics for the run report (plan section 7.3): is a change real,
 * or is it the balance's noise? Each run's settled readings are grouped by
 * yaw; each group has a mean CdA and a noise band (±z standard errors).
 * Two runs are compared at the yaws they share, and a difference only
 * counts when it is wider than both bands combined.
 *
 * Repeat readings average the balance's noise down, but never the model's
 * own build errors: those are the same in every run of the same model.
 *
 * Repeat runs of one design pool together, and runs at several crank angles
 * average the legs' swing into what a pedalling rider would see.
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
export function headlineGroup<T extends Pick<YawGroup, 'yawDeg' | 'speed'>>(groups: readonly T[]): T | null {
  let best: T | null = null
  for (const g of groups) if (!best || better(g, best)) best = g
  return best
}

export interface Pooled extends YawGroup {
  /** Runs that settled at this setting. */
  runs: number
  /** Spread of those runs' own means (standard deviation), or null with one run. */
  spread: number | null
}

/** Settled readings from several runs of one model, pooled setting by setting. */
export function poolRuns(runs: readonly Pick<Run, 'samples'>[]): Pooled[] {
  const buckets: { yaw: number; speed: number; values: number[]; means: number[] }[] = []
  for (const run of runs) {
    for (const g of yawGroups(run)) {
      let bucket = buckets.find((b) => sameSetting(b.yaw, b.speed, g.yawDeg, g.speed))
      if (!bucket) {
        bucket = { yaw: g.yawDeg, speed: g.speed, values: [], means: [] }
        buckets.push(bucket)
      }
      bucket.means.push(g.mean)
    }
    for (const s of run.samples as RunSample[]) {
      if (!s.steady) continue
      const bucket = buckets.find((b) => sameSetting(b.yaw, b.speed, s.yawDeg, s.speed))
      bucket?.values.push(s.cdA)
    }
  }
  const sd = (values: readonly number[], mean: number) =>
    values.length > 1 ? Math.sqrt(values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / (values.length - 1)) : 0
  return buckets
    .map(({ yaw, speed, values, means }) => {
      const n = values.length
      const mean = values.reduce((sum, v) => sum + v, 0) / n
      const s = sd(values, mean)
      const runMean = means.reduce((sum, v) => sum + v, 0) / means.length
      return {
        yawDeg: yaw,
        speed,
        n,
        mean,
        sd: s,
        band: n > 1 ? (RUN_STATS.z * s) / Math.sqrt(n) : 0,
        trusted: n >= RUN_STATS.minSamples,
        runs: means.length,
        spread: means.length > 1 ? sd(means, runMean) : null,
      }
    })
    .sort((p, q) => p.yawDeg - q.yawDeg || p.speed - q.speed)
}

export interface LegAngle {
  crankDeg: number
  pooled: Pooled
}

export interface LegCycle {
  yawDeg: number
  speed: number
  /** Each crank angle's pooled reading at that setting, in crank order. */
  angles: LegAngle[]
  /** The pedalling average: every angle counts the same. */
  mean: number
  band: number
  /** Enough angles for a fair average. */
  enough: boolean
}

/**
 * The pedalling average from runs of one design at several crank angles,
 * at the best setting every angle shares (square on and fast if it can).
 * Null with fewer than two angles.
 */
export function legCycle(byCrank: ReadonlyMap<number, readonly Pick<Run, 'samples'>[]>): LegCycle | null {
  const pooled = [...byCrank.entries()]
    .map(([crankDeg, runs]) => ({ crankDeg, groups: poolRuns(runs).filter((g) => g.trusted) }))
    .filter((a) => a.groups.length > 0)
    .sort((p, q) => p.crankDeg - q.crankDeg)
  if (pooled.length < 2) return null
  // Settings every angle has, then the headline one among them.
  const shared = pooled[0]!.groups.filter((g) => pooled.every((a) => a.groups.some((h) => sameSetting(g.yawDeg, g.speed, h.yawDeg, h.speed))))
  const head = headlineGroup(shared)
  if (!head) return null
  const angles = pooled.map((a) => ({ crankDeg: a.crankDeg, pooled: a.groups.find((h) => sameSetting(head.yawDeg, head.speed, h.yawDeg, h.speed))! }))
  const k = angles.length
  const mean = angles.reduce((sum, a) => sum + a.pooled.mean, 0) / k
  const band = Math.sqrt(angles.reduce((sum, a) => sum + a.pooled.band * a.pooled.band, 0)) / k
  return { yawDeg: head.yawDeg, speed: head.speed, angles, mean, band, enough: k >= RUN_STATS.legAngles }
}
