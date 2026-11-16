/**
 * The racing car as a body (PR 9j): an outline the drag model can read for
 * the frontal area and the flow picture, and where the car sits in the
 * drawing. The car's own aero (wings, floor, ground effect) is worked out
 * in src/sim/car.ts from its parts; this outline is only its shell.
 *
 * - A touring car is a saloon: a low nose, a cabin, a short boot.
 * - A single-seater is a slim tub with the driver's head and the airbox
 *   highest, its wheels out in the air (they're drawn, not part of the shell).
 */
import { CAR_BODY, type CarDesign } from '../../data/car'
import type { Point, Pose } from './pose'
import type { ShapeSpec, Station } from './body'

/** The car's length, nose to tail, m. */
export function carLength(design: CarDesign): number {
  return CAR_BODY[design.class].length
}

/** The body's axis height above the road: halfway up from the floor at the car's mean ride height. */
export function carAxis(design: CarDesign): number {
  const b = CAR_BODY[design.class]
  const floor = (design.ride.front + design.ride.rear) / 2
  return (floor + b.roof) / 2
}

/** The roof's height above the road at x (m from the nose): rising from the nose to the cabin or airbox, falling to the tail. */
function roofAt(design: CarDesign, x: number): number {
  const b = CAR_BODY[design.class]
  const u = x / b.length
  const low = design.class === 'touring' ? 0.75 : 0.45
  const tail = design.class === 'touring' ? 0.95 : 0.7
  if (u < b.roofFrom) return low + ((b.roof - low) * u) / b.roofFrom
  if (u <= b.roofTo) return b.roof
  return b.roof + ((tail - b.roof) * (u - b.roofTo)) / (1 - b.roofTo)
}

/** The floor's height above the road at x: the ride heights joined in a straight line between the axles (rake), carried on past them. */
export function floorAt(design: CarDesign, x: number): number {
  const b = CAR_BODY[design.class]
  const t = (x - b.frontAxle) / (b.rearAxle - b.frontAxle)
  return design.ride.front + (design.ride.rear - design.ride.front) * t
}

/** One cross-section of the shell at x. */
export function carStation(design: CarDesign, x: number): Station {
  const b = CAR_BODY[design.class]
  const axis = carAxis(design)
  // The nose is rounded off over its first stretch; a single-seater's tub is narrow.
  const round = x < b.nose ? Math.sqrt(Math.max(0, b.nose * b.nose - (b.nose - x) * (b.nose - x))) / b.nose : 1
  const half = (design.class === 'touring' ? b.width / 2 : b.width / 4.2) * (0.35 + 0.65 * round)
  const floor = Math.max(0.005, floorAt(design, x))
  return { x, top: (roofAt(design, x) - axis) * (0.4 + 0.6 * round), bottom: axis - floor, half }
}

export function carShape(design: CarDesign): ShapeSpec {
  const len = carLength(design)
  const xs: number[] = []
  for (let i = 0; i <= 40; i++) xs.push((len * i) / 40)
  return {
    bodies: [{ id: 'car', stations: xs.map((x) => carStation(design, x)), squareness: design.class === 'touring' ? 0.7 : 0.4, roughness: 0.00002 }],
    elements: [],
    junctions: [],
    cavities: [],
  }
}

/** Sim x (m from the nose) to the drawing's x: the car's middle at 0, nose at +x, as the truck is drawn. */
export function carX(design: CarDesign, x: number): number {
  return carLength(design) / 2 - x
}

/** The car has no joints: every one sits at the driver's head, so screens that look at a pose look at the cockpit. */
export function carPose(design: CarDesign): Pose {
  const b = CAR_BODY[design.class]
  const at: Point = { x: carX(design, b.length * (design.class === 'touring' ? 0.45 : 0.5)), y: b.roof * 0.9, z: 0 }
  const pair: [Point, Point] = [at, at]
  return { hip: pair, shoulder: pair, neck: at, head: at, headPitchDeg: 0, helmet: at, helmetTail: at, elbow: pair, hand: pair, knee: pair, foot: pair }
}
