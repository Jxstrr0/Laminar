import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { BID } from '../src/data/briefs'
import { OWN_BILLING, OWN_TUNNEL_BUILD, TUNNEL_BILLING } from '../src/data/tunnel'
import { buildOwnTunnel, deliver, newCareer, orderModel, passDays, placeBid, waitForBriefs, type CareerState } from '../src/sim/career'
import { activeTunnel, buildBlock, ownReadyDay, tunnelQuirks, tunnelRunCost, upkeepDays } from '../src/sim/facility'
import { newLab } from '../src/sim/lab'
import { runCost, stepRecorder, newRecorder } from '../src/sim/run'
import { packSave, parseSave, soundCareer, SAVE_VERSION } from '../src/persist/save'

const rich = (seed = 3): CareerState => ({ ...newCareer(seed), money: OWN_TUNNEL_BUILD.price + 50000, day: 100 })

describe('your own tunnel', () => {
  it('is cash only: no buying it on credit, and only once', () => {
    const poor = newCareer(3)
    expect(buildBlock(poor.facility, poor.money)).toBe('money')
    expect(buildOwnTunnel(poor)).toBe(poor)
    const r = rich()
    const built = buildOwnTunnel(r)
    expect(built.money).toBe(r.money - OWN_TUNNEL_BUILD.price)
    expect(built.facility.ownOrdered).toBe(r.day)
    expect(buildBlock(built.facility, 1e9)).toBe('ordered')
    expect(buildOwnTunnel({ ...built, money: 1e9 }).money).toBe(1e9)
  })

  it('opens after the build days, while the firm keeps renting the university’s', () => {
    const built = buildOwnTunnel(rich())
    const ready = ownReadyDay(built.facility)!
    expect(ready).toBe(100 + OWN_TUNNEL_BUILD.days)
    expect(activeTunnel(built.facility, ready - 1)).toBe('university')
    expect(activeTunnel(built.facility, ready)).toBe('own')
    expect(activeTunnel(newCareer(1).facility, 10_000)).toBe('university')
  })

  it('charges upkeep only for days it is open, every way days can pass', () => {
    const built = buildOwnTunnel(rich())
    const ready = ownReadyDay(built.facility)!
    expect(upkeepDays(built.facility, 100, ready - 1)).toBe(0)
    expect(upkeepDays(built.facility, ready - 3, ready + 2)).toBe(3)
    expect(upkeepDays(built.facility, ready + 10, ready + 17)).toBe(7)
    // Waiting for briefs.
    const open: CareerState = { ...built, day: ready, board: [] }
    const waited = waitForBriefs(open)
    expect(open.money - waited.money).toBe(BID.waitDays * OWN_TUNNEL_BUILD.upkeepPerDay)
    expect(passDays(open, 0)).toBe(open)
    // Before the tunnel exists, days are free.
    const fresh = newCareer(3)
    expect(passDays(fresh, 30).money).toBe(fresh.money)
  })

  it('charges upkeep for model days and the run-up to race day, off the job’s tally', () => {
    const built = buildOwnTunnel(rich(8))
    const ready = ownReadyDay(built.facility)!
    const start: CareerState = { ...built, day: ready, jobsDone: 1, guide: { off: true, done: [] } }
    const brief = start.board.find((b) => b.id !== 'selivan-regional') ?? start.board[0]!
    const won = placeBid(start, brief.id, { price: 1000, promise: 25 })!
    expect(won.won).toBe(true)
    const ordered = orderModel(won.state, 10000, 3)
    expect(won.state.money - ordered.money).toBe(10000 + 3 * OWN_TUNNEL_BUILD.upkeepPerDay)
    expect(ordered.job!.spent).toBe(10000)
    const d = deliver(ordered, DEFAULT_CYCLIST, 0.25)!
    expect(d.upkeep).toBe(ordered.job!.daysLeft * OWN_TUNNEL_BUILD.upkeepPerDay)
    expect(d.state.money).toBe(ordered.money + d.paid - d.upkeep)
  })

  it('has calmer air, a cleaner mount and cheaper runs than the university’s', () => {
    for (let seed = 1; seed < 30; seed++) {
      const uni = tunnelQuirks('university', seed)
      const own = tunnelQuirks('own', seed)
      expect(own.turbulence).toBeLessThan(uni.turbulence)
      expect(own.mountCdA.posts).toBeLessThan(uni.mountCdA.posts)
    }
    expect(tunnelRunCost('own', 1)).toBe(OWN_BILLING.perKWh)
    expect(tunnelRunCost('university', 1)).toBe(TUNNEL_BILLING.perRun + TUNNEL_BILLING.perKWh)
  })

  it('tags runs made in it and bills them at its rates', () => {
    let rec = newRecorder()
    let finished = null
    for (let i = 0; i < 400 && !finished; i++) {
      const step = stepRecorder(rec, i < 200 ? 30 : 0, 1 / 60, 'rider', 'own')
      rec = step.recorder
      finished = step.finished
    }
    expect(finished?.tunnel).toBe('own')
    expect(runCost(finished!)).toBeCloseTo(finished!.energyKWh * OWN_BILLING.perKWh, 9)
    // The university's runs carry no tag, as before.
    const uni = stepRecorder(newRecorder(), 30, 1 / 60, 'rider').recorder.run!
    expect('tunnel' in uni).toBe(false)
  })
})

describe('saves with a tunnel of your own', () => {
  it('keep the build date, and older careers rent the university’s', () => {
    const built = buildOwnTunnel(rich())
    const text = packSave({ v: SAVE_VERSION, savedAt: 0, design: structuredClone(DEFAULT_CYCLIST), lab: newLab(), career: built })
    expect(parseSave(text)!.career.facility).toEqual(built.facility)
    const { facility: _gone, ...old } = newCareer(4)
    expect(soundCareer(old)!.facility).toEqual({ ownOrdered: null })
    expect(soundCareer({ ...built, facility: { ownOrdered: -3 } })).toBeNull()
  })
})
