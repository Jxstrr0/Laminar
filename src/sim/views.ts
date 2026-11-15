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
import { MODEL_FINISH, type ModelFinish } from '../data/model'
import { aeroForces, type AeroForces } from './aero/forces'
import type { Flow } from './aero/flow'
import { cdAAt, windAveragedCdA, yawCurve, type YawCurve } from './aero/windAverage'
import { densityAt, viscosityAt } from './field/atmosphere'
import { courseTime, type RiderSpec, type SegmentResult } from './field/timeTrial'
import { describeShape, scaleShape, type ShapeSpec } from './geom/body'
import { gaussian } from './noise'
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
}

/** The tunnel as the reading sees it. */
export interface TunnelSpec {
  turbulence: number
  balanceNoise: number
}

export interface RunSpec {
  speed: number
  yawDeg: number
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
  return {
    ...scaled,
    bodies: scaled.bodies.map((b) => {
      const k = 1 + model.accuracy * gaussian(rng)
      return {
        ...b,
        roughness: Math.max(b.roughness ?? 0, roughness),
        stations: b.stations.map((p) => ({ x: p.x, top: p.top * k, bottom: p.bottom * k, half: p.half * k })),
      }
    }),
  }
}

/**
 * One tunnel run: what the balance reads for a model at a speed and yaw.
 * Draws its noise from `rng`, so repeat runs on the same stream scatter.
 */
export function tunnelReading(spec: ShapeSpec, model: ModelSpec, tunnel: TunnelSpec, run: RunSpec, rng: Rng): TunnelReading {
  const shape = describeShape(buildModel(spec, model))
  const flow: Flow = { density: AIR.density, viscosity: AIR.viscosity, speed: run.speed, turbulence: tunnel.turbulence }
  const forces = aeroForces(shape, flow, { yawDeg: run.yawDeg })
  const modelCdA = forces.cdA * (1 + tunnel.balanceNoise * gaussian(rng))
  const cyA = forces.cyA * (1 + tunnel.balanceNoise * gaussian(rng))
  const s2 = model.scale * model.scale
  const longest = shape.bodies.reduce((m, b) => Math.max(m, b.length), 0)
  return {
    modelCdA,
    cdA: modelCdA / s2,
    cyA: cyA / s2,
    reynolds: (flow.density * flow.speed * longest) / flow.viscosity,
    forces,
  }
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
  const temperature = event.temperature + REFERENCE_EVENT.temperatureSpread * gaussian(rng)
  const windSpeed = Math.max(0, event.windSpeed + REFERENCE_EVENT.windSpread * gaussian(rng))
  const windFromDeg = rng.range(0, 360)
  const power = event.rider.power * (1 + REFERENCE_EVENT.powerSpread * gaussian(rng))
  const curve = yawCurve(describeShape(spec), eventFlow(event, temperature), event.refX)
  const run = courseTime(
    { ...event.rider, power },
    event.course,
    { density: densityAt(temperature, event.altitude), windSpeed, windFromDeg },
    (yaw) => cdAAt(curve, yaw),
  )
  return { ...run, temperature, windSpeed, windFromDeg, power }
}
