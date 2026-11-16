/**
 * The ski jumper in the air (plan sections 6.3, 6.4 and 8.3, PR 8c).
 *
 * Skis and body are low, wide plates. Each makes lift two ways: the plain
 * potential lift of a wing, and the vortex lift that low plates get from the
 * air curling over their edges (the Polhamus split). Lift and drag come from
 * the plate's normal force, so a steeper angle lifts more and drags more.
 * Where each plate's lift acts, against the hips, gives the pitch moment;
 * its slope with angle gives the static margin, the jumper's pitch
 * stability.
 *
 * The flight is a fixed-step march down the hill from the take-off edge
 * until the jumper meets the landing slope.
 */
import { FLIGHT, type Hill } from '../data/hills'
import { FLIGHT_ATTITUDE, JUMP_BODY, JUMP_SKIS, JUMPER_COST, PITCH, type JumperDesign } from '../data/jumper'
import { FIELD_TURBULENCE } from '../data/field'
import { shapeDrag } from './aero/drag'
import type { Flow } from './aero/flow'
import { detCos, detSin } from './det'
import { densityAt, viscosityAt } from './field/atmosphere'
import { describeShape } from './geom/body'
import { jumperParts } from './geom/jumper'
import { gaussian } from './noise'
import { clamp01, DEG } from './num'
import { Rng } from './rng'
import type { Comfort } from './cyclist'

export interface PlateForces {
  /** Lift and drag as areas per unit dynamic pressure, m². */
  clA: number
  cdA: number
  /** Where the lift acts, m forward of the hips. */
  x: number
}

export interface JumperForces {
  clA: number
  cdA: number
  lOverD: number
  /** Pitch moment about the hips, m³ (lift × arm); positive is nose up. */
  pitchA: number
  skis: PlateForces
  body: PlateForces
  /** Drag of the helmet and boots, m². */
  partsCdA: number
}

/** A plate's lift and drag coefficients at an angle (radians), from its normal force. */
function plate(kp: number, kv: number, cd0: number, alpha: number): { cl: number; cd: number } {
  const s = detSin(alpha)
  const c = detCos(alpha)
  const normal = kp * s * c + kv * s * (s < 0 ? -s : s)
  return { cl: normal * c, cd: normal * s + cd0 }
}

/** The body's width in flight (a baggy suit adds to it at the arms and legs). */
export function bodySpan(design: JumperDesign): number {
  return JUMP_BODY.width + JUMP_BODY.bagWidth * clamp01(design.suit.bagginess)
}

/** The lifting area: skis plus body, m². */
export function liftArea(design: JumperDesign): number {
  return 2 * JUMP_SKIS.length * JUMP_SKIS.width + bodySpan(design) * JUMP_BODY.length
}

/**
 * Forces at the skis' angle of attack (degrees). `partsCdA` is the helmet
 * and boots' drag, worked out once per flow by partsDrag().
 */
