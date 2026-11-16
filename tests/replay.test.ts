import { describe, expect, it } from 'vitest'
import { BRIEFS, TRACK } from '../src/data/briefs'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { eventOf, newCareer, daySeed } from '../src/sim/career'
import { riderEvent } from '../src/sim/cyclist'
import { cyclistShape } from '../src/sim/geom/cyclist'
import { gapAt, replayNotes, rideTime, timeAt, trackAt, turnAngle, windFeel, type Ride } from '../src/sim/replay'
import { fieldResult } from '../src/sim/views'
import { designEvent, designShape } from '../src/sim/design'

function rides() {
  const brief = newCareer(5).board[0]!
  const t = BRIEFS.find((b) => b.id === brief.id)!
  const event = eventOf(brief)
  const seed = daySeed(brief)
  const mine = fieldResult(cyclistShape(DEFAULT_CYCLIST), riderEvent(DEFAULT_CYCLIST, event), seed)
  const old = fieldResult(designShape(t.setup), designEvent(t.setup, event), seed)
  return { mine: { course: event.course, segments: mine.segments } as Ride, old: { course: event.course, segments: old.segments } as Ride, mine$: mine, old$: old }
}

describe('the race replay', () => {
  it('follows the course: out, turn, back to the start', () => {
    const { mine, mine$ } = rides()
    expect(rideTime(mine)).toBeCloseTo(mine$.time, 6)
    const start = trackAt(mine, 0)
    expect(start.distance).toBe(0)
    const turn = trackAt(mine, mine.segments[0]!.time)
    expect(turn.distance).toBeCloseTo(mine.course[0]!.length, 3)
    const end = trackAt(mine, rideTime(mine) + 10)
    expect(end.done).toBe(true)
    expect(end.distance).toBeCloseTo(mine$.distance, 6)
    // Out and back: the finish is where it started.
    expect(Math.hypot(end.x, end.z)).toBeLessThan(1e-6)
    expect(timeAt(mine, mine.course[0]!.length / 2)).toBeCloseTo(mine.segments[0]!.time / 2, 6)
  })

  it('shows the gap to the old setup, ending on the real time saved', () => {
    const { mine, old, mine$, old$ } = rides()
    expect(gapAt(mine, old, 0)).toBeCloseTo(0, 6)
    expect(gapAt(mine, old, rideTime(mine))).toBeCloseTo(old$.time - mine$.time, 6)
    expect(gapAt(mine, old, rideTime(mine) / 2)).toBeGreaterThan(0)
  })

  it('names the wind and the moments worth a line', () => {
    expect(turnAngle(350, 10)).toBe(20)
    expect(windFeel(0, 20)).toBe('head')
    expect(windFeel(0, 90)).toBe('cross')
    expect(windFeel(90, 250)).toBe('tail')
    const { mine, old, mine$ } = rides()
    const notes = replayNotes(mine, old, { windFromDeg: mine$.windFromDeg, calm: false })
    expect(new Set(notes.map((n) => n.kind))).toEqual(new Set(['start', 'half', 'turn', 'meet', 'finish']))
    expect(notes[0]!.kind).toBe('start')
    expect(notes[notes.length - 1]!.kind).toBe('finish')
    expect(notes.some((n) => n.kind === 'turn')).toBe(true)
    expect(notes.some((n) => n.kind === 'meet')).toBe(true)
    for (let i = 1; i < notes.length; i++) expect(notes[i]!.t).toBeGreaterThanOrEqual(notes[i - 1]!.t)
  })

  it('rides laps of the indoor track and rings the bell', () => {
    const brief = { id: 'vesnina-pursuit', fee: 120000, days: 18, seed: 77 }
    const t = BRIEFS.find((b) => b.id === brief.id)!
    const event = eventOf(brief)
    expect(event.windSpeed).toBe(0)
    const seed = daySeed(brief)
    const mine$ = fieldResult(cyclistShape(DEFAULT_CYCLIST), riderEvent(DEFAULT_CYCLIST, event), seed)
    const old$ = fieldResult(designShape(t.setup), designEvent(t.setup, event), seed)
    expect(mine$.windSpeed).toBe(0)
    const mine: Ride = { course: event.course, segments: mine$.segments }
    const old: Ride = { course: event.course, segments: old$.segments }
    expect(mine$.distance).toBeCloseTo(4000, 6)
    // Every lap comes back to the start line.
    const lapTime = timeAt(mine, TRACK.lap)
    const back = trackAt(mine, lapTime)
    expect(Math.hypot(back.x, back.z)).toBeLessThan(1e-6)
    const notes = replayNotes(mine, old, { windFromDeg: mine$.windFromDeg, calm: true, lap: TRACK.lap })
    expect(notes.map((n) => n.kind)).toEqual(['start', 'half', 'bell', 'finish'])
    expect(notes[0]).toMatchObject({ kind: 'start', wind: null })
    expect(notes[2]!.t).toBeCloseTo(timeAt(mine, 4000 - TRACK.lap), 6)
  })
})
