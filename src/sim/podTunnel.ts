/**
 * The sensor pod in the tunnel and the forecast (plan sections 6.3 and 6.8,
 * PR 10aa).
 *
 * - readPod: what the balance says about a pod model on the sting: its drag
 *   area, scaled to full size, and how hard it shakes (the buffet index).
 *   Through the tunnel's quirks (blockage, the sting's own drag) and the
 *   balance's noise.
 * - Kelbo's trap (16 November 2026): a pod on its own reads only its own
 *   drag and its tail's shake. Under a stretch of wing fixed to the walls
 *   above it, its pylon with it, the pod on the balance also feels the
 *   squeezed air in the gap: the interference drag, and the extra shake of
 *   hanging close.
 * - forecastPod: hours on station worked out with the readings' drag, plus
 *   what the firm adds by hand (the pylon from the handbook if the pod was
 *   read on its own, and the trim drag of hanging it forward or back), and
 *   the buffet from the readings' shake.
 */
import { AIR } from '../data/air'
import { POD_BODY, POD_BUFFET, POD_CLASS, POD_TUNNEL as T, type PodDesign, type TestRange } from '../data/pod'
import { describeShape } from './geom/body'
import { podShape } from './geom/pod'
import { gaussian } from './noise'
import { hoursOnStation, patrolDensity, podBuffet, podDrag, podLengths } from './pod'
import { blockageFactor, type MountKind } from './quirks'
import { Rng } from './rng'
import type { Run } from './run'
import { REFERENCE_TT, type EventSpec, type ModelSpec, type TunnelSpec } from './views'

/** A built pod model: its build errors and whether it hangs under its stretch of wing, ready to read many times a second. */
export interface PreparedPod {
  design: PodDesign
  scale: number
  /** The model's drag came out this much bigger (or smaller) than drawn. */
  drag: number
  /** Hung under its stretch of wing, the pylon with it. */
  wing: boolean
  /** The frontal area in the test section at full size, m²: the pod, and the wing's edge-on front and the pylon if fitted. */
  frontal: number
}

export function preparePod(design: PodDesign, model: ModelSpec, wing: boolean): PreparedPod {
  const rng = new Rng(model.seed).fork('pod-build')
  const pod = describeShape(podShape(design)).frontalArea
  const wingFront = T.wingSpan * POD_BODY.chord * POD_BODY.wingThick + design.gap * POD_BODY.pylonThick
  return { design, scale: model.scale, drag: 1 + model.accuracy * gaussian(rng), wing, frontal: pod + (wing ? wingFront : 0) }
}

/** The model pod's Reynolds number on its length in the tunnel at `speed` (shown on the readings). */
export function podReynolds(prepared: Pick<PreparedPod, 'design' | 'scale'>, speed: number): number {
  return (AIR.density * speed * podLengths(prepared.design).total * prepared.scale) / AIR.viscosity
}

export interface PodTunnelRun {
  speed: number
  mount?: MountKind
}

/** One balance reading, scaled to full size. */
export interface PodReading {
  /** Drag area, m²: the pod's own, and with the wing the gap's interference and the pylon too. */
  cdA: number
  /** How hard it shook, as the buffet index. */
  shake: number
  /** The model pod's Reynolds number in this run. */
  re: number
  /** The pod hung under its stretch of wing. */
  wing: boolean
  /** The model's drag as the balance felt it, N. */
  dragN: number
}

/**
 * One balance reading of a prepared pod model at a speed. Draws its noise
 * from `rng`, so repeat readings on the same stream scatter.
 */
