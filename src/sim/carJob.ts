/**
 * A racing-car job's race weekend (plan section 9, PR 9m).
 *
 * - Before the car races, the scrutineers check it against the Motor
 *   Racing Federation's rulebook and raise or trim anything past a limit
 *   (scrutineered). The promise is judged on that car.
 * - The promise is lap time gained on the circuit's usual day over the
 *   team's current car, so it doesn't hang on race day's air.
 * - Race day is the show: one seeded day's air, your car and the old one
 *   round the circuit in it.
 * - The declared number is the new car's lap time on the usual day. How
 *   good a read it was is judged on downforce, the hard thing to read in a
 *   tunnel: the declared time is turned back into how much more (or less)
 *   downforce than the car really makes would lap in it.
 */
import type { BriefTemplate } from '../data/briefs'
import { CAR_CLASS, type CarDesign } from '../data/car'
import { CIRCUITS, type Circuit } from '../data/circuits'
import { clamp } from './num'
import { gaussian } from './noise'
import { Rng } from './rng'
import { lapTime, lapWith, type Lap } from './car'

/** A brief's race weekend, ready for the lap. */
export interface CarEvent {
  circuit: Circuit
  /** Day-to-day spread of race day's air (standard deviation), °C. */
  spread: { temperature: number }
}

/** A brief's race weekend, or null if it isn't a car brief. */
export function carEventFrom(b: Pick<BriefTemplate, 'event' | 'setup'>): CarEvent | null {
  const e = b.event
  if (!e.car || b.setup.sport !== 'car') return null
  return { circuit: CIRCUITS[e.car.circuit], spread: { temperature: e.spread.temperature } }
}

/** The circuit between jobs: the Dolgo Ring on its usual day. */
export const PRACTICE_CIRCUIT: CarEvent = {
  circuit: CIRCUITS['dolgo-ring'],
  spread: { temperature: 0 },
}

/** Race day's air, seeded: the same for both cars. */
export function raceDayAir(event: CarEvent, seed: number): { temperature: number } {
  const rng = new Rng(seed).fork('car-day')
  return { temperature: event.circuit.temperature + event.spread.temperature * gaussian(rng) }
}

/** The search's bounds on a downforce scale, and how many halvings it makes. */
const SEARCH = { low: 0.2, high: 3, steps: 40 }

/**
 * How much of the car's real downforce would lap in this time on the
 * circuit's usual day (1: exactly its downforce). More downforce laps
 * faster, so halving the range finds it. Clamped to the search's bounds
 * for a time no car could make.
 */
export function downScaleForLap(time: number, design: CarDesign, circuit: Circuit): number {
  let lo = SEARCH.low
  let hi = SEARCH.high
  for (let i = 0; i < SEARCH.steps; i++) {
    const mid = (lo + hi) / 2
    // Too slow with this much: it needs more.
    if (lapTime(design, circuit, circuit.temperature, { down: mid, drag: 1 }).time > time) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * What each of the car's troubles cost on the usual day's lap, s: the
 * floor porpoising (the driver lifting on the straights), the balance
 * outside the drivers' window, and the engine turned down for heat. Each
 * is the lap with that one trouble taken away.
 */
export interface LapTroubles {
  porpoise: number
  balance: number
  heat: number
}

export function lapTroubles(design: CarDesign, circuit: Circuit, lap: Lap = lapTime(design, circuit)): LapTroubles {
  const cost = (relief: Parameters<typeof lapWith>[2]) => Math.max(0, lap.time - lapWith(design, circuit, relief).time)
  return {
    porpoise: lap.porpoise === null ? 0 : cost({ porpoise: true }),
    balance: lap.corners.some((c) => c.loss > 0) ? cost({ balance: true }) : 0,
    heat: lap.heat > 0 ? cost({ heat: true }) : 0,
  }
}

/** The balance the car carries through the corner where it costs the most, and the class's window. */
export function worstBalance(design: CarDesign, lap: Lap): { balance: number; low: number; high: number } | null {
  let worst: Lap['corners'][number] | null = null
  for (const c of lap.corners) if (c.loss > 0 && (!worst || c.loss > worst.loss)) worst = c
  if (!worst) return null
  const w = CAR_CLASS[design.class].window
  return { balance: clamp(worst.balance, 0, 1), low: w.low, high: w.high }
}
