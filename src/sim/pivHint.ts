/**
 * The PIV's hint (PR 10ag): which slider to change. The PIV sees the wake,
 * so it can only say where drag is being lost, not what a change does to
 * downforce, stability or comfort. For each slider that shapes the wake it
 * tries small nudges either way (PIV_HINT) and names the one that cuts the
 * drag most, with the share it would save. Sliders whose real job is
 * something else (a record car's fin, a quad's vents, a drone's tail, a
 * plane's span) are left out, or the hint would always say "make it
 * smaller" and steer players wrong.
 */
import { AIRCRAFT_RANGE, type AircraftDesign } from '../data/aircraft'
import { BOBSLED_RANGE, type BobsledDesign } from '../data/bobsled'
import { CAR_RANGE, type CarDesign } from '../data/car'
import { PART_RANGE, POSTURE_RANGE, type CyclistDesign } from '../data/cyclist'
import { DRONE_RANGE, type DroneDesign } from '../data/drone'
import { JUMPER_RANGE, type JumperDesign } from '../data/jumper'
import { PIV_HINT } from '../data/piv'
import { PLANE_CLASS, PLANE_RANGE, type PlaneDesign } from '../data/plane'
import { POD_RANGE, type PodDesign } from '../data/pod'
import { RECORD_RANGE, type RecordDesign } from '../data/record'
import { SKATER_RANGE, type SkaterDesign } from '../data/skater'
import { TRUCK_RANGE, TRUCK_SPEED, type TruckDesign } from '../data/truck'
import { aircraftDrag } from './aircraft'
import { shapeDrag } from './aero/drag'
import type { Flow } from './aero/flow'
import { sledDrag } from './bobsled'
import { carAero } from './car'
import type { Design } from './design'
import { designShape, isAircraft, isBobsled, isCar, isCyclist, isDrone, isJumper, isPlane, isPod, isRecord, isSkater, isTruck } from './design'
import type { ControlId } from './designDiff'
import { droneDrag } from './drone'
import { describeShape } from './geom/body'
import { planeDrag } from './plane'
import { podDrag } from './pod'
import { recordAero } from './record'
import { truckDrag, truckFlow } from './truck'

/** The slider to change, and the share of the drag a small nudge of it would save (0.03 is 3 %). */
export interface PivHint {
  control: ControlId
  gain: number
}

interface Range {
  min: number
  max: number
}

/** One slider: its range and how to set it on a copy of the design. */
interface Knob<D> {
  id: ControlId
  range: Range
  get: (d: D) => number
  set: (d: D, v: number) => void
}

interface Sport<D extends Design> {
  is: (d: Design) => d is D
  cdA: (d: D) => number
  knobs: (d: D) => Knob<D>[]
}

const air = (speed: number): Flow => ({ ...PIV_HINT.air, speed })
const bodyCdA = (d: Design, speed = PIV_HINT.speed.body): number => shapeDrag(describeShape(designShape(d)), air(speed)).cdA

const knob = <D>(id: ControlId, range: Range, get: (d: D) => number, set: (d: D, v: number) => void): Knob<D> => ({ id, range, get, set })

const CYCLIST: Sport<CyclistDesign> = {
  is: isCyclist,
  cdA: (d) => bodyCdA(d),
  knobs: (d) => [
    knob('torsoDeg', POSTURE_RANGE.torsoDeg, (x) => x.posture.torsoDeg, (x, v) => (x.posture.torsoDeg = v)),
    knob('headDrop', POSTURE_RANGE.headDrop, (x) => x.posture.headDrop, (x, v) => (x.posture.headDrop = v)),
    knob('armWidth', POSTURE_RANGE.armWidth, (x) => x.posture.armWidth, (x, v) => (x.posture.armWidth = v)),
    knob('handReach', POSTURE_RANGE.handReach, (x) => x.posture.handReach, (x, v) => (x.posture.handReach = v)),
    knob('handHeight', POSTURE_RANGE.handHeight, (x) => x.posture.handHeight, (x, v) => (x.posture.handHeight = v)),
    ...(d.helmet.kind === 'aero' ? [knob<CyclistDesign>('tail', PART_RANGE.tail, (x) => x.helmet.tail, (x, v) => (x.helmet.tail = v))] : []),
  ],
}

const SKATER: Sport<SkaterDesign> = {
  is: isSkater,
  cdA: (d) => bodyCdA(d),
  knobs: () => [
    knob('trunkDeg', SKATER_RANGE.trunkDeg, (x) => x.posture.trunkDeg, (x, v) => (x.posture.trunkDeg = v)),
    knob('kneeDeg', SKATER_RANGE.kneeDeg, (x) => x.posture.kneeDeg, (x, v) => (x.posture.kneeDeg = v)),
    knob('headDrop', SKATER_RANGE.headDrop, (x) => x.posture.headDrop, (x, v) => (x.posture.headDrop = v)),
  ],
}

