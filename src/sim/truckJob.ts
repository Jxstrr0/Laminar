/**
 * A truck job's fuel trial (plan section 9, PR 9e).
 *
 * - The promise is judged on the wind-averaged fuel figure on the client's
 *   route (the route's usual air, the wind from every direction in turn), so
 *   it doesn't hang on one day's wind.
 * - The trial day is the show: one seeded day on the route, your truck and
 *   the fleet's current one in the same air and wind.
 * - The declared number is your truck's wind-averaged fuel figure, litres
 *   per 100 km. How good a read it was is judged on drag, as for any other
 *   job: the declared figure is turned back into how much more (or less)
 *   drag than the truck really has would burn it, all the way round the yaw
 *   curve. Rolling and the hills burn the same either way, so a fuel figure
 *   a few per cent out is a drag read several times further out.
 * - The fleet runs the truck on public roads, so a part the road code
 *   forbids is cut back to the limit before it goes out (roadLegal), and the
 *   saving is what the legal truck makes.
 * - Some fleets' yards are gravel (PR 9g): skirts that hang too low crack
 *   there, the trucks run without them, and the saving and the read are
 *   judged on the truck as it ran (asRun).
 */
import type { BriefTemplate } from '../data/briefs'
import { GRAVEL_YARD, ROAD_CODE, RIG, type TruckDesign } from '../data/truck'
import { ROUTES, type Route } from '../data/routes'
import { cdAAt } from './aero/windAverage'
import { gaussian } from './noise'
import { Rng } from './rng'
import { skirtGap, truckCurve, truckFlow, truckMass, windAveragedFuelWith, type RouteDay } from './truck'

/** A truck brief's route, ready for the fuel run. */
export interface TruckEvent {
  route: Route
  /** Day-to-day spread (standard deviations): air °C and wind m/s. */
  spread: { temperature: number; wind: number }
  /** The fleet's yard is gravel: skirts lower than GRAVEL_YARD allows crack there. */
  gravel: boolean
}

/** A brief's fuel trial, or null if it isn't a truck brief. */
export function truckEventFrom(b: Pick<BriefTemplate, 'event' | 'setup'>): TruckEvent | null {
  const e = b.event
  if (!e.truck || b.setup.sport !== 'truck') return null
  return { route: ROUTES[e.truck.route], spread: { temperature: e.spread.temperature, wind: e.spread.wind }, gravel: e.truck.gravel === true }
}

/** The route between jobs: the Stavren–Mostograd highway on its usual day. */
export const PRACTICE_ROUTE: TruckEvent = {
  route: ROUTES['stavren-mostograd'],
  spread: { temperature: 0, wind: 0 },
  gravel: false,
}

/** The trial day on the route, seeded: the same air and wind for both trucks. The wind may come from anywhere. */
export function trialDay(event: TruckEvent, seed: number): RouteDay {
  const rng = new Rng(seed).fork('truck-day')
  const r = event.route
  return {
    temperature: r.temperature + event.spread.temperature * gaussian(rng),
    windSpeed: Math.max(0, r.wind + event.spread.wind * gaussian(rng)),
    windFromDeg: rng.range(0, 360),
  }
}

/** A truck the road code allows: a boat-tail cut back to the limit, skirts trimmed to leave the gap. */
export function roadLegal(design: TruckDesign): TruckDesign {
  const tail = Math.min(design.trailer.tail, ROAD_CODE.maxTail)
  const skirts = Math.min(design.trailer.skirts, RIG.floor - ROAD_CODE.minSkirtGap)
  if (tail === design.trailer.tail && skirts === design.trailer.skirts) return design
  return { ...design, trailer: { ...design.trailer, tail, skirts } }
}

/** True if this truck's skirts hang low enough to crack on the fleet's gravel yard. */
export function cracksOnGravel(design: TruckDesign, event: Pick<TruckEvent, 'gravel'>): boolean {
  return event.gravel && design.trailer.skirts > 0 && skirtGap(design) < GRAVEL_YARD.minSkirtGap - 1e-9
}

/**
 * The truck as the fleet ran it: cut back to the road code, then without
 * its skirts if they cracked in the yard.
 */
export function asRun(design: TruckDesign, event: Pick<TruckEvent, 'gravel'>): { truck: TruckDesign; cracked: boolean } {
  const legal = roadLegal(design)
  if (!cracksOnGravel(legal, event)) return { truck: legal, cracked: false }
  return { truck: { ...legal, trailer: { ...legal.trailer, skirts: 0 } }, cracked: true }
}

/** The search's bounds on a drag scale, and how many halvings it makes. */
const SEARCH = { low: 0.2, high: 3, steps: 40 }

/**
 * How much of the truck's real drag would burn this wind-averaged fuel
 * figure on the route (1: exactly its drag). More drag burns more, so
 * halving the range finds it. Clamped to the search's bounds for a figure
 * no truck could make.
 */
export function dragScaleForFuel(per100: number, design: TruckDesign, route: Route): number {
  const curve = truckCurve(design, truckFlow(route.temperature, route.altitude, route.speed))
  const mass = truckMass(design)
  let lo = SEARCH.low
  let hi = SEARCH.high
  for (let i = 0; i < SEARCH.steps; i++) {
    const mid = (lo + hi) / 2
    if (windAveragedFuelWith((y) => mid * cdAAt(curve, y), mass, route) < per100) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** The truck's drag area straight on at the route's usual air, m²: the figure the firm's record keeps. */
export function straightOnCdA(design: TruckDesign, route: Route): number {
  return cdAAt(truckCurve(design, truckFlow(route.temperature, route.altitude, route.speed)), 0)
}
