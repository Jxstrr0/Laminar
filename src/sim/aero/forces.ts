/**
 * All the forces on a shape at an attitude (plan sections 6.2 to 6.4): drag,
 * lift or downforce, side force, and the yaw and pitch moments that decide
 * whether it settles into the wind or gets pushed off line.
 *
 * Forces are given as areas per unit dynamic pressure (CdA, ClA, CyA), so
 * the force in newtons is q times the number. They are in body axes, the way
 * a tunnel balance on a turntable reads them: drag along the shape's axis,
 * side force across it.
 *
 * Yaw β is the angle of the wind to the shape's axis. Positive β pushes the
 * shape towards +y, the side away from the wind.
 */
import { YAW } from '../../data/aero'
import type { ShapeDescriptor } from '../geom/body'
import { DEG, clamp01 } from '../num'
import { shapeDrag, type ShapeDrag } from './drag'
import type { Flow } from './flow'
import { elementForces, windAxes, type ElementResult } from './lift'

export interface Attitude {
  /** Wind angle to the shape's axis, degrees. */
  yawDeg: number
  /** Nose-up angle, degrees (adds to horizontal wings' angle). */
  pitchDeg?: number
}

export interface AeroForces {
  /** Drag along the shape's axis, m². */
  cdA: number
  /** Lift, m² (negative is downforce). */
  clA: number
  /** Side force, m² (positive pushes towards +y). */
  cyA: number
  /** Lift over drag. */
  lOverD: number
  /** Where the side force acts along the axis (m), or null with no side force. */
  centreOfPressureX: number | null
  /**
   * Yaw moment about the reference point, m³. Positive means the side force
   * acts behind it, so the shape turns into the wind and settles (stable).
   */
  yawMomentA: number
  /** Pitch moment about the reference point, m³. Positive is nose up. */
  pitchMomentA: number
  /** Drag breakdown of the bodies at zero yaw. */
  drag: ShapeDrag
  elements: ElementResult[]
}

/**
 * Forces on a shape. refX is the point moments are taken about (usually the
 * centre of mass), along the shape's axis.
 */
export function aeroForces(shape: ShapeDescriptor, flow: Flow, attitude: Attitude, refX = 0): AeroForces {
  const beta = attitude.yawDeg * DEG
  const { cos, sin } = windAxes(beta)
  const sin2 = sin * sin
  const drag = shapeDrag(shape, flow)

  let fx = drag.interferenceCdA + drag.cavityCdA
  let fy = 0
  let fyMoment = 0 // Σ side force × where it acts
  let lift = 0
  let pitch = 0

  // Bodies: their drag turns with the wind; long bodies add side force from
  // their length (acting near the nose) and cross-flow drag on their sides.
  const absYaw = attitude.yawDeg < 0 ? -attitude.yawDeg : attitude.yawDeg
  const fade = clamp01(1 - absYaw / YAW.shelterFadeDeg)
  shape.bodies.forEach((body, i) => {
    // Shelter behind other parts fades as the wind swings round.
    const sheltered = (drag.bodies[i] as ShapeDrag['bodies'][number]).cdA
    const open = body.inWake < 1 ? sheltered / (1 - body.inWake) : 0
    const d0 = open * (1 - body.inWake * fade)
    const longness = clamp01((body.fineness - 1) / (YAW.longFineness - 1))
    fx += d0 * (cos + YAW.axialRise * longness * sin2)
    const turned = d0 * sin
    const potential = YAW.sideSlope * body.sideArea * sin * cos * longness
    const cross = YAW.crossDrag * Math.max(0, body.sideArea - body.frontalArea) * sin * (sin < 0 ? -sin : sin)
    const centroid = body.x + body.sideCentroidX
    const nose = body.x + YAW.noseCentre * body.length
    fy += turned + cross + potential
    fyMoment += (turned + cross) * centroid + potential * nose
  })

  // Wings, fins and discs.
  const elements = shape.elements.map((el) => {
    const alpha = el.plane === 'horizontal' ? el.angleDeg + (attitude.pitchDeg ?? 0) : el.angleDeg + attitude.yawDeg
    const r = elementForces(el, flow, alpha)
    if (el.plane === 'horizontal') {
      fx += r.dragA * cos
      fy += r.dragA * sin
      fyMoment += r.dragA * sin * el.x
      lift += r.liftA
      pitch += r.liftA * (refX - el.x)
    } else {
      // Lift from a fin at yaw leans forward: the sail effect that lets a
      // disc wheel read less drag in a crosswind.
      const side = r.dragA * sin + r.liftA * cos
      fx += r.dragA * cos - r.liftA * sin
      fy += side
      fyMoment += side * el.x
    }
    return r
  })

  const tiny = 1e-12
  const cp = fy > tiny || fy < -tiny ? fyMoment / fy : null
  return {
    cdA: fx,
    clA: lift,
    cyA: fy,
    lOverD: fx > tiny ? lift / fx : 0,
    centreOfPressureX: cp,
    yawMomentA: cp === null ? 0 : fy * (cp - refX) * (fy < 0 ? -1 : 1),
    pitchMomentA: pitch,
    drag,
    elements,
  }
}

/** Forces over a sweep of yaw angles (the yaw curve). */
export function yawSweep(shape: ShapeDescriptor, flow: Flow, yawsDeg: number[], refX = 0): AeroForces[] {
  return yawsDeg.map((yawDeg) => aeroForces(shape, flow, { yawDeg }, refX))
}
