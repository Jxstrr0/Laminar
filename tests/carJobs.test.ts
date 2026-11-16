import { afterEach, describe, expect, it } from 'vitest'
import { BRIEFS, CAR_JOBS, PROMISE } from '../src/data/briefs'
import { CAR_DESK, STOCK_CAR, type CarDesign } from '../src/data/car'
import { CIRCUITS } from '../src/data/circuits'
import {
  boardFor,
  briefTemplate,
  carEventOf,
  clampBid,
  currentCarRun,
  daySeed,
  deliverCar,
  isCarBrief,
  newCareer,
  openTo,
  type CareerState,
} from '../src/sim/career'
import { carAero, checkCarRules, circuitDensity, lapTime, lapWith, scrutineered } from '../src/sim/car'
import { downScaleForLap, lapTroubles, PRACTICE_CIRCUIT, raceDayAir } from '../src/sim/carJob'
import { legacyOf } from '../src/sim/legacy'

const carBriefs = BRIEFS.filter((b) => b.event.car)

/** A career with this car job in hand. */
function onJob(id: string, promise: number, fee = 100000): CareerState {
  const b = briefTemplate(id)!
  return { ...newCareer(3), job: { brief: { id, fee, days: b.days, seed: 41 }, promise, startDay: 0, daysLeft: b.days, spent: 0 } }
}

/** A well-sorted car of each class: lower and sealed, more wing, the balance in the window, inside the rules. */
const GOOD: Record<'touring' | 'open', CarDesign> = {
  touring: { ...STOCK_CAR.touring, ride: { front: 0.05, rear: 0.055 }, frontWing: 15, rearWing: { angle: 21, chord: 0.24 }, diffuser: 11, floorEdge: 1 },
  open: { ...STOCK_CAR.open, ride: { front: 0.045, rear: 0.06 }, frontWing: 18, rearWing: { angle: 24, chord: 0.32 }, diffuser: 14, floorEdge: 1 },
}

const setupOf = (id: string) => briefTemplate(id)!.setup as CarDesign
const pointsOf = (s: number) => s / CAR_JOBS.pointSeconds

afterEach(() => {
  CAR_JOBS.open = false
})

describe('car briefs', () => {
  it('are a small touring team, a touring team that understeers and a single-seater that porpoises', () => {
    expect(carBriefs.map((b) => b.id)).toEqual(['belan-sport', 'granit-touring', 'iskra-open'])
    for (const b of carBriefs) {
      expect(isCarBrief(b.id)).toBe(true)
      const circuit = carEventOf(b)!.circuit
      // The brief card's air is the circuit's own usual day.
      expect([b.event.temperature, b.event.altitude]).toEqual([circuit.temperature, circuit.altitude])
      // The team's car passes scrutineering as it is.
      expect(checkCarRules(b.setup as CarDesign)).toEqual([])
    }
    expect(setupOf('iskra-open').class).toBe('open')
    expect(carEventOf(briefTemplate('granit-touring')!)!.circuit).toBe(CIRCUITS['dolgo-ring'])
    expect(isCarBrief('kovyl-haulage')).toBe(false)
    expect(carEventOf(briefTemplate('kovyl-haulage')!)).toBeNull()
  })

  it('stay off the board until the switch opens them, then come with the firm’s name', () => {
    for (const b of carBriefs) expect(openTo(b, 100)).toBe(false)
    for (let round = 0; round < 30; round++) expect(boardFor(1, round, false, 100).some((b) => isCarBrief(b.id))).toBe(false)
    CAR_JOBS.open = true
    expect(openTo(briefTemplate('belan-sport')!, 20)).toBe(true)
    expect(openTo(briefTemplate('iskra-open')!, 20)).toBe(false)
    expect(openTo(briefTemplate('iskra-open')!, 60)).toBe(true)
    let offered = false
    for (let round = 0; round < 40; round++) offered ||= boardFor(1, round, false, 100).some((b) => isCarBrief(b.id))
    expect(offered).toBe(true)
  })

  it('ask for a gain a well-sorted car makes with room to spare', () => {
    for (const b of carBriefs) {
      const setup = b.setup as CarDesign
      const circuit = carEventOf(b)!.circuit
      const gain = pointsOf(lapTime(setup, circuit).time - lapTime(GOOD[setup.class], circuit).time)
      expect(gain).toBeGreaterThan(b.target + 2)
    }
  })

  it('bring their own trouble: the Granit car outside the balance window, the Iskra car porpoising', () => {
    const granit = setupOf('granit-touring')
    const dolgo = CIRCUITS['dolgo-ring']
    expect(lapTroubles(granit, dolgo).balance).toBeGreaterThan(0.1)
    const iskra = setupOf('iskra-open')
    const park = CIRCUITS['stavren-park']
    expect(lapTime(iskra, park).porpoise).not.toBeNull()
    expect(lapTroubles(iskra, park).porpoise).toBeGreaterThan(0)
    // The well-sorted car has neither.
    expect(lapTroubles(GOOD.touring, dolgo)).toEqual({ porpoise: 0, balance: 0, heat: 0 })
  })

  it('take bids in tenths of a second', () => {
    expect(clampBid('granit-touring', { price: 130000, promise: 7.4 }).promise).toBe(7)
    expect(clampBid('granit-touring', { price: 130000, promise: 7.6 }).promise).toBe(8)
  })

  it('race the Dolgo Ring against a middling car between jobs, the team’s own car on a job', () => {
    const idle = newCareer(1)
    expect(currentCarRun(idle, 'open')).toEqual({ circuit: PRACTICE_CIRCUIT.circuit, old: STOCK_CAR.open })
    const job = onJob('iskra-open', 14)
    expect(currentCarRun(job, 'open')).toEqual({ circuit: CIRCUITS['stavren-park'], old: setupOf('iskra-open') })
    // A car of the other class keeps a middling one to beat.
    expect(currentCarRun(job, 'touring').old).toBe(STOCK_CAR.touring)
  })
})

