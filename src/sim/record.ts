/**
 * The land-speed streamliner on the salt (plan sections 6.3, 8 and 9,
 * PR 9p).
 *
 * The aero: drag from the bare body, the nose cone (pressure drag that
 * falls as it gets longer, skin drag that grows), the nose's droop, the
 * canopy, the fin and the wheels (much less when faired). The long body
 * lifts like a wing near the ground; a longer nose lifts more and droop
 * presses it down. Near the speed of sound the air squeezes and the drag
 * grows; a longer nose lets that happen later.
 *
 * Pointing straight: the car's side force has to act behind its mass, or a
 * crosswind turns it further off and the car wanders. The slender nose
 * pushes the head off the wind; the fin and the rear fairings pull the
 * side force back.
 *
 * A run: from a standstill, traction-limited at first (all four wheels
 * drive, on salt), then power against drag, through the timed kilometre. If the nose
 * goes light or the car wanders, the driver pulls the chutes: nobody is
 * hurt, but the run doesn't count. The record is a run each way within the
 * hour: the timed kilometre twice over the two runs' time (Kelbo,
 * 16 November 2026).
 */
import { ATMOSPHERE } from '../data/field'
import { COMPRESSIBILITY as C, RECORD_AERO as A, RECORD_CLASS, RECORD_RUN as RUN, RECORD_SIDE as S, type RecordDesign } from '../data/record'
import type { SaltFlat } from '../data/saltFlats'
import { densityAt } from './field/atmosphere'
import { gaussian } from './noise'
import { clamp } from './num'
import { Rng } from './rng'

/** The car's aero: drag area and lift at each end, m² (lift positive, up). */
export interface RecordAero {
  cdA: number
  liftFront: number
  liftRear: number
  /** Each part's drag area, m². */
  drag: { body: number; nose: number; droop: number; canopy: number; fin: number; wheels: number }
}

/** The streamliner's aero at low speed (before the air squeezes). */
export function recordAero(design: RecordDesign): RecordAero {
  const c = RECORD_CLASS[design.class]
  const len = design.nose.length
  const drag = {
    body: c.bodyCdA,
    nose: A.nosePressure / len + A.noseSkin * len,
    droop: A.droopDrag * design.nose.droop * design.nose.droop,
    canopy: A.canopyDrag * design.canopy,
    fin: A.finDrag * design.fin,
    wheels: A.wheelsOpen * (1 - (1 - A.wheelsCovered) * design.fairings),
  }
  return {
    cdA: drag.body + drag.nose + drag.droop + drag.canopy + drag.fin + drag.wheels,
    liftFront: c.lift.front + A.noseLift * len - A.droopDown * design.nose.droop,
    liftRear: c.lift.rear,
    drag,
  }
}

/** The car's whole length, m. */
export function recordLength(design: RecordDesign): number {
  return design.nose.length + RECORD_CLASS[design.class].body.length
}

/**
 * Where the side force acts and where the mass sits, m from the nose's tip,
 * the side force's area (its push per radian of yaw per unit dynamic
 * pressure, m²), and the margin between them as a share of the car's length
 * (positive: the side force is behind the mass, and the car points into
 * the wind).
 */
export function sideCentre(design: RecordDesign): { centre: number; mass: number; area: number; margin: number } {
  const b = RECORD_CLASS[design.class].body
  const n = design.nose.length
  const parts: [number, number][] = [
    [S.noseArea * n * S.noseGain, S.noseAt * n],
    [b.length * b.height * S.bodyGain, n + S.bodyAt * b.length],
    [design.canopy * S.canopyLength, n + S.canopyAt],
    [S.fairingArea * design.fairings, n + b.frontAxle],
    [S.fairingArea * design.fairings, n + b.rearAxle],
    [design.fin * S.finGain, n + S.finAt],
  ]
  let area = 0
  let moment = 0
  for (const [a, x] of parts) {
    area += a
    moment += a * x
  }
  const centre = moment / area
  const mass = n + b.mass
  return { centre, mass, area, margin: (centre - mass) / recordLength(design) }
}

/** The margin the driver needs to hold the car straight in this crosswind, a share of the car's length. */
export function marginNeeded(cross: number): number {
  return S.margin + S.perCross * Math.abs(cross)
}

