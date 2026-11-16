/**
 * The truck in the tunnel (plan section 6.8, PR 9c).
 *
 * The rig's box is a body like any other: built at scale with the model's
 * own size errors and read at the tunnel's speed, so it meets the Reynolds
 * trap. What a box can't show (the cab's corners, the roof step, the gap,
 * the wheels and underside, the boat-tail's panels, the mirrors) rides along
 * as fixed drag that changes with yaw (PreparedModel.fixedYaw), because the
 * gap and the underside get much worse in a crosswind. The wheels and
 * underside go through the still-floor error (TRUCK_TUNNEL); a ground board
 * takes most of it away.
 *
 * The forecast: the fuel run on the client's route on the drag curve the
 * tunnel read, instead of the truth, against their current truck (known
 * from their own fuel records). A curve read only straight on is held flat,
 * so it misses what a crosswind costs: sweep the yaw.
 */
import type { Route } from '../data/routes'
import { TRUCK_TUNNEL, type TruckDesign } from '../data/truck'
import { truckShape } from './geom/truck'
import { gaussian } from './noise'
import { interp } from './num'
import { Rng } from './rng'
import { truckExtras, truckMass, windAveragedFuel, windAveragedFuelWith } from './truck'
import { prepareModel, REFERENCE_TT, type EventSpec, type ModelSpec, type PreparedModel } from './views'

/** The share of the wheels' and underside's drag the balance sees: less on the bare floor, nearly all on a ground board. */
export function truckFloorRead(board: boolean): number {
  return 1 - TRUCK_TUNNEL.floorHidden * (board ? TRUCK_TUNNEL.boardLeft : 1)
}

/** A built truck model: the box as a body, its parts as drag that changes with yaw. */
export function prepareTruck(design: TruckDesign, model: ModelSpec): PreparedModel {
  const built = prepareModel(truckShape(design), model)
  // The bolted-on parts share one size error: the shop cuts them from the same drawings.
  const k = 1 + model.accuracy * gaussian(new Rng(model.seed).fork('truck-build'))
  const s2 = model.scale * model.scale
  const floor = truckFloorRead(model.board === true)
  const steps = Math.round(TRUCK_TUNNEL.maxYaw / TRUCK_TUNNEL.stepDeg)
  const cdA: number[] = []
  for (let i = 0; i <= steps; i++) {
    const e = truckExtras(design, i * TRUCK_TUNNEL.stepDeg)
    cdA.push((e.total - e.under * (1 - floor)) * k * s2)
  }
  return { ...built, fixedYaw: { stepDeg: TRUCK_TUNNEL.stepDeg, cdA } }
}

/** A tunnel reading at a yaw: full-size drag area, m². */
export interface YawPoint {
  yawDeg: number
  cdA: number
}

/**
 * The drag curve a set of readings makes: readings at the same angle
 * (either side) averaged, straight lines between, held flat past the ends.
 * A truck is the same both sides, so a reading at −10° counts for +10°.
 */
export function readCurve(points: readonly YawPoint[]): (yawDeg: number) => number {
  const groups = new Map<number, { sum: number; n: number }>()
  for (const p of points) {
    const at = Math.round(Math.abs(p.yawDeg) * 2) / 2
    const g = groups.get(at) ?? { sum: 0, n: 0 }
    g.sum += p.cdA
    g.n += 1
    groups.set(at, g)
  }
  const yaws = [...groups.keys()].sort((a, b) => a - b)
  const cdAs = yaws.map((y) => groups.get(y)!.sum / groups.get(y)!.n)
  return (yawDeg) => interp(yaws, cdAs, Math.abs(yawDeg))
}

/** The fuel saving, %, on the route for a drag curve the tunnel read, against the client's current truck. */
export function forecastSaving(cdAOf: (yawDeg: number) => number, design: TruckDesign, old: TruckDesign, route: Route): number {
  return (1 - windAveragedFuelWith(cdAOf, truckMass(design), route) / windAveragedFuel(old, route)) * 100
}

/** The route's air as an event, so the model shop and the Reynolds readout match the truck at the speed limit. */
export function truckEvent(route: Route): EventSpec {
  return { ...REFERENCE_TT, temperature: route.temperature, altitude: route.altitude, riderSpeed: route.speed, windSpeed: 0 }
}
