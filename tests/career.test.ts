import { describe, expect, it } from 'vitest'
import { BRIEFS, CAREER } from '../src/data/briefs'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { acceptBrief, boardFor, charge, deliver, eventOf, newCareer, orderBlock, orderModel, penaltyFor, readOf } from '../src/sim/career'
import { PROMISE } from '../src/data/briefs'
import { fieldResult, truth } from '../src/sim/views'
import { cyclistShape } from '../src/sim/geom/cyclist'

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
    for (const b of BRIEFS) {
      const e = eventOf(b)
      expect(e.rider.power).toBe(b.rider.power)
      expect(e.spread).toEqual(b.event.spread)
      const shape = cyclistShape(b.setup)
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
})
