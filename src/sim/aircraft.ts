/**
 * The light aircraft's flight (plan section 6, PR 10p): drag at cruise,
 * cruise speed at cruise power, and the stall speed the inspector checks.
 *
 * Cruise speed is where the prop's push, at the engine's cruise power,
 * matches the drag: the parasite drag of every part, plus the drag of
 * making lift (less with square tips). It is found by halving the gap
 * between a speed too slow and one too fast, a fixed number of times, so
 * every phone gets the same answer.
 *
 * In flight the prop blows on the nose (Kelbo's trap, 16 November 2026):
 * the parts in its slipstream drag more, and its swirl meets the strut
 * fairings' roots at an angle. The tunnel's model has its prop stopped, so
 * it sees neither, unless it is fitted with a powered prop (a later PR).
 *
 * The stall speed is certified at the most take-off mass in standard
 * sea-level air. Square tips and a pod slid forward lower the wing's most
 * lift; past the certified figure, the inspector won't sign the mod off.
 */
import { AIRCRAFT_AERO as A, AIRCRAFT_CLASS, AIRCRAFT_CRUISE as CRUISE, PROP_WASH as W, STALL_AIR, type AircraftDesign, type Airfield } from '../data/aircraft'
import { ATMOSPHERE } from '../data/field'
import { PI } from './det'
import { densityAt } from './field/atmosphere'
import type { FixTarget } from './failure'

/** m/s to km/h. */
export const KMH = 3.6

/** The plane at cruise, kg: the kit's, plus the spats and fairings. */
export function aircraftMass(design: AircraftDesign): number {
  return AIRCRAFT_CLASS[design.class].mass + A.spatMass * design.spats + A.fairMass * design.struts.fairing
}

/** The wing's span efficiency with these tips. */
export function aircraftSpanEfficiency(design: AircraftDesign): number {
  return AIRCRAFT_CLASS[design.class].oswald * (1 + A.tipGain * design.wingtips)
}

/** The wing's most lift: the kit's, less what square tips and a pod forward of the middle take away. */
export function aircraftClMax(design: AircraftDesign): number {
  return AIRCRAFT_CLASS[design.class].clMax * (1 - A.tipStall * design.wingtips - A.podStall * Math.max(0, design.pod.at))
}

/** The stall speed at the most take-off mass in standard sea-level air, m/s (the wing's most lift `clMax`, the full-size wing's by default). */
export function stallSpeed(design: AircraftDesign, clMax = aircraftClMax(design)): number {
  const c = AIRCRAFT_CLASS[design.class]
  const density = densityAt(STALL_AIR.temperature, STALL_AIR.altitude)
  return Math.sqrt((2 * c.maxMass * ATMOSPHERE.gravity) / (density * c.wingArea * clMax))
}

/** The inspector's check: the stall speed and the certified one, km/h, and whether it passes. */
export interface StallCheck {
  stall: number
  limit: number
  passes: boolean
}

export function stallCheck(design: AircraftDesign, clMax = aircraftClMax(design)): StallCheck {
  const stall = stallSpeed(design, clMax) * KMH
  const limit = AIRCRAFT_CLASS[design.class].certifiedStall
  return { stall, limit, passes: stall <= limit }
}

/** Where the drag comes from at one speed, each a drag area, m², and the lift coefficient flown. */
export interface AircraftDrag {
  wing: number
  induced: number
  fuselage: number
  tail: number
  misc: number
  cowl: number
  gear: number
  struts: number
  pod: number
  tips: number
  cdA: number
  cl: number
}

export interface DragOpts {
  /** In the prop's slipstream (flight, or a powered model); false: the prop stopped, as a plain tunnel model. Default true. */
  slipstream?: boolean
}

/** The strut fairings' drag area at one angle to the air, degrees, for a share of the struts. */
function strutDrag(design: AircraftDesign, share: number, angle: number): number {
  const f = design.struts.fairing
  return A.struts * share * (1 - f + f * (1 - A.fairGain) * (1 + A.misalign * angle * angle))
}

