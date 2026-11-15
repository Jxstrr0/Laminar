/**
 * One truth, three views (plan section 6.8).
 *
 * - truth: the design at full size in the real air of the event. Hidden from
 *   the player; the field result and the debrief are built on it.
 * - tunnelReading: what the balance says about a scale model of the design,
 *   at tunnel speed, through the tunnel's quirks and the balance's noise.
 * - fieldResult: what happens on the day, with that day's wind, air and
 *   rider form.
 *
 * Each view is deterministic for a design, seed and set of inputs.
 */
import { AIR } from '../data/air'
import {
  FIELD_TURBULENCE,
  REFERENCE_COURSE,
  REFERENCE_EVENT,
  REFERENCE_RIDER,
  type CourseSegment,
} from '../data/field'
import { MODEL_FINISH, MODEL_TRIPS, type ModelFinish } from '../data/model'
import { aeroForces, type AeroForces } from './aero/forces'
import type { Flow } from './aero/flow'
import { cdAAt, windAveragedCdA, yawCurve, type YawCurve } from './aero/windAverage'
import { densityAt, viscosityAt } from './field/atmosphere'
import { courseTime, type RiderSpec, type SegmentResult } from './field/timeTrial'
import { describeShape, scaleShape, type ShapeDescriptor, type ShapeSpec } from './geom/body'
import { gaussian } from './noise'
import { blockageFactor, type MountKind, type TunnelQuirks } from './quirks'
import { Rng } from './rng'

/** The event a design is built for. */
export interface EventSpec {
  temperature: number
  altitude: number
  /** Expected rider speed, m/s, for flow and yaw weighting. */
  riderSpeed: number
  windSpeed: number
  course: readonly CourseSegment[]
  rider: RiderSpec
  /** Point the yaw moment is taken about, m from the front. */
  refX?: number
  /** How much the day varies (standard deviations): temperature °C, wind m/s, power fraction. The reference event's if left out. */
  spread?: { temperature: number; wind: number; power: number }
}

export const REFERENCE_TT: EventSpec = {
  temperature: REFERENCE_EVENT.temperature,
  altitude: REFERENCE_EVENT.altitude,
  riderSpeed: REFERENCE_EVENT.riderSpeed,
  windSpeed: REFERENCE_EVENT.windSpeed,
  course: REFERENCE_COURSE,
  rider: REFERENCE_RIDER,
  refX: 0.6,
}

export function eventFlow(event: EventSpec, temperature = event.temperature): Flow {
  return {
    density: densityAt(temperature, event.altitude),
    viscosity: viscosityAt(temperature),
    speed: event.riderSpeed,
    turbulence: FIELD_TURBULENCE,
  }
}

export interface Truth {
  /** Full-scale CdA straight into the wind, m². */
  cdA: number
  /** Full-scale CdA averaged over the event's typical wind, m². */
  windAveragedCdA: number
  curve: YawCurve
  forces: AeroForces
}

/** The hidden truth: the design full size in the event's air. */
export function truth(spec: ShapeSpec, event: EventSpec): Truth {
  const shape = describeShape(spec)
  const flow = eventFlow(event)
  const curve = yawCurve(shape, flow, event.refX)
  return {
    cdA: cdAAt(curve, 0),
    windAveragedCdA: windAveragedCdA(curve, event.riderSpeed, event.windSpeed),
    curve,
    forces: aeroForces(shape, flow, { yawDeg: 0 }, event.refX),
  }
}

/** How the model is built. */
export interface ModelSpec {
  scale: number
  finish: ModelFinish
  accuracy: number
  /** Seed for this particular model's build errors. */
  seed: number
  /** The shop's trip strips on the long parts (plan section 6.5, MODEL_TRIPS). */
  trips?: boolean
}

/** The tunnel as the reading sees it. */
export interface TunnelSpec {
  /** Turbulence intensity with no quirks given. */
  turbulence: number
  balanceNoise: number
  /** The tunnel's hidden quirks; leave out for an ideal tunnel. */
  quirks?: TunnelQuirks
  /** Test section, m (needed for blockage). */
  section?: { width: number; height: number }
}

export interface RunSpec {
  speed: number
  yawDeg: number
  /** What holds the model, so its drag joins the reading (with quirks). */
  mount?: MountKind
}

/** The test-section air's turbulence: the hidden quirk if there is one. */
export function tunnelTurbulence(tunnel: TunnelSpec): number {
  return tunnel.quirks ? tunnel.quirks.turbulence : tunnel.turbulence
}

/** The mount's own drag area at model size, m² (0 with no quirks). */
function mountDrag(tunnel: TunnelSpec, run: RunSpec): number {
  return tunnel.quirks && run.mount ? tunnel.quirks.mountCdA[run.mount] : 0
}

export interface TunnelReading {
  /** Drag area of the model, m², as the balance reads it. */
  modelCdA: number
  /** The same scaled up to full size (model CdA ÷ scale²), m². */
  cdA: number
  /** Side-force area scaled to full size, m². */
  cyA: number
  /** Reynolds number of the model's longest part. */
  reynolds: number
  forces: AeroForces
}

