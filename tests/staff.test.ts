import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { STAFF, STAFF_IDS, STAFF_ROLES } from '../src/data/staff'
import { UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { FAILURE } from '../src/data/failure'
import { acceptBrief, deliver, hireStaff, letStaffGo, newCareer, orderModel, passDays, waitForBriefs, type CareerState } from '../src/sim/career'
import { NO_FACILITY, tunnelSetup } from '../src/sim/facility'
import { quote, type ModelOrder } from '../src/sim/modelShop'
import { repairQuote, strains } from '../src/sim/failure'
import { crewEffects, crewIds, NO_CREW, soundCrew, wagesPerDay } from '../src/sim/staff'
import { packSave, parseSave, soundCareer, SAVE_VERSION } from '../src/persist/save'
import { newLab } from '../src/sim/lab'

const order: ModelOrder = { scale: 2, finish: 'sanded', grade: 'standard', trips: false, taps: false }

describe('the staff list', () => {
  it('has two people for each role, each with a wage and a trait', () => {
    for (const role of STAFF_ROLES) expect(STAFF_IDS.filter((id) => STAFF[id].role === role)).toHaveLength(2)
    for (const id of STAFF_IDS) {
      expect(STAFF[id].wage).toBeGreaterThan(0)
      expect(Object.keys(STAFF[id].trait)).toHaveLength(1)
    }
  })
})

describe('hiring', () => {
  it('keeps one per role, three at most, and a new hire replaces the old', () => {
    let c = newCareer(5)
    for (const id of STAFF_IDS) c = hireStaff(c, id)
    expect(crewIds(c.crew)).toHaveLength(3)
    expect(c.crew).toEqual({ maker: 'venko', tech: 'krasna', analyst: 'sorokova' })
    c = hireStaff(c, 'orlik')
    expect(c.crew.maker).toBe('orlik')
    c = letStaffGo(c, 'venko')
    expect(c.crew.maker).toBe('orlik')
    c = letStaffGo(c, 'orlik')
    expect(c.crew.maker).toBeUndefined()
    expect(crewIds(c.crew)).toHaveLength(2)
  })

  it('costs nothing up front: wages are paid for each day that passes', () => {
    const c = hireStaff(hireStaff(newCareer(5), 'orlik'), 'basov')
    expect(c.money).toBe(newCareer(5).money)
    const daily = STAFF.orlik.wage + STAFF.basov.wage
    expect(wagesPerDay(c.crew)).toBe(daily)
    expect(passDays(c, 7).money).toBe(c.money - 7 * daily)
    const waited = waitForBriefs(c)
    expect(c.money - waited.money).toBe((waited.day - c.day) * daily)
  })

  it('pays wages through model days and up to race day, off the job’s tally', () => {
    const base = newCareer(5)
    const hired = hireStaff(acceptBrief(base, base.board[0]!.id), 'zhelin')
    const ordered = orderModel(hired, 10000, 4)
    expect(ordered.money).toBe(hired.money - 10000 - 4 * STAFF.zhelin.wage)
    expect(ordered.job!.spent).toBe(hired.job!.spent + 10000)
    const d = deliver(ordered, DEFAULT_CYCLIST, 0.25)!
    expect(d.wages).toBe(ordered.job!.daysLeft * STAFF.zhelin.wage)
    expect(d.state.money).toBe(ordered.money + d.paid - d.upkeep - d.wages)
  })
})

describe('what each trait does', () => {
  it('a model maker makes models quicker or cheaper, repairs too', () => {
    const plain = quote(order)
    const quick = quote(order, crewEffects({ maker: 'orlik' }))
    const thrifty = quote(order, crewEffects({ maker: 'venko' }))
    expect(quick.days).toBeLessThan(plain.days)
    expect(quick.price).toBe(plain.price)
    expect(thrifty.price).toBeLessThan(plain.price)
    expect(thrifty.days).toBe(plain.days)
    const f = { mode: 'flutter', part: 'tail' } as const
    expect(repairQuote(order, f, crewEffects({ maker: 'venko' })).price).toBeLessThan(repairQuote(order, f).price)
    expect(quote(order, crewEffects(NO_CREW))).toEqual(plain)
  })

  it('a tunnel tech steadies the balance or strengthens the mount', () => {
    const plain = tunnelSetup(5, NO_FACILITY, 0)
    const steady = tunnelSetup(5, NO_FACILITY, 0, { tech: 'basov' })
    const mounts = tunnelSetup(5, NO_FACILITY, 0, { tech: 'krasna' })
    expect(plain.build.balanceNoise).toBe(UNIVERSITY_TUNNEL.balanceNoise)
    expect(steady.build.balanceNoise).toBeLessThan(plain.build.balanceNoise)
    expect(mounts.mountStrength).toBeGreaterThan(1)
    expect(new Set([plain.key, steady.key, mounts.key]).size).toBe(3)
    // Hiring an analyst doesn't change the tunnel.
    expect(tunnelSetup(5, NO_FACILITY, 0, { analyst: 'zhelin' }).key).toBe(plain.key)
    const model = { order, design: DEFAULT_CYCLIST }
    const posts = (s: number) => strains(model, 20, FAILURE.mountN, s).find((x) => x.mode === 'mount')!.level
    expect(posts(1)).toBeCloseTo(1, 9)
    expect(posts(mounts.mountStrength)).toBeLessThan(1)
  })

  it('an analyst narrows the desk estimate', () => {
    expect(crewEffects({ analyst: 'zhelin' }).deskLevel).toBeGreaterThan(crewEffects({ analyst: 'sorokova' }).deskLevel)
    expect(crewEffects(NO_CREW).deskLevel).toBe(0)
  })
})

describe('staff in saves', () => {
  it('round-trips the crew and reads older careers as having none', () => {
    const c: CareerState = hireStaff(hireStaff(newCareer(9), 'krasna'), 'zhelin')
    const back = parseSave(packSave({ v: SAVE_VERSION, savedAt: 0, design: DEFAULT_CYCLIST, lab: newLab(), career: c }))
    expect(back?.career.crew).toEqual(c.crew)
    const { crew: _c, ...old } = newCareer(9)
    expect(soundCareer(old)?.crew).toEqual({})
  })

  it('turns away a crew the game could not have made', () => {
    expect(soundCrew({ maker: 'basov' })).toBeNull()
    expect(soundCrew({ cook: 'orlik' })).toBeNull()
    expect(soundCrew({ maker: 'nobody' })).toBeNull()
    expect(soundCrew([])).toBeNull()
    expect(soundCrew({ maker: 'orlik', analyst: 'sorokova' })).toEqual({ maker: 'orlik', analyst: 'sorokova' })
  })
})
