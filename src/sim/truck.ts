/**
 * The truck on the road (plan sections 4.1, 6.8 and 8.3, PR 9a).
 *
 * The drag: the rig's outside as one long box the drag model reads (its
 * skin and the wake behind the doors or the boat-tail), plus what a box
 * can't show: the cab's front corners, the roof step where the fairing misses the
 * trailer, the churn in the gap, the wheels and underside, the boat-tail's
 * panels pulling back, and the mirrors. The gap and the underside get much
 * worse in a crosswind, which is where extenders and skirts earn their keep.
 *
 * The fuel run: a loaded rig at the speed limit along the client's route,
 * the day's wind meeting each leg at its own angle. The promise is the fuel
 * saved against the fleet's current truck, averaged over every wind
 * direction at the route's usual wind (a "wind-averaged" figure), so one
 * lucky day's wind doesn't decide it.
 */
import { ATMOSPHERE, FIELD_TURBULENCE } from '../data/field'
import type { Route } from '../data/routes'
import { FUEL, RIG, ROAD_CODE, TRUCK_DRAG, TRUCK_PARTS, TRUCK_SPEED, type TruckDesign } from '../data/truck'
import type { Flow } from './aero/flow'
import { cdAAt, yawCurve, type YawCurve } from './aero/windAverage'
import { shapeDrag } from './aero/drag'
import { detAtan2, detCos, detSin, PI } from './det'
import { densityAt, viscosityAt } from './field/atmosphere'
import { describeShape } from './geom/body'
import { doorsAt, truckShape, truckStation } from './geom/truck'
import { DEG, clamp01 } from './num'

/** The drag the box can't show, at a yaw angle, full size, m². */
export interface TruckExtras {
  corners: number
  step: number
  gap: number
  under: number
  panels: number
  mirrors: number
  total: number
}

/** The fairing's top above the road, m. */
export function fairingTop(design: TruckDesign): number {
  return RIG.cabTop + design.cab.fairing
}

/** How far the fairing misses the trailer's roof, m: positive short of it, negative over it. */
export function roofMismatch(design: TruckDesign): number {
  return design.trailerTop - fairingTop(design)
}

/** The skirts' gap above the road, m (the floor's height with no skirts). */
export function skirtGap(design: TruckDesign): number {
  return RIG.floor - design.trailer.skirts
}

/** How well the skirts shield the underside, 0 (none) to 1 (down to the full-effect gap). */
export function skirtCover(design: TruckDesign): number {
  return clamp01(design.trailer.skirts / (RIG.floor - TRUCK_DRAG.skirtFullGap))
}

/** The area of the back the boat-tail's panels close, m² (the doors' section less the end's). */
export function tailClosed(design: TruckDesign): number {
  if (design.trailer.tail <= 0) return 0
  const doors = truckStation(design, doorsAt(design))
  const end = truckStation(design, doorsAt(design) + design.trailer.tail)
  const area = (s: typeof doors) => (s.top + s.bottom) * 2 * s.half
  return Math.max(0, area(doors) - area(end))
}

/** Yaw's effect on the crosswind-hungry parts: 0 straight on, 1 at 10°. */
function yawShare(yawDeg: number): number {
  const s = detSin(yawDeg * DEG) / detSin(10 * DEG)
  return s * s
}

export function truckExtras(design: TruckDesign, yawDeg: number): TruckExtras {
  const D = TRUCK_DRAG
  const y = yawShare(yawDeg)
  const sharp = Math.max(0, 1 - design.cab.nose / D.cornerRound)
  const corners = D.cornerCd * RIG.width * (RIG.cabTop - RIG.bodyBottom) * sharp * sharp
  const miss = roofMismatch(design)
  const step = miss > 0 ? D.stepUnder * miss * RIG.width : -miss * D.stepOver * RIG.width
  const g = design.gap.length
  const shield = clamp01(design.cab.extenders / g) * D.extenderCut
  const gap = D.gapPerMetre * g * (1 - D.gapFillCut * design.gap.fill) * (1 + D.gapYawRise * y * (1 - shield))
  const cover = skirtCover(design)
  const shielded = D.under * D.underShielded
  const open = D.under - shielded
  const under = open + shielded * (1 - D.skirtCut * cover) * (1 + D.underYawRise * y * (1 - D.skirtYawCut * cover))
  const a = design.trailer.tailAngle / D.panelRefDeg
  const panels = D.panelK * tailClosed(design) * a * a
  const total = corners + step + gap + under + panels + D.mirrors
  return { corners, step, gap, under, panels, mirrors: D.mirrors, total }
}