/** The speed of sound in air at this temperature, m/s. */
export function soundSpeed(temperatureC: number): number {
  return Math.sqrt(C.gamma * ATMOSPHERE.gasConstant * (temperatureC + ATMOSPHERE.kelvin))
}

/** The Mach number where the air starts to squeeze round this car. */
export function criticalMach(design: RecordDesign): number {
  return C.critical + C.perNose * (design.nose.length - C.refNose)
}

/** How much the drag grows at this Mach number (1: not at all). */
export function dragRise(design: RecordDesign, mach: number): number {
  const crit = criticalMach(design)
  if (mach <= crit) return 1
  const past = (mach - crit) / (1 - crit)
  return 1 + C.rise * past * past
}

/** The share of power the driver gives up because the canopy is too low to see the line well. */
export function sightLoss(design: RecordDesign): number {
  const short = Math.max(0, A.sightNeed - design.canopy) * 100
  return clamp(short * A.sightPenalty, 0, 0.9)
}

/** The air for one run: its density and temperature, the wind in the driver's face (negative: from behind), and the crosswind, m/s. */
export interface RunAir {
  temperature: number
  density: number
  head: number
  cross: number
}

export type RecordAbort = { cause: 'lift' | 'wander'; at: number; speed: number }

/** One run down the course. */
export interface RecordRun {
  /** The mean speed through the timed kilometre, m/s, and the time it took, s; null if the run was aborted. */
  speed: number | null
  time: number | null
  /** The fastest the car went, m/s over the salt, and its Mach number through the air there. */
  top: number
  topMach: number
  /** The drag rise at the car's fastest (1: the air didn't squeeze). */
  rise: number
  /** Why the driver pulled the chutes, where (m from the start) and how fast, or null. */
  abort: RecordAbort | null
  /** The car's speed at each step down the course, m/s (RUN.step apart, from the start). */
  speeds: number[]
}

/** Scales on the car's drag and lift, for a guess at them rather than the truth (the desk's estimate, PR 9q). */
export interface RecordTrim {
  drag: number
  lift: number
}
export const NO_RECORD_TRIM: RecordTrim = { drag: 1, lift: 1 }

/** The aero through a trim. */
function trimmed(design: RecordDesign, trim: RecordTrim): RecordAero {
  const a = recordAero(design)
  return { ...a, cdA: a.cdA * trim.drag, liftFront: a.liftFront * trim.lift, liftRear: a.liftRear * trim.lift }
}

/** The share of the front axle's static load the nose keeps at this air speed (1: all of it; under RUN.frontKeep the driver aborts). */
export function frontKept(design: RecordDesign, airSpeed: number, density: number, trim: RecordTrim = NO_RECORD_TRIM): number {
  const c = RECORD_CLASS[design.class]
  const front = c.mass * ATMOSPHERE.gravity * c.massFront
  return 1 - (0.5 * density * airSpeed * airSpeed * trimmed(design, trim).liftFront) / front
}

/** The steadiest crosswind the driver can hold the car straight in, m/s (0 or less: it wanders even in still air). */
export function crossHeld(design: RecordDesign): number {
  return crossHeldAt(sideCentre(design).margin)
}

/** The steadiest crosswind held with this margin (a share of the car's length), m/s. */
export function crossHeldAt(margin: number): number {
  return (margin - S.margin) / S.perCross
}

/**
 * How a run is worked out, when it isn't the plain truth:
 * - trim: scales on the drag and lift (the desk's guess);
 * - aero and margin: the drag, the lift and the side force's margin as
 *   something else measured them (the tunnel's forecast, PR 9r);
 * - squeeze: false leaves out the air squeezing near the speed of sound
 *   (the tunnel never sees it);
 * - holdStraight: pretend the driver holds a wandering car straight (to
 *   check the nose of a car that would otherwise wander before it got fast).
 */
export interface RunOptions {
  trim?: RecordTrim
  aero?: Pick<RecordAero, 'cdA' | 'liftFront' | 'liftRear'>
  margin?: number
  squeeze?: boolean
  holdStraight?: boolean
}

