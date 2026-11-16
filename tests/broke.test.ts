import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { MACHINE_PRICE } from '../src/data/model'
import { BROKE, REPUTATION } from '../src/data/reputation'
import { OWN_TUNNEL_BUILD, TUNNEL_UPGRADES } from '../src/data/tunnel'
import { acceptBrief, deliver, firmReputation, hireStaff, newCareer, type CareerState } from '../src/sim/career'
import { salePrice, sellable, sellToCover } from '../src/sim/broke'
import { NO_FACILITY, type Facility } from '../src/sim/facility'
import { reputationOf } from '../src/sim/reputation'
import { packSave, parseSave, soundCareer, SAVE_VERSION } from '../src/persist/save'
import { newLab } from '../src/sim/lab'

const kitted: Facility = { ownOrdered: 0, upgrades: { fan: 90, screens: 95 }, machines: { cnc: 3, fdm: 5 } }

/** A firm on a job with this much cash and this kit. */
function onJob(money: number, facility: Facility = kitted): CareerState {
  const base = newCareer(4)
  return { ...acceptBrief(base, base.board[0]!.id), money, facility }
}

describe('the fire sale', () => {
  it('lists kit cheapest first, with the tunnel always last', () => {
    expect(sellable(kitted).map((i) => (i.kind === 'tunnel' ? 'tunnel' : i.id))).toEqual(['fdm', 'screens', 'fan', 'cnc', 'tunnel'])
    expect(sellable(NO_FACILITY)).toEqual([])
  })

  it('sells at the table’s share of what each thing cost', () => {
    expect(salePrice({ kind: 'machine', id: 'fdm' })).toBe(MACHINE_PRICE.fdm * BROKE.saleShare)
    expect(salePrice({ kind: 'upgrade', id: 'fan' })).toBe(TUNNEL_UPGRADES.fan.price * BROKE.saleShare)
    expect(salePrice({ kind: 'tunnel' })).toBe(OWN_TUNNEL_BUILD.price * BROKE.saleShare)
  })

  it('stops as soon as cash is back to zero or more', () => {
    const small = sellToCover(-10_000, kitted)
    expect(small.sale.sold.map((s) => s.item)).toEqual([{ kind: 'machine', id: 'fdm' }])
    expect(small.money).toBe(-10_000 + MACHINE_PRICE.fdm * BROKE.saleShare)
    expect(small.facility.machines).toEqual({ cnc: 3 })
    expect(small.facility.ownOrdered).toBe(0)
    expect(kitted.machines.fdm).toBe(5)
  })

  it('sells the tunnel only once all the kit has gone, and then the firm rents again', () => {
    const kitValue = sellable(kitted).filter((i) => i.kind !== 'tunnel').reduce((sum, i) => sum + salePrice(i), 0)
    const justKit = sellToCover(-kitValue, kitted)
    expect(justKit.facility.ownOrdered).toBe(0)
    expect(justKit.money).toBe(0)
    const all = sellToCover(-kitValue - 1, kitted)
    expect(all.facility).toEqual({ ownOrdered: null, upgrades: {}, machines: {} })
    expect(all.sale.total).toBe(kitValue + OWN_TUNNEL_BUILD.price * BROKE.saleShare)
  })

  it('can leave cash below zero when there is nothing left to sell', () => {
    const r = sellToCover(-5000, NO_FACILITY)
    expect(r.money).toBe(-5000)
    expect(r.sale).toEqual({ sold: [], total: 0 })
  })
})

describe('going broke after a job', () => {
  it('sells kit to cover the hole, keeps the staff and dips the reputation', () => {
    const before = hireStaff(onJob(-400_000), 'basov')
    const d = deliver(before, DEFAULT_CYCLIST, 0.25)!
    expect(d.sale).not.toBeNull()
    expect(d.sale!.sold.length).toBeGreaterThan(0)
    expect(d.state.money).toBeGreaterThanOrEqual(0)
    expect(d.state.crew).toEqual({ tech: 'basov' })
    expect(d.state.broke).toEqual([1])
    expect(firmReputation(d.state)).toBe(Math.max(REPUTATION.min, reputationOf(d.state.history) - BROKE.dip))
    expect(d.debrief.reputation.after).toBe(firmReputation(d.state))
  })

  it('does nothing when the job leaves money in the bank', () => {
    const d = deliver(onJob(100_000), DEFAULT_CYCLIST, 0.25)!
    expect(d.sale).toBeNull()
    expect(d.state.facility).toEqual(kitted)
    expect(d.state.broke).toEqual([])
  })

  it('is never a game over: a firm with nothing left keeps working', () => {
    const d = deliver(onJob(-1_000_000, NO_FACILITY), DEFAULT_CYCLIST, 0.25)!
    expect(d.state.money).toBeLessThan(0)
    expect(d.state.job).toBeNull()
    expect(d.state.board.length).toBeGreaterThan(0)
  })
})

describe('the reputation dip', () => {
  it('lands right after the job it followed and stays inside the limits', () => {
    const job = { promised: 3, achieved: 4, predicted: 0.25, actual: 0.25 }
    expect(reputationOf([job], [1])).toBe(reputationOf([job]) - BROKE.dip)
    expect(reputationOf([], [0, 0, 0, 0, 0])).toBe(Math.max(REPUTATION.min, REPUTATION.start - 5 * BROKE.dip))
  })

  it('round-trips in saves, and older careers never went broke', () => {
    const d = deliver(onJob(-400_000), DEFAULT_CYCLIST, 0.25)!
    const back = parseSave(packSave({ v: SAVE_VERSION, savedAt: 0, design: DEFAULT_CYCLIST, lab: newLab(), career: d.state }))
    expect(back?.career.broke).toEqual([1])
    const { broke: _b, ...old } = newCareer(4)
    expect(soundCareer(old)?.broke).toEqual([])
    expect(soundCareer({ ...newCareer(4), broke: [3] })).toBeNull()
    expect(soundCareer({ ...d.state, broke: [1, 0] })).toBeNull()
  })
})
