/**
 * Tunnel runs (plan section 7.1). A run starts at fan-up and ends at
 * fan-down; every balance sample in between is kept, so the run report can
 * replay it. Runs cost money, never days: the fan's energy at the
 * university's power rate, plus a fee per run.
 */
import { AIR } from '../data/air'
import type { Failure } from './failure'
import { RUN_RECORDING, TUNNEL_BILLING, UNIVERSITY_TUNNEL } from '../data/tunnel'
import { tunnelRunCost, type TunnelId } from './facility'

export interface RunSample {
  /** Seconds since the run started. */
  t: number
  speed: number
  /** The turntable's yaw, or the sting's pitch with a ski jumper on it, degrees. */
  yawDeg: number
  /** Full-size drag area and side-force area, m². */
  cdA: number
  cyA: number
  /** A ski jumper only: full-size lift area, m², and pitch moment about the hips per unit dynamic pressure, m³. */
  clA?: number
  pitchA?: number
  /** A racing car only (PR 9l): the downforce area on the front axle, m² (clA is the whole car's; yawDeg holds the drop in mm). */
  clAFront?: number
  /** A land-speed car only (PR 9s): the nose's lift area, m² (clA is the whole car's lift, up), and where the side force acts, m from the nose's tip (left out near straight). */
  liftFront?: number
  centre?: number
  /** The model's drag as the balance felt it, N. */
  dragN: number
  /** Fan and turntable were at rest on their settings: a clean data point. */
  steady: boolean
}

export interface Run {
  id: number
  /** What was on the mount ('sphere', or the design's key). */
  model: string
  samples: RunSample[]
  /** Seconds from fan-up to fan-down. */
  duration: number
  /** Fan energy used, kWh. */
  energyKWh: number
  /** Fastest air speed reached, m/s. */
  topSpeed: number
  /** The model broke during this run (plan section 8). */
  failure?: Failure
  /** Run in your own tunnel; left out for the university's. */
  tunnel?: 'own'
}

export interface Recorder {
  /** The run in progress, or null with the fan off. */
  run: Run | null
  nextId: number
  /** Seconds until the next balance sample is due. */
  untilSample: number
}

export function newRecorder(): Recorder {
  return { run: null, nextId: 1, untilSample: 0 }
}

/** Fan power at an air speed, W. */
export function fanPower(speed: number): number {
  const { width, height } = UNIVERSITY_TUNNEL.section
  return 0.5 * AIR.density * width * height * speed * speed * speed * TUNNEL_BILLING.powerFactor
}

/** The tunnel a run was made in. */
export const runTunnel = (run: Pick<Run, 'tunnel'>): TunnelId => run.tunnel ?? 'university'

/** What a run costs (or has cost so far), ₽, at its tunnel's rates. */
export function runCost(run: Pick<Run, 'energyKWh' | 'tunnel'>): number {
  return tunnelRunCost(runTunnel(run), run.energyKWh)
}

export interface RecorderStep {
  recorder: Recorder
  /** True when a balance sample is due this step (add it with addSample). */
  sampleDue: boolean
  /** The run that just ended this step, if any. */
  finished: Run | null
}

/**
 * Advance the recorder by one sim step at the current air speed. `model` names
 * what's on the mount and `tunnel` where it's run, kept with a run when it starts.
 */
export function stepRecorder(rec: Recorder, speed: number, dt: number, model: string, tunnel: TunnelId = 'university'): RecorderStep {
  let run = rec.run
  if (!run) {
    if (speed <= RUN_RECORDING.startAbove) return { recorder: rec, sampleDue: false, finished: null }
    run = { id: rec.nextId, model, samples: [], duration: 0, energyKWh: 0, topSpeed: 0, ...(tunnel === 'own' ? { tunnel } : {}) }
    rec = { run, nextId: rec.nextId + 1, untilSample: 0 }
  }
  if (speed < RUN_RECORDING.endBelow) {
    return { recorder: { ...rec, run: null }, sampleDue: false, finished: run }
  }
  run = {
    ...run,
    duration: run.duration + dt,
    energyKWh: run.energyKWh + (fanPower(speed) * dt) / 3.6e6,
    topSpeed: Math.max(run.topSpeed, speed),
  }
  let untilSample = rec.untilSample - dt
  const sampleDue = untilSample <= 0
  if (sampleDue) untilSample += RUN_RECORDING.sampleEvery
  return { recorder: { ...rec, run, untilSample }, sampleDue, finished: null }
}

/** Keep a balance sample in the run in progress. */
export function addSample(rec: Recorder, sample: Omit<RunSample, 't'>): Recorder {
  if (!rec.run) return rec
  const run = { ...rec.run, samples: [...rec.run.samples, { ...sample, t: rec.run.duration }] }
  return { ...rec, run }
}