/** A jumper flies on lift as much as drag, so only the suit (all drag) is named. */
const JUMPER: Sport<JumperDesign> = {
  is: isJumper,
  cdA: (d) => bodyCdA(d),
  knobs: () => [knob('bagginess', JUMPER_RANGE.bagginess, (x) => x.suit.bagginess, (x, v) => (x.suit.bagginess = v))],
}

const BOBSLED: Sport<BobsledDesign> = {
  is: isBobsled,
  cdA: (d) => sledDrag(d, air(PIV_HINT.speed.sled)).cdA,
  knobs: () => [
    knob('sledNose', BOBSLED_RANGE.nose, (x) => x.sled.nose, (x, v) => (x.sled.nose = v)),
    knob('sledTail', BOBSLED_RANGE.tail, (x) => x.sled.tail, (x, v) => (x.sled.tail = v)),
    knob('cowl', BOBSLED_RANGE.cowl, (x) => x.sled.cowl, (x, v) => (x.sled.cowl = v)),
    knob('tuck', BOBSLED_RANGE.tuck, (x) => x.tuck, (x, v) => (x.tuck = v)),
  ],
}

const TRUCK: Sport<TruckDesign> = {
  is: isTruck,
  cdA: (d) => truckDrag(d, truckFlow(PIV_HINT.truckTemperature, 0, TRUCK_SPEED)).cdA,
  knobs: () => [
    knob('cabNose', TRUCK_RANGE.nose, (x) => x.cab.nose, (x, v) => (x.cab.nose = v)),
    knob('fairing', TRUCK_RANGE.fairing, (x) => x.cab.fairing, (x, v) => (x.cab.fairing = v)),
    knob('extenders', TRUCK_RANGE.extenders, (x) => x.cab.extenders, (x, v) => (x.cab.extenders = v)),
    knob('gapLength', TRUCK_RANGE.gap, (x) => x.gap.length, (x, v) => (x.gap.length = v)),
    knob('gapFill', TRUCK_RANGE.fill, (x) => x.gap.fill, (x, v) => (x.gap.fill = v)),
    knob('skirts', TRUCK_RANGE.skirts, (x) => x.trailer.skirts, (x, v) => (x.trailer.skirts = v)),
    knob('boatTail', TRUCK_RANGE.tail, (x) => x.trailer.tail, (x, v) => (x.trailer.tail = v)),
    knob('tailAngle', TRUCK_RANGE.tailAngle, (x) => x.trailer.tailAngle, (x, v) => (x.trailer.tailAngle = v)),
  ],
}

/** A car's wings are for downforce, so only the floor, ride and cooling are named. */
const CAR: Sport<CarDesign> = {
  is: isCar,
  cdA: (d) => carAero(d, PIV_HINT.speed.car, PIV_HINT.air.density).cdA,
  knobs: (d) => {
    const r = CAR_RANGE[d.class]
    return [
      knob('rideFront', r.front, (x) => x.ride.front, (x, v) => (x.ride.front = v)),
      knob('rideRear', r.rear, (x) => x.ride.rear, (x, v) => (x.ride.rear = v)),
      knob('diffuser', r.diffuser, (x) => x.diffuser, (x, v) => (x.diffuser = v)),
      knob('floorEdge', r.floorEdge, (x) => x.floorEdge, (x, v) => (x.floorEdge = v)),
      knob('inlet', r.inlet, (x) => x.inlet, (x, v) => (x.inlet = v)),
    ]
  },
}

/** The fin keeps a record car straight; it isn't named. */
const RECORD: Sport<RecordDesign> = {
  is: isRecord,
  cdA: (d) => recordAero(d).cdA,
  knobs: (d) => {
    const r = RECORD_RANGE[d.class]
    return [
      knob('noseLength', r.length, (x) => x.nose.length, (x, v) => (x.nose.length = v)),
      knob('noseDroop', r.droop, (x) => x.nose.droop, (x, v) => (x.nose.droop = v)),
      knob('canopy', r.canopy, (x) => x.canopy, (x, v) => (x.canopy = v)),
      knob('fairings', r.fairings, (x) => x.fairings, (x, v) => (x.fairings = v)),
      knob('waist', r.waist, (x) => x.waist, (x, v) => (x.waist = v)),
    ]
  },
}

/** A quad's vents are for cooling; they aren't named. */
const DRONE: Sport<DroneDesign> = {
  is: isDrone,
  cdA: (d) => droneDrag(d, PIV_HINT.droneTilt).cdA,
  knobs: (d) => {
    const r = DRONE_RANGE[d.class]
    return [
      knob('podLength', r.length, (x) => x.pod.length, (x, v) => (x.pod.length = v)),
      knob('podRake', r.rake, (x) => x.pod.rake, (x, v) => (x.pod.rake = v)),
      knob('armFairings', r.arms, (x) => x.arms, (x, v) => (x.arms = v)),
    ]
  },
}