describe('lap troubles', () => {
  it('take one trouble away at a time', () => {
    const park = CIRCUITS['stavren-park']
    const iskra = setupOf('iskra-open')
    expect(lapWith(iskra, park, { porpoise: true }).porpoise).toBeNull()
    // A hot engine: the same aero, more power with a wider inlet.
    const hot: CarDesign = { ...GOOD.open, inlet: 0.45 }
    expect(lapTime(hot, park).heat).toBeGreaterThan(0)
    expect(lapWith(hot, park, { heat: true }).heat).toBe(0)
    expect(lapTroubles(hot, park).heat).toBeGreaterThan(0)
  })
})

describe('race weekend for a car', () => {
  it('turns a lap time back into the downforce that gives it', () => {
    const park = CIRCUITS['stavren-park']
    const car = GOOD.open
    expect(downScaleForLap(lapTime(car, park).time, car, park)).toBeCloseTo(1, 3)
    const keen = lapTime(car, park, park.temperature, { down: 1.1, drag: 1 }).time
    expect(downScaleForLap(keen, car, park)).toBeCloseTo(1.1, 3)
  })

  it('keeps a promise the car makes, and a good read is the exact lap', () => {
    const state = onJob('granit-touring', 8)
    const dolgo = CIRCUITS['dolgo-ring']
    const out = deliverCar(state, GOOD.touring, lapTime(GOOD.touring, dolgo).time)!
    expect(out.debrief.met).toBe(true)
    expect(out.debrief.penalty).toBe(0)
    expect(out.paid).toBe(100000)
    expect(out.debrief.cause).toBeNull()
    expect(Math.abs(out.debrief.readError)).toBeLessThan(0.001)
    expect(out.debrief.read).toBe('good')
    expect(out.debrief.actualClA).toBeCloseTo(carAero(GOOD.touring, CAR_DESK.readSpeed, circuitDensity(dolgo)).clA, 9)
    // Its balance trouble is gone, so the debrief has none to show.
    expect(out.debrief.balance).toBeNull()
    expect(out.state.job).toBeNull()
    expect(out.state.history.at(-1)).toMatchObject({ id: 'granit-touring', promised: 8 })
  })

  it('docks the fee when the old car comes back, and names its balance', () => {
    const out = deliverCar(onJob('granit-touring', 8), setupOf('granit-touring'), 99)!
    expect(out.debrief.achieved).toBeCloseTo(0, 9)
    expect(out.debrief.met).toBe(false)
    expect(out.debrief.penalty).toBe(Math.round((100000 * Math.min(PROMISE.maxShare, (8 - PROMISE.allowance) * PROMISE.perPoint)) / 100) * 100)
    expect(out.debrief.balance).toMatchObject({ fix: 'frontWing' })
    expect(out.debrief.balance!.balance).toBeLessThan(out.debrief.balance!.low)
  })

  it('judges the read on downforce: a lap declared a second quick is a poor read', () => {
    const park = CIRCUITS['stavren-park']
    const out = deliverCar(onJob('iskra-open', 14), GOOD.open, lapTime(GOOD.open, park).time - 1)!
    expect(out.debrief.readError).toBeGreaterThan(0.04)
    expect(out.debrief.read).not.toBe('good')
  })

  it('lets the scrutineers trim an illegal car, and judges the trimmed one', () => {
    const park = CIRCUITS['stavren-park']
    const wide: CarDesign = { ...GOOD.open, rearWing: { angle: 24, chord: 0.46 } }
    const out = deliverCar(onJob('iskra-open', 14), wide, 59)!
    expect(out.debrief.cutBack.map((c) => c.rule)).toEqual(['chord'])
    expect(out.debrief.actual).toBeCloseTo(lapTime(scrutineered(wide), park).time, 9)
  })

  it('blames the rules when the car as drawn would have kept the promise', () => {
    const park = CIRCUITS['stavren-park']
    const old = setupOf('iskra-open')
    // A rear wing past the chord limit: quicker as drawn, slower once the scrutineers trim it.
    const wide: CarDesign = { ...GOOD.open, rearWing: { angle: 24, chord: 0.5 } }
    const drawn = pointsOf(lapTime(old, park).time - lapTime(wide, park).time)
    const legal = pointsOf(lapTime(old, park).time - lapTime(scrutineered(wide), park).time)
    expect(drawn).toBeGreaterThan(legal + 1)
    // Promise what only the illegal car makes.
    const promise = Math.floor(drawn - PROMISE.allowance)
    const out = deliverCar(onJob('iskra-open', promise), wide, 59)!
    expect(out.debrief.met).toBe(false)
    expect(out.debrief.cause).toBe('rules')
  })

  it('blames the porpoising when the car would have kept the promise without it', () => {
    const park = CIRCUITS['stavren-park']
    const old = setupOf('iskra-open')
    const bouncy: CarDesign = { ...GOOD.open, ride: { front: 0.03, rear: 0.045 } }
    const lap = lapTime(bouncy, park)
    expect(lap.porpoise).not.toBeNull()
    const lost = lapTroubles(bouncy, park).porpoise
    const gain = pointsOf(lapTime(old, park).time - lap.time)
    // A promise inside the gain without the bouncing and past the gain with it.
    expect(pointsOf(lost)).toBeGreaterThan(2)
    const promise = Math.floor(gain + pointsOf(lost) - PROMISE.allowance)
    const out = deliverCar(onJob('iskra-open', promise), bouncy, 60)!
    expect(out.debrief.met).toBe(false)
    expect(out.debrief.cause).toBe('porpoise')
    expect(out.debrief.porpoise).toMatchObject({ fix: 'rideHeight' })
    expect(out.debrief.porpoise!.speed).toBeCloseTo(lap.porpoise!, 9)
  })

  it('races both cars on the same seeded race day', () => {
    const state = onJob('belan-sport', 3)
    const out = deliverCar(state, GOOD.touring, 72)!
    const air = raceDayAir(carEventOf(state.job!.brief)!, daySeed(state.job!.brief))
    expect(out.debrief.day).toEqual(air)
    const park = CIRCUITS['stavren-park']
    expect(out.debrief.lap.time).toBeCloseTo(lapTime(GOOD.touring, park, air.temperature).time, 9)
    expect(out.debrief.baselineLap.time).toBeCloseTo(lapTime(setupOf('belan-sport'), park, air.temperature).time, 9)
    // A different seed brings different air.
    expect(raceDayAir(carEventOf(state.job!.brief)!, 7).temperature).not.toBeCloseTo(air.temperature, 3)
  })

  it('won’t deliver a car of the wrong class, a car to another job, or a car to no job', () => {
    expect(deliverCar(onJob('iskra-open', 14), GOOD.touring, 60)).toBeNull()
    expect(deliverCar(onJob('kovyl-haulage', 10), GOOD.touring, 60)).toBeNull()
    expect(deliverCar(newCareer(1), GOOD.touring, 60)).toBeNull()
  })

  it('counts a car’s best job in seconds on the legacy card', () => {
    const out = deliverCar(onJob('granit-touring', 8), GOOD.touring, 98.5)!
    const best = legacyOf(out.state).best!
    expect(best.unit).toBe('s')
    expect(best.cut).toBeCloseTo(out.debrief.achieved * CAR_JOBS.pointSeconds, 9)
  })
})
