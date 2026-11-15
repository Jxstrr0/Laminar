/**
 * Lift, stall and induced drag of wings, fins, discs and diffusers (plan
 * section 6.3).
 *
 * - Lift slope from thin-airfoil theory corrected for aspect ratio
 *   (Helmbold's lifting-line form): 2π per radian for an endless wing, less
 *   for a stubby one. Endplates make a wing act longer.
 * - Camber shifts the zero-lift angle (about −2 × camber, in radians).
 * - Past the stall angle the flow tears off the top and the section turns
 *   into a flat plate: less lift, much more drag. Thin sections stall
 *   sharply, thick ones softly.
 * - Induced drag CL² / (π · AR · e): the price of lift, worse for short wings.
 * - Ground effect: near the ground a wing makes more, until it's so close the
 *   flow under it chokes and the load collapses.
 */
import { GROUND, LIFT } from '../../data/aero'
import { detCos, detSin, PI } from '../det'
import type { LiftingElement } from '../geom/body'
import { DEG, clamp01, lerp, smoothstep } from '../num'
import type { Flow } from './flow'
import { mixedCf, transitionDistance } from './friction'

export interface ElementResult {
  id: string
  /** Angle of attack it actually sees, degrees (set angle plus pitch or yaw). */
  alphaDeg: number
  cl: number
  /** Total drag coefficient: profile, stall and induced. */
  cd: number
  /** Induced part of cd. */
  cdi: number
  /** 0 flying normally, 1 fully stalled. */
  stalled: number
  /** Ground-effect multiplier on the load (1 in free air). */
  ground: number
  /** Lift (or side force) as an area per unit dynamic pressure, m². */
  liftA: number
  /** Drag as an area per unit dynamic pressure, m². */
  dragA: number
}

/** Effective aspect ratio, endplates included. */
export function aspectRatio(el: LiftingElement): number {
  const ar = el.chord > 0 ? el.span / el.chord : 0
  return ar * (1 + LIFT.endplateGain * (el.endplates ?? 0))
}

/** Lift-curve slope per radian (Helmbold). */
export function liftSlope(ar: number): number {
  if (!(ar > 0)) return 0
  return (2 * PI * ar) / (2 + Math.sqrt(ar * ar + 4))
}

/** Ground-effect multiplier on the load and on induced drag. */
export function groundEffect(el: LiftingElement): { load: number; induced: number } {
  if (el.plane !== 'horizontal' || el.rideHeight === undefined) return { load: 1, induced: 1 }
  const hc = Math.max(el.rideHeight, 0) / el.chord
  let load: number
  if (hc >= GROUND.critical) {
    load = 1 + GROUND.gain / hc
  } else {
    const peak = 1 + GROUND.gain / GROUND.critical
    load = peak * lerp(GROUND.floor, 1, smoothstep(GROUND.collapsed, GROUND.critical, hc))
  }
  const k = (GROUND.inducedK * el.rideHeight) / el.span
  const induced = (k * k) / (1 + k * k)
  return { load, induced }
}

/** Coefficients of one element at an angle of attack (degrees), in a flow. */
export function elementForces(el: LiftingElement, flow: Flow, alphaDeg: number): ElementResult {
  const ar = aspectRatio(el)
  const slope = liftSlope(ar)
  const alpha0 = -2 * el.camber
  const x = alphaDeg * DEG - alpha0
  const ax = x < 0 ? -x : x
  const sign = x < 0 ? -1 : 1

  const lowAspect = ar > 0 ? LIFT.stallLowAspect / ar : 0
  const stallRad = (LIFT.stallDeg + LIFT.stallPerThickness * (el.thickness * 100 - 12) + lowAspect) * DEG
  const width = lerp(LIFT.stallWidthSoft, LIFT.stallWidthSharp, clamp01(el.stallSharpness ?? 0.5)) * DEG
  const stalled = smoothstep(stallRad - width / 2, stallRad + width / 2, ax)

  const attached = sign * slope * (ax < stallRad ? ax : stallRad)
  const plate = LIFT.flatPlateLift * detSin(2 * x)
  const ground = groundEffect(el)
  const cl = lerp(attached, plate, stalled) * ground.load

  // Profile drag: friction on both sides, thickened by the section's shape.
  const unit = flow.speed > 0 ? (flow.density * flow.speed) / flow.viscosity : 0
  const reC = unit * el.chord
  const sTr = transitionDistance(flow, el.roughness ?? 0)
  const reTr = Number.isFinite(sTr) ? unit * sTr : reC
  const t = el.thickness
  const cd0 = 2 * mixedCf(reC, reTr) * (1 + LIFT.thicknessA * t + LIFT.thicknessB * t * t * t * t)
  const sx = detSin(x)
  const cdStall = LIFT.flatPlateDrag * sx * sx * stalled
  const cdi = ar > 0 ? ((cl * cl) / (PI * ar * LIFT.spanEfficiency)) * ground.induced : 0
  const cd = cd0 + cdStall + cdi

  const area = el.span * el.chord * (1 - clamp01(el.inWake ?? 0))
  return {
    id: el.id,
    alphaDeg,
    cl,
    cd,
    cdi,
    stalled,
    ground: ground.load,
    liftA: cl * area,
    dragA: cd * area,
  }
}

/** Unit vectors of the wind at yaw β (radians), for turning forces into body axes. */
export function windAxes(betaRad: number): { cos: number; sin: number } {
  return { cos: detCos(betaRad), sin: detSin(betaRad) }
}
