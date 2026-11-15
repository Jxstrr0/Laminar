/**
 * Basic air sums every reading is built on. Real equations, no tuning.
 */
import { PI } from './det'

/** Dynamic pressure q = ½ρV², in pascals. */
export function dynamicPressure(density: number, speed: number): number {
  return 0.5 * density * speed * speed
}

/**
 * Reynolds number Re = ρVL/μ: how fast and big a flow is compared with how
 * sticky the air is. Small models run at a lower Re than the real thing,
 * and that changes where the flow separates (plan section 6.5).
 */
export function reynolds(density: number, speed: number, length: number, viscosity: number): number {
  return (density * speed * length) / viscosity
}

/** Frontal area of a sphere or round body, in m². */
export function circleArea(diameter: number): number {
  return (PI * diameter * diameter) / 4
}

/** Drag force D = q · Cd · A, in newtons. */
export function dragForce(q: number, dragCoefficient: number, area: number): number {
  return q * dragCoefficient * area
}