export function jumperForces(design: JumperDesign, alphaDeg: number, partsCdA: number): JumperForces {
  const bag = clamp01(design.suit.bagginess)
  const lean = design.posture.leanDeg
  const alpha = alphaDeg * DEG
  const bodyAlpha = (alphaDeg - lean) * DEG

  // Skis: a wider V spreads them into a better wing.
  const sk = JUMP_SKIS
  const skiArea = 2 * sk.length * sk.width
  const spread = detSin((design.posture.vAngleDeg / 2) * DEG)
  const skiC = plate(sk.kpBase + sk.kpPerSpread * spread, sk.kv, sk.cd0, alpha)
  const hipsAhead = JUMP_BODY.hipToBoot * detCos(lean * DEG)
  const skiX = sk.tipAhead - (sk.cpFromTip - sk.cpPerSpread * spread + sk.cpPerDeg * alphaDeg) * sk.length - hipsAhead
  const skis: PlateForces = { clA: skiC.cl * skiArea, cdA: skiC.cd * skiArea, x: skiX }

  // Body: a stubby plate, mostly vortex lift; a baggy suit widens it and moves its lift forward.
  const b = JUMP_BODY
  const span = bodySpan(design)
  const bodyArea = span * b.length
  const aspect = span / b.length
  const bodyC = plate(b.kpPerAspect * aspect, b.kv * (1 + b.kvPerBag * bag), b.cd0, bodyAlpha)
  const flat = Math.max(0, b.flatFrom - lean)
  const bodyX = b.headAhead - (b.cpFromHead + b.cpPerBag * bag - b.cpPerFlat * flat) * b.length
  const body: PlateForces = { clA: bodyC.cl * bodyArea, cdA: bodyC.cd * bodyArea, x: bodyX }

  const clA = skis.clA + body.clA
  const cdA = skis.cdA + body.cdA + partsCdA
  const pitchA = skis.clA * skis.x * detCos(alpha) + body.clA * body.x * detCos(bodyAlpha)
  return { clA, cdA, lOverD: cdA > 0 ? clA / cdA : 0, pitchA, skis, body, partsCdA }
}

/** The helmet and boots' drag in a flow, m². */
export function partsDrag(design: JumperDesign, flow: Flow): number {
  return shapeDrag(describeShape(jumperParts(design)), flow).cdA
}

/**
 * Static margin at an angle: how far behind the hips the lift's neutral
 * point sits, as a fraction of the body's length. Positive holds the
 * attitude; negative pitches the jumper over.
 */
export function staticMargin(design: JumperDesign, alphaDeg: number): number {
  const lo = jumperForces(design, alphaDeg - PITCH.step, 0)
  const hi = jumperForces(design, alphaDeg + PITCH.step, 0)
  const dL = hi.clA - lo.clA
  if (dL <= 1e-9) return 0
  return -(hi.pitchA - lo.pitchA) / dL / JUMP_BODY.length
}

/** The skis' angle of attack t seconds into the flight, degrees. */
export function attitudeAt(t: number): number {
  const a = FLIGHT_ATTITUDE
  if (t < a.ramp) return a.start + (a.hold - a.start) * (t / a.ramp)
  return a.hold + a.creepPerSecond * (t - a.ramp)
}

/** The landing surface under each step of x: height, and distance along the surface from the edge. */
export interface Surface {
  step: number
  y: number[]
  s: number[]
}

export function hillSurface(hill: Hill): Surface {
  const step = FLIGHT.surfaceStep
  const length = hill.transitionAt + hill.transitionLength + hill.hs * 0.5
  const n = Math.ceil(length / step) + 1
  const y = [-hill.drop]
  const s = [0]
  for (let i = 1; i < n; i++) {
    const x = (i - 0.5) * step
    const deg =
      x < hill.knollLength
        ? hill.knollDeg + (hill.landingDeg - hill.knollDeg) * (x / hill.knollLength)
        : x < hill.transitionAt
          ? hill.landingDeg
          : Math.max(0, hill.landingDeg * (1 - (x - hill.transitionAt) / hill.transitionLength))
    const dy = (step * detSin(deg * DEG)) / detCos(deg * DEG)
    y.push((y[i - 1] as number) - dy)
    s.push((s[i - 1] as number) + Math.sqrt(step * step + dy * dy))
  }
  return { step, y, s }
}

/** The surface under x: its height, and the distance along it from the edge, m. */
export function groundAt(surface: Surface, x: number): { y: number; s: number } {
  return { y: sample(surface.y, surface.step, x), s: sample(surface.s, surface.step, x) }
}

/** Where on the hill (x, m) the surface is `s` metres from the edge. */
export function xAtAlong(surface: Surface, s: number): number {
  const along = surface.s
  if (s <= 0) return 0
  for (let i = 1; i < along.length; i++) {
    const b = along[i] as number
    if (b >= s) {
      const a = along[i - 1] as number
      return (i - 1 + (s - a) / (b - a)) * surface.step
    }
  }
  return (along.length - 1) * surface.step
}

