import { describe, expect, it } from 'vitest'
import { BRIEFS } from '../src/data/briefs'
import { FOREIGN_RIVAL_IDS, RIVALS, RIVAL_IDS, RIVAL_WEEK_DAYS } from '../src/data/rivals'
import { bidScore, biddersFor, boardFor, newCareer, placeBid, rivalBid, rivalBids, type CareerState } from '../src/sim/career'
import { rivalRecord } from '../src/sim/rivals'

describe('the rival firms', () => {
  it('sends Bystro Aero after every paid brief and Vysota Aerolab only after the big ones', () => {
    for (const b of BRIEFS) {
      const firms = biddersFor(b.id)
      if (b.tutorial) expect(firms).toEqual([])
      // A brief from abroad gets only that country's own firm (PR 11f).
      else if (b.country) expect(firms).toEqual(FOREIGN_RIVAL_IDS.filter((f) => RIVALS[f].country === b.country))
      else {
        expect(firms).toContain('bystro')
        expect(firms.includes('vysota')).toBe(b.fee.max >= RIVALS.vysota.minFee)
      }
    }
    expect(BRIEFS.some((b) => biddersFor(b.id).includes('vysota'))).toBe(true)
    expect(BRIEFS.some((b) => !b.tutorial && !biddersFor(b.id).includes('vysota'))).toBe(true)
  })

  it('has Bystro Aero bid cheaper and Vysota Aerolab dearer, on average', () => {
    let cheap = 0
    let dear = 0
    let n = 0
    for (let seed = 1; seed < 200; seed++) {
      for (const b of boardFor(seed, 1, false, 100)) {
        if (!biddersFor(b.id).includes('vysota')) continue
        cheap += rivalBid(b, 'bystro').price
        dear += rivalBid(b, 'vysota').price
        n++
      }
    }
    expect(n).toBeGreaterThan(50)
    expect(dear / n).toBeGreaterThan(cheap / n)
  })

  it('keeps public records that are steady within a week and show Bystro’s sloppy correlation', () => {
    for (const firm of RIVAL_IDS) {
      expect(rivalRecord(4, firm, 0)).toEqual(rivalRecord(4, firm, RIVAL_WEEK_DAYS - 1))
      const r = rivalRecord(4, firm, 50)
      expect(r.correlation).toBeGreaterThanOrEqual(0)
      expect(r.correlation).toBeLessThanOrEqual(100)
      expect(Math.abs(r.reputation - RIVALS[firm].reputation)).toBeLessThanOrEqual(RIVALS[firm].drift)
    }
    let bystro = 0
    let vysota = 0
    for (let day = 0; day < 700; day += RIVAL_WEEK_DAYS) {
      bystro += rivalRecord(9, 'bystro', day).correlation
      vysota += rivalRecord(9, 'vysota', day).correlation
    }
    expect(vysota).toBeGreaterThan(bystro)
  })

  it('gives the job to the best bid, names the winner, and lets a tie go to you', () => {
    const base = newCareer(21)
    const brief = base.board.find((b) => biddersFor(b.id).length > 0)!
    const t = BRIEFS.find((b) => b.id === brief.id)!
    const state: CareerState = { ...base, jobsDone: 1 }
    const rivals = rivalBids(state, brief)
    const best = Math.max(...rivals.map((r) => bidScore(brief.id, r.bid, r.reputation)))
    // A lowball with a huge promise beats everyone.
    const win = placeBid(state, brief.id, { price: t.fee.min, promise: 25 })!
    expect(win.won).toBe(true)
    expect(win.winner).toBeNull()
    expect(win.rivals).toEqual(rivals)
    // The top price with the smallest promise loses, to whichever rival scored best.
    const lose = placeBid(state, brief.id, { price: t.fee.max, promise: 0.5 })!
    expect(lose.won).toBe(false)
    const top = rivals.find((r) => bidScore(brief.id, r.bid, r.reputation) === best)!
    expect(lose.winner).toBe(top.firm)
    expect(lose.state.lost).toContain(brief.id)
  })
})
