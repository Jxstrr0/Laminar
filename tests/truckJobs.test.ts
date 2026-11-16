import { afterEach, describe, expect, it } from 'vitest'
import { BRIEFS, PROMISE, TRUCK_JOBS } from '../src/data/briefs'
import { ROUTES } from '../src/data/routes'
import { DEFAULT_TRUCK, RIG, ROAD_CODE, type TruckDesign } from '../src/data/truck'
import { UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import {
  boardFor,
  briefTemplate,
  currentTruckEvent,
  daySeed,
  deliverTruck,
  isTruckBrief,
  newCareer,
  openTo,
  truckEventOf,
  type CareerState,
} from '../src/sim/career'
import { legacyOf } from '../src/sim/legacy'
import { Rng } from '../src/sim/rng'
import { cdAAt } from '../src/sim/aero/windAverage'
import { checkTruckRules, fuelSaving, truckCurve, truckFlow, truckMass, windAveragedFuel, windAveragedFuelWith } from '../src/sim/truck'
import { dragScaleForFuel, PRACTICE_ROUTE, roadLegal, trialDay } from '../src/sim/truckJob'
import { frictionScaleUp, prepareTruck, readCurve } from '../src/sim/truckTunnel'
import { readBalance, type ModelSpec } from '../src/sim/views'

const truckBriefs = BRIEFS.filter((b) => b.event.truck)
const mostograd = ROUTES['stavren-mostograd']

/** A career with this truck job in hand. */
function onJob(id: string, promise: number, fee = 50000): CareerState {
  const b = briefTemplate(id)!
  return { ...newCareer(3), job: { brief: { id, fee, days: b.days, seed: 41 }, promise, startDay: 0, daysLeft: b.days, spent: 0 } }
}

/** A good kit for a fleet's trailer: DEFAULT_TRUCK with the fairing raised to meet the roof. */
const kitFor = (setup: TruckDesign): TruckDesign => ({ ...DEFAULT_TRUCK, trailerTop: setup.trailerTop, cab: { ...DEFAULT_TRUCK.cab, fairing: setup.trailerTop - RIG.cabTop } })

afterEach(() => {
  TRUCK_JOBS.open = false
})

describe('truck briefs', () => {
  it('are three fleets: a small one and a mid one on the Mostograd run, a bigger one on the coast', () => {
    expect(truckBriefs.map((b) => b.id)).toEqual(['kovyl-haulage', 'volok-freight', 'prichal-coast'])
    for (const b of truckBriefs) {
      expect(isTruckBrief(b.id)).toBe(true)
      expect(b.setup.sport).toBe('truck')
      // The brief card's air is the route's own usual day.
      const route = truckEventOf(b)!.route
      expect([b.event.temperature, b.event.altitude, b.event.windSpeed, b.event.riderSpeed]).toEqual([route.temperature, route.altitude, route.wind, route.speed])
      // The fleet's current truck is road-legal.
      expect(checkTruckRules(b.setup as TruckDesign)).toEqual([])
    }
    expect(truckEventOf(briefTemplate('prichal-coast')!)!.route).toBe(ROUTES['kosa-coast'])
    expect(isTruckBrief('kostrov-club')).toBe(false)
    expect(truckEventOf(briefTemplate('kostrov-club')!)).toBeNull()
  })

  it('stay off the board until the board can show them (PR 9f), then come as the firm’s name grows', () => {
    for (const b of truckBriefs) expect(openTo(b, 100)).toBe(false)
    for (let round = 0; round < 30; round++) expect(boardFor(1, round, false, 100).some((b) => isTruckBrief(b.id))).toBe(false)
    TRUCK_JOBS.open = true
    expect(openTo(briefTemplate('kovyl-haulage')!, 10)).toBe(true)
    expect(openTo(briefTemplate('prichal-coast')!, 10)).toBe(false)
    expect(openTo(briefTemplate('prichal-coast')!, 40)).toBe(true)
    let offered = false
    for (let round = 0; round < 40; round++) offered ||= boardFor(1, round, false, 100).some((b) => isTruckBrief(b.id))
    expect(offered).toBe(true)
  })

  it('ask for a saving a good legal kit makes with room to spare', () => {
    for (const b of truckBriefs) {
      const setup = b.setup as TruckDesign
      const route = truckEventOf(b)!.route
      expect(fuelSaving(kitFor(setup), setup, route)).toBeGreaterThan(b.target + 4)
    }
  })

  it('run the Mostograd highway between jobs', () => {
    expect(currentTruckEvent(newCareer(1))).toBe(PRACTICE_ROUTE)
    expect(currentTruckEvent(onJob('prichal-coast', 16)).route.id).toBe('kosa-coast')
  })
})

describe('the trial day and the road code', () => {
  it('seeds one day for both trucks, with the wind from anywhere', () => {
    const event = truckEventOf(briefTemplate('volok-freight')!)!
    expect(trialDay(event, 7)).toEqual(trialDay(event, 7))
    const winds = Array.from({ length: 40 }, (_, k) => trialDay(event, k).windFromDeg)
    expect(Math.min(...winds)).toBeLessThan(90)
    expect(Math.max(...winds)).toBeGreaterThan(270)
    for (let k = 0; k < 40; k++) expect(trialDay(event, k).windSpeed).toBeGreaterThanOrEqual(0)
  })

  it('cuts back a boat-tail or skirts the road code forbids, and leaves a legal truck alone', () => {
    expect(roadLegal(DEFAULT_TRUCK)).toBe(DEFAULT_TRUCK)
    const long: TruckDesign = { ...DEFAULT_TRUCK, trailer: { ...DEFAULT_TRUCK.trailer, tail: 1.6, skirts: 1.1 } }
    const fitted = roadLegal(long)
    expect(fitted.trailer.tail).toBe(ROAD_CODE.maxTail)
    expect(RIG.floor - fitted.trailer.skirts).toBeCloseTo(ROAD_CODE.minSkirtGap, 12)
    expect(checkTruckRules(fitted)).toEqual([])
  })

  it('turns a fuel figure back into the drag that would burn it', () => {
    for (const k of [0.8, 1, 1.15]) {
      const per100 = windAveragedFuelWith((y) => k * dragAt(DEFAULT_TRUCK, y), truckMass(DEFAULT_TRUCK), mostograd)
      expect(dragScaleForFuel(per100, DEFAULT_TRUCK, mostograd)).toBeCloseTo(k, 6)
    }
  })
})

/** The truck's true drag area at a yaw on the Mostograd run, m². */
function dragAt(d: TruckDesign, yawDeg: number): number {
  return cdAAt(truckCurve(d, truckFlow(mostograd.temperature, mostograd.altitude, mostograd.speed)), yawDeg)
}

describe('delivering a truck', () => {
  it('keeps a promise the kit makes, and pays in full for a good read', () => {
    const d = deliverTruck(onJob('kovyl-haulage', 12), DEFAULT_TRUCK, windAveragedFuel(DEFAULT_TRUCK, mostograd))!
    expect(d.debrief.achieved).toBeCloseTo(fuelSaving(DEFAULT_TRUCK, briefTemplate('kovyl-haulage')!.setup as TruckDesign, mostograd), 9)
    expect(d.debrief.met).toBe(true)
    expect(d.paid).toBe(50000)
    expect(d.debrief.read).toBe('good')
    expect(Math.abs(d.debrief.readError)).toBeLessThan(1e-6)
    expect(d.debrief.cutBack).toEqual([])
    expect(d.state.history.at(-1)!.predicted).toBeCloseTo(d.debrief.actualCdA, 6)
  })

  it('docks the fee for a miss: the fleet’s own truck saves nothing', () => {
    const setup = briefTemplate('kovyl-haulage')!.setup as TruckDesign
    const d = deliverTruck(onJob('kovyl-haulage', 12), setup, windAveragedFuel(setup, mostograd))!
    expect(d.debrief.achieved).toBeCloseTo(0, 9)
    expect(d.debrief.cause).toBe('design')
    expect(d.debrief.penalty).toBe(50000 * PROMISE.maxShare)
  })

  it('judges the read on drag: a fuel figure 3 % low is a poor read', () => {
    const real = windAveragedFuel(DEFAULT_TRUCK, mostograd)
    const d = deliverTruck(onJob('kovyl-haulage', 12), DEFAULT_TRUCK, real * 0.97)!
    expect(d.debrief.readError).toBeLessThan(-0.04)
    expect(d.debrief.read).toBe('poor')
  })

  it('blames the road code when the depot’s cut-back cost the promise', () => {
    const setup = briefTemplate('kovyl-haulage')!.setup as TruckDesign
    // A boat-tail far past the limit and skirts nearly to the road.
    const wild: TruckDesign = { ...DEFAULT_TRUCK, trailer: { skirts: 1.1, tail: 1.6, tailAngle: 13 } }
    const drawn = fuelSaving(wild, setup, mostograd)
    const legal = fuelSaving(roadLegal(wild), setup, mostograd)
    expect(drawn).toBeGreaterThan(legal + 0.6)
    const d = deliverTruck(onJob('kovyl-haulage', Math.floor(drawn * 2) / 2), wild, windAveragedFuel(roadLegal(wild), mostograd))!
    expect(d.debrief.cutBack.map((c) => c.rule).sort()).toEqual(['skirts', 'tail'])
    expect(d.debrief.achieved).toBeCloseTo(legal, 9)
    expect(d.debrief.met).toBe(false)
    expect(d.debrief.cause).toBe('roadCode')
  })

  it('runs both trucks on the same seeded day', () => {
    const job = onJob('volok-freight', 10, 100000)
    const kit = kitFor(briefTemplate('volok-freight')!.setup as TruckDesign)
    const a = deliverTruck(job, kit, 33)!
    expect(a.debrief.day).toEqual(trialDay(a.event, daySeed(job.job!.brief)))
    expect(a.debrief.run.per100).toBeLessThan(a.debrief.baselineRun.per100)
    expect(a.debrief.baseline).toBeCloseTo(windAveragedFuel(briefTemplate('volok-freight')!.setup as TruckDesign, mostograd), 9)
  })

  it('won’t deliver to a job that isn’t a truck job, or to no job', () => {
    expect(deliverTruck(onJob('kostrov-club', 12), DEFAULT_TRUCK, 32)).toBeNull()
    expect(deliverTruck(newCareer(1), DEFAULT_TRUCK, 32)).toBeNull()
  })

  it('counts a truck’s best job in per cent of fuel on the legacy card', () => {
    const d = deliverTruck(onJob('kovyl-haulage', 12), DEFAULT_TRUCK, 32)!
    const best = legacyOf(d.state).best!
    expect(best.unit).toBe('fuel')
    expect(best.cut).toBeCloseTo(d.debrief.achieved, 9)
  })
})

describe('the lab’s full-size friction correction', () => {
  const quiet = { ...UNIVERSITY_TUNNEL, balanceNoise: 0 }
  const model = (scale: number): ModelSpec => ({ scale, finish: 'sanded', accuracy: 0, seed: 3, board: true })
  const forecast = (d: TruckDesign, scale: number, speed: number, scaleUp: boolean) => {
    const fr = scaleUp ? frictionScaleUp(d, scale, speed, mostograd) : 0
    const points = [0, 5, 10, 15, 20].map((yawDeg) => ({ yawDeg, cdA: readBalance(prepareTruck(d, model(scale)), quiet, { speed, yawDeg }, new Rng(1)).cdA - fr }))
    return dragScaleForFuel(windAveragedFuelWith(readCurve(points), truckMass(d), mostograd), d, mostograd)
  }

  it('takes more off a smaller, slower model', () => {
    const at = (scale: number, speed: number) => frictionScaleUp(DEFAULT_TRUCK, scale, speed, mostograd)
    expect(at(1 / 8, 40)).toBeGreaterThan(0)
    expect(at(1 / 12, 40)).toBeGreaterThan(at(1 / 8, 40))
    expect(at(1 / 8, 30)).toBeGreaterThan(at(1 / 8, 40))
    expect(at(1 / 8, 0)).toBe(0)
  })

  it('turns a ground-board sweep at full fan from a poor read into a good one', () => {
    expect(forecast(DEFAULT_TRUCK, 1 / 8, 40, false) - 1).toBeGreaterThan(0.04)
    expect(Math.abs(forecast(DEFAULT_TRUCK, 1 / 8, 40, true) - 1)).toBeLessThan(PROMISE.goodRead)
    // A slower fan leaves more of the model's laminar patch: a weaker read.
    expect(Math.abs(forecast(DEFAULT_TRUCK, 1 / 8, 30, true) - 1)).toBeGreaterThan(Math.abs(forecast(DEFAULT_TRUCK, 1 / 8, 40, true) - 1))
  })
})
