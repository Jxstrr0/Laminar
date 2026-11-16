/**
 * A light-aircraft job's test day (plan sections 6.8 and 9, PR 10t).
 *
 * - The promise is cruise speed at cruise power at cruise height over the
 *   airfield on its usual day, over the client's own plane on paper. A mod
 *   whose stall speed creeps past the certified figure (Kelbo, 16 November
 *   2026) isn't signed off by the inspector: it never flies, so it gains
 *   nothing. Nobody is hurt; the plane flies on as it was.
 * - Test day is the show: one seeded day's air, the test pilot's cruise
 *   runs for both planes in it, and the inspector's stall check (always in
 *   standard sea-level air, so the day doesn't move it).
 * - The declared number is the new plane's cruise speed. How good a read it
 *   was is judged on drag: the declared cruise turns back into the drag
 *   that would fly it.
 */
import { AIRCRAFT_JOBS, type BriefTemplate } from '../data/briefs'
import { AIRCRAFT_CRUISE, AIRFIELDS, type AircraftDesign, type Airfield } from '../data/aircraft'
import { aircraftDrag, cruiseDensity, cruiseSpeed, KMH, stallCheck } from './aircraft'
import { gaussian } from './noise'
import { Rng } from './rng'

/** A brief's test flight, ready for the day. */
export interface AircraftEvent {
  field: Airfield
  /** Day-to-day spread of test day's air (standard deviation), °C. */
  spread: { temperature: number }
}

/** A brief's test flight, or null if it isn't a light-aircraft brief. */
export function aircraftEventFrom(b: Pick<BriefTemplate, 'event' | 'setup'>): AircraftEvent | null {
  const e = b.event
  if (!e.aircraft || b.setup.sport !== 'aircraft') return null
  return { field: AIRFIELDS[e.aircraft.field], spread: { temperature: e.spread.temperature } }
}

/** The airfield between jobs: Belyanka on its usual day. */
export const PRACTICE_FIELD: AircraftEvent = { field: AIRFIELDS.belyanka, spread: { temperature: 0 } }

/** Test day, seeded: its air at the airfield, °C. The same for both planes. */
export interface TestDay {
  temperature: number
}

export function testDay(event: AircraftEvent, seed: number): TestDay {
  const rng = new Rng(seed).fork('test-day')
  return { temperature: event.field.temperature + event.spread.temperature * gaussian(rng) }
}

/** The airfield's usual day: what the promise is judged on. */
export function usualTestDay(field: Airfield): TestDay {
  return { temperature: field.temperature }
}

/**
 * One plane's test flight on a day: its cruise speed, km/h, and the
 * inspector's stall check, km/h. A plane that isn't signed off doesn't fly
 * the cruise runs, but its cruise is kept to show what it would have done.
 */
export interface TestFlight {
  cruise: number
  stall: number
  limit: number
  passes: boolean
}

export function testFlight(design: AircraftDesign, field: Airfield, day: TestDay): TestFlight {
  const check = stallCheck(design)
  return { cruise: cruiseSpeed(design, field, { temperature: day.temperature }) * KMH, stall: check.stall, limit: check.limit, passes: check.passes }
}

/** The plane's drag area at cruise on the airfield's usual day, m²: the number the read is judged on. */
export function cruiseDragArea(design: AircraftDesign, field: Airfield): number {
  return aircraftDrag(design, cruiseSpeed(design, field), cruiseDensity(field)).cdA
}

/**
 * How much of the plane's real drag would cruise at `cruise` km/h on the
 * usual day (1: exactly its drag). Found by halving the gap between a
 * drag scale too small and one too big, a fixed number of times; held to
 * AIRCRAFT_JOBS.dragScale.
 */
export function dragScaleForCruise(cruise: number, design: AircraftDesign, field: Airfield): number {
  let lo = AIRCRAFT_JOBS.dragScale.min
  let hi = AIRCRAFT_JOBS.dragScale.max
  for (let i = 0; i < AIRCRAFT_CRUISE.steps; i++) {
    const mid = (lo + hi) / 2
    // More drag, slower: a scale whose cruise is still too fast needs more drag.
    if (cruiseSpeed(design, field, { drag: mid }) * KMH > cruise) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
