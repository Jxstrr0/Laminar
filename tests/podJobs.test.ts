import { describe, expect, it } from 'vitest'
import { BRIEFS, POD_JOBS } from '../src/data/briefs'
import { CLEARANCE } from '../src/data/defence'
import { OLD_POD, POD_BUFFET, STOCK_POD, TEST_RANGES, type PodDesign } from '../src/data/pod'
import { hoursOnStation, patrolDensity, podBuffet } from '../src/sim/pod'
import { dragScaleForHours, podDragArea, podFlight, PRACTICE_RANGE, rangeDay, usualRangeDay } from '../src/sim/podJob'
import { boardFor, briefTemplate, clampBid, currentPodRun, daySeed, deliverPod, isPodBrief, newCareer, openTo, podEventOf, type CareerState } from '../src/sim/career'
import { newLab } from '../src/sim/lab'
import { readOf, reputationOf } from '../src/sim/reputation'

const podBriefs = BRIEFS.filter((b) => b.event.pod)
const range = TEST_RANGES.stepnoy

/** A career with this sensor-pod job in hand. */
function onJob(id: string, promise: number, fee = 500000): CareerState {
  const b = briefTemplate(id)!
  return { ...newCareer(3), job: { brief: { id, fee, days: b.days, seed: 41 }, promise, startDay: 0, daysLeft: b.days, spent: 0 } }
}

/** The sorted pod: a fine nose and tail, a clear gap, a little forward. */
const GOOD: PodDesign = { ...STOCK_POD.patrol, nose: 0.9, tail: 0.9, gap: 0.5, at: 0.2 }
/** Sorted, but hung tight under the wing: the picture blurs. */
const TIGHT: PodDesign = { ...GOOD, gap: 0.1 }

/** Hours on station on the usual day. */
const hours = (d: PodDesign) => hoursOnStation(d, { density: patrolDensity(range) })

describe('sensor-pod briefs (PR 10ac)', () => {
  it('are the ministry’s defence briefs over Stepnoy, and a sorted pod stays out longer than each one asks', () => {
    expect(podBriefs.map((b) => b.id)).toEqual(['stepnoy-pod', 'stepnoy-tight', 'stepnoy-forward'])
    for (const b of podBriefs) {
      expect(b.defence).toBe(true)
      expect(isPodBrief(b.id)).toBe(true)
      expect(b.minRep).toBeGreaterThanOrEqual(CLEARANCE.minReputation)
      expect(podEventOf({ id: b.id })!.range).toBe(range)
      expect(b.event.temperature).toBe(range.temperature)
      expect(b.event.altitude).toBe(range.altitude)
      expect((hours(GOOD) - hours(b.setup as PodDesign)) / POD_JOBS.pointHours).toBeGreaterThan(b.target)
      // Secrecy's big fees: more than any light-aircraft job pays.
      expect(b.fee.min).toBeGreaterThan(250000)
    }
    expect(podBuffet(GOOD).blurs).toBe(false)
    expect(isPodBrief('belyanka-club')).toBe(false)
  })

  it('every pod the ministry has now blurs the picture: the workshop’s tail, the tight one’s gap, the forward one’s cut-off tail', () => {
    const [workshop, tight, forward] = podBriefs.map((b) => podBuffet(b.setup as PodDesign))
    expect(workshop).toMatchObject({ blurs: true, cause: 'tail' })
    expect(tight).toMatchObject({ blurs: true, cause: 'gap' })
    expect(forward).toMatchObject({ blurs: true, cause: 'tail' })
    // The tight pod read on its own beats the old pod; under the wing it doesn't (the last contractor's trap).
    const old = hoursOnStation(OLD_POD.patrol, { sensor: 'old', density: patrolDensity(range) })
    const t = briefTemplate('stepnoy-tight')!.setup as PodDesign
    expect(hoursOnStation(t, { alone: true, density: patrolDensity(range) })).toBeGreaterThan(old)
    expect(hours(t)).toBeLessThan(old)
  })

  it('stay off the board until clearance opens, and then only a cleared firm sees them; bids go a minute at a time', () => {
    expect(POD_JOBS.open).toBe(false)
    for (const b of podBriefs) expect(openTo(b, 100, true)).toBe(false)
    const ids = new Set<string>()
    for (let round = 1; round < 40; round++) for (const b of boardFor(3, round, false, 100, true)) ids.add(b.id)
    for (const b of podBriefs) expect(ids.has(b.id)).toBe(false)
    expect(clampBid('stepnoy-pod', { price: 500000, promise: 24.6 }).promise).toBe(25)
  })

  it('forecast against the ministry’s pod as it hangs now on a job, or the old pod between jobs', () => {
    expect(currentPodRun(newCareer(3), 'patrol')).toEqual({ range, old: OLD_POD.patrol, oldSensor: 'old' })
    expect(currentPodRun(onJob('stepnoy-tight', 20), 'patrol')).toEqual({ range, old: briefTemplate('stepnoy-tight')!.setup, oldSensor: 'new' })
    expect(PRACTICE_RANGE.range).toBe(range)
    expect(newLab(briefTemplate('stepnoy-pod')!.setup).order.scale).toBe(2.4)
  })
})

