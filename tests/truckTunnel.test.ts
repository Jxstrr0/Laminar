import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { FAILURE } from '../src/data/failure'
import { newLab } from '../src/sim/lab'
import { strains } from '../src/sim/failure'
import { MODEL_SHOP, STANDARD_ORDER, TRUCK_SCALES } from '../src/data/model'
import { ROUTES } from '../src/data/routes'
import { DEFAULT_TRUCK, FLEET_TRUCK, TRUCK_TUNNEL, type TruckDesign } from '../src/data/truck'
import { UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { cdAAt } from '../src/sim/aero/windAverage'
import { forMaker, isTruckScale, makerScales, matchedSpeed, modelSpecOf, quote, reynoldsRatio } from '../src/sim/modelShop'
import { Rng } from '../src/sim/rng'
import { fuelSaving, truckCurve, truckExtras, truckFlow } from '../src/sim/truck'
import { forecastSaving, prepareTruck, readCurve, truckEvent, truckFloorRead } from '../src/sim/truckTunnel'
import { fixedDrag, readBalance, type ModelSpec } from '../src/sim/views'

const route = ROUTES['stavren-mostograd']
const quiet = { ...UNIVERSITY_TUNNEL, balanceNoise: 0 }
const model = (patch: Partial<ModelSpec> = {}): ModelSpec => ({ scale: 1 / 8, finish: 'sanded', accuracy: 0, seed: 3, ...patch })
const read = (d: TruckDesign, m: ModelSpec, yawDeg = 0) => readBalance(prepareTruck(d, m), quiet, { speed: 40, yawDeg }, new Rng(1)).cdA
const sweep = (d: TruckDesign, m: ModelSpec, yaws = [0, 5, 10, 15, 20]) => yaws.map((yawDeg) => ({ yawDeg, cdA: read(d, m, yawDeg) }))
const truth = (d: TruckDesign) => truckCurve(d, truckFlow(route.temperature, route.altitude))

describe('the truck in the tunnel', () => {
  it('reads only part of the wheels and underside on the bare floor, nearly all on a ground board', () => {
    expect(truckFloorRead(false)).toBeCloseTo(1 - TRUCK_TUNNEL.floorHidden, 12)
    expect(truckFloorRead(true)).toBeGreaterThan(truckFloorRead(false))
    expect(truckFloorRead(true)).toBeLessThan(1)
  })

  it('carries the parts as drag that grows with yaw, the same either side', () => {
    const p = prepareTruck(FLEET_TRUCK, model({ board: true }))
    expect(p.shape.bodies).toHaveLength(1)
    expect(fixedDrag(p, 10)).toBeGreaterThan(fixedDrag(p, 0) * 1.3)
    expect(fixedDrag(p, -10)).toBe(fixedDrag(p, 10))
    // Between the samples it runs straight; past the end it holds.
    expect(fixedDrag(p, 1.25)).toBeCloseTo((fixedDrag(p, 0) + fixedDrag(p, 2.5)) / 2, 12)
    expect(fixedDrag(p, 45)).toBe(fixedDrag(p, TRUCK_TUNNEL.maxYaw))
    // At model size: the parts' full-size drag times the scale squared, less the floor's share.
    const e = truckExtras(FLEET_TRUCK, 0)
    expect(fixedDrag(p, 0)).toBeCloseTo((e.total - e.under * (1 - truckFloorRead(true))) / 64, 12)
  })

  it('reads close to the truth on a ground board, and too slippery on the bare floor, worst in a crosswind', () => {
    for (const d of [FLEET_TRUCK, DEFAULT_TRUCK]) {
      const t = truth(d)
      for (const yaw of [0, 10, 20]) {
        expect(Math.abs(read(d, model({ board: true }), yaw) / cdAAt(t, yaw) - 1)).toBeLessThan(0.06)
        expect(read(d, model(), yaw)).toBeLessThan(cdAAt(t, yaw))
      }
      const bareMiss = (yaw: number) => 1 - read(d, model(), yaw) / cdAAt(t, yaw)
      expect(bareMiss(20)).toBeGreaterThan(bareMiss(0))
    }
  })

  it('forecasts the saving on a ground board within a couple of points; the bare floor over-promises', () => {
    const real = fuelSaving(DEFAULT_TRUCK, FLEET_TRUCK, route)
    const board = forecastSaving(readCurve(sweep(DEFAULT_TRUCK, model({ board: true }))), DEFAULT_TRUCK, FLEET_TRUCK, route)
    const bare = forecastSaving(readCurve(sweep(DEFAULT_TRUCK, model())), DEFAULT_TRUCK, FLEET_TRUCK, route)
    expect(Math.abs(board - real)).toBeLessThan(2)
    expect(bare).toBeGreaterThan(real + 1.5)
  })

  it('over-promises on a straight-on reading alone: a crosswind costs more than it shows', () => {
    const m = model({ board: true })
    const swept = forecastSaving(readCurve(sweep(DEFAULT_TRUCK, m)), DEFAULT_TRUCK, FLEET_TRUCK, route)
    const straight = forecastSaving(readCurve(sweep(DEFAULT_TRUCK, m, [0])), DEFAULT_TRUCK, FLEET_TRUCK, route)
    expect(straight).toBeGreaterThan(swept + 1.5)
    // The truth on the curve gives the real saving.
    expect(forecastSaving((y) => cdAAt(truth(DEFAULT_TRUCK), y), DEFAULT_TRUCK, FLEET_TRUCK, route)).toBeCloseTo(fuelSaving(DEFAULT_TRUCK, FLEET_TRUCK, route), 9)
  })

  it('builds a curve from readings: either side and repeats averaged, flat past the ends', () => {
    const c = readCurve([
      { yawDeg: 0, cdA: 4 },
      { yawDeg: 10, cdA: 5 },
      { yawDeg: -10, cdA: 5.4 },
    ])
    expect(c(0)).toBe(4)
    expect(c(10)).toBeCloseTo(5.2, 12)
    expect(c(-5)).toBeCloseTo(4.6, 12)
    expect(c(25)).toBeCloseTo(5.2, 12)
  })

  it('meets the Reynolds trap: even a 1:8 model runs far below the road’s Reynolds number', () => {
    const e = truckEvent(route)
    expect(e.riderSpeed).toBe(route.speed)
    expect(e.altitude).toBe(route.altitude)
    const ratio = reynoldsRatio(prepareTruck(DEFAULT_TRUCK, model()), UNIVERSITY_TUNNEL.topSpeed, e)
    expect(ratio).toBeLessThan(0.3)
    expect(matchedSpeed(1 / 8, e)).toBeGreaterThan(UNIVERSITY_TUNNEL.topSpeed * 3)
  })

  it('is deterministic for a seed, and a build’s size errors move the reading', () => {
    expect(read(DEFAULT_TRUCK, model({ accuracy: 0.01 }))).toBe(read(DEFAULT_TRUCK, model({ accuracy: 0.01 })))
    expect(read(DEFAULT_TRUCK, model({ accuracy: 0.01, seed: 9 }))).not.toBe(read(DEFAULT_TRUCK, model({ accuracy: 0.01 })))
  })
})

describe('truck models in the shop', () => {
  it('offers small scales for a truck, priced like the others', () => {
    expect(TRUCK_SCALES.every((s) => isTruckScale(s))).toBe(true)
    expect(isTruckScale(STANDARD_ORDER.scale)).toBe(false)
    const order = { ...STANDARD_ORDER, scale: 8 as const, board: true }
    expect(quote(order).price).toBe(MODEL_SHOP.scale[8].price + MODEL_SHOP.board.price)
    expect(modelSpecOf(order, 1).scale).toBe(1 / 8)
  })

  it('keeps a truck’s scale a truck’s when the maker changes', () => {
    expect(makerScales('resin', 'truck')).toEqual([12, 10])
    expect(makerScales('resin', 'rider')).toEqual([4, 3])
    expect(forMaker({ ...STANDARD_ORDER, scale: 8 }, 'resin').scale).toBe(10)
    expect(forMaker({ ...STANDARD_ORDER, scale: 2 }, 'resin').scale).toBe(3)
  })
})

describe('the truck on the tunnel’s mount', () => {
  it('starts a truck lab on a 1:8 model with a ground board', () => {
    const lab = newLab(DEFAULT_TRUCK)
    expect(lab.order.scale).toBe(8)
    expect(lab.order.board).toBe(true)
    expect(newLab().order.board).toBeUndefined()
  })

  it('bolts a truck to stouter struts than a rider’s posts', () => {
    const order = { ...STANDARD_ORDER, scale: 8 as const, board: true }
    const posts = (design: TruckDesign | typeof DEFAULT_CYCLIST, loadN: number) =>
      strains({ order, design }, 40, loadN).find((s) => s.part === 'posts')!.level
    expect(posts(DEFAULT_TRUCK, FAILURE.truckMountN)).toBeCloseTo(1, 12)
    expect(posts(DEFAULT_CYCLIST, FAILURE.mountN)).toBeCloseTo(1, 12)
    expect(FAILURE.truckMountN).toBeGreaterThan(FAILURE.mountN * 3)
  })
})
