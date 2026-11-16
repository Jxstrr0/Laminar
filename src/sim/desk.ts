/**
 * The desk estimate: what the analyst can say about a design before any
 * model is built. Truth plus a seeded error, shown with error bars.
 */
import { DESK } from '../data/cyclist'
import { JUMP_DESK, type JumperDesign } from '../data/jumper'
import { referenceJump, type JumpEvent } from './jumper'
import { BOB_DESK, type BobsledDesign } from '../data/bobsled'
import type { Track } from '../data/tracks'
import { dayDrag, referenceConditions, runWith, type SledDrag } from './bobsled'
import { TRUCK_DESK, type TruckDesign } from '../data/truck'
import type { Route } from '../data/routes'
import { truckCurve, truckFlow, truckMass, windAveragedFuel, windAveragedFuelWith } from './truck'
import { cdAAt } from './aero/windAverage'
import { CAR_DESK, type CarDesign } from '../data/car'
import type { Circuit } from '../data/circuits'
import { carAero, circuitDensity, downforceKg, lapTime } from './car'
import { RECORD_DESK, type RecordDesign } from '../data/record'
import type { SaltFlat } from '../data/saltFlats'
import { criticalMach, flatDensity, frontKept, recordRun, soundSpeed, stillDay, twoWay, type RecordAbort } from './record'
import { DRONE_CLASS, DRONE_DESK, type DroneCourse, type DroneDesign } from '../data/drone'
import { courseDensity, droneRace, heatLoss, steadyTilt, topSpeed, type DroneRace } from './drone'
import type { ShapeSpec } from './geom/body'
import { gaussian } from './noise'
import { hashString, Rng } from './rng'
import { truth, type EventSpec } from './views'

export interface DeskEstimate {
  /** Wind-averaged CdA, m², best guess. */
  value: number
  low: number
  high: number
}

/**
 * @param jobSeed seeds the job-wide bias
 * @param designKey a stable string for the design (seeds the small jitter)
 * @param analystLevel 0 for none; each level narrows the spread
 */
export function deskEstimate(spec: ShapeSpec, event: EventSpec, jobSeed: number, designKey: string, analystLevel = 0): DeskEstimate {
  const real = truth(spec, event).windAveragedCdA
  const narrow = Math.max(DESK.floor, 1 - DESK.perLevel * analystLevel)
  const bias = DESK.bias * narrow * gaussian(new Rng(jobSeed).fork('desk-bias'))
  const jitter = DESK.jitter * narrow * gaussian(new Rng(jobSeed ^ hashString(designKey)).fork('desk-jitter'))
  const value = real * (1 + bias + jitter)
  const spread = Math.sqrt(DESK.bias * DESK.bias + DESK.jitter * DESK.jitter) * narrow * DESK.bars
  return { value, low: value * (1 - spread), high: value * (1 + spread) }
}

/**
 * The desk's guess at a jumper's reference jump, m (PR 8d): the still-air
 * flight on the job's hill, through the job's bias and a design's jitter.
 * `stable` and `minMargin` are the desk's word on the pitch-stability floor
 * over the whole flight (it reads that right: the margin is geometry, not a
 * measurement).
 */
export function jumpDeskEstimate(design: JumperDesign, event: JumpEvent, jobSeed: number, designKey: string, analystLevel = 0): DeskEstimate & { stable: boolean; minMargin: number } {
  const ref = referenceJump(design, event)
  const narrow = Math.max(DESK.floor, 1 - DESK.perLevel * analystLevel)
  const bias = JUMP_DESK.bias * narrow * gaussian(new Rng(jobSeed).fork('desk-bias'))
  const jitter = JUMP_DESK.jitter * narrow * gaussian(new Rng(jobSeed ^ hashString(designKey)).fork('desk-jitter'))
  const value = ref.distance * (1 + bias + jitter)
  const spread = Math.sqrt(JUMP_DESK.bias * JUMP_DESK.bias + JUMP_DESK.jitter * JUMP_DESK.jitter) * narrow * DESK.bars
  return { value, low: value * (1 - spread), high: value * (1 + spread), stable: ref.stable, minMargin: ref.minMargin }
}

/**
 * The desk's guess at a sled's reference run, s (PR 8m): the drag area
 * through the job's bias and a design's jitter, then the run on the
 * reference day. `low` is the quick end (less drag), `high` the slow end;
 * `drag` is the desk's guess split into the sled's parts (each part off
 * by the same share, so they add up to the guess).
 */
