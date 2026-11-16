import { describe, expect, it } from 'vitest'
import { ROUTES, type Route } from '../src/data/routes'
import { DEFAULT_TRUCK, FLEET_TRUCK, RIG, ROAD_CODE, type TruckDesign } from '../src/data/truck'
import { cdAAt } from '../src/sim/aero/windAverage'
import { describeShape } from '../src/sim/geom/body'
import { doorsAt, truckLength, truckShape, truckStation } from '../src/sim/geom/truck'
import {
  checkTruckRules,
  fuelRun,
  fuelRunWith,
  fuelSaving,
  skirtGap,
  truckCurve,
  truckDrag,
  truckFlow,
  truckMass,
  truckParts,
  windAveragedFuel,
} from '../src/sim/truck'

const route = ROUTES['stavren-mostograd']
const flow = truckFlow(route.temperature, route.altitude)
type Patch = { cab?: Partial<TruckDesign['cab']>; gap?: Partial<TruckDesign['gap']>; trailer?: Partial<TruckDesign['trailer']> }
const truck = (p: Patch = {}, base: TruckDesign = DEFAULT_TRUCK): TruckDesign => ({
  ...base,
  cab: { ...base.cab, ...p.cab },
  gap: { ...base.gap, ...p.gap },
  trailer: { ...base.trailer, ...p.trailer },
})
const cdA = (d: TruckDesign) => truckDrag(d, flow).cdA
const at = (d: TruckDesign, yaw: number) => cdAAt(truckCurve(d, flow), yaw)

describe('the rig', () => {
  it('runs cab, gap, trailer and boat-tail end to end, a box as big as the trailer', () => {
    expect(truckLength(DEFAULT_TRUCK)).toBeCloseTo(RIG.cab + 0.8 + RIG.trailer + 0.9, 9)
    const shape = describeShape(truckShape(FLEET_TRUCK))
    expect(shape.frontalArea).toBeGreaterThan(8.5)
    expect(shape.frontalArea).toBeLessThan(RIG.width * (FLEET_TRUCK.trailerTop - RIG.bodyBottom) + 1e-9)
  })

  it('folds the boat-tail’s top and sides in, and leaves the floor straight', () => {
    const doors = truckStation(DEFAULT_TRUCK, doorsAt(DEFAULT_TRUCK))
    const end = truckStation(DEFAULT_TRUCK, truckLength(DEFAULT_TRUCK))
    expect(end.top).toBeLessThan(doors.top - 0.15)
    expect(end.half).toBeLessThan(doors.half - 0.15)
    expect(end.bottom).toBeCloseTo(doors.bottom, 9)
  })

  it('weighs and prices the parts', () => {
    expect(truckParts(FLEET_TRUCK)).toEqual({ mass: 0, price: 0 })
    expect(truckParts(DEFAULT_TRUCK).mass).toBeGreaterThan(100)
    expect(truckMass(DEFAULT_TRUCK)).toBeGreaterThan(truckMass(FLEET_TRUCK))
  })
})

describe('the Tarnovian Road Code', () => {
  it('passes the fleet’s truck and the default kit', () => {
    expect(checkTruckRules(FLEET_TRUCK)).toEqual([])
    expect(checkTruckRules(DEFAULT_TRUCK)).toEqual([])
  })

  it('caps the boat-tail’s length and the skirts’ ground gap', () => {
    expect(checkTruckRules(truck({ trailer: { tail: 1.4 } }))).toEqual([{ rule: 'tail', part: 'trailer.tail', value: 1.4, limit: ROAD_CODE.maxTail }])
    const low = truck({ trailer: { skirts: 1.05 } })
    expect(skirtGap(low)).toBeCloseTo(0.2, 9)
    expect(checkTruckRules(low)).toEqual([{ rule: 'skirts', part: 'trailer.skirts', value: expect.closeTo(0.2, 9), limit: ROAD_CODE.minSkirtGap }])
  })
})

