/**
 * The land-speed streamliner in the tunnel and the forecast (plan sections
 * 6.3, 6.8 and 9.2, PR 9r).
 *
 * - readRecord: what the balance says about a scale model on the
 *   turntable: drag, lift at each end, and at yaw the side force and where
 *   it acts, scaled to full size, through the tunnel's quirks (blockage,
 *   the strut's own drag) and the balance's noise. The floor under the
 *   model changes the nose's lift (RECORD_TUNNEL.floor); still wheels read
 *   draggy until a rolling road spins them.
 * - forecastRecord: the record run worked out with those readings in place
 *   of the truth, on the salt's usual (still) day, against the team's car
 *   (their own data, so the truth). The tunnel never runs near the speed of
 *   sound, so the forecast leaves out the air squeezing: above about
 *   650 km/h it reads fast (Kelbo, 16 November 2026: "read low, learn the
 *   trap").
 */
import { AIR } from '../data/air'
import { RECORD_AERO, RECORD_DESK, RECORD_TUNNEL as T, type RecordDesign } from '../data/record'
import type { SaltFlat } from '../data/saltFlats'
import { describeShape } from './geom/body'
import { recordShape } from './geom/record'
import { gaussian } from './noise'
import { DEG } from './num'
import { blockageFactor, type MountKind } from './quirks'
import { crossHeldAt, flatDensity, frontKept, recordAero, recordLength, sideCentre, stillDay, twoWay, type RecordAbort } from './record'
import { Rng } from './rng'
import type { Run } from './run'
import { REFERENCE_TT, type EventSpec, type ModelSpec, type TunnelSpec } from './views'

/** The floor under a record model: still, the model shop's ground board, or your tunnel's rolling road. */
export type RecordFloor = keyof typeof T.floor

/** A built record model: its build errors and the floor it sits over, ready to read many times a second. */
export interface PreparedRecord {
  design: RecordDesign
  scale: number
  /** The model's drag, lift and side force came out this much bigger (or smaller) than drawn. */
  drag: number
  lift: number
  side: number
  floor: RecordFloor
  /** The full-size car's frontal area, m² (for the blockage). */
  frontal: number
}

export function prepareRecord(design: RecordDesign, model: ModelSpec, floor: RecordFloor): PreparedRecord {
  const rng = new Rng(model.seed).fork('record-build')
  return {
    design,
    scale: model.scale,
    drag: 1 + model.accuracy * gaussian(rng),
    lift: 1 + model.accuracy * gaussian(rng),
    side: 1 + model.accuracy * gaussian(rng),
    floor,
    frontal: describeShape(recordShape(design)).frontalArea,
  }
}

export interface RecordTunnelRun {
  speed: number
  yawDeg: number
  mount?: MountKind
}

/** One balance reading, scaled to full size. */
export interface RecordReading {
  yawDeg: number
  /** Drag area, lift area at each end (up), and side-force area, m². */
  cdA: number
  liftFront: number
  liftRear: number
  cyA: number
  /** Where the side force acts, m from the nose's tip (full size), or null straight ahead (no side force to place). */
  centre: number | null
  /** The model's drag as the balance felt it, N. */
  dragN: number
}

/**
 * One balance reading of a prepared record model at a speed and yaw. Draws
 * its noise from `rng`, so repeat readings on the same stream scatter.
 */
export function readRecord(prepared: PreparedRecord, tunnel: TunnelSpec, run: RecordTunnelRun, rng: Rng): RecordReading {
  const { design, scale } = prepared
  const s2 = scale * scale
  const a = recordAero(design)
  const side = sideCentre(design)
  const q = tunnel.quirks
  const section = tunnel.section
  const blocked = q && section ? blockageFactor(q.blockage, prepared.frontal * s2, section.width * section.height) : 1
  const mount = q && run.mount ? q.mountCdA[run.mount] / s2 : 0
  const wheels = prepared.floor === 'rolling' ? 0 : T.staticWheels * (1 - (1 - RECORD_AERO.wheelsCovered) * design.fairings)
  const read = T.floor[prepared.floor].lift
  const noise = () => 1 + tunnel.balanceNoise * gaussian(rng)
  const cdA = ((a.cdA * prepared.drag + wheels) * blocked + mount) * noise()
  const liftFront = a.liftFront * prepared.lift * read * blocked * noise()
  const liftRear = a.liftRear * prepared.lift * read * blocked * noise()
  const yaw = Math.abs(run.yawDeg)
  const cyA = side.area * run.yawDeg * DEG * prepared.side * blocked * noise()
  // The side force's centre is placed from the yaw moment over the side force: harder the smaller the yaw.
  const centre = yaw < T.straight ? null : side.centre + ((T.centreNoise * tunnel.balanceNoise) / yaw) * gaussian(rng)
  const qN = 0.5 * AIR.density * run.speed * run.speed
  return { yawDeg: run.yawDeg, cdA, liftFront, liftRear, cyA, centre, dragN: qN * cdA * s2 }
}

