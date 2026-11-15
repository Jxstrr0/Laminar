/**
 * The time-trial field model (plan section 8.3): how fast a rider goes on
 * each stretch of road, from a power balance. The rider's power pushes
 * against air drag (at the apparent wind, with CdA read off the yaw curve),
 * rolling resistance and gravity.
 */
import { ATMOSPHERE, type CourseSegment } from '../../data/field'
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
  return { speed, yawDeg: at.yaw, apparent: at.va, time: seg.length / speed }
}

/** Time over a whole course. */
export function courseTime(
  rider: RiderSpec,
  course: readonly CourseSegment[],
  air: FieldAir,
  cdAAt: CdAAtYaw,
): { time: number; distance: number; segments: SegmentResult[] } {
  const segments = course.map((seg) => steadySpeed(rider, seg, air, cdAAt))
  return {
    time: segments.reduce((s, r) => s + r.time, 0),
    distance: course.reduce((s, c) => s + c.length, 0),
    segments,
  }
}