/** One run in this air. */
export function recordRun(design: RecordDesign, air: RunAir, opts: RunOptions = {}): RecordRun {
  const c = RECORD_CLASS[design.class]
  const g = ATMOSPHERE.gravity
  const weight = c.mass * g
  const frontStatic = weight * c.massFront
  const aero = opts.aero ?? trimmed(design, opts.trim ?? NO_RECORD_TRIM)
  const squeeze = opts.squeeze ?? true
  const power = c.power * (1 - sightLoss(design))
  const stable = opts.holdStraight === true || (opts.margin ?? sideCentre(design).margin) >= marginNeeded(air.cross)
  const sound = soundSpeed(air.temperature)
  const end = RUN.runUp + RUN.timed
  const speeds = [0]
  let v = 0
  let d = 0
  let timed = 0
  let top = 0
  let topMach = 0
  let rise = 1
  while (d < end - 1e-9) {
    const u = v + air.head
    const q = 0.5 * air.density * u * Math.abs(u)
    // The nose goes light, or the car wanders off the line: chutes out.
    if (q * aero.liftFront > (1 - RUN.frontKeep) * frontStatic) return aborted('lift')
    if (!stable && v >= S.wanderSpeed) return aborted('wander')
    const mach = Math.abs(u) / sound
    const r = squeeze ? dragRise(design, mach) : 1
    const traction = c.grip * Math.max(0, weight - q * (aero.liftFront + aero.liftRear))
    const drive = Math.min(power / Math.max(v, 1), traction)
    const drag = q * aero.cdA * r
    const rolling = RUN.rolling * Math.max(0, weight - q * (aero.liftFront + aero.liftRear))
    const accel = (drive - drag - rolling) / c.mass
    const next = Math.sqrt(Math.max(0, v * v + 2 * accel * RUN.step))
    const dt = RUN.step / Math.max((v + next) / 2, 0.5)
    if (d >= RUN.runUp - 1e-9) timed += dt
    v = next
    d += RUN.step
    speeds.push(v)
    if (v > top) {
      top = v
      topMach = Math.abs(v + air.head) / sound
      rise = r
    }
  }
  return { speed: RUN.timed / timed, time: timed, top, topMach, rise, abort: null, speeds }

  function aborted(cause: RecordAbort['cause']): RecordRun {
    return { speed: null, time: null, top, topMach, rise, abort: { cause, at: d, speed: v }, speeds }
  }
}

/** A record day's air: the temperature, the wind along the course (in the face on the first run) and across it, and how the wind along shifts before the run back. */
export interface RecordDay {
  temperature: number
  along: number
  cross: number
  shift: number
}

/** The air's density on the salt, kg/m³. */
export function flatDensity(flat: SaltFlat, temperature = flat.temperature): number {
  return densityAt(temperature, flat.altitude)
}

/** The salt flat's usual day: still air. */
export function stillDay(flat: SaltFlat): RecordDay {
  return { temperature: flat.temperature, along: 0, cross: 0, shift: 0 }
}

/** A seeded record day on the salt. */
export function recordDayAir(flat: SaltFlat, seed: number): RecordDay {
  const rng = new Rng(seed).fork('record-day')
  return {
    temperature: flat.temperature + flat.spread.temperature * gaussian(rng),
    along: flat.spread.along * gaussian(rng),
    cross: flat.spread.cross * gaussian(rng),
    shift: RUN.windShift * gaussian(rng),
  }
}

/** A record attempt: a run each way within the hour. */
export interface RecordAttempt {
  runs: [RecordRun, RecordRun]
  /** The record speed (the timed kilometre twice over both runs' time), m/s, or null if either run was aborted. */
  mean: number | null
}

/** The attempt on this day: out into the wind along, back with it (shifted a little) behind. */
export function twoWay(design: RecordDesign, flat: SaltFlat, day: RecordDay, opts: RunOptions = {}): RecordAttempt {
  const density = flatDensity(flat, day.temperature)
  const out = recordRun(design, { temperature: day.temperature, density, head: day.along, cross: day.cross }, opts)
  const back = recordRun(design, { temperature: day.temperature, density, head: -(day.along + day.shift), cross: day.cross }, opts)
  const mean = out.time !== null && back.time !== null ? (2 * RUN.timed) / (out.time + back.time) : null
  return { runs: [out, back], mean }
}
