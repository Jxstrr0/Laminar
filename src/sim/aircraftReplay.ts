/**
 * The light aircraft's test day as the replay plays it (plan section 9,
 * PR 10v). Kelbo chose speed runs and the stall check (16 November 2026):
 *
 * 1. The inspector's check: your plane, high over Belyanka, slowed a little
 *    at a time. Its nose comes up as the wing needs more angle to hold the
 *    plane up, until the wing lets go at the plane's stall speed: the nose
 *    drops and a wing dips, and the plane recovers.
 * 2. Past the certified stall speed, the plane isn't signed off: a cut to it
 *    parked beside the runway. Signed off, both planes fly a timed low pass
 *    over the measured kilometre, abreast at the start, each at its cruise
 *    on test day, a stopwatch on each between the two markers.
 *
 * Nothing here changes a result; the replay only shows what test day's two
 * flights decided. Times are flight seconds; speeds km/h unless named.
 */
import { AIRCRAFT_CLASS, type AircraftDesign } from '../data/aircraft'
import { AIRCRAFT_REPLAY as R, AIRFIELD_SCENE as S } from '../data/replay'
import { aircraftClMax, KMH } from './aircraft'
import type { TestFlight } from './aircraftJob'
import { DEG } from './num'
import type { Clip, PlanePose } from './planeReplay'
import type { TrackPoint } from './replay'

/** Test day's show, worked out once. */
export interface AircraftShow {
  /** Whether the inspector signs the mod off; its stall speed and the certified limit, km/h. */
  passes: boolean
  stall: number
  limit: number
  /** The wing's most lift and its lift slope (per radian): the nose's angle as it slows. */
  clMax: number
  liftSlope: number
  /** When the wing lets go and when the plane has recovered, s. */
  stallAt: number
  recovered: number
  /** Where along the runway the check starts, m. */
  checkFrom: number
  /** After the cut: the passes (signed off) or the plane parked (not), from this time; and the end. */
  afterAt: number
  end: number
  /** Each plane's pass speed, m/s (test day's cruise). */
  mineSpeed: number
  oldSpeed: number
}

/** How far the check has flown `t` seconds in while slowing, m. */
function slowedFor(t: number): number {
  const v0 = R.check.from / KMH
  const a = R.check.slow / KMH
  return v0 * t - 0.5 * a * t * t
}

export function aircraftShow(design: AircraftDesign, flight: TestFlight, baselineFlight: TestFlight): AircraftShow {
  const stallAt = Math.max(0, (R.check.from - flight.stall) / R.check.slow)
  const recovered = stallAt + R.stallBreak.seconds
  const afterAt = recovered + R.gap
  const mineSpeed = flight.cruise / KMH
  const oldSpeed = baselineFlight.cruise / KMH
  const P = R.pass
  const end = flight.passes ? afterAt + (P.runIn + P.course + P.runOut) / Math.min(mineSpeed, oldSpeed) : afterAt + R.parked.seconds
  return {
    passes: flight.passes,
    stall: flight.stall,
    limit: flight.limit,
    clMax: aircraftClMax(design),
    liftSlope: AIRCRAFT_CLASS[design.class].liftSlope,
    stallAt,
    recovered,
    checkFrom: R.check.over - slowedFor(stallAt),
    afterAt,
    end,
    mineSpeed,
    oldSpeed,
  }
}

/** Your plane's airspeed through the check, km/h: slowing to the stall, then gathering speed as it recovers. */
export function checkAirspeed(show: AircraftShow, time: number): number {
  if (time < show.stallAt) return R.check.from - R.check.slow * time
  return show.stall + R.regain * (time - show.stallAt)
}

/** The wing's angle as it holds the plane up at `kmh`, radians: the lift it needs over its lift slope, up to the stall's. */
export function noseAngle(show: AircraftShow, kmh: number): number {
  const r = show.stall / Math.max(kmh, show.stall)
  return (show.clMax * r * r) / show.liftSlope
}

const smooth = (x: number) => x * x * (3 - 2 * x)
/** A bump from 0 up to 1 a third of the way through and back to 0 at the end. */
const early = (f: number) => 6.75 * f * (1 - f) * (1 - f)

/** A point on the runway's line: `x` m along it (east), `off` m to its right. */
function at(x: number, off: number, speed: number): TrackPoint {
  return { distance: x, x, z: off, heading: 90, speed, yawDeg: 0, segment: 0, done: false, eased: 0, faded: 0 }
}

/** A plane as the replay draws it: where, how it sits in the air, and whether it's shown. */
export interface AircraftFrame {
  point: TrackPoint
  pose: PlanePose
  visible: boolean
}

const LEVEL = (height: number): PlanePose => ({ height, bank: 0, pitch: 0, spin: 0 })

