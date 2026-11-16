/**
 * The land-speed streamliner as a body (PR 9q): an outline the drag model
 * can read for the frontal area and the flow picture, and where the car
 * sits in the drawing. The car's own aero (drag, nose lift, side force) is
 * worked out in src/sim/record.ts from its parts; this outline is only its
 * shell.
 *
 * A long, low, round-sided body: the nose cone swelling from a point to the
 * body's full width, the canopy a blister on top, the tail tapering to a
 * small blunt end. The nose's droop is drawn by the figure; the shell keeps
 * the nose on the body's axis.
 */
import { RECORD_BODY, RECORD_CLASS, type RecordDesign } from '../../data/record'
import type { Point, Pose } from './pose'
import type { ShapeSpec, Station } from './body'
import { recordLength } from '../record'

export { recordLength }

/** The body's half-height, m. */
function halfHeight(design: RecordDesign): number {
  return RECORD_CLASS[design.class].body.height / 2
}

/** The body's axis height above the salt, m. */
export function recordAxis(design: RecordDesign): number {
  return RECORD_BODY[design.class].ride + halfHeight(design)
}

/** How far the canopy rises above the body's top at x (m from the nose's tip): a smooth blister. */
export function canopyAt(design: RecordDesign, x: number): number {
  const b = RECORD_BODY[design.class]
  const from = design.nose.length + b.canopyFrom
  const to = design.nose.length + b.canopyTo
  if (x <= from || x >= to) return 0
  const u = (x - from) / (to - from)
  // A blister: rising steeply at the windscreen, easing back over the driver's head.
  const rise = u < 0.35 ? u / 0.35 : 1 - ((u - 0.35) / 0.65) * ((u - 0.35) / 0.65)
  return design.canopy * Math.max(0, rise)
}

/** How much a jet car's waist takes off the body's size at x (m from the nose's tip): the most at the engine, easing out either side. */
export function pinchAt(design: RecordDesign, x: number): number {
  const b = RECORD_BODY[design.class]
  const u = (x - design.nose.length - b.waistAt) / b.waistSpan
  if (u <= -1 || u >= 1) return 0
  // A smooth dip: flat at its edges and at its middle.
  const w = 1 - u * u
  return b.waistDepth * design.waist * w * w
}

/** The body's size at x as a share of its full size: 0 at the nose's tip, 1 along the body (less at a jet car's waist), easing in at the tail. */
export function fullnessAt(design: RecordDesign, x: number): number {
  return shellAt(design, x) * (1 - pinchAt(design, x))
}

function shellAt(design: RecordDesign, x: number): number {
  const b = RECORD_BODY[design.class]
  const n = design.nose.length
  const len = recordLength(design)
  if (x < n) {
    // An ogive: round-shouldered, coming to a point.
    const u = x / n
    return Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)))
  }
  const fromTail = len - x
  if (fromTail >= b.taper) return 1
  const tail = b.tailHalf / b.half
  const u = fromTail / b.taper
  return tail + (1 - tail) * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)))
}

/** One cross-section of the shell at x. */
export function recordStation(design: RecordDesign, x: number): Station {
  const b = RECORD_BODY[design.class]
  const f = fullnessAt(design, x)
  const h = halfHeight(design) * f
  return { x, top: Math.max(0.005, h + canopyAt(design, x)), bottom: Math.max(0.005, h), half: Math.max(0.005, b.half * f) }
}

export function recordShape(design: RecordDesign): ShapeSpec {
  const len = recordLength(design)
  const xs: number[] = []
  for (let i = 0; i <= 48; i++) xs.push((len * i) / 48)
  return {
    bodies: [{ id: 'record', stations: xs.map((x) => recordStation(design, x)), squareness: 0.2, roughness: 0.00002 }],
    elements: [],
    junctions: [],
    cavities: [],
  }
}

/** Sim x (m from the nose's tip) to the drawing's x: the car's middle at 0, nose at +x, as the truck and car are drawn. */
export function recordX(design: RecordDesign, x: number): number {
  return recordLength(design) / 2 - x
}

/** The car has no joints: every one sits at the driver's head under the canopy, so screens that look at a pose look at the cockpit. */
export function recordPose(design: RecordDesign): Pose {
  const b = RECORD_BODY[design.class]
  const at: Point = { x: recordX(design, design.nose.length + (b.canopyFrom + b.canopyTo) / 2), y: recordAxis(design) + halfHeight(design), z: 0 }
  const pair: [Point, Point] = [at, at]
  return { hip: pair, shoulder: pair, neck: at, head: at, headPitchDeg: 0, helmet: at, helmetTail: at, elbow: pair, hand: pair, knee: pair, foot: pair }
}
