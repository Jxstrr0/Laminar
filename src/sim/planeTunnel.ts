/**
 * The survey drone in the tunnel and the forecast (plan sections 6.3, 6.8
 * and 9.6, PR 10k).
 *
 * - readPlane: what the balance says about a plane model on the sting, its
 *   wing pitched to an angle of attack: its drag area and lift coefficient,
 *   scaled to full size, and its pitching moment coefficient about the
 *   balance point. Through the tunnel's quirks (blockage, the sting's own
 *   drag) and the balance's noise.
 * - The model is smaller than the plane, so its wing flies at a lower
 *   Reynolds number: below PLANE_TUNNEL.reFull it drags more and stalls
 *   sooner. That's Kelbo's trap (16 November 2026): a small model run at
 *   survey speed says the plane stalls in a gust it rides out. Trip strips,
 *   a bigger model or a faster fan fix it.
 * - forecastPlane: range on a charge worked out with the readings' drag,
 *   against the client's plane; the pitch margin from the moment readings;
 *   the wing's most lift from a reading past the stall. With no reading
 *   past the stall, or none with lift enough to read the moment, it can't
 *   say whether a gust on a turn stalls the plane.
 */
import { AIR } from '../data/air'
import { PLANE_CLASS, PLANE_TUNNEL as T, type PlaneDesign, type SurveySite } from '../data/plane'
import { viscosityAt } from './field/atmosphere'
import { describeShape } from './geom/body'
import { planeShape } from './geom/plane'
import { gaussian } from './noise'
import { DEG } from './num'
import { dragAtLift, gustLimit, gustTurn, planeRange, siteDensity, staticMargin } from './plane'
import { blockageFactor, type MountKind } from './quirks'
import { Rng } from './rng'
import { REFERENCE_TT, type EventSpec, type ModelSpec, type TunnelSpec } from './views'

/** A built plane model: its build errors and whether its wing carries trip strips, ready to read many times a second. */
export interface PreparedPlane {
  design: PlaneDesign
  scale: number
  /** The model's drag, lift and pitching moment came out this much bigger (or smaller) than drawn. */
  drag: number
  lift: number
  moment: number
  trips: boolean
  /** The plane's frontal area, m² (for the blockage): its fuselage and pod, and the wing's edge-on front. */
  frontal: number
}

/** The wing's edge-on front, m²: span times thickness (its area times the section's thickness share). */
const wingFront = (design: PlaneDesign) => PLANE_CLASS[design.class].wingArea * T.wingThickness

export function preparePlane(design: PlaneDesign, model: ModelSpec): PreparedPlane {
  const rng = new Rng(model.seed).fork('plane-build')
  return {
    design,
    scale: model.scale,
    drag: 1 + model.accuracy * gaussian(rng),
    lift: 1 + model.accuracy * gaussian(rng),
    moment: 1 + model.accuracy * gaussian(rng),
    trips: model.trips === true,
    frontal: describeShape(planeShape(design)).frontalArea + wingFront(design),
  }
}

/** The wing's chord, m, at full size. */
const chord = (design: PlaneDesign) => PLANE_CLASS[design.class].wingArea / PLANE_CLASS[design.class].span

/** The model wing's Reynolds number on its chord in the tunnel at `speed`. */
export function modelReynolds(prepared: Pick<PreparedPlane, 'design' | 'scale'>, speed: number): number {
  return (AIR.density * speed * chord(prepared.design) * prepared.scale) / AIR.viscosity
}

/** The full-size wing's Reynolds number at survey speed on a site's usual day. */
export function fieldReynolds(design: PlaneDesign, site: SurveySite, temperature = site.temperature): number {
  return (siteDensity(site, temperature) * PLANE_CLASS[design.class].survey * chord(design)) / viscosityAt(temperature)
}

/** How far into the low-Reynolds trouble a wing is: 0 flying as full size does, 1 at its worst. */
export function lowness(re: number): number {
  return Math.min(1, Math.max(0, (T.reFull - re) / (T.reFull - T.reLow)))
}

/** A wing at this Reynolds number: its most lift, and its own profile drag as a share of full size's. */
export function wingAt(design: PlaneDesign, re: number, trips: boolean): { clMax: number; cd: number } {
  const low = lowness(re)
  const stall = T.stallDrop * low * (trips ? 1 - T.trips.stall : 1)
  const bubble = T.bubble * low * (trips ? 1 - T.trips.bubble : 1)
  return { clMax: PLANE_CLASS[design.class].clMax - stall, cd: 1 + bubble + (trips ? T.trips.drag : 0) }
}

/** The lift coefficient a wing makes at an angle of attack (radians), with its most lift `clMax`: a straight line to the stall, then falling away. */
export function liftAt(design: PlaneDesign, alpha: number, clMax: number): { cl: number; stalled: boolean } {
  const line = PLANE_CLASS[design.class].liftSlope * alpha
  if (line <= clMax) return { cl: line, stalled: false }
  return { cl: Math.max(clMax * T.stalledLift, clMax - T.stallFall * (line - clMax)), stalled: true }
}

export interface PlaneTunnelRun {
  speed: number
  /** The wing's angle of attack on the sting, degrees. */
  pitchDeg: number
  mount?: MountKind
}

/** One balance reading, scaled to full size. */
export interface PlaneReading {
  pitchDeg: number
  /** Drag area, m², lift coefficient and pitching moment coefficient (nose-up positive, on the wing's area and chord). */
  cdA: number
  cl: number
  cm: number
  /** The model wing's Reynolds number in this run. */
  re: number
  /** The model's drag as the balance felt it, N. */
  dragN: number
}

