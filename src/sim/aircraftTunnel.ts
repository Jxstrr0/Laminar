/**
 * The light aircraft in the tunnel and the forecast (plan sections 6.3 and
 * 6.8, PR 10r).
 *
 * - readAircraft: what the balance says about a kit plane's model on the
 *   sting, its wing pitched to an angle of attack: its drag area and lift
 *   coefficient, scaled to full size. Through the tunnel's quirks (blockage,
 *   the sting's own drag) and the balance's noise.
 * - Kelbo's trap (16 November 2026): a plain model's prop is stopped, so the
 *   cowl, the gear, the fuselage's front and the struts' roots sit in calm
 *   air and the swirl never meets the strut fairings. The tunnel reads the
 *   plane slicker than it flies, and the forecast promises a cruise speed
 *   the plane won't make. A powered model (its prop driven down the sting)
 *   blows them as flight does.
 * - forecastAircraft: cruise speed worked out with the readings' drag,
 *   against the client's plane, and the stall speed from a reading past the
 *   stall. With no reading past the stall it can't say whether the
 *   inspector signs the mod off.
 */
import { AIR } from '../data/air'
import { AIRCRAFT_CLASS, AIRCRAFT_TUNNEL as T, type AircraftDesign, type Airfield } from '../data/aircraft'
import { aircraftClMax, aircraftDragAtLift, cruiseSpeed, KMH, stallCheck } from './aircraft'
import { describeShape } from './geom/body'
import { aircraftShape } from './geom/aircraft'
import { gaussian } from './noise'
import { DEG } from './num'
import { blockageFactor, type MountKind } from './quirks'
import { Rng } from './rng'
import type { Run } from './run'
import { REFERENCE_TT, type EventSpec, type ModelSpec, type TunnelSpec } from './views'

/** A built kit-plane model: its build errors and whether its prop is driven, ready to read many times a second. */
export interface PreparedAircraft {
  design: AircraftDesign
  scale: number
  /** The model's drag and lift came out this much bigger (or smaller) than drawn. */
  drag: number
  lift: number
  /** Its prop is driven by a motor down the sting, so its slipstream blows the nose as in flight. */
  powered: boolean
  /** The plane's frontal area, m² (for the blockage): its fuselage and pod, and the wing's edge-on front. */
  frontal: number
}

export function prepareAircraft(design: AircraftDesign, model: ModelSpec, powered: boolean): PreparedAircraft {
  const rng = new Rng(model.seed).fork('aircraft-build')
  return {
    design,
    scale: model.scale,
    drag: 1 + model.accuracy * gaussian(rng),
    lift: 1 + model.accuracy * gaussian(rng),
    powered,
    frontal: describeShape(aircraftShape(design)).frontalArea + AIRCRAFT_CLASS[design.class].wingArea * T.wingThickness,
  }
}

/** The model wing's Reynolds number on its chord in the tunnel at `speed` (shown on the readings; the kit's wing has no trouble at these sizes). */
export function aircraftReynolds(prepared: Pick<PreparedAircraft, 'design' | 'scale'>, speed: number): number {
  const c = AIRCRAFT_CLASS[prepared.design.class]
  return (AIR.density * speed * (c.wingArea / c.span) * prepared.scale) / AIR.viscosity
}

/** The lift coefficient the wing makes at an angle of attack (radians), with its most lift `clMax`: a straight line to the stall, then falling away. */
export function aircraftLiftAt(design: AircraftDesign, alpha: number, clMax = aircraftClMax(design)): { cl: number; stalled: boolean } {
  const line = AIRCRAFT_CLASS[design.class].liftSlope * alpha
  if (line <= clMax) return { cl: line, stalled: false }
  return { cl: Math.max(clMax * T.stalledLift, clMax - T.stallFall * (line - clMax)), stalled: true }
}

export interface AircraftTunnelRun {
  speed: number
  /** The wing's angle of attack on the sting, degrees. */
  pitchDeg: number
  mount?: MountKind
}

/** One balance reading, scaled to full size. */
export interface AircraftReading {
  pitchDeg: number
  /** Drag area, m², and lift coefficient (on the wing's area). */
  cdA: number
  cl: number
  /** The model wing's Reynolds number in this run. */
  re: number
  /** The model's prop was driven: the slipstream was in the reading. */
  powered: boolean
  /** The model's drag as the balance felt it, N. */
  dragN: number
}

/**
 * One balance reading of a prepared kit-plane model at a speed and angle.
 * Draws its noise from `rng`, so repeat readings on the same stream scatter.
 */
export function readAircraft(prepared: PreparedAircraft, tunnel: TunnelSpec, run: AircraftTunnelRun, rng: Rng): AircraftReading {
  const { design, scale } = prepared
  const s2 = scale * scale
  const q = tunnel.quirks
  const section = tunnel.section
  const blocked = q && section ? blockageFactor(q.blockage, prepared.frontal * s2, section.width * section.height) : 1
  const mount = q && run.mount ? q.mountCdA[run.mount] / s2 : 0
  const noise = () => 1 + tunnel.balanceNoise * gaussian(rng)
  const lift = aircraftLiftAt(design, run.pitchDeg * DEG)
  const cl = lift.cl * prepared.lift * blocked * noise()
  const drag = aircraftDragAtLift(design, lift.cl, { slipstream: prepared.powered, wingCd: lift.stalled ? T.stalledDrag : 1 }).cdA
  const cdA = (drag * prepared.drag * blocked + mount) * noise()
  const qN = 0.5 * AIR.density * run.speed * run.speed
  return { pitchDeg: run.pitchDeg, cdA, cl, re: aircraftReynolds(prepared, run.speed), powered: prepared.powered, dragN: qN * cdA * s2 }
}

