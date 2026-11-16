/**
 * A racing-quad job's club race (plan section 9, PR 10f).
 *
 * - The promise is race time gained on the course's usual day over the
 *   pilot's own quad (five laps from a standing start), so it doesn't hang
 *   on race day's air. A quad that tumbles crashes out: it sets no time and
 *   gains nothing. People are never hurt; the pilot walks over and picks it up.
 * - Race day is the show: one seeded day's air, your quad and the old one
 *   round the gates in it.
 * - The declared number is the new quad's race time on the usual day. How
 *   good a read it was is judged on drag: the declared time is turned back
 *   into how much more (or less) drag than the quad really has would fly it.
 */
import type { BriefTemplate } from '../data/briefs'
import { DRONE_COURSES, type DroneCourse, type DroneDesign } from '../data/drone'
import { gaussian } from './noise'
import { Rng } from './rng'
import { courseDensity, droneDrag, droneRace, steadyTilt, topSpeed, type DroneRace } from './drone'

/** A brief's club race, ready for the race model. */
export interface DroneEvent {
  course: DroneCourse
  /** Day-to-day spread of race day's air (standard deviation), °C. */
  spread: { temperature: number }
}

/** A brief's club race, or null if it isn't a quad brief. */
export function droneEventFrom(b: Pick<BriefTemplate, 'event' | 'setup'>): DroneEvent | null {
  const e = b.event
  if (!e.drone || b.setup.sport !== 'drone') return null
  return { course: DRONE_COURSES[e.drone.course], spread: { temperature: e.spread.temperature } }
}

/** The course between jobs: the Lugovoy meadow on its usual day. */
export const PRACTICE_COURSE: DroneEvent = { course: DRONE_COURSES.lugovoy, spread: { temperature: 0 } }

/** Race day's air, seeded: the same for both quads. */
export function droneDayAir(event: DroneEvent, seed: number): { temperature: number } {
  const rng = new Rng(seed).fork('drone-day')
  return { temperature: event.course.temperature + event.spread.temperature * gaussian(rng) }
}

/** The search's bounds on a drag scale, and how many halvings it makes. */
const SEARCH = { low: 0.2, high: 4, steps: 40 }

/**
 * How much of the quad's real drag would fly this race time on the
 * course's usual day (1: exactly its drag), as if the motors held any twist
 * (a time is a time). More drag flies slower, so halving the range finds
 * it. Clamped to the search's bounds for a time no quad could make.
 */
export function dragScaleForTime(time: number, design: DroneDesign, course: DroneCourse): number {
  let lo = SEARCH.low
  let hi = SEARCH.high
  for (let i = 0; i < SEARCH.steps; i++) {
    const mid = (lo + hi) / 2
    const t = droneRace(design, course, course.temperature, { trim: { drag: mid }, relief: { tumble: true } }).time ?? Infinity
    // Faster than declared with this much drag: it has more.
    if (t < time) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** The quad's drag area flat out on the course's usual day, m²: the number the read is judged on. */
export function raceDragArea(design: DroneDesign, course: DroneCourse): number {
  const density = courseDensity(course)
  return droneDrag(design, steadyTilt(design, topSpeed(design, density), density)).cdA
}

/** What the overheating speed controllers cost on the usual day's race, s (0 if they never overheat or it tumbled). */
export function heatCost(design: DroneDesign, course: DroneCourse, race: DroneRace = droneRace(design, course)): number {
  if (race.hotAt === null || race.time === null) return 0
  const cool = droneRace(design, course, course.temperature, { relief: { heat: true } }).time
  return cool === null ? 0 : Math.max(0, race.time - cool)
}
