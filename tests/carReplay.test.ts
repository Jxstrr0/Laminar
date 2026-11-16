import { describe, expect, it } from 'vitest'
import { STOCK_CAR, type CarDesign } from '../src/data/car'
import { CIRCUITS, lapLength } from '../src/data/circuits'
import { CAR_REPLAY } from '../src/data/replay'
import { lapTime } from '../src/sim/car'
import { carDuration, carNotes, carRide, circuitCourse } from '../src/sim/carReplay'
import { trackAt } from '../src/sim/replay'

const park = CIRCUITS['stavren-park']
const dolgo = CIRCUITS['dolgo-ring']
const GOOD: CarDesign = { ...STOCK_CAR.open, ride: { front: 0.045, rear: 0.06 }, frontWing: 18, rearWing: { angle: 24, chord: 0.32 }, diffuser: 14, floorEdge: 1 }
const BOUNCY: CarDesign = { ...GOOD, ride: { front: 0.03, rear: 0.045 } }

describe('the circuit as a replay course', () => {
  it('is the whole lap, in short pieces', () => {
    for (const circuit of [park, dolgo]) {
      const course = circuitCourse(circuit)
      expect(course.reduce((s, c) => s + c.length, 0)).toBeCloseTo(lapLength(circuit), 6)
      for (const c of course) {
        expect(c.length).toBeLessThanOrEqual(CAR_REPLAY.piece + 1e-9 + Math.PI * 200 * (CAR_REPLAY.cornerStep / 180))
        expect(c.heading).toBeGreaterThanOrEqual(0)
        expect(c.heading).toBeLessThan(360)
      }
    }
  })

  it('turns right round a right-hand corner', () => {
    // Stavren Park starts with a straight, then a right turn: the heading grows.
    const course = circuitCourse(park)
    const firstTurn = course.findIndex((c) => c.heading !== 0)
    expect(course[firstTurn]!.heading).toBeGreaterThan(0)
    expect(course[firstTurn]!.heading).toBeLessThan(90)
  })
})

describe('a lap as a ride', () => {
  it('takes the lap’s own time, and never beats its top speed', () => {
    for (const [circuit, car] of [
      [park, GOOD],
      [dolgo, STOCK_CAR.touring],
    ] as const) {
      const lap = lapTime(car, circuit)
      const ride = carRide(circuit, lap)
      const total = ride.segments.reduce((s, x) => s + x.time, 0)
      expect(total).toBeCloseTo(lap.time, 6)
      for (const s of ride.segments) expect(s.speed).toBeLessThanOrEqual(lap.top + 0.5)
      // The slowest piece is about the slowest corner's speed.
      const slowest = Math.min(...ride.segments.map((s) => s.speed))
      expect(slowest).toBeLessThan(Math.min(...lap.corners.map((c) => c.speed)) + 3)
      // At the finish the car is across the line.
      expect(trackAt(ride, lap.time + 0.01).done).toBe(true)
    }
  })

  it('bounces only where a porpoising car runs at its porpoising speed', () => {
    const goodLap = lapTime(STOCK_CAR.open, park)
    expect(goodLap.porpoise).toBeNull()
    expect(carRide(park, goodLap).segments.every((s) => s.eased === 0)).toBe(true)
    const lap = lapTime(BOUNCY, park)
    expect(lap.porpoise).not.toBeNull()
    const bouncing = carRide(park, lap).segments.filter((s) => s.eased > 0)
    expect(bouncing.length).toBeGreaterThan(0)
    for (const s of bouncing) expect(s.speed).toBeGreaterThanOrEqual(lap.porpoise! - 1)
  })
})

describe('the lap’s commentary', () => {
  it('starts on the line, ends at your lap, and names the slowest corner', () => {
    const mine = lapTime(GOOD, park)
    const old = lapTime(STOCK_CAR.open, park)
    const notes = carNotes(park, mine, old)
    expect(notes[0]!.kind).toBe('start')
    const last = notes.at(-1)!
    expect(last).toMatchObject({ kind: 'finish', time: mine.time, oldTime: old.time })
    const slow = notes.find((n) => n.kind === 'slowest')!
    expect(slow.kind === 'slowest' && slow.speed).toBeCloseTo(Math.min(...mine.corners.map((c) => c.speed)), 9)
    for (let i = 1; i < notes.length; i++) expect(notes[i]!.t).toBeGreaterThanOrEqual(notes[i - 1]!.t)
    expect(carDuration(mine, old)).toBe(Math.max(mine.time, old.time))
  })

  it('calls the porpoising when it starts', () => {
    const lap = lapTime(BOUNCY, park)
    const notes = carNotes(park, lap, lapTime(STOCK_CAR.open, park))
    expect(notes.find((n) => n.kind === 'porpoise')).toMatchObject({ speed: lap.porpoise })
    expect(carNotes(park, lapTime(STOCK_CAR.open, park), lapTime(STOCK_CAR.open, park)).some((n) => n.kind === 'porpoise')).toBe(false)
  })
})