/** The air the truck meets at highway speed, at a temperature and altitude. */
export function truckFlow(temperature: number, altitude: number, speed = TRUCK_SPEED): Flow {
  return { density: densityAt(temperature, altitude), viscosity: viscosityAt(temperature), speed, turbulence: FIELD_TURBULENCE }
}

export interface TruckDrag {
  /** The box: skin friction, its (well rounded) front, the wake. */
  friction: number
  front: number
  wake: number
  extras: TruckExtras
  /** All of it straight on, m². */
  cdA: number
}

/** The drag straight on, part by part. */
export function truckDrag(design: TruckDesign, flow: Flow): TruckDrag {
  const body = shapeDrag(describeShape(truckShape(design)), flow).bodies[0]!
  const extras = truckExtras(design, 0)
  return { friction: body.frictionCdA, front: body.forebodyCdA, wake: body.pressureCdA, extras, cdA: body.cdA + extras.total }
}

/** The whole truck's drag over yaw: the box's own curve with the extras added at each angle. */
export function truckCurve(design: TruckDesign, flow: Flow): YawCurve {
  const box = yawCurve(describeShape(truckShape(design)), flow)
  return { ...box, cdA: box.cdA.map((c, i) => c + truckExtras(design, box.yawsDeg[i]!).total) }
}

/** A road-code limit the truck breaks, with the slider to change. */
export interface TruckRuleBreak {
  rule: 'tail' | 'skirts'
  part: 'trailer.tail' | 'trailer.skirts'
  value: number
  limit: number
}

/** The Tarnovian Road Code: the boat-tail's length, and the skirts' gap above the road. */
export function checkTruckRules(design: TruckDesign): TruckRuleBreak[] {
  const out: TruckRuleBreak[] = []
  if (design.trailer.tail > ROAD_CODE.maxTail + 1e-9) out.push({ rule: 'tail', part: 'trailer.tail', value: design.trailer.tail, limit: ROAD_CODE.maxTail })
  const gap = skirtGap(design)
  if (design.trailer.skirts > 0 && gap < ROAD_CODE.minSkirtGap - 1e-9) out.push({ rule: 'skirts', part: 'trailer.skirts', value: gap, limit: ROAD_CODE.minSkirtGap })
  return out
}

/** What the add-on parts weigh, kg, and cost to fit, ₽. */
export function truckParts(design: TruckDesign): { mass: number; price: number } {
  const P = TRUCK_PARTS
  const amounts = {
    fairing: design.cab.fairing,
    extenders: design.cab.extenders,
    fill: design.gap.fill,
    skirts: design.trailer.skirts,
    tail: design.trailer.tail,
  }
  const mass = amounts.fairing * P.massFairing + amounts.extenders * P.massExtenders + amounts.fill * P.massFill + amounts.skirts * P.massSkirts + amounts.tail * P.massTail
  const price = amounts.fairing * P.priceFairing + amounts.extenders * P.priceExtenders + amounts.fill * P.priceFill + amounts.skirts * P.priceSkirts + amounts.tail * P.priceTail
  return { mass, price: Math.round(price / 100) * 100 }
}

export interface TruckReadouts {
  /** The rig's biggest cross-section, m². */
  frontalArea: number
  /** Loaded, with the parts, kg. */
  mass: number
  /** The parts' fitting price, ₽. */
  price: number
}

export function truckReadouts(design: TruckDesign): TruckReadouts {
  const parts = truckParts(design)
  return { frontalArea: describeShape(truckShape(design)).frontalArea, mass: truckMass(design), price: parts.price }
}

/** The loaded rig with its parts, kg. */
export function truckMass(design: TruckDesign): number {
  return RIG.mass + RIG.payload + truckParts(design).mass
}

/** A day on the route. */
export interface RouteDay {
  temperature: number
  /** Wind speed, m/s, and the direction it blows from, degrees clockwise from north. */
  windSpeed: number
  windFromDeg: number
}

export interface LegResult {
  /** Speed held on the leg, m/s (below the limit on a climb the engine can't hold). */
  speed: number
  /** The wind's angle to the truck, degrees, and the drag area there, m². */
  yawDeg: number
  cdA: number
  litres: number
  time: number
}

