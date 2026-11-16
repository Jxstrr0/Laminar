import { describe, expect, it } from 'vitest'
import { DEFAULT_JUMPER, type JumperDesign } from '../src/data/jumper'
import { HILLS, PRACTICE_JUMP } from '../src/data/hills'
import { JUMP_REPLAY } from '../src/data/replay'
import { groundAt, hillSurface, jumpDay, xAtAlong, type JumpEvent } from '../src/sim/jumper'
import { frameAt, jumpDuration, jumpNotes, jumpPath } from '../src/sim/jumpReplay'

const jumper = (leanDeg: number, vAngleDeg: number, bagginess: number): JumperDesign => ({ sport: 'skijump', posture: { leanDeg, vAngleDeg }, suit: { bagginess } })
const still = (e: JumpEvent): JumpEvent => ({ ...e, spread: { temperature: 0, wind: 0, speed: 0 } })

describe('the jump replay', () => {
  it('finds a place on the hill by its distance along the slope', () => {
    const surface = hillSurface(HILLS.normal)
    for (const s of [10, 45.5, 90, 98]) expect(groundAt(surface, xAtAlong(surface, s)).s).toBeCloseTo(s, 6)
    expect(xAtAlong(surface, 0)).toBe(0)
  })

  it('follows the flight and touches down at the measured distance', () => {
    const day = jumpDay(DEFAULT_JUMPER, still(PRACTICE_JUMP), 1)
    const path = jumpPath(day, PRACTICE_JUMP.hill)
    const surface = hillSurface(PRACTICE_JUMP.hill)
    const first = path.frames[0]!
    expect(first.x).toBe(0)
    expect(first.y).toBe(0)
    const touch = path.frames[path.frames.length - 2]!
    expect(groundAt(surface, touch.x).s).toBeCloseTo(day.distance, 2)
    expect(touch.y).toBeCloseTo(groundAt(surface, touch.x).y, 6)
    expect(path.landAt).toBeCloseTo(touch.t, 9)
    // Time runs forward; the body lies out above the path in the air.
    for (let i = 1; i < path.frames.length; i++) expect(path.frames[i]!.t).toBeGreaterThanOrEqual(path.frames[i - 1]!.t)
    const mid = frameAt(path, path.landAt / 2)
    expect(mid.landed).toBe(false)
    expect(mid.y).toBeGreaterThan(groundAt(surface, mid.x).y)
    expect(mid.along).toBeGreaterThan(0)
    expect(mid.along).toBeLessThan(day.distance)
    // On the snow it holds at the mark, skis down the slope.
    const after = frameAt(path, path.landAt + 0.5)
    expect(after.landed).toBe(true)
    expect(after.along).toBeCloseTo(day.distance, 9)
    expect(after.pitchDeg).toBeLessThan(0)
  })

  it('brings a bail-out down at the hill size', () => {
    const ev = still({ hill: HILLS.large, mass: 63, temperature: -9, altitude: 640, headwind: 0, spread: { temperature: 0, wind: 0, speed: 0 } })
    const day = jumpDay(jumper(6, 40, 0.2), ev, 1)
    expect(day.trouble).toBe('long')
    const path = jumpPath(day, HILLS.large)
    const surface = hillSurface(HILLS.large)
    const touch = path.frames[path.frames.length - 2]!
    expect(groundAt(surface, touch.x).s).toBeCloseTo(HILLS.large.hs, 2)
    expect(path.landAt).toBeLessThan(day.flight.time)
    // Before the bend it is the flight itself, untouched.
    const early = path.frames.find((f) => f.t > 1)!
    const flown = day.flight.track.find((p) => p.t === early.t)!
    expect(early.y).toBe(flown.y)
    const notes = jumpNotes(day, path, path)
    expect(notes.map((n) => n.kind)).toEqual(['off', 'settled', 'long', 'land'])
    expect(notes.at(-1)).toMatchObject({ kind: 'land', distance: HILLS.large.hs, gap: 0 })
  })

  it('calls a pitch-forward and runs to the later landing', () => {
    const wild = jumper(12, 34, 1)
    const day = jumpDay(wild, still(PRACTICE_JUMP), 1)
    const base = jumpDay(DEFAULT_JUMPER, still(PRACTICE_JUMP), 1)
    const mine = jumpPath(day, PRACTICE_JUMP.hill)
    const old = jumpPath(base, PRACTICE_JUMP.hill)
    expect(day.flight.pitchedAt).not.toBeNull()
    expect(jumpNotes(day, mine, old).some((n) => n.kind === 'pitch')).toBe(true)
    expect(jumpDuration(mine, old)).toBeCloseTo(Math.max(mine.landAt, old.landAt) + JUMP_REPLAY.hold, 9)
  })
})
