/**
 * The time-trial field model (plan section 8.3): how fast a rider goes on
 * each stretch of road, from a power balance. The rider's power pushes
 * against air drag (at the apparent wind, with CdA read off the yaw curve),
 * rolling resistance and gravity.
 *
 * Two kinds of trouble cost time (plan section 7): a gust that turns the
 * bike makes the rider ease off for a while, and a position they can't hold
 * makes them sit up for the last third.
 */
import { ATMOSPHERE, FIELD_TROUBLE, type CourseSegment } from '../../data/field'
import { detAtan2, detCos, detSin, PI } from '../det'
import { DEG } from '../num'

export interface RiderSpec {
  /** Power, W. */
  power: number
  /** Rider plus bike, kg. */
  mass: number
  rollingResistance: number
  drivetrain: number
}

export interface FieldAir {
  density: number
  /** Wind speed, m/s, and the direction it blows from (degrees, 0 is north). */
  windSpeed: number
  windFromDeg: number
}

export interface SegmentResult {
  /** Ground speed, m/s. */
  speed: number
  /** Apparent wind yaw angle, degrees. */
  yawDeg: number
  /** Apparent wind speed, m/s. */
  apparent: number
  /** Time on the segment, s. */
  time: number
  /** Share of the rider's power given up while a gust lasts (0 if they held the bike straight). */
  eased: number
  /** Share of the rider's power lost to sitting up (0 if they held the position). */
  faded: number
  /** The worst steering moment a gust put on the bike here, N·m. */
  steer: number
}

/** CdA at a yaw angle (degrees). */
export type CdAAtYaw = (yawDeg: number) => number

/** Bisection bounds and steps for the speed solve, m/s. */
const SPEED_SOLVE = { low: 0.1, high: 40, steps: 60 } as const

/** Speed the rider holds on one segment. */
export function steadySpeed(rider: RiderSpec, seg: CourseSegment, air: FieldAir, cdAAt: CdAAtYaw): SegmentResult {
  const rel = (air.windFromDeg - seg.heading) * DEG
  const head = air.windSpeed * detCos(rel)
  const cross = air.windSpeed * detSin(rel)
  const norm = Math.sqrt(1 + seg.gradient * seg.gradient)
  const resist = (rider.mass * ATMOSPHERE.gravity * (seg.gradient + rider.rollingResistance)) / norm
  const push = rider.power * rider.drivetrain

  const forceAt = (v: number) => {
    const vx = v + head
    const va2 = vx * vx + cross * cross
    const yaw = (detAtan2(cross, vx) * 180) / PI
    return { f: 0.5 * air.density * va2 * cdAAt(yaw) + resist, yaw, va: Math.sqrt(va2) }
  }
  // Bisection on power: v × force(v) = push.
  let lo: number = SPEED_SOLVE.low
  let hi: number = SPEED_SOLVE.high
  for (let i = 0; i < SPEED_SOLVE.steps; i++) {
    const mid = (lo + hi) / 2
    if (mid * forceAt(mid).f > push) hi = mid
    else lo = mid
  }
  const speed = (lo + hi) / 2
  const at = forceAt(speed)
  return { speed, yawDeg: at.yaw, apparent: at.va, time: seg.length / speed, eased: 0, faded: 0, steer: 0 }
}

/** The moment turning a rider off line at a yaw angle, m³ (see `steerAt` in windAverage). */
export type SteerAtYaw = (yawDeg: number) => number

export interface Trouble {
  /** The design's steering moment over yaw; with it, gusts are checked. */
  steerAt?: SteerAtYaw
  /** Share of the rider's power lost from the last third on (0 if they hold the position). */
  fade?: number
}

/** The steering moment, N·m, a gust puts on a rider going `speed` on a segment. */
export function gustSteer(seg: CourseSegment, air: FieldAir, speed: number, steerAt: SteerAtYaw): number {
  const gust = air.windSpeed * FIELD_TROUBLE.gust.factor
  const rel = (air.windFromDeg - seg.heading) * DEG
  const vx = speed + gust * detCos(rel)
  const cross = gust * detSin(rel)
  const yaw = (detAtan2(cross, vx) * 180) / PI
  return 0.5 * air.density * (vx * vx + cross * cross) * steerAt(yaw)
}

/** How much power a rider gives up in a gust with this steering moment, N·m. */
export function easeFor(steer: number, mass: number): number {
  const limit = FIELD_TROUBLE.steerPerKg * mass
  if (steer <= limit) return 0
  const e = FIELD_TROUBLE.ease
  return Math.min(e.max, e.start + e.per * (steer / limit - 1))
}

/** One segment with any trouble on it: a gust share ridden at eased power. */
function troubledSpeed(rider: RiderSpec, seg: CourseSegment, air: FieldAir, cdAAt: CdAAtYaw, steerAt: SteerAtYaw | undefined, faded: number): SegmentResult {
  const own = { ...rider, power: rider.power * (1 - faded) }
  const calm = steadySpeed(own, seg, air, cdAAt)
  if (!steerAt || !(air.windSpeed > 0)) return { ...calm, faded }
  const steer = gustSteer(seg, air, calm.speed, steerAt)
  const eased = easeFor(steer, rider.mass)
  if (eased === 0) return { ...calm, faded, steer }
  const slow = steadySpeed({ ...own, power: own.power * (1 - eased) }, seg, air, cdAAt)
  const share = FIELD_TROUBLE.gust.share
  const time = (1 - share) * calm.time + share * slow.time
  return { ...calm, speed: seg.length / time, time, eased, faded, steer }
}

/** The course with a break at `distance` metres (if it falls inside a segment). */
export function splitCourse(course: readonly CourseSegment[], distance: number): CourseSegment[] {
  const out: CourseSegment[] = []
  let covered = 0
  for (const seg of course) {
    const cut = distance - covered
    if (cut > 0 && cut < seg.length) out.push({ ...seg, length: cut }, { ...seg, length: seg.length - cut })
    else out.push(seg)
    covered += seg.length
  }
  return out
}

export interface CourseRun {
  time: number
  distance: number
  /** The course as ridden: split where the rider sits up, so each piece has one speed. */
  course: CourseSegment[]
  segments: SegmentResult[]
}

/** Time over a whole course, with any trouble the rider meets on it. */
export function courseTime(rider: RiderSpec, course: readonly CourseSegment[], air: FieldAir, cdAAt: CdAAtYaw, trouble: Trouble = {}): CourseRun {
  const distance = course.reduce((s, c) => s + c.length, 0)
  const fade = trouble.fade ?? 0
  const from = distance * FIELD_TROUBLE.fade.from
  const ridden = fade > 0 ? splitCourse(course, from) : [...course]
  let covered = 0
  const segments = ridden.map((seg) => {
    // A segment past the fade point (allowing for rounding at the split).
    const late = fade > 0 && covered >= from - 1e-6
    covered += seg.length
    return troubledSpeed(rider, seg, air, cdAAt, trouble.steerAt, late ? fade : 0)
  })
  return { time: segments.reduce((s, r) => s + r.time, 0), distance, course: ridden, segments }
}
