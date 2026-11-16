/**
 * Where the truck sits in the drawing (PR 9b). The figure is built nose
 * along +x with its wheels on y = 0 and +z to its right, centred on the
 * rig's middle so it turns about its middle on a turntable. A truck has no
 * joints, so its pose puts every one at the driver's seat: the screens
 * that read a pose (the camera's look point, the flow picture) get a
 * sensible place to look at.
 */
import { RIG, type TruckDesign } from '../../data/truck'
import type { Point, Pose } from './pose'
import { truckLength } from './truck'

/** Sim x (downstream from the cab's front) to the drawing's x (the rig's middle at 0, nose at +x). */
export function truckX(design: TruckDesign, x: number): number {
  return truckLength(design) / 2 - x
}

/** The driver's head: a metre back from the cab's front, high in the cab. */
const SEAT = { back: 1, up: 2.3 }

export function truckPose(design: TruckDesign): Pose {
  const at: Point = { x: truckX(design, SEAT.back), y: SEAT.up, z: 0 }
  const pair: [Point, Point] = [at, at]
  return {
    hip: pair,
    shoulder: pair,
    neck: at,
    head: at,
    headPitchDeg: 0,
    helmet: at,
    helmetTail: at,
    elbow: pair,
    hand: pair,
    knee: pair,
    foot: pair,
  }
}

/** The rig's middle height, for framing it. */
export function truckMiddleY(design: TruckDesign): number {
  return (design.trailerTop + RIG.bodyBottom) / 2
}