/** What the calibration runs let you take off a kit-plane model's readings: the sting's tare and the blockage. */
export interface AircraftFix {
  tare: number | null
  blockageK: number | null
}

/** A reading with the sting's tare and the blockage taken off (as far as the calibration runs found them). */
export function correctAircraft<R extends Pick<AircraftReading, 'cdA' | 'cl'>>(r: R, fix: AircraftFix, prepared: PreparedAircraft, sectionArea: number): R {
  const s2 = prepared.scale * prepared.scale
  const b = fix.blockageK !== null ? blockageFactor(fix.blockageK, prepared.frontal * s2, sectionArea) : 1
  const tare = (fix.tare ?? 0) / s2
  return { ...r, cdA: (r.cdA - tare) / b, cl: r.cl / b }
}

export interface AircraftForecast {
  /** Cruise speed at cruise power over the airfield on its usual day, km/h, and what it gains on the client's plane, km/h. */
  cruise: number
  gain: number
  /** The drag scale the readings found on the firm's own drag-against-lift curve (which has the prop's slipstream in it, as flight does). */
  drag: number
  /** Every reading in the drag fit had the prop driven: the slipstream was measured, not left out. */
  powered: boolean
  /** The wing's most lift, from a reading past the stall, or null if no reading reached it. */
  clMax: number | null
  /** The stall speed at the most take-off mass, km/h, and whether the inspector signs it off; null until the stall was read. */
  stall: number | null
  passes: boolean | null
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

/** Whether a reading's lift fell short of the firm's straight line: the wing had stalled. */
export function aircraftReadStalled(design: AircraftDesign, r: Pick<AircraftReading, 'pitchDeg' | 'cl'>): boolean {
  const line = AIRCRAFT_CLASS[design.class].liftSlope * r.pitchDeg * DEG
  return line > 0 && r.cl < line * (1 - T.stallSeen)
}

/**
 * Cruise and stall on the tunnel's readings, against the client's plane.
 * The drag scale is the mean, over the readings at cruise-like lift
 * (`dragUpTo`), of each one's drag over what the firm's curve expects at
 * its lift, slipstream and all: a model with its prop stopped reads less
 * than the curve, so the forecast flies faster than the plane will. The
 * wing's most lift is the highest lift read, if any reading went past the
 * stall. Null until something has been read.
 */
export function forecastAircraft(readings: readonly Omit<AircraftReading, 'dragN'>[], design: AircraftDesign, old: AircraftDesign, field: Airfield): AircraftForecast | null {
  if (readings.length === 0) return null
  const flying = readings.filter((r) => !aircraftReadStalled(design, r))
  const cruiseLike = flying.filter((r) => r.cl <= T.dragUpTo)
  const base = cruiseLike.length ? cruiseLike : flying.length ? flying : readings
  const drag = mean(base.map((r) => r.cdA / aircraftDragAtLift(design, r.cl).cdA))
  const clMax = readings.some((r) => aircraftReadStalled(design, r)) ? Math.max(...readings.map((r) => r.cl)) : null
  const cruise = cruiseSpeed(design, field, { drag }) * KMH
  const check = clMax !== null ? stallCheck(design, clMax) : null
  return {
    cruise,
    gain: cruise - cruiseSpeed(old, field) * KMH,
    drag,
    powered: base.every((r) => r.powered),
    clMax,
    stall: check ? check.stall : null,
    passes: check ? check.passes : null,
  }
}

/**
 * What the model shop matches a kit-plane model to: the plane at cruise in
 * the air over the airfield. No tunnel matches it (that's six times cruise
 * at 1:6), and the kit's wing doesn't need it: its Reynolds number is well
 * clear of trouble at either scale.
 */
export function aircraftEvent(field: Airfield, design: AircraftDesign): EventSpec {
  return { ...REFERENCE_TT, temperature: field.temperature, altitude: field.cruiseAltitude, riderSpeed: cruiseSpeed(design, field), windSpeed: 0 }
}

/** A kit-plane run's settled readings: fan and sting at rest, with the lift recorded and no pitching moment (that's a survey drone's). */
export function aircraftReadings(runs: readonly Pick<Run, 'samples' | 'powered'>[]): Omit<AircraftReading, 'dragN'>[] {
  const out: Omit<AircraftReading, 'dragN'>[] = []
  for (const run of runs)
    for (const s of run.samples)
      if (s.steady && s.cl !== undefined && s.cm === undefined && s.re !== undefined)
        out.push({ pitchDeg: s.yawDeg, cdA: s.cdA, cl: s.cl, re: s.re, powered: run.powered === true })
  return out
}

/** True if a run read a kit plane: lift without a pitching moment. */
export const isAircraftRun = (run: Pick<Run, 'samples'>): boolean => run.samples.some((s) => s.cl !== undefined && s.cm === undefined)
