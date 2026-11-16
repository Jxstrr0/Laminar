/**
 * One design, any sport (PR 8). Each sport has its own design, shape and
 * comfort rules; this file picks the right ones, so the lab, the career and
 * the saves can hold a design without caring which sport it is for.
 * A design with no `sport` is a cyclist (every save from before PR 8).
 */
import { DEFAULT_CYCLIST, type CyclistDesign } from '../data/cyclist'
import type { SkaterDesign } from '../data/skater'
import type { Design, Sport } from '../data/sport'
import { ICE } from '../data/skater'
import { comfort, readouts, riderEvent, type Comfort, type Readouts } from './cyclist'
import type { CyclingRules } from '../data/rules'
import type { ShapeSpec } from './geom/body'
import { cyclistShape, type CyclistShapeOptions } from './geom/cyclist'
import { skaterShape } from './geom/skater'
import { skaterComfort, skaterEvent, skaterReadouts } from './skater'
import type { EventSpec } from './views'
import type { RiderSpec } from './field/timeTrial'

export type { Design, Sport } from '../data/sport'
export { SPORTS } from '../data/sport'

export function sportOf(design: Design): Sport {
  return design.sport ?? 'cycling'
}

export function isSkater(design: Design): design is SkaterDesign {
  return design.sport === 'skating'
}

export function isCyclist(design: Design): design is CyclistDesign {
  return design.sport === undefined || design.sport === 'cycling'
}

/**
 * The shape the aero model reads. The options only matter to a cyclist
 * (a tunnel model's legs fixed at a crank angle, wheels held still).
 */
export function designShape(design: Design, options: CyclistShapeOptions = {}): ShapeSpec {
  return isSkater(design) ? skaterShape(design) : cyclistShape(design, options)
}

export function designComfort(design: Design, limit?: number): Comfort<string> {
  return isSkater(design) ? skaterComfort(design, limit) : comfort(design, limit)
}

export function designReadouts(design: Design, rules: CyclingRules, limit?: number): Readouts<string> {
  return isSkater(design) ? skaterReadouts(design, limit) : readouts(design, rules, limit)
}

/** The event as this design meets it: the athlete's power through their comfort meter. */
export function designEvent(design: Design, event: EventSpec, limit?: number): EventSpec {
  return isSkater(design) ? skaterEvent(design, event, limit) : riderEvent(design, event, limit)
}

/**
 * The design as a cyclist, for the screens that only draw cyclists until
 * PR 8b brings the skater's figure and controls (no skater reaches them before then).
 */
export function asCyclist(design: Design): CyclistDesign {
  return isCyclist(design) ? design : DEFAULT_CYCLIST
}

/** The surface a sport races on: blades on ice glide with no drivetrain to lose power in. */
export function sportRider(sport: Sport, rider: RiderSpec): RiderSpec {
  return sport === 'skating' ? { ...rider, rollingResistance: ICE.friction, drivetrain: ICE.drivetrain } : rider
}
