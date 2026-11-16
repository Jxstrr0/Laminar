/**
 * A bobsled job's race (plan section 9, PR 8o).
 *
 * - The promise is judged on the reference run: the usual push, good ice,
 *   still air (referenceRun), so it doesn't hang on the day.
 * - Race day is the show: the client's crew push, the day's ice, air and
 *   wind, with your sled and their old one in the same conditions.
 * - The declared number is the reference run's time. How good a read it was
 *   is judged on drag, as for any other job: the declared time is turned
 *   back into the drag area that would give it, and set against the sled's
 *   real one. A tenth of a second is a few per cent of drag.
 */
import { BOB_PUSH, BOB_REFERENCE, TRACKS, type Track } from '../data/tracks'
import type { BobsledDesign, Crew } from '../data/bobsled'
import type { BriefTemplate } from '../data/briefs'
import { runWith, referenceConditions, type RunConditions } from './bobsled'
import { gaussian } from './noise'
import { Rng } from './rng'

/** A bobsled race, ready for the run model. */
export interface SledEvent {
  track: Track
  crew: Crew
  /** Typical air and ice, °C, and wind up the track, m/s. */
  temperature: number
  iceTemp: number
  headwind: number
  /** How much faster than the usual push this crew pushes, m/s. */
  push: number
  /** Day-to-day spread (standard deviations): air and ice °C, wind and push m/s. */
  spread: { temperature: number; ice: number; wind: number; push: number }
}

/** A brief's race, or null if it isn't a bobsled brief. */
export function sledEventFrom(b: Pick<BriefTemplate, 'event' | 'setup'>): SledEvent | null {
  const e = b.event
  if (!e.sled || b.setup.sport !== 'bobsled') return null
  return {
    track: TRACKS[e.sled.track],
    crew: b.setup.crew,
    temperature: e.temperature,
    iceTemp: e.sled.iceTemp,
    headwind: e.windSpeed,
    push: e.sled.push,
    spread: { temperature: e.spread.temperature, ice: e.sled.spread.ice, wind: e.spread.wind, push: e.sled.spread.push },
  }
}

/** The race between jobs: Belogor in the reference conditions, a two-man crew. */
export const PRACTICE_RUN: SledEvent = {
  track: TRACKS.belogor,
  crew: 2,
  temperature: BOB_REFERENCE.temperature,
  iceTemp: BOB_REFERENCE.iceTemp,
  headwind: BOB_REFERENCE.headwind,
  push: 0,
  spread: { temperature: 0, ice: 0, wind: 0, push: 0 },
}

/** Race day's conditions, seeded: the same for every sled raced that day. */
export function raceConditions(event: SledEvent, seed: number): RunConditions {
  const rng = new Rng(seed).fork('sled-day')
  const usual = BOB_PUSH[event.crew]
  const s = event.spread
  return {
    temperature: event.temperature + s.temperature * gaussian(rng),
    iceTemp: event.iceTemp + s.ice * gaussian(rng),
    headwind: event.headwind + s.wind * gaussian(rng),
    pushSpeed: usual.speed + event.push + s.push * gaussian(rng),
    pushTime: usual.time,
  }
}

/** The search's bounds on a drag area, m², and how many halvings it makes. */
const SEARCH = { low: 0.001, high: 3, steps: 40 }

/**
 * The drag area that gives this reference run time (the run gets slower as
 * the drag grows, so halving the range finds it). Clamped to the search's
 * bounds for a time no sled could run.
 */
export function cdAForTime(time: number, design: BobsledDesign, track: Track): number {
  const day = referenceConditions(design)
  let lo = SEARCH.low
  let hi = SEARCH.high
  for (let i = 0; i < SEARCH.steps; i++) {
    const mid = (lo + hi) / 2
    if (runWith(mid, design, track, day).time < time) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