/** Where each plane is `time` seconds into test day. Their plane only flies the passes. */
export function aircraftFrames(show: AircraftShow, time: number): { mine: AircraftFrame; old: AircraftFrame } {
  const P = R.pass
  if (time >= show.afterAt) {
    if (!show.passes) {
      const parked = { point: at(R.parked.at, R.parked.off, 0), pose: LEVEL(0), visible: true }
      return { mine: parked, old: { ...parked, visible: false } }
    }
    const t = time - show.afterAt
    const fly = (speed: number): AircraftFrame => ({ point: at(-P.runIn + speed * t, 0, speed), pose: LEVEL(S.passHeight), visible: true })
    return { mine: fly(show.mineSpeed), old: fly(show.oldSpeed) }
  }
  // The check: slowing, the break, then recovered and gathering speed.
  const along = time < show.stallAt ? slowedFor(time) : slowedFor(show.stallAt) + (time - show.stallAt) * (show.stall / KMH + (R.regain / KMH) * (time - show.stallAt) * 0.5)
  const speed = checkAirspeed(show, time) / KMH
  const point = at(show.checkFrom + along, 0, speed)
  let pose: PlanePose
  if (time < show.stallAt) pose = { ...LEVEL(S.checkHeight), pitch: noseAngle(show, checkAirspeed(show, time)) }
  else {
    const B = R.stallBreak
    const f = Math.min(1, (time - show.stallAt) / B.seconds)
    const k = 1 - f
    pose = {
      height: S.checkHeight - B.drop * smooth(f),
      // The nose falls through level as the wing lets go, then comes back up to it; a wing drops and comes back.
      pitch: (show.clMax / show.liftSlope) * k * k * k - B.noseDeg * DEG * early(f),
      bank: B.wingDeg * DEG * early(f),
      spin: 0,
    }
  }
  const mine = { point, pose, visible: true }
  return { mine, old: { ...mine, visible: false } }
}

/** A plane's stopwatch over the measured course: seconds so far (null before the first marker), and whether it's through the second. */
export function stopwatch(show: AircraftShow, mine: boolean, time: number): { time: number; done: boolean } | null {
  if (!show.passes || time < show.afterAt) return null
  const speed = mine ? show.mineSpeed : show.oldSpeed
  const t = time - show.afterAt - R.pass.runIn / speed
  if (t < 0) return null
  const full = R.pass.course / speed
  return { time: Math.min(t, full), done: t >= full }
}

/** The clips: the slow-down (quick), the break (as it happens), and after the cut the passes or the plane parked. */
export function aircraftClips(show: AircraftShow): Clip[] {
  const lead = Math.min(show.stallAt, R.stallBreak.seconds / 2)
  const clips: Clip[] = []
  if (show.stallAt - lead > 0) clips.push({ from: 0, to: show.stallAt - lead, rate: R.check.rate })
  clips.push({ from: show.stallAt - lead, to: show.recovered + 1, rate: R.stallBreak.rate })
  clips.push({ from: show.afterAt, to: show.end, rate: show.passes ? R.pass.rate : 1 })
  return clips
}

/** How long the replay takes to play, s: each clip at its rate, then a hold on the last moment. */
export function aircraftPlayTime(clips: readonly Clip[]): number {
  return clips.reduce((s, c) => s + (c.to - c.from) / c.rate, 0) + R.hold
}

export type AircraftNote =
  /** The inspector takes your plane up and starts slowing it. */
  | { t: number; kind: 'check' }
  /** The wing lets go: at what speed, against the limit, and whether that signs it off. */
  | { t: number; kind: 'break'; stall: number; limit: number; passes: boolean }
  /** Not signed off: the plane is parked. */
  | { t: number; kind: 'grounded' }
  /** Both planes line up for the passes. */
  | { t: number; kind: 'pass' }
  /** A plane through the second marker: its time over the course, s, and speed, km/h; whether it was first, and how far behind the other it was, s. */
  | { t: number; kind: 'cross'; mine: boolean; first: boolean; time: number; kmh: number; gap: number }

/** The commentator's moments, in time order. */
export function aircraftNotes(show: AircraftShow): AircraftNote[] {
  const notes: AircraftNote[] = [
    { t: 0, kind: 'check' },
    { t: show.stallAt, kind: 'break', stall: show.stall, limit: show.limit, passes: show.passes },
  ]
  if (!show.passes) {
    notes.push({ t: show.afterAt, kind: 'grounded' })
    return notes
  }
  notes.push({ t: show.afterAt, kind: 'pass' })
  const P = R.pass
  const mineT = P.course / show.mineSpeed
  const oldT = P.course / show.oldSpeed
  const mineFirst = mineT <= oldT
  const cross = (mine: boolean): AircraftNote => {
    const speed = mine ? show.mineSpeed : show.oldSpeed
    const time = mine ? mineT : oldT
    return { t: show.afterAt + (P.runIn + P.course) / speed, kind: 'cross', mine, first: mine === mineFirst, time, kmh: speed * KMH, gap: Math.abs(mineT - oldT) }
  }
  notes.push(cross(true), cross(false))
  return notes.sort((a, b) => a.t - b.t)
}
