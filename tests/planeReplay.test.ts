import { describe, expect, it } from 'vitest'
import { PLANE_CLASS, STOCK_PLANE, SURVEY_PATTERN, SURVEY_SITES, type PlaneDesign } from '../src/data/plane'
import { SURVEY_REPLAY as R, SURVEY_SCENE } from '../src/data/replay'
import { surveyFlight, turnRadius, turnStart, type SurveyDay } from '../src/sim/planeJob'
import { bankAt, clipClock, clipsPlayTime, planePose, planeRide, surveyClips, surveyCourse, surveyNotes } from '../src/sim/planeReplay'
import { rideTime, trackAt } from '../src/sim/replay'

const site = SURVEY_SITES.ozimka
const GOOD: PlaneDesign = { ...STOCK_PLANE.survey, fuselage: { nose: 0.3, taper: 0.9 }, camera: { drop: 0.35, fairing: 1, at: 0.5 }, winglets: 0.12, tail: 0.95 }
const LOOSE: PlaneDesign = { ...GOOD, tail: 0.7 }
/** A day whose big gust (8 km/h) comes on the turn nearest 40 km: the sorted plane rides it out, a loose one doesn't. */
const DAY: SurveyDay = { temperature: 16, gust: 2.2, gustAt: turnStart('survey', 60) }
const length = (segs: readonly { length: number }[]) => segs.reduce((s, x) => s + x.length, 0)

describe('the survey lines (PR 10o)', () => {
  it('run back and forth, 600 m east then west, with half-circle turns between, as far as the plane flew', () => {
    const lap = SURVEY_PATTERN.line + Math.PI * turnRadius('survey')
    const course = surveyCourse('survey', 2 * lap + 100)
    expect(length(course)).toBeCloseTo(2 * lap + 100, 6)
    expect(course[0]).toMatchObject({ length: SURVEY_PATTERN.line, heading: 90 })
    const west = course.find((c) => c.heading === 270)!
    expect(west.length).toBe(SURVEY_PATTERN.line)
    // Each pair of turns brings it back to the start's line, two turn widths down the field: south (a turn drawn in pieces lands within a per cent of it).
    const ride = { course, segments: course.map((c) => ({ speed: 16, yawDeg: 0, apparent: 0, time: c.length / 16, eased: 0, faded: 0, steer: 0 })) }
    const back = trackAt(ride, (2 * lap) / 16)
    expect(back.x).toBeCloseTo(0, 6)
    expect(back.z / (4 * turnRadius('survey'))).toBeGreaterThan(0.99)
    expect(back.z / (4 * turnRadius('survey'))).toBeLessThan(1.01)
  })

  it('banks right into the first turn and left into the second, level on the lines', () => {
    const bank = (PLANE_CLASS.survey.bank * Math.PI) / 180
    const arc = Math.PI * turnRadius('survey')
    expect(bankAt('survey', 300)).toBe(0)
    expect(bankAt('survey', SURVEY_PATTERN.line + arc / 2)).toBeCloseTo(bank, 9)
    expect(bankAt('survey', SURVEY_PATTERN.line + 1)).toBeCloseTo(bank / R.rollIn, 9)
    expect(bankAt('survey', 2 * SURVEY_PATTERN.line + 1.5 * arc)).toBeCloseTo(-bank, 9)
  })
})

describe('a survey flight in the replay', () => {
  it('flies at survey speed and height to its range, then glides down onto the stubble', () => {
    const flight = surveyFlight(GOOD, site, DAY)
    const ride = planeRide('survey', flight)
    expect(ride.stalledAt).toBeNull()
    expect(ride.landedAt).toBeCloseTo((flight.range * 1000) / 16, 6)
    expect(rideTime(ride)).toBeCloseTo(ride.landedAt!, 6)
    expect(planePose(ride, 100).height).toBe(SURVEY_SCENE.flyHeight)
    expect(planePose(ride, ride.landedAt! - R.glide / 2).height).toBeCloseTo(SURVEY_SCENE.flyHeight / 2, 6)
    expect(planePose(ride, ride.landedAt! + 5)).toMatchObject({ height: 0, spin: 0 })
  })

  it('spins down into the crop from where the gust stalled it', () => {
    const flight = surveyFlight(LOOSE, site, DAY)
    const ride = planeRide('survey', flight)
    expect(flight.stall).not.toBeNull()
    expect(ride.end).toBeCloseTo(DAY.gustAt * 1000, 6)
    expect(ride.stalledAt).toBeCloseTo((DAY.gustAt * 1000) / 16, 6)
    const down = planePose(ride, ride.stalledAt! + R.spin.seconds)
    expect(down.height).toBe(0)
    expect(down.spin).toBeCloseTo(2 * Math.PI * R.spin.turns, 9)
    expect(down.pitch).toBeLessThan(0)
  })
})