export function readPod(prepared: PreparedPod, tunnel: TunnelSpec, run: PodTunnelRun, rng: Rng): PodReading {
  const { design, scale } = prepared
  const s2 = scale * scale
  const q = tunnel.quirks
  const section = tunnel.section
  const blocked = q && section ? blockageFactor(q.blockage, prepared.frontal * s2, section.width * section.height) : 1
  const mount = q && run.mount ? q.mountCdA[run.mount] / s2 : 0
  const noise = () => 1 + tunnel.balanceNoise * gaussian(rng)
  const d = podDrag(design)
  const own = prepared.wing ? d.alone + d.interference + d.pylon : d.alone
  const cdA = (own * prepared.drag * blocked + mount) * noise()
  const b = podBuffet(design)
  const shake = (b.wake + (prepared.wing ? b.near : 0)) * (1 + T.shakeNoise * gaussian(rng))
  const qN = 0.5 * AIR.density * run.speed * run.speed
  return { cdA, shake: Math.max(0, shake), re: podReynolds(prepared, run.speed), wing: prepared.wing, dragN: qN * cdA * s2 }
}

/** What the calibration runs let you take off a pod model's readings: the sting's tare and the blockage. */
export interface PodFix {
  tare: number | null
  blockageK: number | null
}

/** A reading with the sting's tare and the blockage taken off (as far as the calibration runs found them). */
export function correctPod<R extends Pick<PodReading, 'cdA'>>(r: R, fix: PodFix, prepared: PreparedPod, sectionArea: number): R {
  const s2 = prepared.scale * prepared.scale
  const b = fix.blockageK !== null ? blockageFactor(fix.blockageK, prepared.frontal * s2, sectionArea) : 1
  const tare = (fix.tare ?? 0) / s2
  return { ...r, cdA: (r.cdA - tare) / b }
}

export interface PodForecast {
  /** Hours on station over the range on its usual day, and what it gains on the ministry's plane with its old pod, h. */
  hours: number
  gain: number
  /** The pod's whole drag area as the forecast flies it, m²: the readings', plus the pylon (if read alone) and the trim. */
  cdA: number
  /** Every reading had the pod under its stretch of wing: the gap was measured, not left out. */
  wing: boolean
  /** The buffet index from the readings' shake, and whether it blurs the sensor's picture. */
  buffet: number
  blurs: boolean
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

/**
 * Hours on station and the buffet on the tunnel's readings, against the
 * ministry's plane with its old pod. The pod's drag is the readings' mean;
 * read on its own, the firm adds the pylon's drag from the handbook, but
 * nothing for the gap, so a tight pod looks better than it flies. The trim
 * drag of the stagger is worked out by hand either way. Null until
 * something has been read.
 */
export function forecastPod(readings: readonly Omit<PodReading, 'dragN'>[], design: PodDesign, old: PodDesign, range: TestRange): PodForecast | null {
  if (readings.length === 0) return null
  const wing = readings.every((r) => r.wing)
  const d = podDrag(design)
  const cdA = mean(readings.map((r) => r.cdA + (r.wing ? 0 : d.pylon))) + d.trim
  const density = patrolDensity(range)
  const hours = hoursOnStation(design, { density, podCdA: cdA })
  const buffet = mean(readings.map((r) => r.shake))
  return { hours, gain: hours - hoursOnStation(old, { sensor: 'old', density }), cdA, wing, buffet, blurs: buffet > POD_BUFFET.limit }
}

/**
 * What the model shop matches a pod model to: the pod at patrol speed in
 * the air over the range. The pod's Reynolds number at either scale is well
 * past where its boundary layer trips, so matching it doesn't matter much.
 */
export function podEvent(range: TestRange, design: PodDesign): EventSpec {
  return { ...REFERENCE_TT, temperature: range.temperature, altitude: range.patrolAltitude, riderSpeed: POD_CLASS[design.class].patrol, windSpeed: 0 }
}

/** A pod run's settled readings: fan at rest, with the shake recorded. */
export function podReadings(runs: readonly Pick<Run, 'samples' | 'wing'>[]): Omit<PodReading, 'dragN'>[] {
  const out: Omit<PodReading, 'dragN'>[] = []
  for (const run of runs)
    for (const s of run.samples)
      if (s.steady && s.shake !== undefined && s.re !== undefined) out.push({ cdA: s.cdA, shake: s.shake, re: s.re, wing: run.wing === true })
  return out
}

/** True if a run read a sensor pod: it recorded the shake. */
export const isPodRun = (run: Pick<Run, 'samples'>): boolean => run.samples.some((s) => s.shake !== undefined)
