/**
 * One design, any sport (PR 8). Each sport has its own design, shape and
 * comfort rules; this file picks the right ones, so the lab, the career and
 * the saves can hold a design without caring which sport it is for.
 * A design with no `sport` is a cyclist (every save from before PR 8).
 */
import { DEFAULT_CYCLIST, type CyclistDesign } from '../data/cyclist'
import type { SkaterDesign } from '../data/skater'
import type { JumperDesign } from '../data/jumper'
import type { BobsledDesign } from '../data/bobsled'
import type { Design, Sport } from '../data/sport'
import { ICE } from '../data/skater'
import { comfort, readouts, riderEvent, type Comfort, type Readouts } from './cyclist'
import type { CyclingRules } from '../data/rules'
import type { ShapeSpec } from './geom/body'
import { cyclistShape, type CyclistShapeOptions } from './geom/cyclist'
import { skaterShape } from './geom/skater'
import { skaterPose } from './geom/skaterPose'
import { riderPose, type Pose } from './geom/pose'
import { skaterComfort, skaterEvent, skaterReadouts } from './skater'
import { jumperParts } from './geom/jumper'
import { jumperPose } from './geom/jumperPose'
import { jumperComfort, jumperReadouts } from './jumper'
import { sledShape } from './geom/bobsled'
import { bobsledPose } from './geom/bobsledPose'
import { bobsledReadouts } from './bobsled'
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

export function isJumper(design: Design): design is JumperDesign {
  return design.sport === 'skijump'
}

export function isBobsled(design: Design): design is BobsledDesign {
  return design.sport === 'bobsled'
}

export function isCyclist(design: Design): design is CyclistDesign {
  return design.sport === undefined || design.sport === 'cycling'
}

/**
 * The shape the aero model reads. The options only matter to a cyclist
 * (a tunnel model's legs fixed at a crank angle, wheels held still).
 */
export function designShape(design: Design, options: CyclistShapeOptions = {}): ShapeSpec {
  if (isJumper(design)) return jumperParts(design)
  if (isBobsled(design)) return sledShape(design)
  return isSkater(design) ? skaterShape(design) : cyclistShape(design, options)
}

/** Where every joint sits. `crankDeg` only turns a cyclist's cranks. */
export function designPose(design: Design, crankDeg?: number): Pose {
  if (isJumper(design)) return jumperPose(design)
  if (isBobsled(design)) return bobsledPose(design)
  return isSkater(design) ? skaterPose(design) : riderPose(design, crankDeg)
}

export function designComfort(design: Design, limit?: number): Comfort<string> {
  if (isJumper(design) || isBobsled(design)) return jumperComfort()
  return isSkater(design) ? skaterComfort(design, limit) : comfort(design, limit)
}

export function designReadouts(design: Design, rules: CyclingRules, limit?: number): Readouts<string> {
  if (isJumper(design)) {
    const r = jumperReadouts(design)
    return { frontalArea: r.frontalArea, mass: r.mass, price: r.price, comfort: jumperComfort(), breaks: [] }
  }
  if (isBobsled(design)) {
    // The sled's rule box is the sliding federation's, not the cycling book: its sheet shows those breaks itself.
    const r = bobsledReadouts(design)
    return { frontalArea: r.frontalArea, mass: r.mass, price: r.price, comfort: jumperComfort(), breaks: [] }
  }
  return isSkater(design) ? skaterReadouts(design, limit) : readouts(design, rules, limit)
}

/** The event as this design meets it: the athlete's power through their comfort meter (a jumper or a sled crew has no pedals to push). */
export function designEvent(design: Design, event: EventSpec, limit?: number): EventSpec {
  if (isJumper(design) || isBobsled(design)) return event
  return isSkater(design) ? skaterEvent(design, event, limit) : riderEvent(design, event, limit)
}

/** The design as a cyclist (a skater gives the default cyclist), for code that only handles cyclists. */
export function asCyclist(design: Design): CyclistDesign {
  return isCyclist(design) ? design : DEFAULT_CYCLIST
}

/** The surface a sport races on: blades on ice glide with no drivetrain to lose power in. */
export function sportRider(sport: Sport, rider: RiderSpec): RiderSpec {
  return sport === 'skating' ? { ...rider, rollingResistance: ICE.friction, drivetrain: ICE.drivetrain } : rider
}
