/**
 * The kit plane as a body (PR 10q): an outline the drag model can read for
 * the frontal area and the flow picture, and where the plane's parts sit in
 * the drawing. The plane's own aero (drag by part, cruise speed, stall
 * speed) is worked out in src/sim/aircraft.ts; this outline is only its
 * shell: the fuselage, cowl to tail cone, and the client's pod.
 *
 * Sim x runs back from the spinner's tip along the fuselage's axis. The
 * drawing puts the wing's middle at x = 0, nose along +x, y up from the
 * ground the plane stands on, z out to the right wing.
 */
import { AIRCRAFT_BODY as B, type AircraftDesign } from '../../data/aircraft'
import type { Point, Pose } from './pose'
import type { ShapeSpec, Station } from './body'

/** The fuselage's length, m: cowl, cabin and tail cone. */
export function aircraftLength(): number {
  return B.cowl + B.cabin + B.cone
}

/** Sim x (m back from the spinner) to the drawing's x: the wing's middle at 0, nose at +x. */
export function aircraftX(x: number): number {
  return B.wingFrom + B.chord / 2 - x
}

/** The cowl's front as a share of the cabin: the tighter the cowl, the slimmer its front. */
export function cowlFront(design: AircraftDesign): number {
  return B.cowlLoose + (B.cowlTight - B.cowlLoose) * design.cowling
}

/** The fuselage's size at x as a share of the cabin: the spinner, the cowl rounding out from its front, the straight cabin, then the tail cone easing to its end. */
export function fuselageFullness(design: AircraftDesign, x: number): number {
  const sp = B.spinner
  if (x < sp.length) return (sp.radius / B.halfHeight) * Math.sqrt(Math.max(0, x / sp.length))
  if (x < B.cowl) {
    const u = (x - sp.length) / (B.cowl - sp.length)
    const s = cowlFront(design)
    return s + (1 - s) * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)))
  }
  const from = B.cowl + B.cabin
  if (x <= from) return 1
  const u = Math.min(1, (x - from) / B.cone)
  return B.coneEnd + (1 - B.coneEnd) * (1 - u * u * (3 - 2 * u))
}

/** One cross-section of the fuselage (the spinner is round). */
export function fuselageStation(design: AircraftDesign, x: number): Station {
  const f = fuselageFullness(design, x)
  const h = Math.max(0.005, B.halfHeight * f)
  return { x, top: h, bottom: h, half: x < B.spinner.length ? h : Math.max(0.005, B.half * f) }
}

/** The client's pod as placed: its middle's sim x, m (slid forward, it reaches ahead of the wing), and its length with any fairing, m. */
export function podPlace(design: AircraftDesign): { x: number; length: number } {
  return { x: B.wingFrom + B.chord / 2 - design.pod.at * B.pod.slide, length: B.pod.length }
}

/** The pod's size at x (m from its front) as a share of full: a box with rounded corners bare, a teardrop faired (a round nose, a long fine tail). */
export function podFullness(design: AircraftDesign, x: number): number {
  const len = B.pod.length
  const f = design.pod.fairing
  const u = Math.min(1, Math.max(0, x / len))
  // The faired shape: a round nose over the first quarter, then a long taper to a point.
  const nose = 0.25
  const a = (nose - u) / nose
  const b = (u - nose) / (1 - nose)
  const faired = u < nose ? 0.15 + 0.85 * Math.sqrt(Math.max(0, 1 - a * a)) : 1 - 0.9 * b * Math.sqrt(b)
  // The box: full nearly end to end, its ends cut square.
  const box = u < 0.04 || u > 0.96 ? 0.85 : 1
  return box + (faired - box) * f
}

export function aircraftShape(design: AircraftDesign): ShapeSpec {
  const len = aircraftLength()
  const xs: number[] = []
  for (let i = 0; i <= 48; i++) xs.push((len * i) / 48)
  const pod = podPlace(design)
  const px: number[] = []
  for (let i = 0; i <= 16; i++) px.push((pod.length * i) / 16)
  const r = B.pod.radius
  return {
    bodies: [
      { id: 'fuselage', stations: xs.map((x) => fuselageStation(design, x)), squareness: 0.35, roughness: 0.0001 },
      {
        id: 'pod',
        stations: px.map((x) => {
          const f = podFullness(design, x)
          return { x, top: Math.max(0.005, r * f), bottom: Math.max(0.005, r * f), half: Math.max(0.005, r * f) }
        }),
        squareness: 0.7 - 0.5 * design.pod.fairing,
        roughness: 0.0001,
        x: pod.x - pod.length / 2,
      },
    ],
    elements: [],
    junctions: [],
    cavities: [],
  }
}

/** The plane has no joints: every one sits at the pilot's seat, so screens that look at a pose look there. */
export function aircraftPose(): Pose {
  const at: Point = { x: aircraftX(B.cowl + B.cabin / 3), y: B.axis, z: 0 }
  const pair: [Point, Point] = [at, at]
  return { hip: pair, shoulder: pair, neck: at, head: at, headPitchDeg: 0, helmet: at, helmetTail: at, elbow: pair, hand: pair, knee: pair, foot: pair }
}
