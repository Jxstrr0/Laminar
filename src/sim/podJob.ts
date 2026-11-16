/**
 * A sensor-pod job's range day (plan sections 6.8 and 9, PR 10ac).
 *
 * - The promise is minutes on station over the Stepnoy range on its usual
 *   day, over the ministry's pod as it hangs now (the brief's setup). A pod
 *   that buffets past the ministry's limit (Kelbo, 16 November 2026) blurs
 *   the sensor's picture and the run is rejected: it gains nothing. Nobody
 *   is hurt; the plane lands and flies on with the pod it had.
 * - Range day is the show: one seeded day's air, the patrol for both pods
 *   in it, and the sensor's picture (the buffet doesn't change with the
 *   air, so the day can't save a shaking pod).
 * - The declared number is the new pod's hours on station. How good a read
 *   it was is judged on drag: the declared hours turn back into the pod's
 *   drag that would fly them, and the read is on the plane's whole drag
 *   area with it (airframe and pod), as the ministry's engineers book it.
 *   On the pod's drag alone a couple of minutes would be a poor read.
 */
import { POD_JOBS, type BriefTemplate } from '../data/briefs'
import { POD_BUFFET, POD_CLASS, TEST_RANGES, type PodDesign, type TestRange } from '../data/pod'
import { gaussian } from './noise'
import { hoursOnStation, patrolDensity, podBuffet, podDrag, type Sensor } from './pod'
import { Rng } from './rng'

/** A brief's range trial, ready for the day. */
export interface PodEvent {
  range: TestRange
  /** Day-to-day spread of range day's air (standard deviation), °C. */
  spread: { temperature: number }
}

/** A brief's range trial, or null if it isn't a sensor-pod brief. */
export function podEventFrom(b: Pick<BriefTemplate, 'event' | 'setup'>): PodEvent | null {
  const e = b.event
  if (!e.pod || b.setup.sport !== 'pod') return null
  return { range: TEST_RANGES[e.pod.range], spread: { temperature: e.spread.temperature } }
}

/** The range between jobs: Stepnoy on its usual day. */
export const PRACTICE_RANGE: PodEvent = { range: TEST_RANGES.stepnoy, spread: { temperature: 0 } }

/** Range day, seeded: its air at patrol height, °C (the range's own figure at the ground). The same for both pods. */
export interface RangeDay {
  temperature: number
}

export function rangeDay(event: PodEvent, seed: number): RangeDay {
  const rng = new Rng(seed).fork('range-day')
  return { temperature: event.range.temperature + event.spread.temperature * gaussian(rng) }
}

/** The range's usual day: what the promise is judged on. */
export function usualRangeDay(range: TestRange): RangeDay {
  return { temperature: range.temperature }
}

/**
 * One pod's patrol on a day: its hours on station, and the sensor's
 * buffet index. A pod whose picture blurs has its run rejected, but its
 * hours are kept to show what it would have done.
 */
export interface PodFlight {
  hours: number
  buffet: number
  limit: number
  blurs: boolean
  /** The bigger cause of the shake: the tail cone's wake, or hanging close to the wing. */
  cause: 'tail' | 'gap'
}

export function podFlight(design: PodDesign, range: TestRange, day: RangeDay, sensor: Sensor = 'new'): PodFlight {
  const b = podBuffet(design, sensor)
  return {
    hours: hoursOnStation(design, { sensor, density: patrolDensity(range, day.temperature) }),
    buffet: b.index,
    limit: POD_BUFFET.limit,
    blurs: b.blurs,
    cause: b.cause,
  }
}

/**
 * The plane's drag area on patrol with this pod, m² (the airframe and the
 * pod as it flies), with the pod's drag scaled by `podScale`: the number
 * the read is judged on.
 */
export function planeDragArea(design: PodDesign, podScale = 1): number {
  return POD_CLASS[design.class].airframeCdA + podDrag(design).installed * podScale
}

/**
 * How much of the pod's real drag would stay on station `hours` on the
 * usual day (1: exactly its drag). Found by halving the gap between a drag
 * scale too small and one too big, a fixed number of times; held to
 * POD_JOBS.dragScale.
 */
export function dragScaleForHours(hours: number, design: PodDesign, range: TestRange): number {
  let lo = POD_JOBS.dragScale.min
  let hi = POD_JOBS.dragScale.max
  const density = patrolDensity(range)
  for (let i = 0; i < POD_JOBS.steps; i++) {
    const mid = (lo + hi) / 2
    // More drag, fewer hours: a scale that still stays out too long needs more drag.
    if (hoursOnStation(design, { density, podDrag: mid }) > hours) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