function sample(values: number[], step: number, x: number): number {
  const f = x / step
  const i = Math.max(0, Math.min(values.length - 2, Math.floor(f)))
  const t = f - i
  return (values[i] as number) * (1 - t) + (values[i + 1] as number) * t
}

/** The day's air and the jumper's run-in. */
export interface JumpConditions {
  temperature: number
  altitude: number
  /** Wind along the hill, m/s: positive blows up the hill into the jumper's face. */
  headwind: number
  takeoffSpeed: number
  /** Jumper plus kit, kg. */
  mass: number
}

export interface FlightPoint {
  t: number
  x: number
  y: number
  /** Skis' angle of attack, degrees. */
  alpha: number
  speed: number
  margin: number
}

export interface Flight {
  /** Metres along the landing slope from the edge. */
  distance: number
  /** Seconds in the air. */
  time: number
  /** Where and how fast it landed. */
  landing: { x: number; y: number; speed: number }
  /** The lowest static margin in the flight, and when it happened, s. */
  minMargin: number
  minMarginAt: number
  /** When the jumper pitched forward, s, or null if they held on. */
  pitchedAt: number | null
  /** Samples for the replay and charts, every few hundredths of a second. */
  track: FlightPoint[]
}

/**
 * What a flight needs from the air at each angle of attack (degrees): lift
 * and drag areas, m², and the static margin. The truth comes from the
 * design (designAero); a forecast from the tunnel's readings (PR 8e).
 */
export interface JumperAero {
  forces(alphaDeg: number): { clA: number; cdA: number }
  margin(alphaDeg: number): number
}

/** The design's own air: its plates, plus the helmet and boots' drag (`partsCdA`, m²). */
export function designAero(design: JumperDesign, partsCdA: number): JumperAero {
  return {
    forces: (alphaDeg) => jumperForces(design, alphaDeg, partsCdA),
    margin: (alphaDeg) => staticMargin(design, alphaDeg),
  }
}

/**
 * One flight from the edge to the landing. With `pitch` on, a margin below
 * zero tips the jumper forward: the skis' angle falls away and the jump ends
 * short. Off, the jumper holds the attitude whatever the margin (the clean
 * flight, for the promise and for saying what the pitch cost).
 */
export function fly(design: JumperDesign, hill: Hill, air: JumpConditions, pitch = true): Flight {
  const flow: Flow = { density: densityAt(air.temperature, air.altitude), viscosity: viscosityAt(air.temperature), speed: air.takeoffSpeed, turbulence: FIELD_TURBULENCE }
  return flyAero(designAero(design, partsDrag(design, flow)), hill, air, pitch)
}

