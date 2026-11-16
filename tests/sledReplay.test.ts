import { describe, expect, it } from 'vitest'
import { CLUB_BOBSLED, DEFAULT_BOBSLED, type BobsledDesign } from '../src/data/bobsled'
import { TRACKS } from '../src/data/tracks'
import { referenceRun } from '../src/sim/bobsled'
import { bankFor, curveNear, frameAt, pointAt, sledDuration, sledNotes, sledPath, timeAt, trackLine } from '../src/sim/sledReplay'
import { SLED_REPLAY } from '../src/data/replay'

const track = TRACKS.belogor
const line = trackLine(track)
const total = track.push.length + track.stretches.reduce((sum, st) => sum + st.length, 0)

describe('the bobsled replay', () => {
  it('lays the track out stretch by stretch, dropping as it goes', () => {
    expect(line.length).toBeCloseTo(total, 6)
    expect(line.s[line.s.length - 1]).toBeCloseTo(total, 6)
    // Every metre is a metre of track: the line's own steps add up to its length.
    let walked = 0
    for (let i = 1; i < line.s.length; i++) walked += Math.hypot(line.x[i]! - line.x[i - 1]!, line.z[i]! - line.z[i - 1]!)
    expect(walked).toBeGreaterThan(total * 0.99)
    expect(walked).toBeLessThanOrEqual(total + 1e-6)
    // The drop is each stretch's grade times its length.
    const drop = track.push.length * (track.push.grade / 100) + track.stretches.reduce((sum, st) => sum + (st.length * st.grade) / 100, 0)
    expect(-line.y[line.y.length - 1]!).toBeCloseTo(drop, 6)
    // The first curve turns right, the next left.
    const curves = track.stretches.filter((st) => st.radius > 0)
    const firstAt = track.push.length + track.stretches[0]!.length + 1
    expect(pointAt(line, firstAt).curve).toBeCloseTo(1 / curves[0]!.radius, 9)
    const secondAt = firstAt + track.stretches[1]!.length + track.stretches[2]!.length
    expect(pointAt(line, secondAt).curve).toBeCloseTo(-1 / curves[1]!.radius, 9)
  })

  it('throws a fast sled further up the outside wall', () => {
    expect(bankFor(30, 0)).toBe(0)
    expect(bankFor(30, 1 / 25)).toBeLessThan(0)
    expect(bankFor(30, -1 / 25)).toBeGreaterThan(0)
    expect(Math.abs(bankFor(35, 1 / 25))).toBeGreaterThan(Math.abs(bankFor(25, 1 / 25)))
    expect(Math.abs(bankFor(80, 1 / 10))).toBe(SLED_REPLAY.maxBankDeg)
    // Into a curve the wall comes up over a few metres, not all at once.
    const into = track.push.length + track.stretches[0]!.length
    const full = 1 / track.stretches[1]!.radius
    expect(curveNear(line, into - SLED_REPLAY.easeSpan - 1)).toBe(0)
    expect(curveNear(line, into)).toBeGreaterThan(0)
    expect(curveNear(line, into)).toBeLessThan(full)
    expect(curveNear(line, into + SLED_REPLAY.easeSpan + 1)).toBeCloseTo(full, 9)
  })

  it('follows the run: the line at the run’s time, the speeds the run had', () => {
    const run = referenceRun(DEFAULT_BOBSLED, track)
    const path = sledPath(run, track, line)
    expect(path.finishAt).toBeCloseTo(run.time, 9)
    expect(frameAt(path, run.time + 1).finished).toBe(true)
    expect(frameAt(path, run.time + 1).s).toBeCloseTo(total, 6)
    for (let i = 1; i < path.frames.length; i++) {
      expect(path.frames[i]!.t).toBeGreaterThanOrEqual(path.frames[i - 1]!.t)
      expect(path.frames[i]!.s).toBeGreaterThanOrEqual(path.frames[i - 1]!.s)
    }
    const mid = frameAt(path, run.time / 2)
    expect(mid.s).toBeGreaterThan(0)
    expect(mid.s).toBeLessThan(total)
    expect(timeAt(path, mid.s)).toBeCloseTo(run.time / 2, 6)
  })

  it('shares the time lost steering late over the curves, still finishing at the run’s time', () => {
    // A tall cowling and the deepest tuck: the driver can't see the curves.
    const blind: BobsledDesign = { ...DEFAULT_BOBSLED, sled: { ...DEFAULT_BOBSLED.sled, cowl: 0.6 }, tuck: 1 }
    const run = referenceRun(blind, track)
    expect(run.blindLoss).toBeGreaterThan(0)
    const path = sledPath(run, track, line)
    expect(path.finishAt).toBeCloseTo(run.time, 9)
    // Halfway down, some of the loss is already in the clock: later than the sighted run there.
    const sighted = sledPath({ ...run, time: run.time - run.blindLoss, blindLoss: 0, trace: run.trace.map((p, i) => (i === run.trace.length - 1 ? { ...p, t: p.t - run.blindLoss } : p)) }, track, line)
    expect(timeAt(path, total / 2)).toBeGreaterThan(timeAt(sighted, total / 2))
    expect(sledNotes(track, path, path).some((n) => n.kind === 'blind')).toBe(true)
  })

  it('calls the load, the horseshoe and the finish, with the gap to the old sled', () => {
    const mine = sledPath(referenceRun(DEFAULT_BOBSLED, track), track, line)
    const old = sledPath(referenceRun(CLUB_BOBSLED, track), track, line)
    const notes = sledNotes(track, mine, old)
    expect(notes.slice(0, 2).map((n) => n.kind)).toEqual(['push', 'load'])
    expect(notes.map((n) => n.kind)).toContain('horseshoe')
    expect(notes.some((n) => n.kind === 'blind')).toBe(false)
    const finish = notes.find((n) => n.kind === 'finish')!
    expect(finish.kind === 'finish' && finish.gap).toBeCloseTo(old.finishAt - mine.finishAt, 9)
    expect(finish.kind === 'finish' && finish.gap).toBeGreaterThan(0)
    for (let i = 1; i < notes.length; i++) expect(notes[i]!.t).toBeGreaterThanOrEqual(notes[i - 1]!.t)
    expect(sledDuration(mine, old)).toBeCloseTo(old.finishAt + SLED_REPLAY.hold, 9)
  })
})
