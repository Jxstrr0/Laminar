/**
 * The ski jumper in the tunnel and the forecast (plan section 6.8, PR 8e).
 *
 * - readJumper: what the balance says about a scale model on a pitching
 *   sting: lift, drag and the pitch moment about the hips, scaled to full
 *   size, through the tunnel's quirks (blockage, the sting's own drag) and
 *   the balance's noise. The plates' lift comes from their edges, which the
 *   air treats the same at any size, so a jumper model hardly feels the
 *   Reynolds trap; only the helmet and boots do.
 * - forecastJump: the reference jump flown on those readings instead of the
 *   truth. Its distance is what you declare (Kelbo, 16 November 2026), and
 *   its lowest margin is the tunnel's word on stability.
 */
import { AIR } from '../data/air'
import { FLIGHT_ATTITUDE, JUMP_BODY, JUMP_SKIS, JUMP_TUNNEL, PITCH, type JumperDesign } from '../data/jumper'
import { shapeDrag } from './aero/drag'
import type { Flow } from './aero/flow'
import { detCos, detSin } from './det'
import { describeShape, type ShapeDescriptor } from './geom/body'
import { jumperParts } from './geom/jumper'
import { bodySpan, flyAero, jumperForces, type Flight, type JumpEvent, type JumperAero } from './jumper'
import { gaussian } from './noise'
import { DEG } from './num'
import { blockageFactor, type MountKind } from './quirks'
import { Rng } from './rng'
import { buildModel, tunnelTurbulence, type ModelSpec, type TunnelSpec } from './views'

/** A built jumper model: its plates' size errors and its small parts, ready to read many times a second. */
export interface PreparedJumper {
  design: JumperDesign
  scale: number
  /** Each plate came out this much bigger (or smaller) than drawn: skis, body. */
  skiArea: number
  bodyArea: number
  /** The helmet and boots, built at model scale. */
  parts: ShapeDescriptor
}

export function prepareJumper(design: JumperDesign, model: ModelSpec): PreparedJumper {
  const rng = new Rng(model.seed).fork('jumper-build')
  const k = () => 1 + model.accuracy * gaussian(rng)
  return { design, scale: model.scale, skiArea: k(), bodyArea: k(), parts: describeShape(buildModel(jumperParts(design), model)) }
}

export interface JumpRun {
  speed: number
  /** The sting's pitch: the skis' angle to the air, degrees. */
  alphaDeg: number
  /** What holds the model, so its drag joins the reading (with quirks). */
  mount?: MountKind
}

/** One balance reading, scaled to full size. */
export interface JumpReading {
  alphaDeg: number
  /** Lift and drag areas, m², and the pitch moment about the hips per unit dynamic pressure, m³ (nose up positive). */
  clA: number
  cdA: number
  pitchA: number
  /** The model's lift and drag as the balance felt them, N. */
  liftN: number
  dragN: number
}

/** The plates' area as the oncoming air sees it at an angle, m² (full size). */
export function jumperFrontal(design: JumperDesign, alphaDeg: number): number {
  const skis = 2 * JUMP_SKIS.length * JUMP_SKIS.width * Math.abs(detSin(alphaDeg * DEG))
  const body = bodySpan(design) * JUMP_BODY.length * Math.abs(detSin((alphaDeg - design.posture.leanDeg) * DEG))
  return skis + body
}

/**
 * One balance reading of a prepared jumper at a speed and pitch. Draws its
 * noise from `rng`, so repeat readings on the same stream scatter.
 */
export function readJumper(prepared: PreparedJumper, tunnel: TunnelSpec, run: JumpRun, rng: Rng): JumpReading {
  const { design, scale } = prepared
  const s2 = scale * scale
  const flow: Flow = { density: AIR.density, viscosity: AIR.viscosity, speed: run.speed, turbulence: tunnelTurbulence(tunnel) }
  // The small parts at the model's own size and speed (this is where Reynolds bites), back to full size.
  const partsCdA = shapeDrag(prepared.parts, flow).cdA / s2
  const f = jumperForces(design, run.alphaDeg, 0)
  const skiMoment = f.skis.clA * f.skis.x * detCos(run.alphaDeg * DEG)
  const bodyMoment = f.pitchA - skiMoment
  const k = { skis: prepared.skiArea, body: prepared.bodyArea }
  const q = tunnel.quirks
  const section = tunnel.section
  const frontal = (jumperFrontal(design, run.alphaDeg) + prepared.parts.frontalArea / s2) * s2
  const blocked = q && section ? blockageFactor(q.blockage, frontal, section.width * section.height) : 1
  const mount = q && run.mount ? q.mountCdA[run.mount] / s2 : 0
  const noise = () => 1 + tunnel.balanceNoise * gaussian(rng)
  const clA = (k.skis * f.skis.clA + k.body * f.body.clA) * blocked * noise()
  const cdA = ((k.skis * f.skis.cdA + k.body * f.body.cdA + partsCdA) * blocked + mount) * noise()
  const pitchA = (k.skis * skiMoment + k.body * bodyMoment) * blocked * noise()
  const qN = 0.5 * flow.density * run.speed * run.speed
  return { alphaDeg: run.alphaDeg, clA, cdA, pitchA, liftN: qN * clA * s2, dragN: qN * cdA * s2 }
}