/** A survey drone's tail and span are for stability and lift; they aren't named. */
const PLANE: Sport<PlaneDesign> = {
  is: isPlane,
  cdA: (d) => planeDrag(d, PLANE_CLASS[d.class].survey, PIV_HINT.air.density).cdA,
  knobs: (d) => {
    const r = PLANE_RANGE[d.class]
    return [
      knob('planeNose', r.nose, (x) => x.fuselage.nose, (x, v) => (x.fuselage.nose = v)),
      knob('tailCone', r.taper, (x) => x.fuselage.taper, (x, v) => (x.fuselage.taper = v)),
      knob('cameraDrop', r.drop, (x) => x.camera.drop, (x, v) => (x.camera.drop = v)),
      knob('cameraFairing', r.fairing, (x) => x.camera.fairing, (x, v) => (x.camera.fairing = v)),
      knob('cameraAt', r.at, (x) => x.camera.at, (x, v) => (x.camera.at = v)),
      knob('winglets', r.winglets, (x) => x.winglets, (x, v) => (x.winglets = v)),
    ]
  },
}

const AIRCRAFT: Sport<AircraftDesign> = {
  is: isAircraft,
  cdA: (d) => aircraftDrag(d, PIV_HINT.speed.aircraft, PIV_HINT.air.density).cdA,
  knobs: (d) => {
    const r = AIRCRAFT_RANGE[d.class]
    return [
      knob('acCowling', r.cowling, (x) => x.cowling, (x, v) => (x.cowling = v)),
      knob('spats', r.spats, (x) => x.spats, (x, v) => (x.spats = v)),
      knob('wingtips', r.wingtips, (x) => x.wingtips, (x, v) => (x.wingtips = v)),
      knob('strutFairing', r.fairing, (x) => x.struts.fairing, (x, v) => (x.struts.fairing = v)),
      knob('strutToe', r.toe, (x) => x.struts.toe, (x, v) => (x.struts.toe = v)),
      knob('acPodFairing', r.podFairing, (x) => x.pod.fairing, (x, v) => (x.pod.fairing = v)),
      knob('acPodAt', r.podAt, (x) => x.pod.at, (x, v) => (x.pod.at = v)),
    ]
  },
}

const POD: Sport<PodDesign> = {
  is: isPod,
  cdA: (d) => podDrag(d).installed,
  knobs: (d) => {
    const r = POD_RANGE[d.class]
    return [
      knob('senNose', r.nose, (x) => x.nose, (x, v) => (x.nose = v)),
      knob('senTail', r.tail, (x) => x.tail, (x, v) => (x.tail = v)),
      knob('senGap', r.gap, (x) => x.gap, (x, v) => (x.gap = v)),
      knob('senAt', r.at, (x) => x.at, (x, v) => (x.at = v)),
    ]
  },
}

const SPORTS = [JUMPER, BOBSLED, TRUCK, CAR, RECORD, DRONE, PLANE, AIRCRAFT, POD, SKATER, CYCLIST] as const

/** The most a nudge of this slider cuts the drag, m² (0 if no nudge helps). */
function bestNudge<D extends Design>(sport: Sport<D>, design: D, k: Knob<D>, base: number): number {
  const reach = (k.range.max - k.range.min) * PIV_HINT.nudge
  if (!(reach > 0)) return 0
  const now = k.get(design)
  let best = 0
  for (let i = 1; i <= PIV_HINT.tries; i++) {
    for (const sign of [-1, 1]) {
      const v = Math.min(k.range.max, Math.max(k.range.min, now + (sign * reach * i) / PIV_HINT.tries))
      if (v === now) continue
      const copy = structuredClone(design)
      k.set(copy, v)
      best = Math.max(best, base - sport.cdA(copy))
    }
  }
  return best
}

function hintFor<D extends Design>(sport: Sport<D>, design: D): PivHint | null {
  const base = sport.cdA(design)
  if (!(base > 0)) return null
  let best: PivHint | null = null
  for (const k of sport.knobs(design)) {
    const gain = bestNudge(sport, design, k, base) / base
    if (gain >= PIV_HINT.minGain && (!best || gain > best.gain)) best = { control: k.id, gain }
  }
  return best
}

/** The slider whose nudge would cut the drag most, or null when no nudge helps much (a tidy wake). */
export function pivHint(design: Design): PivHint | null {
  for (const sport of SPORTS) {
    if ((sport as Sport<Design>).is(design)) return hintFor(sport as Sport<Design>, design)
  }
  return null
}

/** The drag area the hint works from, m², full size (null for a design it doesn't know). */
export function pivDragArea(design: Design): number | null {
  for (const sport of SPORTS) {
    if ((sport as Sport<Design>).is(design)) return (sport as Sport<Design>).cdA(design)
  }
  return null
}
