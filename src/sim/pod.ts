/**
 * The patrol plane's sensor pod (plan section 9.7, PR 10y): the pod's drag
 * on its own and under the wing, the plane's hours on station, and the
 * buffet that blurs the sensor.
 *
 * The pod's drag on its own is its nose, its base and its skin. Under the
 * wing it drags more: the air squeezed through the pylon's gap speeds up
 * between the pod and the wing (interference), the pylon drags, and a pod
 * hung forward costs trim. A pod model tested alone in the tunnel sees only
 * the first part (Kelbo's trap, 16 November 2026).
 *
 * Hours on station: the fuel for the patrol leg, turned into push, over the
 * power it takes to fly at patrol speed (the plane's drag, the pod's, and
 * the drag of making lift for both). It is worked out in closed form, so
 * every phone gets the same answer.
 */
import { POD_AERO as A, POD_BUFFET as B, POD_CLASS, TEST_RANGES, type PodDesign, type TestRange } from '../data/pod'
import { ATMOSPHERE } from '../data/field'
import { PI } from './det'
import { densityAt } from './field/atmosphere'
import { lerp } from './num'

/** Which sensor the pod carries: the ministry's new one, or the old one it flies now. */
export type Sensor = 'new' | 'old'

/** The sensor's diameter, m. */
export function sensorDiameter(design: PodDesign, sensor: Sensor = 'new'): number {
  const c = POD_CLASS[design.class]
  return sensor === 'new' ? c.newDiameter : c.oldDiameter
}

/** The pod's front: the circle round its sensor, m². */
export function podFront(design: PodDesign, sensor: Sensor = 'new'): number {
  const d = sensorDiameter(design, sensor)
  return (PI * d * d) / 4
}

/** The pod's lengths, m: the nose fairing, the sensor, the tail cone and all three. */
export function podLengths(design: PodDesign, sensor: Sensor = 'new'): { nose: number; middle: number; tail: number; total: number } {
  const d = sensorDiameter(design, sensor)
  const nose = d * lerp(A.noseLen.dome, A.noseLen.fine, design.nose)
  const tail = d * lerp(A.tailLen.blunt, A.tailLen.fine, design.tail)
  const middle = POD_CLASS[design.class].sensorLength
  return { nose, middle, tail, total: nose + middle + tail }
}

/** The pod with its pylon, kg: the sensor, the fairings and the pylon. */
export function podMass(design: PodDesign, sensor: Sensor = 'new'): number {
  const c = POD_CLASS[design.class]
  const d = sensorDiameter(design, sensor)
  const l = podLengths(design, sensor)
  const scale = (d / c.newDiameter) * (d / c.newDiameter)
  return (sensor === 'new' ? c.sensorMass : c.oldSensorMass) + A.fairingMass * (l.nose + l.tail) * scale + A.pylonMass * design.gap
}

/** Where the pod's drag comes from, each a drag area, m². */
export interface PodDrag {
  nose: number
  base: number
  skin: number
  /** The pod alone: what a pod model on its own in the tunnel reads. */
  alone: number
  /** Under the wing: the squeezed air in the gap, the pylon and the trim. */
  interference: number
  pylon: number
  trim: number
  /** All of it, the pod as it flies. */
  installed: number
}

/** A fairing's gain flattens as it gets finer: the last of the length buys little. */
const easing = (x: number) => x * (2 - x)

/** The interference's share of the pod's front at this gap and stagger. */
export function interferenceCd(design: PodDesign): number {
  const near = A.gapScale / (A.gapScale + design.gap)
  return A.interference * near * near * (1 - A.stagger * design.at)
}

export function podDrag(design: PodDesign, sensor: Sensor = 'new'): PodDrag {
  const front = podFront(design, sensor)
  const d = sensorDiameter(design, sensor)
  const nose = A.noseCd * (1 - A.noseGain * easing(design.nose)) * front
  const base = A.baseCd * (1 - A.baseGain * easing(design.tail)) * front
  const skin = ((A.skinPerLength * podLengths(design, sensor).total) / d) * front
  const alone = nose + base + skin
  const interference = interferenceCd(design) * front
  const pylon = A.pylonCdA * design.gap
  const trim = A.trimCdA * design.at * design.at
  return { nose, base, skin, alone, interference, pylon, trim, installed: alone + interference + pylon + trim }
}

/** The air at patrol height over the range, kg/m³. */
export function patrolDensity(range: TestRange = TEST_RANGES.stepnoy, temperature = range.temperature): number {
  return densityAt(temperature, range.patrolAltitude)
}

/** How patrol drag is worked out: which sensor, the air, the pod alone (no wing), and a scale on the pod's own drag (the desk's guess; 1 as it is). */
export interface PatrolOpts {
  sensor?: Sensor
  density?: number
  alone?: boolean
  podDrag?: number
  /** The pod's whole drag area as it flies, m², in place of the sim's (the tunnel's forecast). */
  podCdA?: number
}

/** The whole plane's drag at patrol speed with this pod, N: its parasite drag, the pod's (installed or alone) and the drag of making lift. */
export function patrolDrag(design: PodDesign, opts: PatrolOpts = {}): number {
  const c = POD_CLASS[design.class]
  const sensor = opts.sensor ?? 'new'
  const density = opts.density ?? patrolDensity()
  const q = 0.5 * density * c.patrol * c.patrol
  const pod = podDrag(design, sensor)
  const weight = (c.mass + podMass(design, sensor)) * ATMOSPHERE.gravity
  const induced = (weight * weight) / (q * PI * c.oswald * c.span * c.span)
  const podCdA = opts.podCdA ?? (opts.alone ? pod.alone : pod.installed) * (opts.podDrag ?? 1)
  return q * (c.airframeCdA + podCdA) + induced
}

/** Hours on station at patrol speed on the patrol leg's fuel. */
export function hoursOnStation(design: PodDesign, opts: PatrolOpts = {}): number {
  const c = POD_CLASS[design.class]
  const energy = c.fuel * c.fuelEnergy * c.efficiency
  return energy / (patrolDrag(design, opts) * c.patrol) / 3600
}

/** The buffet on a sensor run: the tail's wake, the wing's nearness, their sum (past the limit the picture blurs), and which to change. */
export interface Buffet {
  wake: number
  near: number
  index: number
  blurs: boolean
  /** The bigger cause, for the debrief's "change this": the tail cone or the pylon's gap. */
  cause: 'tail' | 'gap'
}

export function podBuffet(design: PodDesign, sensor: Sensor = 'new'): Buffet {
  const c = POD_CLASS[design.class]
  const ratio = sensorDiameter(design, sensor) / c.newDiameter
  const size = ratio * ratio
  const open = 1 - design.tail
  const wake = B.wake * open * open * size
  const near = B.near * Math.max(0, (B.clear - design.gap) / B.clear) * size
  const index = wake + near
  return { wake, near, index, blurs: index > B.limit, cause: near > wake ? 'gap' : 'tail' }
}