export interface FuelRun {
  litres: number
  /** Litres per 100 km. */
  per100: number
  time: number
  distance: number
  legs: LegResult[]
}

/** The road force on a leg at a speed: air (along the truck), tyres, the hill, N. */
function legForce(v: number, leg: { grade: number; heading: number }, mass: number, density: number, cdAOf: (yaw: number) => number, day: RouteDay) {
  const rel = (day.windFromDeg - leg.heading) * DEG
  const vx = v + day.windSpeed * detCos(rel)
  const vy = day.windSpeed * detSin(rel)
  const yawDeg = (detAtan2(vy, vx) * 180) / PI
  const cdA = cdAOf(yawDeg)
  const g = ATMOSPHERE.gravity
  const k = leg.grade / 100
  const norm = Math.sqrt(1 + k * k)
  const force = 0.5 * density * (vx * vx + vy * vy) * cdA + FUEL.rolling * mass * g / norm + (mass * g * k) / norm
  return { force, yawDeg, cdA }
}

/**
 * The run along a route on a day, with a drag-area-at-yaw function (the
 * design's own curve, or one a tunnel read). The truck holds the limit; on a
 * climb it can't hold, it slows to the speed its power allows (never below
 * a crawl). Downhill it brakes and burns only what the accessories need.
 */
export function fuelRunWith(cdAOf: (yawDeg: number) => number, mass: number, route: Route, day: RouteDay): FuelRun {
  const density = densityAt(day.temperature, route.altitude)
  const wheelPower = FUEL.power * FUEL.drivetrain
  const legs: LegResult[] = []
  let litres = 0
  let time = 0
  let distance = 0
  for (const leg of route.legs) {
    let v = route.speed
    let r = legForce(v, leg, mass, density, cdAOf, day)
    if (r.force * v > wheelPower) {
      // Too steep to hold the limit: halve the range of speeds until the engine just copes.
      let lo: number = FUEL.crawl
      let hi = route.speed
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2
        if (legForce(mid, leg, mass, density, cdAOf, day).force * mid > wheelPower) hi = mid
        else lo = mid
      }
      v = lo
      r = legForce(v, leg, mass, density, cdAOf, day)
    }
    const t = leg.length / v
    const work = Math.max(0, r.force) * leg.length / FUEL.drivetrain + FUEL.accessories * t
    const l = work / (FUEL.engine * FUEL.diesel)
    legs.push({ speed: v, yawDeg: r.yawDeg, cdA: r.cdA, litres: l, time: t })
    litres += l
    time += t
    distance += leg.length
  }
  return { litres, per100: (litres * 100000) / distance, time, distance, legs }
}

/** The design's own run on a day (its drag curve in that day's air). */
export function fuelRun(design: TruckDesign, route: Route, day: RouteDay): FuelRun {
  const curve = truckCurve(design, truckFlow(day.temperature, route.altitude, route.speed))
  return fuelRunWith((y) => cdAAt(curve, y), truckMass(design), route, day)
}

/**
 * The wind-averaged fuel figure, litres per 100 km: the run with the wind
 * from each of `FUEL.windSamples` directions in turn, averaged.
 */
export function windAveragedFuelWith(cdAOf: (yawDeg: number) => number, mass: number, route: Route, temperature = route.temperature, windSpeed = route.wind): number {
  let sum = 0
  for (let k = 0; k < FUEL.windSamples; k++) {
    const day = { temperature, windSpeed, windFromDeg: (360 * k) / FUEL.windSamples }
    sum += fuelRunWith(cdAOf, mass, route, day).per100
  }
  return sum / FUEL.windSamples
}

/** The design's wind-averaged fuel figure on its route's usual day, litres per 100 km. */
export function windAveragedFuel(design: TruckDesign, route: Route, temperature = route.temperature, windSpeed = route.wind): number {
  const curve = truckCurve(design, truckFlow(temperature, route.altitude, route.speed))
  return windAveragedFuelWith((y) => cdAAt(curve, y), truckMass(design), route, temperature, windSpeed)
}

/** Fuel saved against another truck (the fleet's current one), per cent of its fuel. */
export function fuelSaving(design: TruckDesign, old: TruckDesign, route: Route): number {
  const mine = windAveragedFuel(design, route)
  const theirs = windAveragedFuel(old, route)
  return (1 - mine / theirs) * 100
}
