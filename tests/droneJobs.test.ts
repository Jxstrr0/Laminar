import { describe, expect, it } from 'vitest'
import { BRIEFS, DRONE_JOBS } from '../src/data/briefs'
import { DRONE_CLASS, DRONE_COURSES, STOCK_DRONE, type DroneDesign } from '../src/data/drone'
import {
  briefTemplate,
  clampBid,
  currentDroneRun,
  daySeed,
  deliverDrone,
  droneEventOf,
  isDroneBrief,
  newCareer,
  openTo,
  type CareerState,
} from '../src/sim/career'
import { droneRace } from '../src/sim/drone'
import { dragScaleForTime, droneDayAir, heatCost, PRACTICE_COURSE, raceDragArea } from '../src/sim/droneJob'
import { newLab } from '../src/sim/lab'
import { readOf } from '../src/sim/reputation'

const droneBriefs = BRIEFS.filter((b) => b.event.drone)
const course = DRONE_COURSES.lugovoy

/** A career with this quad job in hand. */
function onJob(id: string, promise: number, fee = 50000): CareerState {
  const b = briefTemplate(id)!
  return { ...newCareer(3), job: { brief: { id, fee, days: b.days, seed: 41 }, promise, startDay: 0, daysLeft: b.days, spent: 0 } }
}

/** The sorted club racer: a short pod raked to the racing tilt, the vents it needs, arms faired. */
const GOOD: DroneDesign = { ...STOCK_DRONE.racer, pod: { length: 0.12, rake: 70, vents: DRONE_CLASS.racer.coolNeed }, arms: 1 }
/** Strizh's trap: their long pod raked right up, with faired arms. It tumbles braking for a corner. */
const TUMBLES: DroneDesign = { ...GOOD, pod: { ...GOOD.pod, length: 0.18 } }
/** Fast, but with the vents taped over: the speed controllers overheat. */
const HOT: DroneDesign = { ...GOOD, pod: { ...GOOD.pod, vents: 0.1 } }

describe('quad briefs (PR 10f)', () => {
  it('are hobby pilots early in a career, at the Lugovoy meadow, each flying a quad that finishes', () => {
    expect(droneBriefs.map((b) => b.id)).toEqual(['shmel-quad', 'vertel-quad', 'strizh-quad'])
    for (const b of droneBriefs) {
      expect(isDroneBrief(b.id)).toBe(true)
      expect(b.minRep ?? 0).toBeLessThanOrEqual(20)
      expect(b.fee.max).toBeLessThanOrEqual(80000)
      expect(droneEventOf({ id: b.id })!.course).toBe(course)
      // Their quad finishes, and a sorted one beats it by more than the ask.
      const theirs = droneRace(b.setup as DroneDesign, course).time!
      expect(theirs).toBeGreaterThan(0)
      expect((theirs - droneRace(GOOD, course).time!) / DRONE_JOBS.pointSeconds).toBeGreaterThan(b.target)
    }
    expect(isDroneBrief('selivan-regional')).toBe(false)
  })

  it('stay off the board until it can show them, and bid a tenth of a second at a time', () => {
    expect(DRONE_JOBS.open).toBe(false)
    for (const b of droneBriefs) expect(openTo(b, 100)).toBe(false)
    expect(clampBid('shmel-quad', { price: 40000, promise: 12.4 }).promise).toBe(12)
  })

  it('race the job’s quad against the pilot’s own, or a club racer between jobs', () => {
    expect(currentDroneRun(newCareer(3), 'racer').old).toEqual(STOCK_DRONE.racer)
    expect(currentDroneRun(onJob('vertel-quad', 15), 'racer').old).toEqual(briefTemplate('vertel-quad')!.setup)
    expect(PRACTICE_COURSE.course).toBe(course)
    // A job's model is full size.
    expect(newLab(briefTemplate('strizh-quad')!.setup).order.scale).toBe(1)
  })

  it('Inna’s taped vents cost her the second half of the race; Strizh’s long pod tumbles once it’s raked up and faired', () => {
    const vertel = briefTemplate('vertel-quad')!.setup as DroneDesign
    expect(droneRace(vertel, course).hotAt).not.toBeNull()
    expect(heatCost(vertel, course)).toBeGreaterThan(0.5)
    expect(heatCost(GOOD, course)).toBe(0)
    const race = droneRace(TUMBLES, course)
    expect(race.time).toBeNull()
    expect(race.twist.braking).toBe(true)
  })
})

describe('delivering a quad', () => {
  it('judges the promise on the usual day’s race, and the read on drag', () => {
    const job = onJob('shmel-quad', 12)
    const truth = droneRace(GOOD, course).time!
    const d = deliverDrone(job, GOOD, truth)!
    const baseline = droneRace(STOCK_DRONE.racer, course).time!
    expect(d.debrief.achieved).toBeCloseTo((baseline - truth) / DRONE_JOBS.pointSeconds, 6)
    expect(d.debrief.met).toBe(true)
    expect(d.debrief.cause).toBeNull()
    // Declaring the true time reads the drag true.
    expect(Math.abs(d.debrief.readError)).toBeLessThan(0.01)
    expect(d.debrief.read).toBe(readOf(d.debrief.readError))
    // Declaring it a second fast is reading the drag low.
    expect(deliverDrone(job, GOOD, truth - 1)!.debrief.readError).toBeLessThan(-0.05)
    // Race day is seeded: the same air for both quads.
    expect(d.debrief.day).toEqual(droneDayAir(d.event, daySeed(job.job!.brief)))
    expect(d.debrief.race.time).not.toBeNull()
    expect(d.debrief.baselineRace.time).not.toBeNull()
  })

  it('a quad that tumbles crashes out and gains nothing, and the debrief says where', () => {
    const d = deliverDrone(onJob('strizh-quad', 10), TUMBLES, 55)!
    expect(d.debrief.actual).toBeNull()
    expect(d.debrief.achieved).toBe(0)
    expect(d.debrief.met).toBe(false)
    expect(d.debrief.cause).toBe('tumble')
    expect(d.debrief.tumble).toMatchObject({ braking: true, fix: 'podRake' })
    expect(d.debrief.tumble!.speed).toBeGreaterThan(100)
  })

  it('names the overheating when it alone cost the promise', () => {
    const lost = heatCost(HOT, course)
    const hotTime = droneRace(HOT, course).time!
    const baseline = droneRace(STOCK_DRONE.racer, course).time!
    // A promise the cool quad keeps but the hot one doesn't.
    const promise = Math.round((baseline - hotTime + lost / 2) / DRONE_JOBS.pointSeconds)
    const d = deliverDrone(onJob('shmel-quad', promise), HOT, hotTime)!
    expect(d.debrief.met).toBe(false)
    expect(d.debrief.cause).toBe('heat')
    expect(d.debrief.heat).toMatchObject({ fix: 'podVents', at: DRONE_CLASS.racer.heatAfter })
    expect(d.debrief.heat!.lost).toBeCloseTo(lost, 9)
  })

  it('turns a declared time back into drag, and refuses anything but a quad job', () => {
    const t = droneRace(GOOD, course).time!
    expect(dragScaleForTime(t, GOOD, course)).toBeCloseTo(1, 3)
    expect(dragScaleForTime(t + 1, GOOD, course)).toBeGreaterThan(1)
    expect(raceDragArea(GOOD, course)).toBeLessThan(raceDragArea(STOCK_DRONE.racer, course))
    expect(deliverDrone(newCareer(3), GOOD, t)).toBeNull()
    expect(deliverDrone(onJob('selivan-regional', 5), GOOD, t)).toBeNull()
  })
})
