/**
 * The racing quad in the tunnel and the forecast (plan sections 6.3, 6.8
 * and 9.6, PR 10c).
 *
 * - readDrone: what the balance says about a quad model on the sting,
 *   tipped to a tilt (nose down; negative is tipped back, as when it
 *   brakes): its drag area, the twist on its pod (the pitching moment over
 *   the dynamic pressure), and, if the model is powered and its props spin,
 *   the share of the thrust the downwash on the arms takes. Through the
 *   tunnel's quirks (blockage, the sting's own drag) and the balance's noise.
 *   A quad is tested full size.
 * - forecastDrone: the race worked out with those readings in place of the
 *   truth, against the club's quad (their own lap times, so the truth). With
 *   the props stopped the forecast takes the motor maker's downwash figure,
 *   measured on bare arms, so it reads fairings slow (Kelbo, 16 November
 *   2026: "props stopped"). With no reading where the pod meets the air at
 *   an angle, it can't say how hard the quad twists, so it can't see a
 *   tumble coming.
 */
import { AIR } from '../data/air'
import { DRONE_AERO as A, DRONE_CLASS, DRONE_TUNNEL as T, type DroneCourse, type DroneDesign } from '../data/drone'
import { detSin } from './det'
import { courseDensity, downwashLoss, droneDrag, droneRace, heatLoss, steadyTilt, topSpeed, type DroneRace, type DroneTrim } from './drone'
import { describeShape } from './geom/body'
import { droneShape } from './geom/drone'
import { gaussian } from './noise'
import { DEG } from './num'
import { blockageFactor, type MountKind } from './quirks'
import { Rng } from './rng'
import type { Run } from './run'
import { REFERENCE_TT, type EventSpec, type ModelSpec, type TunnelSpec } from './views'

/** How a quad model goes in: props stopped (a plain model) or spinning (a powered one, PR 10c). */
export type DroneProps = 'stopped' | 'powered'

/** A built quad model: its build errors and its props, ready to read many times a second. */
export interface PreparedDrone {
  design: DroneDesign
  scale: number
  /** The model's drag and twist came out this much bigger (or smaller) than drawn. */
  drag: number
  twist: number
  props: DroneProps
  /** The quad's frontal area, m² (for the blockage). */
  frontal: number
}

export function prepareDrone(design: DroneDesign, model: ModelSpec, props: DroneProps): PreparedDrone {
  const rng = new Rng(model.seed).fork('drone-build')
  return {
    design,
    scale: model.scale,
    drag: 1 + model.accuracy * gaussian(rng),
    twist: 1 + model.accuracy * gaussian(rng),
    props,
    frontal: describeShape(droneShape(design)).frontalArea,
  }
}

export interface DroneTunnelRun {
  speed: number
  /** How far the sting tips the model nose-down, degrees (negative: tipped back). */
  tiltDeg: number
  mount?: MountKind
}

/** One balance reading, scaled to full size. */
export interface DroneReading {
  tiltDeg: number
  /** Drag area, m², and the twist on the pod over the dynamic pressure, m³ (positive: nose down, turning the pod further off the wind). */
  cdA: number
  twist: number
  /** The share of the thrust the downwash on the arms takes, or null with the props stopped. */
  downwash: number | null
  /** The model's drag as the balance felt it, N. */
  dragN: number
}

/** The twist on the pod over the dynamic pressure at this tilt, m³: what the sim's pitching moment is per unit q. */
export function twistArea(design: DroneDesign, tilt: number): number {
  return A.munk * design.pod.length * A.podFront * detSin(2 * (tilt - design.pod.rake * DEG))
}

/**
 * One balance reading of a prepared quad model at a speed and tilt. Draws
 * its noise from `rng`, so repeat readings on the same stream scatter.
 */
export function readDrone(prepared: PreparedDrone, tunnel: TunnelSpec, run: DroneTunnelRun, rng: Rng): DroneReading {
  const { design, scale } = prepared
  const s2 = scale * scale
  const tilt = run.tiltDeg * DEG
  const q = tunnel.quirks
  const section = tunnel.section
  const blocked = q && section ? blockageFactor(q.blockage, prepared.frontal * s2, section.width * section.height) : 1
  const mount = q && run.mount ? q.mountCdA[run.mount] / s2 : 0
  const noise = () => 1 + tunnel.balanceNoise * gaussian(rng)
  const cdA = (droneDrag(design, tilt).cdA * prepared.drag * blocked + mount) * noise()
  // The twist reads with the balance's scatter, and a small floor of noise even when the pod is head-on.
  const floor = T.twistNoise * tunnel.balanceNoise * A.munk * design.pod.length * A.podFront * detSin(2 * T.twistFrom * DEG)
  const twist = twistArea(design, tilt) * prepared.twist * blocked * noise() + floor * gaussian(rng)
  const downwash = prepared.props === 'powered' ? downwashLoss(design) + T.downwashScatter * tunnel.balanceNoise * gaussian(rng) : null
  const qN = 0.5 * AIR.density * run.speed * run.speed
  return { tiltDeg: run.tiltDeg, cdA, twist, downwash, dragN: qN * cdA * s2 }
}

