import { describe, expect, it } from 'vitest'
import { BRIEFS } from '../src/data/briefs'
import { CORRELATION, REPUTATION } from '../src/data/reputation'
import { bidScore, boardFor, newCareer, openTo, placeBid, pointWorth, type CareerState, type JobRecord } from '../src/sim/career'
import { correlationScore, reputationChange, reputationOf } from '../src/sim/reputation'

/** A finished job: promised and achieved cut, and how far off the read was (a fraction). */
const job = (promised: number, achieved: number, off: number): JobRecord => ({
  id: 'stavren-club',
  day: 1,
  fee: 50000,
  paid: 50000,
  promised,
  achieved,
  predicted: 0.25 * (1 + off),
  actual: 0.25,
})

describe('reputation', () => {
  it('starts where the table says and rises with kept promises and close reads', () => {
    expect(reputationOf([])).toBe(REPUTATION.start)
    expect(reputationChange(job(3, 4, 0.01))).toBe(REPUTATION.kept + REPUTATION.read.good)
    expect(reputationChange(job(3, 4, 0.03))).toBe(REPUTATION.kept + REPUTATION.read.fair)
    expect(reputationChange(job(3, 4, 0.2))).toBe(REPUTATION.kept + REPUTATION.read.poor)
  })

  it('falls more the further a promise is missed', () => {
    const small = reputationChange(job(5, 4, 0))
    const big = reputationChange(job(5, 1, 0))
    expect(small).toBeLessThan(0 + REPUTATION.read.good)
    expect(big).toBeLessThan(small)
  })

  it('stays between 0 and 100', () => {
    expect(reputationOf(Array.from({ length: 50 }, () => job(3, 4, 0)))).toBe(REPUTATION.max)
    expect(reputationOf(Array.from({ length: 50 }, () => job(20, 0, 0.5)))).toBe(REPUTATION.min)
  })
})

describe('correlation score', () => {
  it('has no score before the first job, 100 for perfect reads and 0 past the cut-off', () => {
    expect(correlationScore([])).toBeNull()
    expect(correlationScore([job(3, 4, 0)])).toBe(100)
    expect(correlationScore([job(3, 4, CORRELATION.zeroAt * 2)])).toBe(0)
    expect(correlationScore([job(3, 4, -0.05)])).toBe(50)
  })

  it('only counts the last few jobs', () => {
    const old = Array.from({ length: 10 }, () => job(3, 4, 0.5))
    const recent = Array.from({ length: CORRELATION.jobs }, () => job(3, 4, 0))
    expect(correlationScore([...old, ...recent])).toBe(100)
  })
})

describe('a good name brings bigger clients', () => {
  it('keeps the national-level clients off the board until the firm is known', () => {
    const big = BRIEFS.filter((b) => (b.minRep ?? 0) > REPUTATION.start)
    expect(big.length).toBeGreaterThan(0)
    for (let round = 1; round < 20; round++) {
      const ids = boardFor(3, round, false, REPUTATION.start).map((b) => b.id)
      for (const b of big) expect(ids).not.toContain(b.id)
    }
    // With a top name, every client can turn up.
    const seen = new Set<string>()
    for (let round = 1; round < 40; round++) for (const b of boardFor(3, round, false, REPUTATION.max)) seen.add(b.id)
    for (const b of BRIEFS.filter((x) => !x.tutorial)) expect(seen.has(b.id), b.id).toBe(true)
    expect(BRIEFS.every((b) => openTo(b, REPUTATION.max))).toBe(true)
  })

  it('tips a close bid toward the better-known firm', () => {
    const id = 'brusnik-hill'
    const bid = { price: 60000, promise: 4 }
    expect(bidScore(id, bid, 50) - bidScore(id, bid, 0)).toBeCloseTo(50 * REPUTATION.bidPerPoint * pointWorth(id), 6)
  })

  it('weighs your record against the rival in a sealed bid', () => {
    const base = newCareer(8)
    const brief = base.board.find((b) => !BRIEFS.find((t) => t.id === b.id)!.tutorial)!
    const t = BRIEFS.find((x) => x.id === brief.id)!
    const unknown: CareerState = { ...base, jobsDone: 1 }
    const famous: CareerState = { ...unknown, history: Array.from({ length: 10 }, () => job(3, 4, 0)) }
    const a = placeBid(unknown, brief.id, { price: t.fee.max, promise: t.target })!
    const b = placeBid(famous, brief.id, { price: t.fee.max, promise: t.target })!
    expect(a.myRep).toBe(REPUTATION.start)
    expect(b.myRep).toBe(REPUTATION.max)
    expect(a.rivals.length).toBeGreaterThan(0)
    expect(bidScore(brief.id, b.mine, b.myRep)).toBeGreaterThan(bidScore(brief.id, a.mine, a.myRep))
  })
})
