import { describe, expect, it } from 'vitest'
import { DRONE_CLASS, DRONE_COURSES, DRONE_RACE, STOCK_DRONE, type DroneDesign } from '../src/data/drone'
import { DRONE_REPLAY } from '../src/data/replay'
import { droneRace } from '../src/sim/drone'
import { droneClock, droneDuration, droneGates, dronePlayTime, droneLap, droneNotes, droneRide, lapAt, leanAt } from '../src/sim/droneReplay'
import { rideTime, trackAt } from '../src/sim/replay'

const course = DRONE_COURSES.lugovoy
const GOOD: DroneDesign = { ...STOCK_DRONE.racer, pod: { length: 0.12, rake: 70, vents: DRONE_CLASS.racer.coolNeed }, arms: 1 }
/** A long pod raked up and faired: it tumbles braking for a corner. */
const TUMBLES: DroneDesign = { ...GOOD, pod: { ...GOOD.pod, length: 0.18 } }
const lapLength = droneLap(course).reduce((s, p) => s + p.length, 0)

describe('the quad race replay (PR 10h)', () => {
  it('flies five laps in exactly the race’s time, round a lap that closes on itself', () => {
    const race = droneRace(GOOD, course)
    const ride = droneRide(course, race)
    expect(rideTime(ride)).toBeCloseTo(race.time!, 6)
    expect(ride.course.reduce((s, p) => s + p.length, 0)).toBeCloseTo(lapLength * DRONE_RACE.laps, 6)
    expect(ride.tumbledAt).toBeNull()
    expect(droneClock(ride, dronePlayTime(ride, ride))).toBeCloseTo(race.time!, 9)
    // Back over the start line after each lap: the gate course is a loop.
    const end = trackAt(ride, race.time! + 1)
    expect(end.done).toBe(true)
    expect(Math.hypot(end.x, end.z)).toBeLessThan(0.5)
    expect(lapAt(course, 0)).toBe(1)
    expect(lapAt(course, lapLength * 2.5)).toBe(3)
    expect(lapAt(course, lapLength * 9)).toBe(DRONE_RACE.laps)
    expect(droneGates(course)[0]).toBe(0)
  })

  it('leans forward pulling away, and back braking into a hairpin', () => {
    const race = droneRace(GOOD, course)
    const ride = droneRide(course, race)
    expect(leanAt(ride, 1)).toBeGreaterThan(0.3)
    expect(Math.min(...ride.tilts)).toBeLessThan(-0.3)
  })

  it('stops a tumbling quad where it tumbled, and runs on until the old one finishes', () => {
    const race = droneRace(TUMBLES, course)
    const old = droneRide(course, droneRace(STOCK_DRONE.racer, course))
    const ride = droneRide(course, race)
    expect(race.tumble).not.toBeNull()
    expect(ride.course.reduce((s, p) => s + p.length, 0)).toBeCloseTo(race.tumble!.at, 6)
    expect(ride.tumbledAt).toBeCloseTo(rideTime(ride), 9)
    // The replay ends a moment after it lands, and the tumble plays slowly.
    const end = ride.tumbledAt! + DRONE_REPLAY.tumble.seconds + DRONE_REPLAY.hold
    expect(droneDuration(ride, old)).toBeCloseTo(end, 9)
    expect(droneClock(ride, dronePlayTime(ride, old))).toBeCloseTo(end, 9)
    expect(dronePlayTime(ride, old)).toBeGreaterThan(end / DRONE_REPLAY.rate)
    const notes = droneNotes(race, droneRace(STOCK_DRONE.racer, course), ride, old)
    expect(notes.map((n) => n.kind)).toContain('tumble')
    expect(notes.at(-1)).toMatchObject({ kind: 'finish', time: null })
    // Braking for a corner: it was tipped back when it went.
    expect(ride.tilts.at(-1)!).toBeLessThan(0)
  })

  it('names the overheating where it happens', () => {
    const hot: DroneDesign = { ...GOOD, pod: { ...GOOD.pod, vents: 0.1 } }
    const race = droneRace(hot, course)
    const old = droneRace(STOCK_DRONE.racer, course)
    const notes = droneNotes(race, old, droneRide(course, race), droneRide(course, old))
    expect(notes.find((n) => n.kind === 'hot')?.t).toBe(DRONE_CLASS.racer.heatAfter)
    for (let i = 1; i < notes.length; i++) expect(notes[i]!.t).toBeGreaterThanOrEqual(notes[i - 1]!.t)
  })
})
