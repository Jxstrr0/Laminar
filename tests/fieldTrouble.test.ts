import { describe, expect, it } from 'vitest'
import { BRIEFS } from '../src/data/briefs'
import { DEFAULT_CYCLIST, type CyclistDesign } from '../src/data/cyclist'
import { FIELD_TROUBLE, REFERENCE_COURSE } from '../src/data/field'
import { deliver, eventOf, newCareer, type CareerState } from '../src/sim/career'
import { comfort, riderEvent } from '../src/sim/cyclist'
import { courseTime, easeFor, splitCourse } from '../src/sim/field/timeTrial'
import { cyclistShape } from '../src/sim/geom/cyclist'
import { replayNotes, rideTime, trackAt } from '../src/sim/replay'
import { hashString } from '../src/sim/rng'
import { fieldResult } from '../src/sim/views'

const coast = BRIEFS.find((b) => b.id === 'korolets-coast')!
const track = BRIEFS.find((b) => b.id === 'vesnina-pursuit')!

const withWheels = (front: CyclistDesign['wheels']['front'], rear: CyclistDesign['wheels']['rear']): CyclistDesign => ({
  ...structuredClone(DEFAULT_CYCLIST),
  wheels: { front, rear },
})
/** Past the comfort limit: flat back, head right down, narrow arms. */
const extreme: CyclistDesign = { ...structuredClone(DEFAULT_CYCLIST), posture: { torsoDeg: 5, headDrop: 1, armWidth: 0.2, handReach: 0.72, handHeight: 0 } }

const days = (n: number) => Array.from({ length: n }, (_, k) => hashString(`trouble:${k}`))

describe('crosswind steer', () => {
  it('lets a rider hold the bike up to their limit, then eases off more the further past it', () => {
    const limit = FIELD_TROUBLE.steerPerKg * 70
    expect(easeFor(limit * 0.99, 70)).toBe(0)
    expect(easeFor(limit * 1.01, 70)).toBeGreaterThanOrEqual(FIELD_TROUBLE.ease.start)
    expect(easeFor(limit * 2, 70)).toBeGreaterThan(easeFor(limit * 1.5, 70))
    expect(easeFor(limit * 100, 70)).toBe(FIELD_TROUBLE.ease.max)
  })

  it('costs a disc front wheel time on the windy coast, and never spoked wheels', () => {
    const event = eventOf(coast)
    let disc = 0
    let spoked = 0
    for (const seed of days(8)) {
      disc += fieldResult(cyclistShape(withWheels('disc', 'disc')), riderEvent(withWheels('disc', 'disc'), event), seed).lostToGusts
      spoked += fieldResult(cyclistShape(withWheels('spoked', 'spoked')), riderEvent(withWheels('spoked', 'spoked'), event), seed).lostToGusts
    }
    expect(disc).toBeGreaterThan(30)
    expect(spoked).toBe(0)
  })

  it('never steers anyone on the indoor track', () => {
    const event = eventOf(track)
    const r = fieldResult(cyclistShape(withWheels('disc', 'disc')), riderEvent(withWheels('disc', 'disc'), event), 7)
    expect(r.lostToGusts).toBe(0)
    expect(r.segments.every((s) => s.eased === 0)).toBe(true)
  })
})