/** One measured angle: the readings there, averaged. */
export interface PolarPoint {
  alphaDeg: number
  clA: number
  cdA: number
  pitchA: number
  /** How many readings went into it. */
  n: number
}

/** Readings pooled by angle, lowest angle first. */
export function polar(readings: readonly Pick<JumpReading, 'alphaDeg' | 'clA' | 'cdA' | 'pitchA'>[]): PolarPoint[] {
  const out: PolarPoint[] = []
  for (const r of [...readings].sort((a, b) => a.alphaDeg - b.alphaDeg)) {
    const last = out[out.length - 1]
    if (last && Math.abs(r.alphaDeg - last.alphaDeg) <= JUMP_TUNNEL.sameAngle) {
      const n = last.n + 1
      last.alphaDeg += (r.alphaDeg - last.alphaDeg) / n
      last.clA += (r.clA - last.clA) / n
      last.cdA += (r.cdA - last.cdA) / n
      last.pitchA += (r.pitchA - last.pitchA) / n
      last.n = n
    } else out.push({ alphaDeg: r.alphaDeg, clA: r.clA, cdA: r.cdA, pitchA: r.pitchA, n: 1 })
  }
  return out
}

/** The segment of the polar an angle falls in (clamped to the ends). */
function segment(points: readonly PolarPoint[], alphaDeg: number): { a: PolarPoint; b: PolarPoint; t: number } {
  let i = 0
  while (i < points.length - 2 && alphaDeg > points[i + 1]!.alphaDeg) i++
  const a = points[i]!
  const b = points[i + 1]!
  const t = Math.min(1, Math.max(0, (alphaDeg - a.alphaDeg) / (b.alphaDeg - a.alphaDeg)))
  return { a, b, t }
}

/**
 * The air as the tunnel measured it: straight lines between the angles read,
 * held flat past the ends. The margin is the moment's slope against the
 * lift's between the two readings either side, so noisy readings give a
 * noisy margin (repeat runs steady it).
 */
export function polarAero(points: readonly PolarPoint[]): JumperAero {
  if (points.length < 2) throw new Error('a polar needs two angles')
  return {
    forces(alphaDeg) {
      const { a, b, t } = segment(points, alphaDeg)
      return { clA: a.clA + (b.clA - a.clA) * t, cdA: a.cdA + (b.cdA - a.cdA) * t }
    },
    margin(alphaDeg) {
      const { a, b } = segment(points, alphaDeg)
      const dL = b.clA - a.clA
      if (Math.abs(dL) < 1e-9) return 0
      return -(b.pitchA - a.pitchA) / dL / JUMP_BODY.length
    },
  }
}

export interface JumpForecast {
  /** The reference jump flown on the readings, m. */
  distance: number
  /** The lowest margin the readings give over that flight, and whether it clears the floor. */
  minMargin: number
  stable: boolean
  /** The angles the flight passed through, and the angles read. */
  need: { from: number; to: number }
  have: { from: number; to: number }
  /** True when the readings span the flight's angles (within JUMP_TUNNEL.coverSlack). */
  covered: boolean
  flight: Flight
}

/**
 * The reference jump (still air, the hill's own take-off speed) flown on the
 * tunnel's readings. Null with fewer than two angles read.
 */
export function forecastJump(readings: readonly Pick<JumpReading, 'alphaDeg' | 'clA' | 'cdA' | 'pitchA'>[], event: JumpEvent): JumpForecast | null {
  const points = polar(readings)
  if (points.length < 2) return null
  const air = { temperature: event.temperature, altitude: event.altitude, headwind: 0, takeoffSpeed: event.hill.takeoffSpeed, mass: event.mass }
  const flight = flyAero(polarAero(points), event.hill, air, false)
  const alphas = flight.track.map((p) => p.alpha)
  const need = { from: Math.min(FLIGHT_ATTITUDE.start, ...alphas), to: Math.max(...alphas) }
  const have = { from: points[0]!.alphaDeg, to: points[points.length - 1]!.alphaDeg }
  const slack = JUMP_TUNNEL.coverSlack
  return {
    distance: flight.distance,
    minMargin: flight.minMargin,
    stable: flight.minMargin >= PITCH.floor,
    need,
    have,
    covered: have.from <= need.from + slack && have.to >= need.to - slack,
    flight,
  }
}
