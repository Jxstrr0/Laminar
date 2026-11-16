/**
 * The sensor pod as a body (PR 10z): an outline the drag model can read for
 * its frontal area and the flow picture, and where the pod, its pylon and
 * the wing above sit in the drawing. The pod's own aero (drag alone and
 * under the wing, hours on station, buffet) is worked out in
 * src/sim/pod.ts; this outline is only its shell.
 *
 * Sim x runs back from the nose's tip along the pod's axis. The drawing puts
 * the wing's thickest part at x = 0, nose along +x, y up, z out along the
 * wing; the pod hangs under the middle of the stretch of wing drawn.
 */
import { POD_BODY as B, type PodDesign } from '../../data/pod'
import { podLengths, sensorDiameter } from '../pod'
import { lerp } from '../num'
import { detPow } from '../det'
import type { Point, Pose } from './pose'
import type { ShapeSpec, Station } from './body'

/** The pod's radius at x (m back from its nose), m: the nose rounding out, the straight sensor, then the tail cone easing to its base. */
export function podRadius(design: PodDesign, x: number): number {
  const r = sensorDiameter(design) / 2
  const l = podLengths(design)
  if (x <= l.nose) {
    const u = Math.max(0, x / l.nose)
    const tip = lerp(B.noseTip.dome, B.noseTip.fine, design.nose)
    const curve = lerp(B.noseCurve.dome, B.noseCurve.fine, design.nose)
    const round = 1 - (1 - u) * (1 - u)
    return r * (tip + (1 - tip) * detPow(Math.max(0, round), curve))
  }
  if (x <= l.nose + l.middle) return r
  const u = Math.min(1, (x - l.nose - l.middle) / l.tail)
  const base = lerp(B.base.blunt, B.base.fine, design.tail)
  return r * (base + (1 - base) * (1 - u * u * (3 - 2 * u)))
}

/** The pod's middle in the drawing's x, m: slid forward of the wing's thickest part by the stagger. */
export function podMiddleX(design: PodDesign): number {
  return design.at * B.slide
}

/** Sim x (m back from the pod's nose) to the drawing's x. */
export function podX(design: PodDesign, x: number): number {
  return podMiddleX(design) + podLengths(design).total / 2 - x
}

/** The wing's underside above the pod's axis, m: the pod's radius plus the pylon's gap. */
export function wingBelow(design: PodDesign): number {
  return sensorDiameter(design) / 2 + design.gap
}

export function podShape(design: PodDesign): ShapeSpec {
  const len = podLengths(design).total
  const xs: number[] = []
  for (let i = 0; i <= 40; i++) xs.push((len * i) / 40)
  const station = (x: number): Station => {
    const r = Math.max(0.005, podRadius(design, x))
    return { x, top: r, bottom: r, half: r }
  }
  return {
    bodies: [{ id: 'pod', stations: xs.map(station), squareness: 0, roughness: 0.0001 }],
    elements: [],
    junctions: [],
    cavities: [],
  }
}

/** The pod has no joints: every one sits at its middle, so screens that look at a pose look there. */
export function podPose(design: PodDesign): Pose {
  const at: Point = { x: podMiddleX(design), y: B.axis, z: 0 }
  const pair: [Point, Point] = [at, at]
  return { hip: pair, shoulder: pair, neck: at, head: at, headPitchDeg: 0, helmet: at, helmetTail: at, elbow: pair, hand: pair, knee: pair, foot: pair }
}