describe('range day', () => {
  it('is seeded, and its air strays about the range’s usual', () => {
    const event = podEventOf({ id: 'stepnoy-pod' })!
    expect(rangeDay(event, 9)).toEqual(rangeDay(event, 9))
    const days = Array.from({ length: 200 }, (_, i) => rangeDay(event, i + 1))
    const mean = days.reduce((s, d) => s + d.temperature, 0) / days.length
    expect(Math.abs(mean - range.temperature)).toBeLessThan(1)
    expect(new Set(days.map((d) => d.temperature)).size).toBeGreaterThan(150)
  })

  it('moves the hours with the air, but not the buffet', () => {
    const cold = podFlight(GOOD, range, { temperature: -15 })
    const warm = podFlight(GOOD, range, { temperature: 25 })
    expect(cold.hours).not.toBeCloseTo(warm.hours, 2)
    expect(cold.buffet).toBe(warm.buffet)
    expect(podFlight(GOOD, range, usualRangeDay(range)).hours).toBeCloseTo(hours(GOOD), 9)
    expect(podFlight(TIGHT, range, usualRangeDay(range))).toMatchObject({ blurs: true, cause: 'gap', limit: POD_BUFFET.limit })
  })

  it('turns declared hours back into the drag that flies them', () => {
    expect(dragScaleForHours(hours(GOOD), GOOD, range)).toBeCloseTo(1, 6)
    expect(dragScaleForHours(hours(GOOD) + 0.5, GOOD, range)).toBeLessThan(0.9)
    expect(dragScaleForHours(hours(GOOD) - 0.5, GOOD, range)).toBeGreaterThan(1.1)
    // Held to its range for a declaration nothing could fly.
    expect(dragScaleForHours(40, GOOD, range)).toBeCloseTo(POD_JOBS.dragScale.min, 6)
  })
})

describe('delivering a sensor pod', () => {
  it('judges the promise on the usual day’s hours over the ministry’s pod, and the read on drag', () => {
    const job = onJob('stepnoy-pod', 25)
    const real = hours(GOOD)
    const d = deliverPod(job, GOOD, real)!
    expect(d.debrief.achieved).toBeCloseTo((real - hours(STOCK_POD.patrol)) / POD_JOBS.pointHours, 6)
    expect(d.debrief.met).toBe(true)
    expect(d.debrief.cause).toBeNull()
    expect(d.debrief.buffet).toBeNull()
    expect(d.debrief.actualCdA).toBeCloseTo(podDragArea(GOOD), 12)
    // Declaring the true hours reads the drag true; half an hour long (the pod tested alone) is reading it low.
    expect(Math.abs(d.debrief.readError)).toBeLessThan(1e-6)
    expect(d.debrief.read).toBe(readOf(d.debrief.readError))
    expect(deliverPod(job, GOOD, real + 0.5)!.debrief.readError).toBeLessThan(-0.08)
    // Range day is seeded: the same air for both pods.
    expect(d.debrief.day).toEqual(rangeDay(d.event, daySeed(job.job!.brief)))
    expect(d.debrief.baselineFlight.hours).toBeCloseTo(hoursOnStation(STOCK_POD.patrol, { density: patrolDensity(range, d.debrief.day.temperature) }), 9)
  })

  it('a pod that blurs the picture has its run rejected and gains nothing, and the debrief says what to change', () => {
    const d = deliverPod(onJob('stepnoy-tight', 20), TIGHT, 9.6)!
    expect(d.debrief.actual).toBeNull()
    expect(d.debrief.achieved).toBe(0)
    expect(d.debrief.cause).toBe('buffet')
    expect(d.debrief.buffet).toMatchObject({ fix: 'senGap', limit: POD_BUFFET.limit })
    expect(d.debrief.buffet!.index).toBeGreaterThan(d.debrief.buffet!.limit)
    expect(deliverPod(onJob('stepnoy-pod', 25), { ...GOOD, tail: 0.1 }, 9.4)!.debrief.buffet!.fix).toBe('senTail')
    // Their own pod counts on paper, though its picture blurs too.
    expect(d.debrief.baseline).toBeCloseTo(hours(briefTemplate('stepnoy-tight')!.setup as PodDesign), 9)
  })

  it('is a secret job: it counts for the correlation score, never the public name', () => {
    const job = onJob('stepnoy-forward', 22)
    const d = deliverPod(job, GOOD, hours(GOOD))!
    expect(d.state.history.at(-1)!.secret).toBe(true)
    expect(d.debrief.reputation.after).toBe(d.debrief.reputation.before)
    expect(reputationOf(d.state.history)).toBe(reputationOf(job.history))
  })

  it('a pod that misses the promise names the design, and only a sensor-pod job takes a pod', () => {
    const d = deliverPod(onJob('stepnoy-pod', 25), { ...STOCK_POD.patrol, tail: 0.3, gap: 0.42 }, 9.2)!
    expect(d.debrief.met).toBe(false)
    expect(d.debrief.cause).toBe('design')
    expect(deliverPod(newCareer(3), GOOD, 9.6)).toBeNull()
    expect(deliverPod(onJob('belyanka-club', 12), GOOD, 9.6)).toBeNull()
  })
})