export function bobDeskEstimate(design: BobsledDesign, track: Track, jobSeed: number, designKey: string, analystLevel = 0): DeskEstimate & { cdA: number; drag: SledDrag } {
  const day = referenceConditions(design)
  const drag = dayDrag(design, track, day)
  const narrow = Math.max(DESK.floor, 1 - DESK.perLevel * analystLevel)
  const bias = BOB_DESK.bias * narrow * gaussian(new Rng(jobSeed).fork('desk-bias'))
  const jitter = BOB_DESK.jitter * narrow * gaussian(new Rng(jobSeed ^ hashString(designKey)).fork('desk-jitter'))
  const cdA = drag.cdA * (1 + bias + jitter)
  const spread = Math.sqrt(BOB_DESK.bias * BOB_DESK.bias + BOB_DESK.jitter * BOB_DESK.jitter) * narrow * DESK.bars
  const time = (c: number) => runWith(c, design, track, day).time
  const k = 1 + bias + jitter
  const guess: SledDrag = { hull: drag.hull * k, nose: drag.nose * k, runners: drag.runners * k, crew: drag.crew * k, cdA }
  return { value: time(cdA), low: time(cdA * (1 - spread)), high: time(cdA * (1 + spread)), cdA, drag: guess }
}

/**
 * The desk's guess at a truck's fuel saving, per cent (PR 9b): the design's
 * drag curve through the job's bias and a design's jitter, then the
 * wind-averaged fuel run on the client's route against their current truck
 * (known from their records). `low` is the small-saving end (more drag),
 * `high` the big one. `cdA` is the desk's straight-on drag area, `cdA10` the
 * same at 10° of crosswind, and `fuel` its litres per 100 km.
 */
export function truckDeskEstimate(design: TruckDesign, old: TruckDesign, route: Route, jobSeed: number, designKey: string, analystLevel = 0): DeskEstimate & { cdA: number; cdA10: number; fuel: number } {
  const curve = truckCurve(design, truckFlow(route.temperature, route.altitude, route.speed))
  const narrow = Math.max(DESK.floor, 1 - DESK.perLevel * analystLevel)
  const bias = TRUCK_DESK.bias * narrow * gaussian(new Rng(jobSeed).fork('desk-bias'))
  const jitter = TRUCK_DESK.jitter * narrow * gaussian(new Rng(jobSeed ^ hashString(designKey)).fork('desk-jitter'))
  const k = 1 + bias + jitter
  const spread = Math.sqrt(TRUCK_DESK.bias * TRUCK_DESK.bias + TRUCK_DESK.jitter * TRUCK_DESK.jitter) * narrow * DESK.bars
  const theirs = windAveragedFuel(old, route)
  const mass = truckMass(design)
  const fuelAt = (f: number) => windAveragedFuelWith((y) => cdAAt(curve, y) * f, mass, route)
  const saving = (f: number) => (1 - fuelAt(f) / theirs) * 100
  return { value: saving(k), low: saving(k * (1 + spread)), high: saving(k * (1 - spread)), cdA: cdAAt(curve, 0) * k, cdA10: cdAAt(curve, 10) * k, fuel: fuelAt(k) }
}

/**
 * The desk's guess at a racing car's lap-time gain, s (PR 9j): the car's
 * downforce and drag through the job's bias and a design's jitter, lapped
 * on the client's circuit against the car they run now (their own data,
 * so known). `low` is the small-gain end (less downforce, more drag),
 * `high` the big one. Also the desk's downforce at the read speed in kg,
 * its drag area, and the balance there (the desk gets the split right; the
 * size is what it guesses).
 */
export function carDeskEstimate(design: CarDesign, old: CarDesign, circuit: Circuit, jobSeed: number, designKey: string, analystLevel = 0): DeskEstimate & { downKg: number; cdA: number; balance: number } {
  const narrow = Math.max(DESK.floor, 1 - DESK.perLevel * analystLevel)
  const job = new Rng(jobSeed)
  const mine = new Rng(jobSeed ^ hashString(designKey))
  const down = 1 + narrow * (CAR_DESK.downBias * gaussian(job.fork('desk-down')) + CAR_DESK.jitter * gaussian(mine.fork('desk-jitter')))
  const drag = 1 + narrow * CAR_DESK.dragBias * gaussian(job.fork('desk-drag'))
  const sd = Math.sqrt(CAR_DESK.downBias * CAR_DESK.downBias + CAR_DESK.jitter * CAR_DESK.jitter) * narrow * DESK.bars
  const sg = CAR_DESK.dragBias * narrow * DESK.bars
  const theirs = lapTime(old, circuit).time
  const gain = (dn: number, dg: number) => theirs - lapTime(design, circuit, circuit.temperature, { down: dn, drag: dg }).time
  const density = circuitDensity(circuit)
  const aero = carAero(design, CAR_DESK.readSpeed, density)
  return {
    value: gain(down, drag),
    low: gain(down * (1 - sd), drag * (1 + sg)),
    high: gain(down * (1 + sd), drag * (1 - sg)),
    downKg: downforceKg(aero, density) * down,
    cdA: aero.cdA * drag,
    balance: aero.balance,
  }
}

/**
 * The desk's guess at a record car (PR 9q): its drag and lift through the
 * job's bias and a design's jitter, run both ways on the salt's usual
 * (still) day against the team's car (their own data, so known). The value
 * is the record speed, m/s, or null if the desk's run is aborted; `low` is
 * the slow end (more drag), `high` the fast one. Also the desk's top speed,
 * and its Mach number there (PR 9x), the share of the nose's weight it
 * keeps there with a moderate headwind,
 * where the air starts to squeeze round the car (m/s through the air),
 * why the desk's run stopped, if it did, and whether the nose would go
 * light (checked as if the driver held the car straight, so a car that
 * wanders early still gets its nose checked).
 */