/** The parasite drag areas, m², with the prop's slipstream on the nose or not. */
function parasite(design: AircraftDesign, slipstream: boolean): Omit<AircraftDrag, 'wing' | 'induced' | 'cdA' | 'cl'> {
  const s = W.share
  // A part's drag with its share in the slipstream blown harder.
  const blown = (cdA: number, share: number) => (slipstream ? cdA * (1 + W.boost * share) : cdA)
  const cowl = blown(A.cowl * (1 - A.cowlGain * design.cowling), s.cowl)
  const gear = blown(A.gear * (1 - A.spatGain * design.spats), s.gear)
  const fuselage = blown(A.fuselage, s.fuselage)
  const toe = design.struts.toe
  // The struts' roots sit in the swirl: the air meets their fairings at the toe less the swirl.
  const struts = slipstream
    ? strutDrag(design, 1 - s.struts, toe) + strutDrag(design, s.struts, toe - W.swirlDeg) * (1 + W.boost)
    : strutDrag(design, 1, toe)
  const pod =
    A.podBare + (A.podFaired - A.podBare) * design.pod.fairing + (A.podInterference * (1 - design.pod.at)) / 2
  return { fuselage, tail: A.tail, misc: A.misc, cowl, gear, struts, pod, tips: A.tipCdA * design.wingtips }
}

/** The drag at this speed and air in level flight, carrying its weight at cruise. */
export function aircraftDrag(design: AircraftDesign, speed: number, density: number, opts: DragOpts = {}): AircraftDrag {
  const c = AIRCRAFT_CLASS[design.class]
  const q = 0.5 * density * speed * speed
  const cl = (aircraftMass(design) * ATMOSPHERE.gravity) / (q * c.wingArea)
  const aspect = (c.span * c.span) / c.wingArea
  const induced = ((cl * cl) / (PI * aircraftSpanEfficiency(design) * aspect)) * c.wingArea
  const wing = A.wingCd0 * c.wingArea
  const p = parasite(design, opts.slipstream ?? true)
  const cdA = wing + induced + p.fuselage + p.tail + p.misc + p.cowl + p.gear + p.struts + p.pod + p.tips
  return { wing, induced, ...p, cdA, cl }
}

/** The air at cruise height over an airfield on a day, kg/m³. */
export function cruiseDensity(field: Airfield, temperature = field.temperature): number {
  return densityAt(temperature, field.cruiseAltitude)
}

/** The prop's push at cruise power times speed, W: what the drag has to match. */
export function cruisePower(design: AircraftDesign): number {
  const c = AIRCRAFT_CLASS[design.class]
  return c.power * c.cruiseShare * c.propEfficiency
}

/**
 * Cruise speed at cruise power over an airfield, m/s: where the push
 * matches the drag. `drag` scales the drag (1: as it is).
 */
export function cruiseSpeed(design: AircraftDesign, field: Airfield, opts: DragOpts & { drag?: number; temperature?: number } = {}): number {
  const density = cruiseDensity(field, opts.temperature)
  const power = cruisePower(design)
  const scale = opts.drag ?? 1
  const short = (v: number) => 0.5 * density * v * v * v * aircraftDrag(design, v, density, opts).cdA * scale > power
  let lo = CRUISE.slow
  let hi = CRUISE.fast
  for (let i = 0; i < CRUISE.steps; i++) {
    const mid = (lo + hi) / 2
    if (short(mid)) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

/** What lifted the stall speed, for its "change this": the square tips or the pod slid forward, whichever took more of the wing's lift (the tips if neither did). */
export function stallFix(design: AircraftDesign): Extract<FixTarget, 'wingtips' | 'acPodAt'> {
  const tips = A.tipStall * design.wingtips
  const pod = A.podStall * Math.max(0, design.pod.at)
  return pod > tips ? 'acPodAt' : 'wingtips'
}
