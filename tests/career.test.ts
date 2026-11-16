import { describe, expect, it } from 'vitest'
import { designShape } from '../src/sim/design'
import { reputationOf } from '../src/sim/reputation'
import { BRIEFS, CAREER } from '../src/data/briefs'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import {
  acceptBrief,
  bidScore,
  boardFor,
  charge,
  clampBid,
  deliver,
  eventOf,
  newCareer,
  orderBlock,
  orderModel,
  penaltyFor,
  placeBid,
  pointWorth,
  readOf,
  biddersFor,
  rivalBid,
  waitForBriefs,
  type CareerState,
} from '../src/sim/career'
import { BID, PROMISE } from '../src/data/briefs'
import { fieldResult, truth } from '../src/sim/views'

describe('the career', () => {
  it('starts with money, the tutorial first and one small brief on the board', () => {
    const c = newCareer(5)
    expect(c.money).toBe(CAREER.startMoney)
    expect(c.board).toHaveLength(CAREER.boardSize)
    expect(c.board[0]!.id).toBe('selivan-regional')
    expect(c.board.filter((b) => BRIEFS.find((t) => t.id === b.id)!.small)).toHaveLength(1)
    expect(new Set(c.board.map((b) => b.id)).size).toBe(c.board.length)
  })

  it('draws the same board from the same seed, and fees inside the range', () => {
    expect(boardFor(11, 3)).toEqual(boardFor(11, 3))
    for (let seed = 1; seed < 30; seed++) {
      for (const b of boardFor(seed, 2)) {
        const t = BRIEFS.find((x) => x.id === b.id)!
        expect(t.tutorial).toBeUndefined()
        expect(b.fee).toBeGreaterThanOrEqual(t.fee.min)
        expect(b.fee).toBeLessThanOrEqual(t.fee.max)
        expect(b.fee % CAREER.feeRound).toBe(0)
      }
    }
  })

  it('takes one job at a time', () => {
    const c = acceptBrief(newCareer(5), 'selivan-regional')
    expect(c.job?.daysLeft).toBe(21)
    const other = c.board[1]!.id
    expect(acceptBrief(c, other)).toBe(c)
    expect(acceptBrief(newCareer(5), 'not-on-the-board')).toEqual(newCareer(5))
  })

  it('charges runs with or without a job; models need a job and the days', () => {
    const idle = charge(newCareer(5), 1500)
    expect(idle.money).toBe(CAREER.startMoney - 1500)
    expect(orderBlock(idle, 4)).toBe('noJob')
    expect(orderModel(idle, 24000, 4)).toBe(idle)
    const job = acceptBrief(idle, 'selivan-regional')
    const ordered = orderModel(job, 52000, 7)
    expect(ordered.money).toBe(job.money - 52000)
    expect(ordered.day).toBe(7)
    expect(ordered.job!.daysLeft).toBe(14)
    expect(ordered.job!.spent).toBe(52000)
    expect(orderBlock(ordered, 15)).toBe('noDays')
    expect(orderBlock(ordered, 14)).toBeNull()
  })

  it('delivers: the event runs, the fee is paid, the calendar jumps and the board moves on', () => {
    const job = orderModel(acceptBrief(newCareer(5), 'selivan-regional'), 24000, 4)
    const d = deliver(job, DEFAULT_CYCLIST, 0.25)!
    expect(d.paid).toBe(job.job!.brief.fee)
    expect(d.state.money).toBe(job.money + d.paid)
    expect(d.state.day).toBe(21)
    expect(d.state.job).toBeNull()
    expect(d.state.jobsDone).toBe(1)
    expect(d.state.board.some((b) => b.id === 'selivan-regional')).toBe(false)
    expect(d.result.distance).toBe(40000)
    // The same design and job give the same day.
    expect(deliver(job, DEFAULT_CYCLIST, 0.25)!.result).toEqual(d.result)
    expect(deliver(newCareer(5), DEFAULT_CYCLIST, 0.25)).toBeNull()
  })

  it('builds each event from its brief', () => {
    // Ski jumps fly their own event (tests/jumpJobs.test.ts).
    for (const b of BRIEFS.filter((x) => !x.event.jump)) {
      const e = eventOf(b)
      expect(e.rider.power).toBe(b.rider.power)
      expect(e.spread).toEqual(b.event.spread)
      const shape = designShape(b.setup)
      expect(truth(shape, e).cdA).toBeGreaterThan(0.15)
      const day = fieldResult(shape, e, 1)
      // Plausible amateur-to-pro average speeds.
      const kmh = (day.distance / day.time) * 3.6
      expect(kmh).toBeGreaterThan(28)
      expect(kmh).toBeLessThan(55)
    }
  })

  it('checks the promise on race day and docks the fee for a miss', () => {
    const job = acceptBrief(newCareer(5), 'selivan-regional')
    // Their own setup cuts nothing: a big miss, capped at half the fee.
    const same = deliver(job, BRIEFS[0]!.setup, 0.27)!
    expect(same.debrief.achieved).toBeCloseTo(0, 6)
    expect(same.debrief.met).toBe(false)
    expect(same.debrief.cause).toBe('design')
    expect(same.debrief.penalty).toBe(Math.round((job.job!.brief.fee * PROMISE.maxShare) / 100) * 100)
    expect(same.paid).toBe(job.job!.brief.fee - same.debrief.penalty)
    expect(same.state.history).toHaveLength(1)
    expect(same.state.history[0]!.paid).toBe(same.paid)
    // A proper time-trial position keeps a 10 % promise to a club rider sitting up.
    const good = deliver(job, DEFAULT_CYCLIST, 0.25)!
    expect(good.debrief.achieved).toBeGreaterThan(10)
    expect(good.debrief.met).toBe(true)
    expect(good.debrief.penalty).toBe(0)
    expect(good.debrief.timeSaved).toBeGreaterThan(0)
  })

  it('works out penalties and reads', () => {
    expect(penaltyFor(100000, 10, 9.6)).toEqual({ shortfall: 0, penalty: 0 })
    expect(penaltyFor(100000, 10, 7.5).penalty).toBe(Math.round(100000 * 2 * PROMISE.perPoint / 100) * 100)
    expect(penaltyFor(100000, 10, -20).penalty).toBe(50000)
    expect(readOf(0.01)).toBe('good')
    expect(readOf(-0.03)).toBe('fair')
    expect(readOf(0.1)).toBe('poor')
  })

  it('lets the first client ask for you alone, and the rivals bid on the rest', () => {
    const c = newCareer(5)
    const tutorial = c.board[0]!
    expect(biddersFor(tutorial.id)).toEqual([])
    const r = placeBid(c, tutorial.id, { price: 130000, promise: 10 })!
    expect(r.won).toBe(true)
    expect(r.rivals).toEqual([])
    expect(r.winner).toBeNull()
    expect(r.state.job?.brief.fee).toBe(130000)
    expect(r.state.job?.promise).toBe(10)
    // Another bid while on the job does nothing.
    expect(placeBid(r.state, c.board[1]!.id, { price: 1, promise: 1 })).toBeNull()
    for (let seed = 1; seed < 40; seed++) {
      for (const b of boardFor(seed, 1)) {
        for (const firm of biddersFor(b.id)) {
          const rival = rivalBid(b, firm)
          expect(rival).toEqual(rivalBid(b, firm))
          expect(clampBid(b.id, rival)).toEqual(rival)
        }
      }
    }
  })

  it('keeps bids inside the limits and scores them by promise worth plus the saving', () => {
    const t = BRIEFS.find((b) => b.id === 'stavren-club')!
    expect(clampBid(t.id, { price: 1, promise: 99 })).toEqual({ price: t.fee.min, promise: BID.promiseMax })
    expect(clampBid(t.id, { price: 1e9, promise: 0.2 })).toEqual({ price: t.fee.max, promise: BID.promiseMin })
    expect(clampBid(t.id, { price: 40400, promise: 10.3 })).toEqual({ price: 40000, promise: 10.5 })
    const worth = pointWorth(t.id)
    expect(worth).toBe(Math.round(((t.fee.min + t.fee.max) / 2) * BID.pointValue / 100) * 100)
    expect(bidScore(t.id, { price: 40000, promise: 11 })).toBe(11 * worth + t.fee.max - 40000)
  })

  it('wins on a better bid, and a lost brief makes way for another', () => {
    // Past the first job, with a good enough name for every client to call: a board with a rival on every brief.
    const good = { id: 'stavren-club', day: 1, fee: 1, paid: 1, promised: 3, achieved: 5, predicted: 0.25, actual: 0.25 }
    const history = [good, good, good]
    const base: CareerState = { ...newCareer(8), jobsDone: 3, round: 1, history, board: boardFor(8, 1, false, reputationOf(history)) }
    const brief = base.board[0]!
    const t = BRIEFS.find((b) => b.id === brief.id)!
    const cheap = placeBid(base, brief.id, { price: t.fee.min, promise: BID.promiseMax })!
    expect(cheap.won).toBe(true)
    const greedy = placeBid(base, brief.id, { price: t.fee.max, promise: BID.promiseMin })!
    expect(greedy.won).toBe(false)
    expect(greedy.state.job).toBeNull()
    expect(greedy.state.lost).toEqual([brief.id])
    expect(greedy.state.board.some((b) => b.id === brief.id)).toBe(false)
    expect(greedy.state.board).toHaveLength(CAREER.boardSize)
    // Lose everything: the board runs dry, then a week's wait brings a new one.
    let s = greedy.state
    while (s.board.length > 0) {
      const b = s.board[0]!
      const bt = BRIEFS.find((x) => x.id === b.id)!
      s = placeBid(s, b.id, { price: bt.fee.max, promise: BID.promiseMin })!.state
    }
    expect(s.lost.length).toBe(BRIEFS.length - 1)
    const w = waitForBriefs(s)
    expect(w.day).toBe(s.day + BID.waitDays)
    expect(w.round).toBe(s.round + 1)
    expect(w.lost).toEqual([])
    expect(w.board).toHaveLength(CAREER.boardSize)
  })

  it('keeps old boards for careers that never waited or lost', () => {
    expect(boardFor(11, 0)[0]!.id).toBe('selivan-regional')
    expect(boardFor(11, 2).some((b) => b.id === 'selivan-regional')).toBe(false)
    const d = deliver(acceptBrief(newCareer(5), 'selivan-regional'), DEFAULT_CYCLIST, 0.25)!
    expect(d.state.round).toBe(1)
    expect(d.state.board).toEqual(boardFor(5, 1))
  })
})
