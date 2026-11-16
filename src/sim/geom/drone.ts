/**
 * The racing quad as a body (PR 10b): an outline the drag model can read for
 * the frontal area and the flow picture, and where the quad sits in the
 * drawing. The quad's own aero (drag by part, thrust, twist) is worked out in
 * src/sim/drone.ts; this outline is only its shell: the pod, the frame plate
 * under it, and the arms.
 *
 * Drawn level, as it hovers, nose along +x: the pod tipped up by its rake,
 * its back end over the plate's middle.
 */
import { DRONE_AERO, DRONE_BODY, type DroneDesign } from '../../data/drone'
import { detCos, detSin } from '../det'
import type { Point, Pose } from './pose'
import type { ShapeSpec, Station } from './body'

const DEG = Math.PI / 180

/** The pod's height, m: its front area over its width. */
export function podHeight(): number {
  return DRONE_AERO.podFront / DRONE_AERO.podWidth
}

/** The pod's size at x (m from its nose along its own axis) as a share of full: a rounded front, a squarer back. */
function podFullness(design: DroneDesign, x: number): number {
  const len = design.pod.length
  const nose = Math.min(0.04, len * 0.3)
  if (x < nose) {
    const u = x / nose
    return 0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)))
  }
  const tail = 0.02
  if (len - x < tail) return 0.85 + 0.15 * ((len - x) / tail)
  return 1
}

/** One cross-section of the pod. */
export function podStation(design: DroneDesign, x: number): Station {
  const f = podFullness(design, x)
  const h = (podHeight() / 2) * f
  return { x, top: Math.max(0.002, h), bottom: Math.max(0.002, h), half: Math.max(0.002, (DRONE_AERO.podWidth / 2) * f) }
}

/** The pod's nose and back, in the drawing's frame (m, plate's middle at the origin, y up): tipped up by the rake. */
export function podEnds(design: DroneDesign): { back: Point; nose: Point } {
  const r = design.pod.rake * DEG
  const lift = DRONE_BODY.plateThick / 2 + podHeight() / 2
  const back: Point = { x: -DRONE_BODY.podBack, y: lift, z: 0 }
  return { back, nose: { x: back.x + design.pod.length * detCos(r), y: back.y + design.pod.length * detSin(r), z: 0 } }
}

export function droneShape(design: DroneDesign): ShapeSpec {
  const len = design.pod.length
  const xs: number[] = []
  for (let i = 0; i <= 16; i++) xs.push((len * i) / 16)
  const plate = DRONE_BODY.plate
  const plateHalf = DRONE_BODY.plateThick / 2
  return {
    bodies: [
      { id: 'pod', stations: xs.map((x) => podStation(design, x)), squareness: 0.6, roughness: 0.00005 },
      {
        id: 'plate',
        stations: [0, plate / 2, plate].map((x) => ({ x, top: plateHalf, bottom: plateHalf, half: DRONE_BODY.plateWidth / 2 })),
        squareness: 1,
        roughness: 0.0001,
        x: DRONE_BODY.podBack - plate / 2,
      },
    ],
    elements: [],
    junctions: [],
    cavities: [],
  }
}

/** The quad has no joints: every one sits at the pod's nose, where the camera looks out, so screens that look at a pose look there. */
export function dronePose(design: DroneDesign): Pose {
  const n = podEnds(design).nose
  const at: Point = { x: n.x, y: n.y + DRONE_BODY.hover, z: 0 }
  const pair: [Point, Point] = [at, at]
  return { hip: pair, shoulder: pair, neck: at, head: at, headPitchDeg: 0, helmet: at, helmetTail: at, elbow: pair, hand: pair, knee: pair, foot: pair }
}
