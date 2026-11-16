import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CLEARANCE } from '../src/data/defence'
import { REPUTATION } from '../src/data/reputation'
import { applyForClearance, briefTemplate, clearanceBlock, firmClearance, newCareer, openTo, type CareerState, type JobRecord } from '../src/sim/career'
import { clearanceOn, isCleared, NO_CLEARANCE, poorRun, reviewClearance } from '../src/sim/clearance'
import { legacyOf } from '../src/sim/legacy'
import { correlationScore, reputationOf } from '../src/sim/reputation'
import { soundCareer } from '../src/persist/save'

/** A finished job, its read off by `off` (a fraction); `secret` for a defence job. */
const job = (off: number, secret = false): JobRecord => ({
  id: 'stavren-club',
  day: 1,
  fee: 50000,
  paid: 50000,
  promised: 3,
  achieved: 4,
  predicted: 0.25 * (1 + off),
  actual: 0.25,
  ...(secret ? { secret: true as const } : {}),
})

/** A well-known firm with close reads and money to spare. */
function known(): CareerState {
  return { ...newCareer(4), day: 300, money: 1_000_000, history: Array.from({ length: 12 }, () => job(0.005)) }
}

describe('defence clearance while the defence jobs are still being built', () => {
  it('is closed: nobody can apply, and no firm counts as cleared', () => {
    expect(CLEARANCE.open).toBe(false)
    expect(clearanceBlock(known())).toBe('closed')
    expect(applyForClearance(known())).toEqual(known())
    expect(isCleared({ status: 'cleared', since: 0 }, 10)).toBe(false)
    expect(newCareer(1).clearance).toEqual(NO_CLEARANCE)
  })
})

describe('defence clearance (PR 10x)', () => {
  beforeEach(() => {
    CLEARANCE.open = true
  })
  afterEach(() => {
    CLEARANCE.open = false
  })

  it('needs the reputation, the correlation score and the fee', () => {
    expect(clearanceBlock(newCareer(4))).toBe('reputation')
    const s = known()
    expect(reputationOf(s.history)).toBeGreaterThanOrEqual(CLEARANCE.minReputation)
    expect(clearanceBlock(s)).toBeNull()
    expect(clearanceBlock({ ...s, money: CLEARANCE.fee - 1 })).toBe('money')
    // Loose reads keep the correlation score down even with the name to apply.
    const loose = { ...s, history: [...s.history.slice(0, 7), ...Array.from({ length: 5 }, () => job(0.05))] }
    expect(reputationOf(loose.history)).toBeGreaterThanOrEqual(CLEARANCE.minReputation)
    expect(clearanceBlock(loose)).toBe('correlation')
  })

  it('takes the fee, then vets for weeks before the firm is cleared', () => {
    const s = applyForClearance(known())
    expect(s.money).toBe(1_000_000 - CLEARANCE.fee)
    expect(firmClearance(s)).toEqual({ status: 'vetting', applied: 300, ready: 300 + CLEARANCE.vettingDays })
    expect(clearanceBlock(s)).toBe('applied')
    expect(firmClearance({ ...s, day: 300 + CLEARANCE.vettingDays - 1 }).status).toBe('vetting')
    expect(firmClearance({ ...s, day: 300 + CLEARANCE.vettingDays })).toEqual({ status: 'cleared', since: 300 + CLEARANCE.vettingDays })
    expect(isCleared(s.clearance, 300 + CLEARANCE.vettingDays)).toBe(true)
  })

  it('is lost by going broke or a run of poor reads, and may be sought again after a while', () => {
    const cleared = { status: 'cleared', since: 10 } as const
    const good = Array.from({ length: 5 }, () => job(0.005))
    expect(reviewClearance(cleared, 50, good, false)).toEqual(cleared)
    expect(reviewClearance(cleared, 50, good, true)).toEqual({ status: 'lost', on: 50, why: 'broke' })
    const poor = [...good, job(0.2), job(0.2), job(0.2)]
    expect(poorRun(poor)).toBe(true)
    expect(poorRun(poor.slice(0, -1))).toBe(false)
    expect(reviewClearance(cleared, 50, poor, false)).toEqual({ status: 'lost', on: 50, why: 'reads' })
    // Vetting can be lost too; a firm that never applied has nothing to lose.
    expect(reviewClearance({ status: 'vetting', applied: 40, ready: 82 }, 50, good, true).status).toBe('lost')
    expect(reviewClearance(NO_CLEARANCE, 50, poor, true)).toEqual(NO_CLEARANCE)
    const lost = { ...known(), clearance: { status: 'lost', on: 280, why: 'broke' } as const }
    expect(clearanceBlock(lost)).toBe('wait')
    expect(clearanceBlock({ ...lost, day: 280 + CLEARANCE.reapplyAfter })).toBeNull()
  })

  it('lets defence briefs reach only a cleared firm’s board', () => {
    const defence = { ...briefTemplate('belyanka-club')!, defence: true as const }
    expect(openTo(defence, REPUTATION.max)).toBe(false)
    expect(openTo(defence, REPUTATION.max, true)).toBe(true)
    expect(clearanceOn({ status: 'vetting', applied: 0, ready: 42 }, 41).status).toBe('vetting')
  })
})

describe('defence secrecy (PR 10x)', () => {
  it('counts a defence job toward the correlation score but never the public reputation or the legacy card', () => {
    const open = [job(0.005), job(0.005)]
    const withSecret = [...open, job(0.005, true)]
    expect(reputationOf(withSecret)).toBe(reputationOf(open))
    expect(correlationScore(withSecret)).not.toBeNull()
    expect(correlationScore([job(0.08, true)])).toBeLessThan(correlationScore([job(0.005)])!)
    const card = legacyOf({ ...newCareer(2), history: withSecret })
    expect(card.jobs).toBe(2)
    expect(card.earned).toBe(150000)
  })

  it('keeps clearance and secret jobs in saves; an older career has never applied', () => {
    const s: CareerState = { ...known(), clearance: { status: 'vetting', applied: 300, ready: 342 }, history: [job(0.01, true)] }
    const back = soundCareer(JSON.parse(JSON.stringify(s)))!
    expect(back.clearance).toEqual(s.clearance)
    expect(back.history[0]!.secret).toBe(true)
    const { clearance: _gone, ...older } = known()
    expect(soundCareer(JSON.parse(JSON.stringify(older)))!.clearance).toEqual(NO_CLEARANCE)
    expect(soundCareer({ ...JSON.parse(JSON.stringify(s)), clearance: { status: 'cleared' } })).toBeNull()
  })
})
