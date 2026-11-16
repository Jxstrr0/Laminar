/**
 * Drones (plan sections 4.1, 6 and 9.6, PR 10a). Kelbo chose (16 November
 * 2026) racing quadcopters first, for hobby drone racers early in a career,
 * then fixed-wing survey drones mid-career (a later PR).
 *
 * A racing quad flies forward by tilting nose-down: its four props pull up
 * and forward at once. So the air meets the body at the quad's tilt, and
 * what the firm shapes is how the body takes that air:
 * - The body pod (the shell over the battery, camera and electronics): its
 *   length (a longer one is finer, less draggy head-on, but heavier, and it
 *   twists the quad harder when the air meets it at an angle) and its rake,
 *   how far it's tipped up on the frame. Raked to the quad's racing tilt,
 *   the pod points into the wind at full speed.
 * - The pod's vents: open, the speed controllers stay cool; closed, less
 *   drag, but they overheat partway through the race and cut the thrust.
 * - The arm fairings: a thin wing-shaped sleeve over each arm. Less drag,
 *   and less of the props' downwash beats on the arms, so more of the thrust
 *   lifts the quad; but they add weight, and weight costs cornering.
 *
 * Too long a pod at the wrong rake twists the quad harder than its motors
 * can hold at speed: it tumbles and crashes. Nobody is hurt; the drone
 * breaks (plan section 7).
 *
 * Lengths in metres, areas m², angles degrees, masses kg, forces N, moments N·m, times s.
 */
import type { CircuitSegment } from './circuits'

export type DroneClass = 'racer'

export interface DroneDesign {
  sport: 'drone'
  /** The client's kind of drone: set by the brief, not shaped. */
  class: DroneClass
  /** The body pod: its length, m, its rake up from the frame, degrees, and the share of its vents left open, 0–1. */
  pod: { length: number; rake: number; vents: number }
  /** How much of each arm the fairings cover, 0 (bare) to 1 (all of it). */
  arms: number
}

/** Slider ranges. */
export const DRONE_RANGE = {
  racer: {
    length: { min: 0.1, max: 0.24, step: 0.01 },
    rake: { min: 0, max: 70, step: 1 },
    vents: { min: 0, max: 1, step: 0.05 },
    arms: { min: 0, max: 1, step: 0.05 },
  },
}

/** A club racer as the hobby pilots fly it: a short pod raked a little, vents open, bare arms. */
export const STOCK_DRONE: Record<DroneClass, DroneDesign> = {
  racer: { sport: 'drone', class: 'racer', pod: { length: 0.12, rake: 10, vents: 0.6 }, arms: 0 },
}

export interface DroneClassSpec {
  /** All-up mass with the stock pod and bare arms, kg. */
  mass: number
  /** The four props' most thrust standing still, N, falling to none at `pitchSpeed`, m/s (the props can't pull faster than they screw through the air). */
  thrust: number
  pitchSpeed: number
  /** The most pitching moment the motors can hold against, N·m, before the quad tumbles. */
  authority: number
  /** The vents the speed controllers need open, share; with fewer, after `heatAfter` s of racing they lose up to `heatLoss` of the thrust. */
  coolNeed: number
  heatAfter: number
  heatLoss: number
}

export const DRONE_CLASS: Record<DroneClass, DroneClassSpec> = {
  racer: { mass: 0.62, thrust: 46, pitchSpeed: 62, authority: 0.5, coolNeed: 0.35, heatAfter: 25, heatLoss: 0.12 },
}

/** The aero (gameplay model, tuned to a 5-inch racing quad). */
export const DRONE_AERO = {
  /** The pod's front, m², and its width and height, m (the battery and stack set them; only the length is shaped). */
  podFront: 0.0045,
  podWidth: 0.06,
  /** The pod's drag coefficient head-on: `podCd` plus `podBluff` × width ÷ length (a short pod is a blunt box). */
  podCd: 0.35,
  podBluff: 1.8,
  /** Air meeting a body side-on: drag coefficient on the side it shows (sin² of the angle). */
  crossCd: 1.1,
  /** The frame plate's top, m², shown to the air as the quad tilts. */
  frameArea: 0.018,
  frameCd: 1,
  /** The four arms' edge area, m², and their drag coefficient bare and fully faired. */
  armArea: 0.0029,
  armCdBare: 1.2,
  armCdFaired: 0.35,
  /** The motors and spinning props, a fixed drag area, m². */
  propCdA: 0.0024,
  /** Open vents' drag area, m², at all open. */
  ventCdA: 0.0012,
  /** The share of the props' thrust lost to the downwash beating on the arms, bare and fully faired. */
  downwashBare: 0.07,
  downwashFaired: 0.025,
  /** The fairings' weight at full cover, kg, and the pod's per metre over the stock length, kg. */
  fairingMass: 0.05,
  podMassPerM: 0.3,
  /** The stock pod's length, m: longer ones weigh more. */
  podStock: 0.12,
  /** The twist air puts on a pod met at an angle (its pitching moment), per unit of q × length × front × sin 2α. */
  munk: 0.9,
}

/** The race (PR 10a): from a standing start, laps of the club's gate course, flown as fast as the quad can. */
export const DRONE_RACE = {
  /** Metres per step through the course. */
  step: 2,
  laps: 5,
  /** Passes to settle each corner's speed. */
  passes: 6,
  /** The fastest the race model lets any quad fly, m/s (a cap for the search). */
  ceiling: 70,
}

export interface DroneCourse {
  id: 'lugovoy'
  segments: readonly CircuitSegment[]
  /** Height above the sea, m, and a usual race day's air, °C. */
  altitude: number
  temperature: number
}

const S = (length: number): CircuitSegment => ({ kind: 'straight', length })
const R = (radius: number, angle: number): CircuitSegment => ({ kind: 'corner', radius, angle, dir: 'R' })
const L = (radius: number, angle: number): CircuitSegment => ({ kind: 'corner', radius, angle, dir: 'L' })

export const DRONE_COURSES: Record<DroneCourse['id'], DroneCourse> = {
  /** The Lugovoy meadow outside Stavren: the drone club's gate course, a fast back straight and two hairpins. */
  lugovoy: {
    id: 'lugovoy',
    altitude: 240,
    temperature: 17,
    segments: [S(80), R(10, 180), S(40), L(8, 90), S(30), R(8, 90), S(50), R(12, 180)],
  },
}