export function recordDeskEstimate(
  design: RecordDesign,
  old: RecordDesign,
  flat: SaltFlat,
  jobSeed: number,
  designKey: string,
  analystLevel = 0,
): {
  value: number | null
  low: number | null
  high: number | null
  old: number | null
  top: number
  topMach: number
  noseKept: number
  squeeze: number
  abort: RecordAbort | null
  noseLight: RecordAbort | null
} {
  const narrow = Math.max(DESK.floor, 1 - DESK.perLevel * analystLevel)
  const job = new Rng(jobSeed)
  const mine = new Rng(jobSeed ^ hashString(designKey))
  const drag = 1 + narrow * (RECORD_DESK.dragBias * gaussian(job.fork('desk-drag')) + RECORD_DESK.jitter * gaussian(mine.fork('desk-jitter')))
  const lift = 1 + narrow * RECORD_DESK.liftBias * gaussian(job.fork('desk-lift'))
  const sd = Math.sqrt(RECORD_DESK.dragBias * RECORD_DESK.dragBias + RECORD_DESK.jitter * RECORD_DESK.jitter) * narrow * DESK.bars
  const day = stillDay(flat)
  const at = (dg: number) => twoWay(design, flat, day, { trim: { drag: dg, lift } })
  const mid = at(drag)
  const first = mid.runs[0]
  const density = flatDensity(flat)
  // The nose, checked on a run held straight (the same run, unless the car wandered).
  const straight = first.abort?.cause === 'wander' ? recordRun(design, { temperature: day.temperature, density, head: 0, cross: 0 }, { trim: { drag, lift }, holdStraight: true }) : first
  return {
    value: mid.mean,
    low: at(drag * (1 + sd)).mean,
    high: at(drag * (1 - sd)).mean,
    old: twoWay(old, flat, day).mean,
    top: straight.top,
    topMach: straight.topMach,
    noseKept: frontKept(design, straight.top + RECORD_DESK.headwind, density, { drag, lift }),
    squeeze: criticalMach(design) * soundSpeed(flat.temperature),
    abort: first.abort,
    noseLight: straight.abort?.cause === 'lift' ? straight.abort : null,
  }
}

/** The desk's guess at a racing quad (PR 10b). */
export interface DroneDeskEstimate {
  /** The race's time, s, or null if the desk's quad tumbles; `low` the quick end (less drag), `high` the slow one. */
  value: number | null
  low: number | null
  high: number | null
  /** The club's quad as they fly it now (their own lap times, so known), s, or null if it tumbles. */
  old: number | null
  /** Top speed, m/s, the tilt that holds it, radians, and the angle the pod meets the air there, degrees (0 is head-on). */
  top: number
  tilt: number
  podAngle: number
  /** The hardest the air twists the quad over the race, as a share of what its motors hold, and where. */
  twist: DroneRace['twist'] & { share: number }
  /** Where it tumbles, if it does. */
  tumble: DroneRace['tumble']
  /** When the speed controllers overheat, s into the race, and the thrust they lose then, share; null and 0 if they don't. */
  hotAt: number | null
  heat: number
}

/**
 * The desk's guess at a racing quad (PR 10b): the race at the club's
 * course on a usual day, with its drag through the job's bias and a
 * design's jitter, against the club's quad as they fly it.
 */
export function droneDeskEstimate(design: DroneDesign, old: DroneDesign, course: DroneCourse, jobSeed: number, designKey: string, analystLevel = 0): DroneDeskEstimate {
  const narrow = Math.max(DESK.floor, 1 - DESK.perLevel * analystLevel)
  const job = new Rng(jobSeed)
  const mine = new Rng(jobSeed ^ hashString(designKey))
  const drag = 1 + narrow * (DRONE_DESK.dragBias * gaussian(job.fork('desk-drag')) + DRONE_DESK.jitter * gaussian(mine.fork('desk-jitter')))
  const sd = Math.sqrt(DRONE_DESK.dragBias * DRONE_DESK.dragBias + DRONE_DESK.jitter * DRONE_DESK.jitter) * narrow * DESK.bars
  const at = (dg: number) => droneRace(design, course, course.temperature, { trim: { drag: dg } })
  const mid = at(drag)
  const density = courseDensity(course)
  const top = topSpeed(design, density, { drag })
  const tilt = steadyTilt(design, top, density, { drag })
  const authority = DRONE_CLASS[design.class].authority
  return {
    value: mid.time,
    low: at(drag * (1 - sd)).time,
    high: at(drag * (1 + sd)).time,
    old: droneRace(old, course).time,
    top,
    tilt,
    podAngle: (tilt * 180) / Math.PI - design.pod.rake,
    twist: { ...mid.twist, share: mid.twist.moment / authority },
    tumble: mid.tumble,
    hotAt: mid.hotAt,
    heat: mid.hotAt === null ? 0 : heatLoss(design),
  }
}