/** The same flight through any air: the design's, or a forecast's. */
export function flyAero(aero: JumperAero, hill: Hill, air: JumpConditions, pitch = true): Flight {
  const surface = hillSurface(hill)
  const density = densityAt(air.temperature, air.altitude)
  const table = hill.tableDeg * DEG
  let vx = air.takeoffSpeed * detCos(table) + hill.jumpSpeed * detSin(table)
  let vy = -air.takeoffSpeed * detSin(table) + hill.jumpSpeed * detCos(table)
  let x = 0
  let y = 0
  let t = 0
  let minMargin = Infinity
  let minMarginAt = 0
  let pitchedAt: number | null = null
  let pitchedFrom = 0
  const track: FlightPoint[] = []
  const every = Math.round(0.05 / FLIGHT.dt)
  let k = 0
  const g = FLIGHT.gravity
  while (t < FLIGHT.maxSeconds) {
    const rx = vx + air.headwind
    const ry = vy
    const speed = Math.sqrt(rx * rx + ry * ry)
    const held = attitudeAt(t)
    const alpha = pitchedAt === null ? held : Math.max(PITCH.collapseAlpha, pitchedFrom - PITCH.collapseRate * (t - pitchedAt))
    const f = aero.forces(alpha)
    const q = 0.5 * density * speed * speed
    // Lift is square to the air, drag along it.
    const ax = (q * (-f.clA * ry - f.cdA * rx)) / speed / air.mass
    const ay = (q * (f.clA * rx - f.cdA * ry)) / speed / air.mass - g
    // The margin of the attitude the jumper is trying to hold.
    const margin = t >= FLIGHT_ATTITUDE.ramp ? aero.margin(held) : Infinity
    if (margin < minMargin) {
      minMargin = margin
      minMarginAt = t
    }
    if (pitch && pitchedAt === null && margin < 0) {
      pitchedAt = t
      pitchedFrom = alpha
    }
    if (k % every === 0) track.push({ t, x, y, alpha, speed: Math.sqrt(vx * vx + vy * vy), margin: Number.isFinite(margin) ? margin : aero.margin(alpha) })
    k++
    vx += ax * FLIGHT.dt
    vy += ay * FLIGHT.dt
    const nx = x + vx * FLIGHT.dt
    const ny = y + vy * FLIGHT.dt
    t += FLIGHT.dt
    const ground = sample(surface.y, surface.step, nx)
    if (ny <= ground && nx > 0) {
      // Land between the last two steps, where the path crosses the surface.
      const before = y - sample(surface.y, surface.step, x)
      const after = ny - ground
      const share = before - after > 1e-9 ? before / (before - after) : 1
      const lx = x + (nx - x) * share
      const ly = y + (ny - y) * share
      track.push({ t, x: lx, y: ly, alpha, speed: Math.sqrt(vx * vx + vy * vy), margin: Number.isFinite(margin) ? margin : aero.margin(alpha) })
      return {
        distance: sample(surface.s, surface.step, lx),
        time: t,
        landing: { x: lx, y: ly, speed: Math.sqrt(vx * vx + vy * vy) },
        minMargin: Number.isFinite(minMargin) ? minMargin : aero.margin(FLIGHT_ATTITUDE.hold),
        minMarginAt,
        pitchedAt,
        track,
      }
    }
    x = nx
    y = ny
  }
  return { distance: sample(surface.s, surface.step, x), time: t, landing: { x, y, speed: Math.sqrt(vx * vx + vy * vy) }, minMargin, minMarginAt, pitchedAt, track }
}

/** Metres a held-on flight loses to a wobbly landing: a margin between zero and the floor. */
export function wobbleLoss(minMargin: number): number {
  return minMargin >= 0 && minMargin < PITCH.floor ? PITCH.wobblePerPoint * (PITCH.floor - minMargin) * 100 : 0
}

/** A ski-jump event: the hill, the jumper and the typical day. */
export interface JumpEvent {
  hill: Hill
  /** Jumper plus kit, kg. */
  mass: number
  temperature: number
  altitude: number
  /** Typical wind along the hill, m/s (positive is a headwind). */
  headwind: number
  /** Day-to-day spread (standard deviations): temperature °C, wind m/s, take-off speed m/s. */
  spread: { temperature: number; wind: number; speed: number }
}

/**
 * The promise's yardstick (plan section 9): the flight in still air at the
 * hill's own take-off speed, so the day's wind doesn't decide it. It counts
 * only if the margin stays above the floor the whole way.
 */
export function referenceJump(design: JumperDesign, event: JumpEvent): ReferenceJump {
  const f = fly(design, event.hill, { temperature: event.temperature, altitude: event.altitude, headwind: 0, takeoffSpeed: event.hill.takeoffSpeed, mass: event.mass }, false)
  return { distance: f.distance, counted: Math.min(f.distance, event.hill.hs), pastHs: f.distance > event.hill.hs, minMargin: f.minMargin, stable: f.minMargin >= PITCH.floor }
}

