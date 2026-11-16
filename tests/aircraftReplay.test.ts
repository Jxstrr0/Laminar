import { describe, expect, it } from 'vitest'
import { AIRFIELDS, STOCK_AIRCRAFT, type AircraftDesign } from '../src/data/aircraft'
import { AIRCRAFT_REPLAY as R, AIRFIELD_SCENE as S } from '../src/data/replay'
import { aircraftClMax, KMH, stallCheck } from '../src/sim/aircraft'
import { testFlight, usualTestDay } from '../src/sim/aircraftJob'
import {
  aircraftClips,
  aircraftFrames,
  aircraftNotes,
  aircraftPlayTime,
  aircraftShow,
  checkAirspeed,
  noseAngle,
  stopwatch,
} from '../src/sim/aircraftReplay'
import { clipClock } from '../src/sim/planeReplay'

const field = AIRFIELDS.belyanka
const STOCK = STOCK_AIRCRAFT.kit
const GOOD: AircraftDesign = { ...STOCK, spats: 1, cowling: 1, struts: { fairing: 1, toe: 2 }, pod: { fairing: 1, at: 0 } }
const TIPPED: AircraftDesign = { ...GOOD, wingtips: 1 }
const day = usualTestDay(field)
const show = (d: AircraftDesign) => aircraftShow(d, testFlight(d, field, day), testFlight(STOCK, field, day))

describe('the inspector’s stall check (PR 10v)', () => {
  it('slows the plane until the wing lets go at its stall speed, the nose coming up all the way', () => {
    const s = show(GOOD)
    expect(s.passes).toBe(true)
    expect(checkAirspeed(s, 0)).toBe(R.check.from)
    expect(checkAirspeed(s, s.stallAt)).toBeCloseTo(stallCheck(GOOD).stall, 9)
    // The nose rises as it slows, to the wing's stall angle at the stall.
    const early = aircraftFrames(s, 0).mine.pose.pitch
    const late = aircraftFrames(s, s.stallAt - 1e-6).mine.pose.pitch
    expect(late).toBeGreaterThan(early)
    expect(late).toBeCloseTo(aircraftClMax(GOOD) / 5, 4)
    expect(noseAngle(s, s.stall)).toBeCloseTo(aircraftClMax(GOOD) / 5, 9)
    // The wing lets go over the runway's middle, the nose dropping below level and a wing dipping, then it's level again.
    expect(aircraftFrames(s, s.stallAt).mine.point.x).toBeCloseTo(R.check.over, 6)
    const mid = aircraftFrames(s, s.stallAt + R.stallBreak.seconds / 3).mine.pose
    expect(mid.pitch).toBeLessThan(0)
    expect(mid.bank).toBeGreaterThan(0)
    const back = aircraftFrames(s, s.recovered).mine.pose
    expect(back.pitch).toBeCloseTo(0, 9)
    expect(back.height).toBeCloseTo(S.checkHeight - R.stallBreak.drop, 9)
    // Their plane isn't part of the check.
    expect(aircraftFrames(s, 1).old.visible).toBe(false)
  })

  it('a plane past the certified stall speed is parked, not flown, and the commentator says why', () => {
    const s = show(TIPPED)
    expect(s.passes).toBe(false)
    const parked = aircraftFrames(s, s.afterAt + 1)
    expect(parked.mine.pose.height).toBe(0)
    expect(parked.mine.point.z).toBeGreaterThan(S.runway.width / 2)
    expect(parked.old.visible).toBe(false)
    expect(stopwatch(s, true, s.end)).toBeNull()
    const notes = aircraftNotes(s)
    expect(notes.map((n) => n.kind)).toEqual(['check', 'break', 'grounded'])
    expect(notes[1]).toMatchObject({ passes: false, limit: 85 })
  })
})

describe('the timed passes', () => {
  it('fly both planes abreast from the run-in, each at its test-day cruise, timed over the measured kilometre', () => {
    const s = show(GOOD)
    const start = aircraftFrames(s, s.afterAt)
    expect(start.mine.point.x).toBe(-R.pass.runIn)
    expect(start.old.point.x).toBe(-R.pass.runIn)
    expect(start.old.visible).toBe(true)
    expect(start.mine.pose.height).toBe(S.passHeight)
    expect(s.mineSpeed * KMH).toBeCloseTo(testFlight(GOOD, field, day).cruise, 9)
    // The stopwatch starts at the first marker and stops at the second.
    expect(stopwatch(s, true, s.afterAt + 1)).toBeNull()
    const done = stopwatch(s, true, s.end)!
    expect(done.done).toBe(true)
    expect(done.time).toBeCloseTo(R.pass.course / s.mineSpeed, 9)
    expect((R.pass.course / done.time) * KMH).toBeCloseTo(testFlight(GOOD, field, day).cruise, 9)
    // The sorted plane is through first; theirs a couple of seconds behind.
    const cross = aircraftNotes(s).filter((n) => n.kind === 'cross')
    expect(cross.map((n) => n.kind === 'cross' && n.mine)).toEqual([true, false])
    expect(cross[0]).toMatchObject({ first: true })
    const gap = cross[1]!.kind === 'cross' ? cross[1]!.gap : 0
    expect(gap).toBeGreaterThan(1)
    expect(gap).toBeLessThan(4)
  })

  it('plays in clips: the slow-down quickly, the break as it happens, then a cut to the passes, under a minute in all', () => {
    const s = show(GOOD)
    const clips = aircraftClips(s)
    expect(clips).toHaveLength(3)
    expect(clips[1]!.rate).toBe(R.stallBreak.rate)
    expect(clips[2]!.from).toBe(s.afterAt)
    const play = aircraftPlayTime(clips)
    expect(play).toBeGreaterThan(20)
    expect(play).toBeLessThan(60)
    // The clock jumps the cut between the check and the passes.
    const breakEnd = (clips[0]!.to - clips[0]!.from) / clips[0]!.rate + (clips[1]!.to - clips[1]!.from) / clips[1]!.rate
    expect(clipClock(clips, breakEnd + 1e-6).time).toBeCloseTo(s.afterAt, 4)
    expect(aircraftNotes(s).every((n, i, all) => i === 0 || n.t >= all[i - 1]!.t)).toBe(true)
  })
})