describe('an unholdable position', () => {
  it('costs nothing while the rider can hold it, and fades past the limit', () => {
    expect(comfort(DEFAULT_CYCLIST).fade).toBe(0)
    const c = comfort(extreme)
    expect(c.holdable).toBe(false)
    expect(c.fade).toBeGreaterThan(FIELD_TROUBLE.fade.start)
    expect(c.fade).toBeLessThanOrEqual(FIELD_TROUBLE.fade.max)
  })

  it('splits the course where the rider sits up and slows only the last third', () => {
    const split = splitCourse(REFERENCE_COURSE, 30000)
    expect(split.map((s) => s.length)).toEqual([20000, 10000, 10000])
    const rider = { power: 300, mass: 80, rollingResistance: 0.004, drivetrain: 0.975 }
    const air = { density: 1.2, windSpeed: 0, windFromDeg: 0 }
    const cdA = () => 0.25
    const clean = courseTime(rider, REFERENCE_COURSE, air, cdA)
    const faded = courseTime(rider, REFERENCE_COURSE, air, cdA, { fade: 0.2 })
    const from = clean.distance * FIELD_TROUBLE.fade.from
    expect(faded.course.reduce((s, c) => s + c.length, 0)).toBeCloseTo(clean.distance, 6)
    let covered = 0
    for (let i = 0; i < faded.segments.length; i++) {
      expect(faded.segments[i]!.faded).toBe(covered >= from - 1e-6 ? 0.2 : 0)
      covered += faded.course[i]!.length
    }
    expect(faded.time).toBeGreaterThan(clean.time)
  })

  it('is slower on the day than the best position the rider can hold', () => {
    const edge: CyclistDesign = { ...structuredClone(DEFAULT_CYCLIST), posture: { torsoDeg: 8, headDrop: 0.8, armWidth: 0.25, handReach: 0.72, handHeight: 0 } }
    expect(comfort(edge).holdable).toBe(true)
    const event = eventOf(BRIEFS[0]!)
    for (const seed of days(3)) {
      const held = fieldResult(cyclistShape(edge), riderEvent(edge, event), seed)
      const over = fieldResult(cyclistShape(extreme), riderEvent(extreme, event), seed)
      expect(over.lostToFade).toBeGreaterThan(0)
      expect(over.time).toBeGreaterThan(held.time)
      // The road CdA (what the promise is checked on) doesn't care how the rider felt.
      expect(over.cdA).toBeLessThan(held.cdA)
    }
  })
})

describe('trouble on race day', () => {
  /** A career with the coast job taken. */
  function onTheCoast(): CareerState {
    const start = newCareer(11)
    const brief = { id: coast.id, fee: coast.fee.min, days: coast.days, seed: 99 }
    return { ...start, job: { brief, promise: coast.target, startDay: start.day, daysLeft: brief.days, spent: 0 } }
  }

  it('names each kind of trouble in the debrief, with the part to change', () => {
    const design: CyclistDesign = { ...extreme, wheels: { front: 'disc', rear: 'disc' } }
    const d = deliver(onTheCoast(), design, 0.2)!
    expect(d.debrief.fade).not.toBeNull()
    expect(d.debrief.fade!.lost).toBeCloseTo(d.result.lostToFade, 9)
    expect(d.debrief.fade!.fix).toBe(comfort(design).worst)
    if (d.result.windSpeed > 1) {
      expect(d.debrief.gusts).not.toBeNull()
      expect(d.debrief.gusts!.fix).toBe('front')
    }
  })

  it('leaves the debrief clean for a design that has no trouble', () => {
    const design = withWheels('spoked', 'disc')
    const d = deliver(onTheCoast(), design, 0.2)!
    expect(d.debrief.gusts).toBeNull()
    expect(d.debrief.fade).toBeNull()
  })

  it('gives the replay a line for the gust and for sitting up, and still finds the meeting on the way back', () => {
    const design: CyclistDesign = { ...extreme, wheels: { front: 'disc', rear: 'disc' } }
    const d = deliver(onTheCoast(), design, 0.2)!
    const mine = { course: d.result.course, segments: d.result.segments }
    const old = { course: d.debrief.baseline.course, segments: d.debrief.baseline.segments }
    expect(rideTime(mine)).toBeCloseTo(d.result.time, 6)
    const notes = replayNotes(mine, old, { windFromDeg: d.result.windFromDeg, calm: false })
    const kinds = notes.map((n) => n.kind)
    expect(kinds).toContain('fade')
    if (d.debrief.gusts) expect(kinds).toContain('gust')
    const fade = notes.find((n) => n.kind === 'fade')!
    expect(fade.t / rideTime(mine)).toBeGreaterThan(0.6)
    // The 3D replay reads the trouble off the track: tucked before the fade, sitting up after it.
    expect(trackAt(mine, fade.t - 1).faded).toBe(0)
    expect(trackAt(mine, fade.t + 1).faded).toBeGreaterThan(0)
    expect(trackAt(mine, rideTime(mine) + 5).faded).toBeGreaterThan(0)
    if (d.debrief.gusts) {
      const gust = notes.find((n) => n.kind === 'gust')!
      expect(trackAt(mine, gust.t).eased).toBeGreaterThan(0)
    }
    // The split where the rider sat up isn't a turn, so the out-and-back still has its meeting.
    expect(kinds).toContain('meet')
    expect(kinds.filter((k) => k === 'turn')).toHaveLength(1)
  })
})
