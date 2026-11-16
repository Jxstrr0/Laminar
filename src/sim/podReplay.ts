/**
 * The sensor pod's range day as a show (PR 10af): when each clock stops,
 * how hard the picture shakes and blurs, and what's said when. Pure and
 * seeded: the steppe's layout comes from the job's seed, and every number
 * from range day's two patrols.
 */
import { POD_REPLAY as R } from '../data/replay'
import type { PodFlight } from './podJob'
import { Rng } from './rng'

export interface PodShow {
  /** Seconds of play per hour on station (both clocks run at it). */
  rate: number
  /** Where each clock stops, s of play, and the hours it shows then. A rejected run stops at the ministry's call. */
  mineEnd: number
  mineHours: number
  oldEnd: number
  oldHours: number
  /** The run is rejected: the picture blurred. */
  rejected: boolean
  /** The picture's shake, px, and blur, px (0 when steady). */
  shake: number
  blur: number
  buffet: number
  limit: number
  /** When the whole show ends, s. */
  end: number
}

export function podShow(flight: PodFlight, old: PodFlight): PodShow {
  const longest = Math.max(flight.hours, old.hours)
  const rate = R.clockSeconds / longest
  const rejected = flight.blurs
  // A blurred picture is called off at rejectAt, and the clock shows the time it had flown.
  const mineEnd = rejected ? Math.min(R.rejectAt, flight.hours * rate) : flight.hours * rate
  const oldEnd = old.hours * rate
  return {
    rate,
    mineEnd,
    mineHours: mineEnd / rate,
    oldEnd,
    oldHours: old.hours,
    rejected,
    shake: flight.buffet * R.shakePerBuffet,
    blur: flight.blurs ? R.blurBase + (flight.buffet - flight.limit) * R.blurPerBuffet : 0,
    buffet: flight.buffet,
    limit: flight.limit,
    end: Math.max(mineEnd, oldEnd),
  }
}

/** Hours on each clock at `time` s of play. */
export function podClocks(show: PodShow, time: number): { mine: number; old: number } {
  return { mine: Math.min(show.mineEnd, time) / show.rate, old: Math.min(show.oldEnd, time) / show.rate }
}

export type PodNote =
  | { t: number; kind: 'start' }
  | { t: number; kind: 'buffet'; buffet: number; limit: number; blurs: boolean }
  | { t: number; kind: 'rejected' }
  | { t: number; kind: 'done'; mine: boolean; hours: number }

/** What's said, in order of time. */
export function podNotes(show: PodShow): PodNote[] {
  const notes: PodNote[] = [
    { t: 0, kind: 'start' },
    { t: R.buffetAt, kind: 'buffet', buffet: show.buffet, limit: show.limit, blurs: show.rejected },
  ]
  if (show.rejected) notes.push({ t: show.mineEnd, kind: 'rejected' })
  else notes.push({ t: show.mineEnd, kind: 'done', mine: true, hours: show.mineHours })
  notes.push({ t: show.oldEnd, kind: 'done', mine: false, hours: show.oldHours })
  return notes.sort((a, b) => a.t - b.t)
}

/** The steppe under the sensor, in a 0–1 square that tiles: fields, roads (straight across) and farmsteads. */
export interface Steppe {
  fields: { x: number; y: number; w: number; h: number; tone: number }[]
  roads: { y0: number; y1: number }[]
  farms: { x: number; y: number }[]
}

export function steppe(seed: number): Steppe {
  const rng = new Rng(seed).fork('steppe')
  const fields = Array.from({ length: R.fields }, () => ({ x: rng.next(), y: rng.next(), w: rng.range(0.12, 0.34), h: rng.range(0.08, 0.22), tone: rng.next() }))
  const roads = Array.from({ length: R.roads }, () => ({ y0: rng.next(), y1: rng.next() }))
  const farms = Array.from({ length: R.farms }, () => ({ x: rng.next(), y: rng.next() }))
  return { fields, roads, farms }
}
