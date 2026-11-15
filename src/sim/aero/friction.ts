/**
 * Skin friction and boundary-layer transition (plan section 6.2).
 *
 * A boundary layer starts laminar (smooth, low friction, but fragile) and
 * turns turbulent (more friction, but it clings to curved surfaces). Where it
 * turns moves with speed, size, turbulence in the air, roughness and trip
 * strips. That trade is the heart of the game's aero puzzles.
 */
import { detLog, detPow } from '../det'
import { FRICTION, TRANSITION } from '../../data/aero'
import type { Flow } from './flow'

/** Laminar flat-plate friction coefficient (Blasius), averaged over length Re. */
export function laminarCf(re: number): number {
  return re > 0 ? FRICTION.laminar / Math.sqrt(re) : 0
}

/** Turbulent flat-plate friction coefficient (Prandtl's 1/5-power law). */
export function turbulentCf(re: number): number {
  return re > 0 ? FRICTION.turbulent / detPow(re, FRICTION.turbulentExponent) : 0
}

/**
 * Friction coefficient of a fully rough surface (Schlichting), for sand-grain
 * height k over run length L. Rough skin can't do better than this.
 */
export function roughCf(length: number, k: number): number {
  if (!(k > 0) || !(length > k)) return 0
  const log10 = detLog(length / k) / detLog(10)
  return detPow(1.89 + 1.62 * log10, -2.5)
}

/**
 * Average friction coefficient over a run whose layer goes turbulent part way
 * (the Prandtl–Schlichting composite). reL is the run's Reynolds number and
 * reTr the Reynolds number where transition happens.
 */
export function mixedCf(reL: number, reTr: number, roughFloor = 0): number {
  if (!(reL > 0)) return 0
  if (reTr >= reL) return laminarCf(reL)
  const tr = Math.max(0, reTr)
  const turb = Math.max(turbulentCf(reL), roughFloor)
  const turbAtTr = tr > 0 ? Math.max(turbulentCf(tr), roughFloor) : 0
  return turb - (tr / reL) * (turbAtTr - laminarCf(tr))
}

/**
 * Distance from the stagnation point (m) at which the layer goes turbulent,
 * before any trip strip. Infinity when the air is still.
 */
export function transitionDistance(flow: Flow, roughness: number): number {
  if (!(flow.speed > 0)) return Infinity
  const unit = (flow.density * flow.speed) / flow.viscosity // Reynolds number per metre
  let re = TRANSITION.reynolds / (1 + TRANSITION.turbulencePerPercent * flow.turbulence * 100)
  if (roughness > 0) {
    const ratio = (unit * roughness) / TRANSITION.roughnessReynolds
    const r2 = ratio * ratio
    re /= 1 + r2 * r2
  }
  return re / unit
}

/**
 * How well a trip strip of this height works at this speed: 0 does nothing,
 * 1 trips the layer right at the strip.
 */
export function tripEffect(flow: Flow, height: number): number {
  if (!(flow.speed > 0) || !(height > 0)) return 0
  const reK = (flow.density * flow.speed * height) / flow.viscosity
  const t = (reK / TRANSITION.tripReynolds - 0.7) / 0.3
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  return c * c * (3 - 2 * c)
}