/**
 * One balance reading of a prepared plane model at a speed and angle.
 * Draws its noise from `rng`, so repeat readings on the same stream scatter.
 */
export function readPlane(prepared: PreparedPlane, tunnel: TunnelSpec, run: PlaneTunnelRun, rng: Rng): PlaneReading {
  const { design, scale } = prepared
  const s2 = scale * scale
  const q = tunnel.quirks
  const section = tunnel.section
  const blocked = q && section ? blockageFactor(q.blockage, prepared.frontal * s2, section.width * section.height) : 1
  const mount = q && run.mount ? q.mountCdA[run.mount] / s2 : 0
  const noise = () => 1 + tunnel.balanceNoise * gaussian(rng)
  const re = modelReynolds(prepared, run.speed)
  const wing = wingAt(design, re, prepared.trips)
  const lift = liftAt(design, run.pitchDeg * DEG, wing.clMax)
  const cl = lift.cl * prepared.lift * blocked * noise()
  const drag = dragAtLift(design, lift.cl, wing.cd * (lift.stalled ? T.stalledDrag : 1)).cdA
  const cdA = (drag * prepared.drag * blocked + mount) * noise()
  // The moment about the balance point: a plane with margin noses down as its lift grows. Plus a small floor of noise.
  const cm = -staticMargin(design) * lift.cl * prepared.moment * noise() + T.momentNoise * tunnel.balanceNoise * gaussian(rng)
  const qN = 0.5 * AIR.density * run.speed * run.speed
  return { pitchDeg: run.pitchDeg, cdA, cl, cm, re, dragN: qN * cdA * s2 }
}

/** What the calibration runs let you take off a plane model's readings: the sting's tare and the blockage. */
export interface PlaneFix {
  tare: number | null
  blockageK: number | null
}

/** A reading with the sting's tare and the blockage taken off (as far as the calibration runs found them). */
export function correctPlane<R extends Pick<PlaneReading, 'cdA' | 'cl'>>(r: R, fix: PlaneFix, prepared: PreparedPlane, sectionArea: number): R {
  const s2 = prepared.scale * prepared.scale
  const b = fix.blockageK !== null ? blockageFactor(fix.blockageK, prepared.frontal * s2, sectionArea) : 1
  const tare = (fix.tare ?? 0) / s2
  return { ...r, cdA: (r.cdA - tare) / b, cl: r.cl / b }
}

export interface PlaneForecast {
  /** Range on a charge on the site's usual day, km, and what it gains on the client's plane, km. */
  range: number
  gain: number
  /** The drag scale the readings found on the firm's own drag-against-lift curve. */
  drag: number
  /** The pitch margin the moment readings found, or null with no reading with lift enough. */
  margin: number | null
  /** The wing's most lift, from a reading past the stall, or null if no reading reached it. */
  clMax: number | null
  /**
   * The strongest gust it rides out on a turn, m/s, and whether the usual
   * gust stalls it; null unless both the margin and the stall were read.
   */
  gustLimit: number | null
  stalls: boolean | null
  /** The lowest Reynolds number the readings were taken at, against the full-size wing's at survey speed. */
  re: number
  fieldRe: number
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

/** Whether a reading's lift fell short of the firm's straight line: the wing had stalled. */
export function readStalled(design: PlaneDesign, r: Pick<PlaneReading, 'pitchDeg' | 'cl'>): boolean {
  const line = PLANE_CLASS[design.class].liftSlope * r.pitchDeg * DEG
  return line > 0 && r.cl < line * (1 - T.stallSeen)
}

/**
 * Range and gusts on the tunnel's readings, against the client's plane.
 * The drag scale is the mean, over the readings at survey-like lift
 * (`dragUpTo`), of each one's drag over what the firm's curve expects at
 * its lift; the margin is fitted, by least
 * squares, from the moment against the lift where the lift is at least
 * `momentFrom`; the wing's most lift is the highest lift read, if any
 * reading went past the stall. Null until something has been read.
 */
export function forecastPlane(readings: readonly Omit<PlaneReading, 'dragN'>[], design: PlaneDesign, old: PlaneDesign, site: SurveySite): PlaneForecast | null {
  if (readings.length === 0) return null
  const flying = readings.filter((r) => !readStalled(design, r))
  // The drag from the readings at survey-like lift, clear of the stall (or whatever there is).
  const cruise = flying.filter((r) => r.cl <= T.dragUpTo)
  const base = cruise.length ? cruise : flying.length ? flying : readings
  const drag = mean(base.map((r) => r.cdA / dragAtLift(design, r.cl).cdA))
  let num = 0
  let den = 0
  for (const r of flying) {
    if (r.cl < T.momentFrom) continue
    num += r.cm * r.cl
    den += r.cl * r.cl
  }
  const margin = den > 0 ? -num / den : null
  const clMax = readings.some((r) => readStalled(design, r)) ? Math.max(...readings.map((r) => r.cl)) : null
  const range = planeRange(design, site, site.temperature, { drag })
  const seen = margin !== null && clMax !== null
  return {
    range,
    gain: range - planeRange(old, site),
    drag,
    margin,
    clMax,
    gustLimit: seen ? gustLimit(design, site, site.temperature, clMax, margin) : null,
    stalls: seen ? gustTurn(design, site, site.gust, site.temperature, clMax, margin).stalls : null,
    re: Math.min(...readings.map((r) => r.re)),
    fieldRe: fieldReynolds(design, site),
  }
}

/** What the model shop matches a plane model's Reynolds number to: the site's air at survey speed. */
export function planeEvent(site: SurveySite): EventSpec {
  return { ...REFERENCE_TT, temperature: site.temperature, altitude: site.altitude, riderSpeed: T.matchSpeed, windSpeed: 0 }
}