/** The reference jump: its flight, and what of it counts. */
export interface ReferenceJump {
  /** Where the flight would land, m. */
  distance: number
  /**
   * What counts (Kelbo, 16 November 2026): no more than the hill size. A
   * jumper heading past HS bails out to a safe landing there.
   */
  counted: number
  pastHs: boolean
  minMargin: number
  stable: boolean
}

export interface JumpResult {
  /** The jump as it was measured, m (after any pitch trouble). */
  distance: number
  /** The same flight with no pitch trouble, m. */
  clean: number
  lostToPitch: number
  /** A pitch-forward, a wobbly landing, or a flight past the hill size that bailed out at HS. */
  trouble: 'pitch' | 'wobble' | 'long' | null
  flight: Flight
  /** The day: air temperature, wind along the hill and the take-off speed. */
  temperature: number
  headwind: number
  takeoffSpeed: number
}

/** The day itself: seeded air, wind and run-in speed, then the flight. */
export function jumpDay(design: JumperDesign, event: JumpEvent, seed: number): JumpResult {
  const rng = new Rng(seed).fork('jump-day')
  const temperature = event.temperature + event.spread.temperature * gaussian(rng)
  const headwind = event.headwind + event.spread.wind * gaussian(rng)
  const takeoffSpeed = event.hill.takeoffSpeed + event.spread.speed * gaussian(rng)
  const air = { temperature, altitude: event.altitude, headwind, takeoffSpeed, mass: event.mass }
  const flight = fly(design, event.hill, air)
  const clean = flight.pitchedAt === null ? flight.distance : fly(design, event.hill, air, false).distance
  const wobble = flight.pitchedAt === null ? wobbleLoss(flight.minMargin) : 0
  // A pitch-forward costs at least a full wobble, even one that comes just before the landing.
  const flown = flight.pitchedAt === null ? flight.distance - wobble : Math.min(flight.distance, clean - wobbleLoss(0))
  // Heading past the hill size, the jumper bails out to a safe landing at HS.
  const long = flown > event.hill.hs
  const distance = Math.min(flown, event.hill.hs)
  return {
    distance,
    clean,
    lostToPitch: clean - distance,
    trouble: flight.pitchedAt !== null ? 'pitch' : wobble > 0 ? 'wobble' : long ? 'long' : null,
    flight,
    temperature,
    headwind,
    takeoffSpeed,
  }
}

/** Readouts for the Shape sheet: lifting area, lift over drag and margin at the held angle, kit mass and price. */
export interface JumperReadouts {
  /** Skis plus body, m². */
  liftArea: number
  /** Lift ÷ drag of the plates at the settled flight angle (helmet and boots left out). */
  lOverD: number
  /** Static margin at the settled flight angle, a fraction of the body's length. */
  margin: number
  /** The plates' area as the oncoming air sees it at that angle, m². */
  frontalArea: number
  mass: number
  price: number
}

export function jumperReadouts(design: JumperDesign): JumperReadouts {
  const c = JUMPER_COST
  const hold = FLIGHT_ATTITUDE.hold
  const f = jumperForces(design, hold, 0)
  const skiArea = 2 * JUMP_SKIS.length * JUMP_SKIS.width
  const bodyArea = bodySpan(design) * JUMP_BODY.length
  return {
    liftArea: liftArea(design),
    lOverD: f.lOverD,
    margin: staticMargin(design, hold),
    frontalArea: skiArea * detSin(hold * DEG) + bodyArea * detSin((hold - design.posture.leanDeg) * DEG),
    mass: c.base.mass + c.suit.mass,
    price: c.base.price + c.suit.price + c.suit.pricePerBag * clamp01(design.suit.bagginess),
  }
}

/** A jumper has no crouch to hold and no pedals to push: the comfort meter stays empty. */
export function jumperComfort(): Comfort<string> {
  return { strain: 0, limit: 1, powerFactor: 1, holdable: true, fade: 0, worst: null }
}