/** Builds the model: scaled, with this model's own small size errors and finish. */
export function buildModel(spec: ShapeSpec, model: ModelSpec): ShapeSpec {
  const rng = new Rng(model.seed).fork('model-build')
  const roughness = MODEL_FINISH[model.finish]
  const scaled = scaleShape(spec, model.scale)
  /** The shop's trip strips go on the parts that are long at full size. */
  const tripped = (i: number) => {
    const xs = spec.bodies[i]!.stations.map((p) => p.x)
    return model.trips === true && Math.max(...xs) - Math.min(...xs) >= MODEL_TRIPS.minLength
  }
  return {
    ...scaled,
    bodies: scaled.bodies.map((b, i) => {
      const k = 1 + model.accuracy * gaussian(rng)
      return {
        ...b,
        roughness: Math.max(b.roughness ?? 0, roughness),
        ...(tripped(i) && !b.trip ? { trip: { at: MODEL_TRIPS.at, height: MODEL_TRIPS.height } } : {}),
        stations: b.stations.map((p) => ({ x: p.x, top: p.top * k, bottom: p.bottom * k, half: p.half * k })),
      }
    }),
  }
}

/** A built model, described once so the balance can read it many times a second. */
export interface PreparedModel {
  shape: ShapeDescriptor
  scale: number
  /** Length of the model's longest part, m (for its Reynolds number). */
  longest: number
}

export function prepareModel(spec: ShapeSpec, model: ModelSpec): PreparedModel {
  return prepareExact(buildModel(spec, model), model.scale)
}

/** A shape made exactly, with no build errors: a reference body like the calibration sphere. */
export function prepareExact(spec: ShapeSpec, scale = 1): PreparedModel {
  const shape = describeShape(spec)
  return { shape, scale, longest: shape.bodies.reduce((m, b) => Math.max(m, b.length), 0) }
}

/**
 * One balance reading of a prepared model at a speed and yaw. Draws its
 * noise from `rng`, so repeat readings on the same stream scatter.
 *
 * With quirks the reading goes through the tunnel's faults: the air is a
 * little turbulent, blockage inflates the model's forces, and the mount's
 * own drag is read along with the model's.
 */
export function readBalance(prepared: PreparedModel, tunnel: TunnelSpec, run: RunSpec, rng: Rng): TunnelReading {
  const { shape, longest } = prepared
  const flow: Flow = { density: AIR.density, viscosity: AIR.viscosity, speed: run.speed, turbulence: tunnelTurbulence(tunnel) }
  const forces = aeroForces(shape, flow, { yawDeg: run.yawDeg })
  const q = tunnel.quirks
  const section = tunnel.section
  const blocked = q && section ? blockageFactor(q.blockage, shape.frontalArea, section.width * section.height) : 1
  const modelCdA = (forces.cdA * blocked + mountDrag(tunnel, run)) * (1 + tunnel.balanceNoise * gaussian(rng))
  const cyA = forces.cyA * blocked * (1 + tunnel.balanceNoise * gaussian(rng))
  const s2 = prepared.scale * prepared.scale
  return {
    modelCdA,
    cdA: modelCdA / s2,
    cyA: cyA / s2,
    reynolds: (flow.density * flow.speed * longest) / flow.viscosity,
    forces,
  }
}

/**
 * A tare reading: the mount with no model on it. The drag area is at model
 * size, m², and carries the balance's noise like any reading.
 */
export function readTare(tunnel: TunnelSpec, run: RunSpec, rng: Rng): number {
  return mountDrag(tunnel, run) * (1 + tunnel.balanceNoise * gaussian(rng))
}

/**
 * One tunnel run: what the balance reads for a model at a speed and yaw.
 * Draws its noise from `rng`, so repeat runs on the same stream scatter.
 */
export function tunnelReading(spec: ShapeSpec, model: ModelSpec, tunnel: TunnelSpec, run: RunSpec, rng: Rng): TunnelReading {
  return readBalance(prepareModel(spec, model), tunnel, run, rng)
}

export interface FieldResult {
  /** Course time, s. */
  time: number
  distance: number
  /** The day's conditions. */
  temperature: number
  windSpeed: number
  windFromDeg: number
  power: number
  segments: SegmentResult[]
}

/** The day itself: seeded weather and form, the truth's yaw curve, the course. */
export function fieldResult(spec: ShapeSpec, event: EventSpec, seed: number): FieldResult {
  const rng = new Rng(seed).fork('field-day')
  const spread = event.spread ?? {
    temperature: REFERENCE_EVENT.temperatureSpread,
    wind: REFERENCE_EVENT.windSpread,
    power: REFERENCE_EVENT.powerSpread,
  }
  const temperature = event.temperature + spread.temperature * gaussian(rng)
  const windSpeed = Math.max(0, event.windSpeed + spread.wind * gaussian(rng))
  const windFromDeg = rng.range(0, 360)
  const power = event.rider.power * (1 + spread.power * gaussian(rng))
  const curve = yawCurve(describeShape(spec), eventFlow(event, temperature), event.refX)
  const run = courseTime(
    { ...event.rider, power },
    event.course,
    { density: densityAt(temperature, event.altitude), windSpeed, windFromDeg },
    (yaw) => cdAAt(curve, yaw),
  )
  return { ...run, temperature, windSpeed, windFromDeg, power }
}