/** What the calibration runs let you take off a quad model's readings: the sting's tare and the blockage. */
export interface DroneFix {
  tare: number | null
  blockageK: number | null
}

/** A reading with the sting's tare and the blockage taken off (as far as the calibration runs found them). */
export function correctDrone<R extends Pick<DroneReading, 'cdA' | 'twist'>>(r: R, fix: DroneFix, prepared: PreparedDrone, sectionArea: number): R {
  const s2 = prepared.scale * prepared.scale
  const b = fix.blockageK !== null ? blockageFactor(fix.blockageK, prepared.frontal * s2, sectionArea) : 1
  const tare = (fix.tare ?? 0) / s2
  return { ...r, cdA: (r.cdA - tare) / b, twist: r.twist / b }
}

export interface DroneForecast {
  /** The race's time, s, and what it gains on the club's quad, s (positive: faster); null if the forecast quad tumbles. */
  time: number | null
  gain: number | null
  /** Top speed, m/s, and the tilt that holds it, radians. */
  top: number
  tilt: number
  /** The drag scale the readings found on the firm's own drag-against-tilt curve. */
  drag: number
  /**
   * The twist's scale on the pod's own curve, and the hardest it twists over
   * the race as a share of what the motors hold; null if no reading met the
   * pod at enough of an angle to measure it (then a tumble can't be seen).
   */
  twist: { scale: number; share: number; braking: boolean; speed: number } | null
  tumble: DroneRace['tumble']
  /** The downwash share the forecast used, and whether it was measured (powered) or the maker's bare-arm figure. */
  downwash: number
  downwashMeasured: boolean
  /** When the speed controllers overheat, s into the race, and the thrust they lose (the maker's data, so the truth). */
  hotAt: number | null
  heat: number
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

/**
 * The race on the tunnel's readings, against the club's quad. The drag
 * scale is the readings' mean over the drag the firm's curve expects at
 * each reading's tilt; the twist is fitted, by least squares, from the
 * readings where the pod met the air at least `twistFrom` off its nose; the
 * downwash share from the powered readings, if any. Null until something
 * has been read.
 */
export function forecastDrone(readings: readonly Omit<DroneReading, 'dragN'>[], design: DroneDesign, old: DroneDesign, course: DroneCourse): DroneForecast | null {
  if (readings.length === 0) return null
  const drag = mean(readings.map((r) => r.cdA / droneDrag(design, r.tiltDeg * DEG).cdA))
  let num = 0
  let den = 0
  for (const r of readings) {
    const alpha = Math.abs(r.tiltDeg - design.pod.rake)
    if (alpha < T.twistFrom || alpha > 90 - T.twistFrom) continue
    const p = twistArea(design, r.tiltDeg * DEG)
    num += r.twist * p
    den += p * p
  }
  const twistScale = den > 0 ? num / den : null
  const powered = readings.flatMap((r) => (r.downwash === null ? [] : [r.downwash]))
  const downwash = powered.length ? mean(powered) : T.bookDownwash
  const trim: DroneTrim = { drag, twist: twistScale ?? 1, downwash }
  // Without a measured twist, the forecast can't tell whether the quad tumbles: it flies the race as if it held.
  const race = droneRace(design, course, course.temperature, { trim, relief: twistScale === null ? { tumble: true } : {} })
  const theirs = droneRace(old, course).time
  const density = courseDensity(course)
  const top = topSpeed(design, density, trim)
  return {
    time: race.time,
    gain: race.time !== null && theirs !== null ? theirs - race.time : null,
    top,
    tilt: steadyTilt(design, top, density, trim),
    drag,
    twist: twistScale === null ? null : { scale: twistScale, share: race.twist.moment / DRONE_CLASS[design.class].authority, braking: race.twist.braking, speed: race.twist.speed },
    tumble: race.tumble,
    downwash,
    downwashMeasured: powered.length > 0,
    hotAt: race.hotAt,
    heat: race.hotAt === null ? 0 : heatLoss(design),
  }
}

/** What the model shop matches a quad model's Reynolds number to: the course's air at about a racer's top speed. */
export function droneEvent(course: DroneCourse): EventSpec {
  return { ...REFERENCE_TT, temperature: course.temperature, altitude: course.altitude, riderSpeed: T.matchSpeed, windSpeed: 0 }
}

/** A quad run's settled readings (PR 10d): fan and sting at rest, with the twist recorded. */
export function droneReadings(runs: readonly Pick<Run, 'samples'>[]): Omit<DroneReading, 'dragN'>[] {
  const out: Omit<DroneReading, 'dragN'>[] = []
  for (const run of runs)
    for (const s of run.samples)
      if (s.steady && s.twist !== undefined) out.push({ tiltDeg: s.yawDeg, cdA: s.cdA, twist: s.twist, downwash: s.downwash ?? null })
  return out
}

/** True if a run read a racing quad. */
export const isDroneRun = (run: Pick<Run, 'samples'>): boolean => run.samples.some((s) => s.twist !== undefined)
