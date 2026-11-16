/**
 * Yaw curves and the wind-averaged CdA (plan section 4.1): the promise metric
 * for cyclists. A rider meets the wind from every direction over an event,
 * so drag is averaged over the yaw angles that wind makes, weighted by how
 * hard the apparent wind blows (a headwind counts for more than a tailwind).
 * The desk estimate, the tunnel reading and the field truth all use this,
 * so they can be compared directly.
 */
import { YAW_CURVE } from '../../data/field'
import { detAtan2, detCos, detSin, PI } from '../det'
import type { ShapeDescriptor } from '../geom/body'
import { interp } from '../num'
import type { Flow } from './flow'
import { aeroForces } from './forces'

export interface YawCurve {
  yawsDeg: number[]
  cdA: number[]
  cyA: number[]
  /** Yaw moment about the shape's reference point, m³ (negative turns it away from the wind). */
  cnA: number[]
}

/** CdA, side force and yaw moment over yaw, from −max to +max. */
export function yawCurve(shape: ShapeDescriptor, flow: Flow, refX = 0): YawCurve {
  const yawsDeg: number[] = []
  const cdA: number[] = []
  const cyA: number[] = []
  const cnA: number[] = []
  const steps = Math.round(YAW_CURVE.max / YAW_CURVE.step)
  for (let i = -steps; i <= steps; i++) {
    const yaw = i * YAW_CURVE.step
    const f = aeroForces(shape, flow, { yawDeg: yaw }, refX)
    yawsDeg.push(yaw)
    cdA.push(f.cdA)
    cyA.push(f.cyA)
    cnA.push(f.yawMomentA)
  }
  return { yawsDeg, cdA, cyA, cnA }
}

/** CdA at any yaw, read off a curve (held flat past its ends). */
export function cdAAt(curve: YawCurve, yawDeg: number): number {
  return interp(curve.yawsDeg, curve.cdA, yawDeg)
}

/**
 * The moment turning a rider off line at a yaw angle, m³: the yaw moment
 * when it turns them away from the wind, else 0. A bike is the same on
 * both sides, so it's read at the angle's size.
 */
export function steerAt(curve: YawCurve, yawDeg: number): number {
  return Math.max(0, -interp(curve.yawsDeg, curve.cnA, Math.abs(yawDeg)))
}

/**
 * Wind-averaged CdA for a rider at `riderSpeed` in a wind of `windSpeed`
 * from every direction in turn, each weighted by (apparent speed / rider
 * speed)².
 */
export function windAveragedCdA(curve: YawCurve, riderSpeed: number, windSpeed: number, samples = 36): number {
  if (!(riderSpeed > 0)) return cdAAt(curve, 0)
  let sum = 0
  for (let k = 0; k < samples; k++) {
    const phi = (2 * PI * (k + 0.5)) / samples
    const vx = riderSpeed + windSpeed * detCos(phi)
    const vy = windSpeed * detSin(phi)
    const yaw = (detAtan2(vy, vx) * 180) / PI
    sum += cdAAt(curve, yaw) * ((vx * vx + vy * vy) / (riderSpeed * riderSpeed))
  }
  return sum / samples
}
