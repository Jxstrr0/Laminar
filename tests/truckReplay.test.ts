import { describe, expect, it } from 'vitest'
import { ROUTES } from '../src/data/routes'
import { TRUCK_REPLAY } from '../src/data/replay'
import { DEFAULT_TRUCK, FLEET_TRUCK } from '../src/data/truck'
import { trackAt } from '../src/sim/replay'
import { fuelRun } from '../src/sim/truck'
import { litresAt, truckCourse, truckDuration, truckNotes, truckRide } from '../src/sim/truckReplay'

const mostograd = ROUTES['stavren-mostograd']
const coast = ROUTES['kosa-coast']
const day = { temperature: 12, windSpeed: 7, windFromDeg: 80 }

describe('the fuel-run replay', () => {
  it('drives the route leg by leg and arrives when the run says', () => {
    const run = fuelRun(DEFAULT_TRUCK, mostograd, day)
    const ride = truckRide(mostograd, run)
    expect(truckCourse(mostograd).map((s) => s.heading)).toEqual(mostograd.legs.map((l) => l.heading))
    const end = trackAt(ride, run.time)
    expect(end.done).toBe(true)
    expect(end.distance).toBeCloseTo(run.distance, 6)
    // Halfway down the first leg.
    const mid = trackAt(ride, run.legs[0]!.time / 2)
    expect(mid.distance).toBeCloseTo(mostograd.legs[0]!.length / 2, 6)
    expect(mid.yawDeg).toBe(run.legs[0]!.yawDeg)
  })

  it('counts the litres as they burn', () => {
    const run = fuelRun(DEFAULT_TRUCK, mostograd, day)
    expect(litresAt(run, 0)).toBe(0)
    expect(litresAt(run, run.legs[0]!.time / 2)).toBeCloseTo(run.legs[0]!.litres / 2, 9)
    expect(litresAt(run, run.time)).toBeCloseTo(run.litres, 9)
    expect(litresAt(run, run.time + 100)).toBeCloseTo(run.litres, 9)
  })

  it('plays until the later truck arrives', () => {
    const mine = fuelRun(DEFAULT_TRUCK, mostograd, day)
    const old = fuelRun(FLEET_TRUCK, mostograd, day)
    expect(truckDuration(mine, old)).toBe(Math.max(mine.time, old.time))
  })

  it('has the commentator call the start, the windiest stretch, a slow climb and the arrival, in order', () => {
    const mine = fuelRun(DEFAULT_TRUCK, coast, { temperature: 14, windSpeed: 9, windFromDeg: 270 })
    const old = fuelRun(FLEET_TRUCK, coast, { temperature: 14, windSpeed: 9, windFromDeg: 270 })
    const notes = truckNotes(coast, mine, old, true)
    expect(notes[0]).toEqual({ t: 0, kind: 'start', cracked: true })
    const last = notes.at(-1)!
    expect(last.kind).toBe('finish')
    if (last.kind === 'finish') expect(last.saving).toBeCloseTo((1 - mine.litres / old.litres) * 100, 9)
    // A wind off the sea meets the coast road side-on: the windiest stretch gets a line, and the kit saves there.
    const cross = notes.find((n) => n.kind === 'cross')
    expect(cross).toBeDefined()
    if (cross?.kind === 'cross') {
      expect(cross.yawDeg).toBeGreaterThan(TRUCK_REPLAY.crossDeg)
      expect(cross.saving).toBeGreaterThan(0)
    }
    for (let i = 1; i < notes.length; i++) expect(notes[i]!.t).toBeGreaterThanOrEqual(notes[i - 1]!.t)
    // A climb line only where the truck really slows.
    const slow = mine.legs.some((l) => l.speed < coast.speed - TRUCK_REPLAY.slowBy)
    expect(notes.some((n) => n.kind === 'climb')).toBe(slow)
  })

  it('stays quiet about the wind on a still day', () => {
    const still = { temperature: 12, windSpeed: 0, windFromDeg: 0 }
    const notes = truckNotes(mostograd, fuelRun(DEFAULT_TRUCK, mostograd, still), fuelRun(FLEET_TRUCK, mostograd, still), false)
    expect(notes.some((n) => n.kind === 'cross')).toBe(false)
    expect(notes[0]).toEqual({ t: 0, kind: 'start', cracked: false })
  })
})