/** What the calibration runs let you take off a record model's readings: the strut's tare and the blockage. */
export interface RecordFix {
  tare: number | null
  blockageK: number | null
}

/** A reading with the strut's tare and the blockage taken off (as far as the calibration runs found them). */
export function correctRecord<R extends Pick<RecordReading, 'cdA' | 'liftFront' | 'liftRear' | 'cyA'>>(r: R, fix: RecordFix, prepared: PreparedRecord, sectionArea: number): R {
  const s2 = prepared.scale * prepared.scale
  const b = fix.blockageK !== null ? blockageFactor(fix.blockageK, prepared.frontal * s2, sectionArea) : 1
  const tare = (fix.tare ?? 0) / s2
  return { ...r, cdA: (r.cdA - tare) / b, liftFront: r.liftFront / b, liftRear: r.liftRear / b, cyA: r.cyA / b }
}

export interface RecordForecast {
  /** The record speed on the salt's usual day, m/s, and its gain on the team's car, m/s; null if the forecast run is aborted. */
  speed: number | null
  gain: number | null
  /** The forecast's top speed, m/s. */
  top: number
  /** The share of the nose's weight kept at top speed with the desk's moderate headwind. */
  noseKept: number
  /** The steadiest crosswind the car holds straight in, m/s, or null if no reading was at enough yaw to place the side force. */
  crossHeld: number | null
  /** Why the forecast run stopped, if it did. */
  abort: RecordAbort | null
  /** The drag area and nose lift the forecast used, m². */
  cdA: number
  liftFront: number
}

/** The mean of some numbers (0 for none). */
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

/**
 * The record run on the tunnel's readings, against the team's current car.
 * Drag and lift come from the readings taken straight ahead (or all of
 * them, if none were); where the side force acts comes from those at
 * enough yaw, weighted toward the bigger yaws (their centre is surer).
 * Null until something has been read.
 */
export function forecastRecord(readings: readonly Omit<RecordReading, 'dragN'>[], design: RecordDesign, old: RecordDesign, flat: SaltFlat): RecordForecast | null {
  if (readings.length === 0) return null
  const ahead = readings.filter((r) => Math.abs(r.yawDeg) < T.straight)
  const use = ahead.length ? ahead : readings
  const aero = { cdA: mean(use.map((r) => r.cdA)), liftFront: mean(use.map((r) => r.liftFront)), liftRear: mean(use.map((r) => r.liftRear)) }
  let w = 0
  let sum = 0
  for (const r of readings) {
    if (r.centre === null || Math.abs(r.yawDeg) < T.minYaw) continue
    const k = r.yawDeg * r.yawDeg
    w += k
    sum += k * r.centre
  }
  const centre = w > 0 ? sum / w : null
  const margin = centre === null ? undefined : (centre - sideCentre(design).mass) / recordLength(design)
  const day = stillDay(flat)
  // The tunnel never sees the air squeeze; with no side force placed, it can't say the car wanders.
  const attempt = twoWay(design, flat, day, { aero, margin, squeeze: false, holdStraight: margin === undefined })
  const first = attempt.runs[0]
  const theirs = twoWay(old, flat, day).mean
  return {
    speed: attempt.mean,
    gain: attempt.mean !== null && theirs !== null ? attempt.mean - theirs : null,
    top: first.top,
    noseKept: frontKept(design, first.top + RECORD_DESK.headwind, flatDensity(flat), { drag: 1, lift: aero.liftFront / recordAero(design).liftFront }),
    crossHeld: margin === undefined ? null : crossHeldAt(margin),
    abort: first.abort,
    cdA: aero.cdA,
    liftFront: aero.liftFront,
  }
}

/** What the model shop matches a record model's Reynolds number to: the salt's air at about record speed (PR 9s). */
export function recordEvent(flat: SaltFlat): EventSpec {
  return { ...REFERENCE_TT, temperature: flat.temperature, altitude: flat.altitude, riderSpeed: T.matchSpeed, windSpeed: 0 }
}

/** A record car run's settled readings, ready to correct and forecast (PR 9s). The whole car's lift rides in clA. */
export function recordReadings(runs: readonly Pick<Run, 'samples'>[]): Omit<RecordReading, 'dragN'>[] {
  const out: Omit<RecordReading, 'dragN'>[] = []
  for (const run of runs)
    for (const s of run.samples)
      if (s.steady && s.clA !== undefined && s.liftFront !== undefined)
        out.push({ yawDeg: s.yawDeg, cdA: s.cdA, liftFront: s.liftFront, liftRear: s.clA - s.liftFront, cyA: s.cyA, centre: s.centre ?? null })
  return out
}

/** True if a run read a land-speed car. */
export const isRecordRun = (run: Pick<Run, 'samples'>): boolean => run.samples.some((s) => s.liftFront !== undefined)