describe('the drag', () => {
  it('lands near real trucks: about 6.5 m² as the fleet runs it, under 4.5 m² with a good kit', () => {
    expect(cdA(FLEET_TRUCK)).toBeGreaterThan(6)
    expect(cdA(FLEET_TRUCK)).toBeLessThan(7.2)
    expect(cdA(DEFAULT_TRUCK)).toBeLessThan(4.5)
  })

  it('pays for rounder cab corners smoothly, a little more with every step', () => {
    let last = Infinity
    for (let nose = 0.05; nose <= 0.45 + 1e-9; nose += 0.05) {
      const c = cdA(truck({ cab: { nose } }))
      expect(c).toBeLessThan(last)
      last = c
    }
  })

  it('likes a roof fairing that meets the trailer, and punishes one short of it or over it', () => {
    const met = cdA(truck({ cab: { fairing: 1 } }))
    expect(cdA(truck({ cab: { fairing: 0.6 } }))).toBeGreaterThan(met + 0.2)
    expect(cdA(truck({ cab: { fairing: 1.3 } }))).toBeGreaterThan(met + 0.1)
    // A lower trailer wants a lower fairing.
    const low = { ...DEFAULT_TRUCK, trailerTop: 3.7 }
    expect(cdA(truck({ cab: { fairing: 0.7 } }, low))).toBeLessThan(cdA(truck({ cab: { fairing: 1 } }, low)))
  })

  it('has a best boat-tail angle: too shallow closes little, too steep and the panels pull back', () => {
    const angles = [6, 8, 10, 12, 14, 16, 18, 20, 22]
    const drags = angles.map((tailAngle) => cdA(truck({ trailer: { tail: 1.2, tailAngle } })))
    const best = angles[drags.indexOf(Math.min(...drags))]!
    expect(best).toBeGreaterThanOrEqual(10)
    expect(best).toBeLessThanOrEqual(16)
    expect(drags[drags.length - 1]!).toBeGreaterThan(Math.min(...drags) + 0.2)
    // And any sensible boat-tail beats bare doors.
    expect(cdA(truck({ trailer: { tail: 1.2, tailAngle: 12 } }))).toBeLessThan(cdA(truck({ trailer: { tail: 0 } })) - 0.15)
  })

  it('makes the gap and underside hungry for crosswind, so extenders and skirts earn most at yaw', () => {
    const rise = (d: TruckDesign) => at(d, 10) - at(d, 0)
    expect(at(FLEET_TRUCK, 10)).toBeGreaterThan(at(FLEET_TRUCK, 0) * 1.2)
    const bare = truck({ trailer: { skirts: 0 } })
    const skirted = truck({ trailer: { skirts: 1 } })
    expect(rise(skirted)).toBeLessThan(rise(bare) * 0.7)
    expect(rise(truck({ cab: { extenders: 0.8 } }))).toBeLessThan(rise(truck({ cab: { extenders: 0 } })))
    // The gap filler helps straight on.
    expect(cdA(truck({ gap: { fill: 1 } }))).toBeLessThan(cdA(truck({ gap: { fill: 0 } })))
  })
})

describe('the fuel run', () => {
  it('burns about what a loaded rig does at 90 km/h, and the kit saves a fifth of it', () => {
    const fleet = windAveragedFuel(FLEET_TRUCK, route)
    expect(fleet).toBeGreaterThan(34)
    expect(fleet).toBeLessThan(44)
    const saving = fuelSaving(DEFAULT_TRUCK, FLEET_TRUCK, route)
    expect(saving).toBeGreaterThan(15)
    expect(saving).toBeLessThan(26)
    expect(fuelSaving(FLEET_TRUCK, FLEET_TRUCK, route)).toBe(0)
  })

  it('is the same every time for a design and a day', () => {
    const day = { temperature: 8, windSpeed: 7, windFromDeg: 200 }
    expect(fuelRun(DEFAULT_TRUCK, route, day)).toEqual(fuelRun(DEFAULT_TRUCK, route, day))
  })

  it('meets the day’s wind at each leg’s own angle: a headwind costs, a tailwind saves', () => {
    const one: Route = { ...route, legs: [{ length: 50000, grade: 0, heading: 90 }] }
    const still = fuelRun(FLEET_TRUCK, one, { temperature: 12, windSpeed: 0, windFromDeg: 0 })
    const head = fuelRun(FLEET_TRUCK, one, { temperature: 12, windSpeed: 8, windFromDeg: 90 })
    const tail = fuelRun(FLEET_TRUCK, one, { temperature: 12, windSpeed: 8, windFromDeg: 270 })
    const cross = fuelRun(FLEET_TRUCK, one, { temperature: 12, windSpeed: 8, windFromDeg: 0 })
    expect(head.litres).toBeGreaterThan(still.litres)
    expect(tail.litres).toBeLessThan(still.litres)
    expect(Math.abs(cross.legs[0]!.yawDeg)).toBeGreaterThan(15)
    // The averaged figure doesn't care which way the wind blew.
    expect(windAveragedFuel(FLEET_TRUCK, one)).toBeGreaterThan(still.per100)
  })

  it('slows on a climb the engine can’t hold, and coasts down the far side on the accessories alone', () => {
    const hill: Route = { ...route, legs: [{ length: 5000, grade: 4, heading: 0 }, { length: 5000, grade: -4, heading: 0 }] }
    const run = fuelRunWith(() => 6, truckMass(FLEET_TRUCK), hill, { temperature: 12, windSpeed: 0, windFromDeg: 0 })
    expect(run.legs[0]!.speed).toBeLessThan(hill.speed - 3)
    expect(run.legs[1]!.speed).toBe(hill.speed)
    expect(run.legs[1]!.litres).toBeLessThan(run.legs[0]!.litres * 0.05)
  })
})
