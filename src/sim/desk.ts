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
