/**
 * The fuel-run replay, worked out from the trial day (plan section 9, PR 9h):
 * where each truck is on the route at any moment, how much diesel each has
 * burned so far, and the moments worth a line from the commentator. Nothing
 * here changes a result; the replay only shows what the fuel runs decided.
 *
 * A route becomes a course of straight stretches, and a fuel run becomes a
 * ride along it, so the time trial's replay (src/sim/replay.ts) places the
 * trucks the same way it places riders.
 */
import type { CourseSegment } from '../data/field'
import { TRUCK_REPLAY as R } from '../data/replay'
import type { Route } from '../data/routes'
import type { Ride } from './replay'
import type { FuelRun } from './truck'

/** The route as the replay's course: one straight stretch per leg. */
export function truckCourse(route: Route): CourseSegment[] {
  return route.legs.map((leg) => ({ length: leg.length, gradient: leg.grade, heading: leg.heading }))
}

/** A truck's fuel run as a ride along the route: its speed, time and yaw on each leg. Trucks hold the line, so nothing eases or fades. */
export function truckRide(route: Route, run: FuelRun): Ride {
  return {
    course: truckCourse(route),
    segments: run.legs.map((leg) => ({ speed: leg.speed, yawDeg: leg.yawDeg, apparent: 0, time: leg.time, eased: 0, faded: 0, steer: 0 })),
  }
}

/** Litres burned by `t` seconds into the run: every finished leg, and the share of the current one driven. */
export function litresAt(run: FuelRun, t: number): number {
  let elapsed = 0
  let litres = 0
  for (const leg of run.legs) {
    if (t < elapsed + leg.time) return litres + leg.litres * Math.max(0, (t - elapsed) / leg.time)
    elapsed += leg.time
    litres += leg.litres
  }
  return litres
}

/** How long the replay runs, in route seconds: until the later truck arrives. */
export function truckDuration(mine: FuelRun, old: FuelRun): number {
  return Math.max(mine.time, old.time)
}

export type TruckNote =
  /** Out of the yard; `cracked` if the skirts broke on its gravel. */
  | { t: number; kind: 'start'; cracked: boolean }
  /** The windiest stretch: your truck's yaw there, and how much less it burns than theirs on it, %. */
  | { t: number; kind: 'cross'; yawDeg: number; saving: number }
  /** The first climb the trucks can't take at the limit: your speed on it, m/s. */
  | { t: number; kind: 'climb'; speed: number }
  /** Arrival: litres each burned, and the day's saving, %. */
  | { t: number; kind: 'finish'; litres: number; oldLitres: number; saving: number }

/** When a leg starts, route seconds into your run. */
function legStart(run: FuelRun, i: number): number {
  let t = 0
  for (let k = 0; k < i; k++) t += run.legs[k]!.time
  return t
}

/** The commentator's moments, in time order. */
export function truckNotes(route: Route, mine: FuelRun, old: FuelRun, cracked: boolean): TruckNote[] {
  const notes: TruckNote[] = [{ t: 0, kind: 'start', cracked }]
  const at = (i: number) => legStart(mine, i) + mine.legs[i]!.time * R.noteAt
  // The windiest stretch, if the wind meets the truck at a real angle anywhere.
  let windiest = -1
  for (let i = 0; i < mine.legs.length; i++) if (windiest < 0 || Math.abs(mine.legs[i]!.yawDeg) > Math.abs(mine.legs[windiest]!.yawDeg)) windiest = i
  if (windiest >= 0 && Math.abs(mine.legs[windiest]!.yawDeg) > R.crossDeg) {
    const leg = mine.legs[windiest]!
    notes.push({ t: at(windiest), kind: 'cross', yawDeg: Math.abs(leg.yawDeg), saving: (1 - leg.litres / old.legs[windiest]!.litres) * 100 })
  }
  // The first climb too steep to hold the limit.
  const climb = mine.legs.findIndex((leg) => leg.speed < route.speed - R.slowBy)
  if (climb >= 0) notes.push({ t: at(climb), kind: 'climb', speed: mine.legs[climb]!.speed })
  notes.push({ t: mine.time, kind: 'finish', litres: mine.litres, oldLitres: old.litres, saving: (1 - mine.litres / old.litres) * 100 })
  return notes.sort((a, b) => a.t - b.t)
}
