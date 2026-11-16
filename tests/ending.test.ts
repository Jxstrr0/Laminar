import { describe, expect, it } from 'vitest'
import { CAREER } from '../src/data/briefs'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import {
  acceptBrief,
  buyMachine,
  charge,
  defaultFirmName,
  deliver,
  firmName,
  hireStaff,
  nameFirm,
  newCareer,
  placeBid,
  retire,
  tidyFirmName,
  waitForBriefs,
  type CareerState,
} from '../src/sim/career'
import { legacyOf } from '../src/sim/legacy'
import { packSave, parseSave, soundCareer, SAVE_VERSION } from '../src/persist/save'
import { newLab } from '../src/sim/lab'

describe('the firm’s name', () => {
  it('starts with a ready-made name picked by the seed', () => {
    const c = newCareer(7)
    expect(c.firm).toBeNull()
    expect(CAREER.firmNames).toContain(firmName(c))
    expect(firmName(c)).toBe(defaultFirmName(7))
    const names = new Set(Array.from({ length: 40 }, (_, i) => defaultFirmName(i + 1)))
    expect(names.size).toBeGreaterThan(1)
  })

  it('takes a typed name, tidied, and keeps the ready-made one for a blank', () => {
    expect(firmName(nameFirm(newCareer(7), '  Kelbo   Aero  '))).toBe('Kelbo Aero')
    expect(tidyFirmName('x'.repeat(60))).toHaveLength(CAREER.firmNameMax)
    const blank = nameFirm(newCareer(7), '   ')
    expect(blank.firm).toBe(defaultFirmName(7))
  })
})

describe('retiring', () => {
  it('ends the career today, but not with a job in hand', () => {
    const c = { ...newCareer(7), day: 400 }
    expect(retire(c).ended).toEqual({ day: 400, why: 'retired' })
    const busy = acceptBrief(c, c.board[0]!.id)
    expect(retire(busy)).toBe(busy)
  })

  it('closes the career: nothing in it changes any more', () => {
    const done = retire({ ...newCareer(7), money: 5_000_000 })
    expect(acceptBrief(done, done.board[0]!.id)).toBe(done)
    expect(placeBid(done, done.board[0]!.id, { price: 1000, promise: 1 })).toBeNull()
    expect(waitForBriefs(done)).toBe(done)
    expect(charge(done, 500)).toBe(done)
    expect(buyMachine(done, 'fdm')).toBe(done)
    expect(hireStaff(done, 'orlik')).toBe(done)
    expect(nameFirm(done, 'Late Name')).toBe(done)
    expect(retire(done)).toBe(done)
  })
})

describe('reaching 2040', () => {
  it('ends the career after the job that reaches it', () => {
    const base: CareerState = { ...newCareer(7), day: CAREER.endDay - 3 }
    const onJob = acceptBrief(base, base.board[0]!.id)
    const d = deliver(onJob, DEFAULT_CYCLIST, 0.25)!
    expect(d.state.day).toBeGreaterThanOrEqual(CAREER.endDay)
    expect(d.state.ended).toEqual({ day: d.state.day, why: 'year2040' })
  })

  it('ends it after a wait that reaches it, and not a day before', () => {
    const early = waitForBriefs({ ...newCareer(7), day: 100 })
    expect(early.ended).toBeNull()
    const late = waitForBriefs({ ...newCareer(7), day: CAREER.endDay - 1 })
    expect(late.ended?.why).toBe('year2040')
  })
})

describe('the legacy card', () => {
  it('tells the career’s story from its record', () => {
    const base = nameFirm(newCareer(7), 'Kelbo Aero')
    const d = deliver(acceptBrief(base, base.board[0]!.id), DEFAULT_CYCLIST, 0.25)!
    const L = legacyOf(retire(d.state))
    expect(L.firm).toBe('Kelbo Aero')
    expect(L.jobs).toBe(1)
    expect(L.earned).toBe(d.paid)
    expect(L.best?.cut).toBeCloseTo(d.debrief.achieved, 9)
    expect(L.ending?.why).toBe('retired')
    expect(L.toDay).toBe(d.state.day)
    expect(legacyOf(newCareer(7)).best).toBeNull()
  })
})

describe('names and endings in saves', () => {
  it('round-trip, and older careers read as unnamed and running', () => {
    const c = retire(nameFirm(newCareer(7), 'Kelbo Aero'))
    const back = parseSave(packSave({ v: SAVE_VERSION, savedAt: 0, design: DEFAULT_CYCLIST, lab: newLab(), career: c }))
    expect(back?.career.firm).toBe('Kelbo Aero')
    expect(back?.career.ended).toEqual(c.ended)
    const { firm: _f, ended: _e, ...old } = newCareer(7)
    expect(soundCareer(old)?.firm).toBeNull()
    expect(soundCareer(old)?.ended).toBeNull()
    expect(soundCareer({ ...newCareer(7), firm: '' })).toBeNull()
    expect(soundCareer({ ...newCareer(7), ended: { day: 3, why: 'bored' } })).toBeNull()
  })
})
