/**
 * The survey drone as a body (PR 10j): an outline the drag model can read
 * for the frontal area and the flow picture, and where the plane's parts sit
 * in the drawing. The plane's own aero (drag by part, range, margin, gusts)
 * is worked out in src/sim/plane.ts; this outline is only its shell: the
 * fuselage and the camera pod under it. The wing and tail are drawn from
 * PLANE_BODY by the figure.
 *
 * Sim x runs back from the nose's tip along the fuselage's axis. The drawing
 * puts the wing's middle at the origin, nose along +x, y up, the axis at
 * the stand's height.
 */
import { PLANE_AERO, PLANE_BODY as B, type PlaneDesign } from '../../data/plane'
import type { Point, Pose } from './pose'
import type { ShapeSpec, Station } from './body'

/** The fuselage's length, m: nose, middle and tail cone. */
export function planeLength(design: PlaneDesign): number {
  return design.fuselage.nose + B.mid + B.cone
}

/** Where the wing's leading edge sits, sim x, m (it rides on the fuselage's middle, so a longer nose reaches further ahead of it). */
export function wingFrom(design: PlaneDesign): number {
  return design.fuselage.nose + B.wingFrom
}

/** The tail cone's end as a share of the full body: blunt, or fine to nearly a point. */
export function tailEnd(design: PlaneDesign): number {
  return B.endBlunt + (B.endPoint - B.endBlunt) * design.fuselage.taper
}

/** The fuselage's size at x as a share of full: an ogive nose from a small spinner, the straight middle, then the tail cone easing to its end. */
export function fuselageFullness(design: PlaneDesign, x: number): number {
  const n = design.fuselage.nose
  if (x < n) {
    const u = Math.max(0, x / n)
    return 0.12 + 0.88 * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)))
  }
  const from = n + B.mid
  if (x <= from) return 1
  const u = Math.min(1, (x - from) / B.cone)
  const end = tailEnd(design)
  // Easing in: full at the cone's start, its end share at the tail.
  return end + (1 - end) * (1 - u * u * (3 - 2 * u))
}

/** One cross-section of the fuselage. */
export function fuselageStation(design: PlaneDesign, x: number): Station {
  const f = fuselageFullness(design, x)
  return { x, top: Math.max(0.003, B.halfHeight * f), bottom: Math.max(0.003, B.halfHeight * f), half: Math.max(0.003, B.half * f) }
}

/** How much of the pod sits below the belly as drawn: the designed drop (the sheet warns if the client would lower it). */
export function podExposure(design: PlaneDesign): number {
  return PLANE_AERO.podFlush + (1 - PLANE_AERO.podFlush) * design.camera.drop
}

/** The camera pod as placed: its middle's sim x, m, its length with any fairing, m, and its top and bottom, m above the fuselage's axis. */
export function podPlace(design: PlaneDesign): { x: number; length: number; top: number; bottom: number } {
  const p = B.pod
  const x = wingFrom(design) + B.chord / 2 - design.camera.at * p.slide
  const bottom = -B.halfHeight - p.height * podExposure(design) - p.mount * design.camera.drop
  return { x, length: p.length + 2 * B.fairing * design.camera.fairing, top: bottom + p.height, bottom }
}

/** The pod's size at x (m from its front) as a share of full: square-ended bare, rounded to a teardrop by its fairing. */
export function podFullness(design: PlaneDesign, x: number): number {
  const len = podPlace(design).length
  const nose = Math.max(0.01, B.fairing * design.camera.fairing)
  const blunt = 0.75 - 0.6 * design.camera.fairing
  if (x < nose) {
    const u = x / nose
    return blunt + (1 - blunt) * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)))
  }
  if (len - x < nose) {
    const u = (len - x) / nose
    return blunt + (1 - blunt) * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)))
  }
  return 1
}

export function planeShape(design: PlaneDesign): ShapeSpec {
  const len = planeLength(design)
  const xs: number[] = []
  for (let i = 0; i <= 40; i++) xs.push((len * i) / 40)
  const pod = podPlace(design)
  const px: number[] = []
  for (let i = 0; i <= 12; i++) px.push((pod.length * i) / 12)
  const h = B.pod.height / 2
  const w = B.pod.width / 2
  return {
    bodies: [
      { id: 'fuselage', stations: xs.map((x) => fuselageStation(design, x)), squareness: 0.3, roughness: 0.00003 },
      {
        id: 'pod',
        stations: px.map((x) => {
          const f = podFullness(design, x)
          return { x, top: Math.max(0.003, h * f), bottom: Math.max(0.003, h * f), half: Math.max(0.003, w * f) }
        }),
        squareness: 0.7 - 0.4 * design.camera.fairing,
        roughness: 0.00005,
        x: pod.x - pod.length / 2,
      },
    ],
    elements: [],
    junctions: [],
    cavities: [],
  }
}

/** Sim x (m back from the nose's tip) to the drawing's x: the wing's middle at 0, nose at +x. */
export function planeX(design: PlaneDesign, x: number): number {
  return wingFrom(design) + B.chord / 2 - x
}

/** The plane has no joints: every one sits at the camera's lens under the pod, so screens that look at a pose look there. */
export function planePose(design: PlaneDesign): Pose {
  const pod = podPlace(design)
  const at: Point = { x: planeX(design, pod.x), y: B.stand + pod.bottom, z: 0 }
  const pair: [Point, Point] = [at, at]
  return { hip: pair, shoulder: pair, neck: at, head: at, headPitchDeg: 0, helmet: at, helmetTail: at, elbow: pair, hand: pair, knee: pair, foot: pair }
}