describe('the highlights', () => {
  it('play the launch, the gust’s turn and both landings, in under half a minute', () => {
    const mine = planeRide('survey', surveyFlight(GOOD, site, DAY))
    const old = planeRide('survey', surveyFlight(STOCK_PLANE.survey, site, DAY))
    const clips = surveyClips(mine, old, DAY)
    expect(clips).toHaveLength(4)
    expect(clips[0]).toMatchObject({ from: 0, rate: R.launch.rate })
    const gust = (DAY.gustAt * 1000) / 16
    expect(clips[1]!.from).toBeCloseTo(gust - R.gust.before, 9)
    expect(clips[2]!.from).toBeCloseTo(old.landedAt! - R.land.before, 9)
    expect(clips[3]!.to).toBeCloseTo(mine.landedAt! + R.land.after, 9)
    const play = clipsPlayTime(clips)
    expect(play).toBeGreaterThan(12)
    expect(play).toBeLessThan(30)
    // The clock runs through each clip in turn, and holds on the last.
    expect(clipClock(clips, 0)).toEqual({ time: 0, clip: 0 })
    expect(clipClock(clips, R.launch.seconds / R.launch.rate + 0.5)).toEqual({ time: clips[1]!.from + 0.5 * R.gust.rate, clip: 1 })
    expect(clipClock(clips, play + 5)).toEqual({ time: clips[3]!.to, clip: 3 })
    const notes = surveyNotes(mine, old, DAY, surveyFlight(GOOD, site, DAY), clips)
    expect(notes.map((n) => n.kind)).toEqual(['launch', 'later', 'gust', 'later', 'landOld', 'later', 'end'])
    expect(notes.find((n) => n.kind === 'gust')).toMatchObject({ mine: true, old: true })
  })

  it('end at your plane in the wheat when it spins in, telling their flight rather than showing it', () => {
    const flight = surveyFlight(LOOSE, site, DAY)
    const mine = planeRide('survey', flight)
    const old = planeRide('survey', surveyFlight(STOCK_PLANE.survey, site, DAY))
    const clips = surveyClips(mine, old, DAY)
    expect(clips).toHaveLength(2)
    expect(clips[1]!.to).toBeGreaterThanOrEqual(mine.stalledAt! + R.spin.seconds)
    const notes = surveyNotes(mine, old, DAY, flight, clips)
    expect(notes.find((n) => n.kind === 'gust')).toMatchObject({ mine: false })
    expect(notes[notes.length - 1]).toMatchObject({ kind: 'end', stalled: true })
    expect(notes.some((n) => n.kind === 'landOld')).toBe(false)
  })

  it('merge clips that overlap, and skip a gust that comes after both planes are down', () => {
    const mine = planeRide('survey', surveyFlight(GOOD, site, { ...DAY, gustAt: 0.6 }))
    const old = planeRide('survey', surveyFlight(STOCK_PLANE.survey, site, { ...DAY, gustAt: 0.6 }))
    // The first turn is inside the launch's clip: one clip, at the slower rate.
    const early = surveyClips(mine, old, { ...DAY, gustAt: 0.6 })
    expect(early[0]).toMatchObject({ from: 0, rate: R.gust.rate })
    const late = { ...DAY, gustAt: 400 }
    const calm = surveyClips(planeRide('survey', surveyFlight(GOOD, site, late)), planeRide('survey', surveyFlight(STOCK_PLANE.survey, site, late)), late)
    expect(calm).toHaveLength(3)
  })
})
