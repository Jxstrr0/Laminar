import { describe, expect, it } from 'vitest'
import { RESEARCH, RESEARCH_IDS } from '../src/data/research'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { firmEffects, newCareer, passDays, startResearch, type CareerState } from '../src/sim/career'
import { finishedResearch, researchBlock, researchReadyDay, researchUnderWay } from '../src/sim/research'
import { NO_FACILITY, tunnelSetup } from '../src/sim/facility'
import { NO_EFFECTS } from '../src/sim/staff'
import { packSave, parseSave, SAVE_VERSION, type SaveFile } from '../src/persist/save'
import { newLab } from '../src/sim/lab'

const rich = (money = 5_000_000): CareerState => ({ ...newCareer(7), money })

describe('the R&D tree', () => {
  it('has two tiers in each of the four areas, the second needing the first', () => {
    expect(RESEARCH_IDS).toHaveLength(8)
    for (const id of RESEARCH_IDS) {
      const needs = RESEARCH[id].needs
      if (needs) {
        expect(RESEARCH[needs].area).toBe(RESEARCH[id].area)
        expect(RESEARCH[needs].needs).toBeUndefined()
        expect(RESEARCH[id].price).toBeGreaterThan(RESEARCH[needs].price)
      }
    }
  })

  it('a new firm has done none of it and changes nothing', () => {
    const c = newCareer(7)
    expect(c.research).toEqual({})
    expect(firmEffects(c)).toEqual(NO_EFFECTS)
  })

  it('a project costs its price up front and is done its days later, while the firm works on', () => {
    const c = startResearch(rich(), 'balanceCal')
    expect(c.money).toBe(5_000_000 - RESEARCH.balanceCal.price)
    expect(c.research.balanceCal).toBe(0)
    expect(researchReadyDay(c.research, 'balanceCal')).toBe(RESEARCH.balanceCal.days)
    expect(researchUnderWay(c.research, 0)).toBe('balanceCal')
    expect(firmEffects(c).balanceNoise).toBe(1)
    const later = passDays(c, RESEARCH.balanceCal.days)
    expect(researchUnderWay(later.research, later.day)).toBeNull()
    expect(finishedResearch(later.research, later.day)).toEqual(['balanceCal'])
    expect(firmEffects(later).balanceNoise).toBeCloseTo(RESEARCH.balanceCal.effect.balanceNoise!)
  })

  it('runs one project at a time, wants the first tier before the second, and needs the money', () => {
    const c = startResearch(rich(), 'deskMethods')
    expect(researchBlock(c.research, c.day, c.money, 'carbonSkins')).toBe('busy')
    expect(startResearch(c, 'carbonSkins')).toBe(c)
    expect(researchBlock(c.research, c.day, c.money, 'deskMethods')).toBe('started')
    const done = passDays(c, RESEARCH.deskMethods.days)
    expect(researchBlock(done.research, done.day, done.money, 'quickMoulds')).toBe('needs')
    expect(researchBlock(done.research, done.day, done.money, 'fieldStudy')).toBeNull()
    expect(researchBlock(done.research, done.day, 1000, 'fieldStudy')).toBe('money')
    const both = passDays(startResearch(done, 'fieldStudy'), RESEARCH.fieldStudy.days)
    expect(firmEffects(both).deskLevel).toBe(3)
  })

  it('stacks with the staff: two balance projects and Timur Basov make a much quieter balance', () => {
    let c = startResearch(rich(), 'balanceCal')
    c = passDays(c, RESEARCH.balanceCal.days)
    c = passDays(startResearch(c, 'steadyBalance'), RESEARCH.steadyBalance.days)
    c = { ...c, crew: { tech: 'basov' } }
    expect(firmEffects(c).balanceNoise).toBeCloseTo(0.75 * 0.75 * 0.5)
    const plain = tunnelSetup(c.seed, NO_FACILITY, c.day)
    const quiet = tunnelSetup(c.seed, NO_FACILITY, c.day, c.crew, finishedResearch(c.research, c.day))
    expect(quiet.build.balanceNoise).toBeCloseTo(plain.build.balanceNoise * 0.75 * 0.75 * 0.5)
    expect(quiet.key).not.toBe(tunnelSetup(c.seed, NO_FACILITY, c.day, c.crew).key)
  })

  it('stiffer stings make the mounts take more load', () => {
    const c = passDays(startResearch(rich(), 'stiffStings'), RESEARCH.stiffStings.days)
    const s = tunnelSetup(c.seed, NO_FACILITY, c.day, c.crew, finishedResearch(c.research, c.day))
    expect(s.mountStrength).toBeCloseTo(1.3)
  })
})

describe('saving R&D', () => {
  const file = (career: CareerState): SaveFile => ({ v: SAVE_VERSION, savedAt: 1_763_200_000_000, design: structuredClone(DEFAULT_CYCLIST), lab: newLab(), career })

  it('keeps the projects through a save, and an old save has none', () => {
    const c = passDays(startResearch(rich(), 'carbonSkins'), 5)
    expect(parseSave(packSave(file(c)))!.career.research).toEqual({ carbonSkins: 0 })
    const old = JSON.parse(packSave(file(c))) as { career: Record<string, unknown> }
    delete old.career.research
    expect(parseSave(JSON.stringify(old))!.career.research).toEqual({})
  })

  it('refuses a project the game doesn’t have, or one started after today', () => {
    const c = passDays(rich(), 10)
    expect(parseSave(packSave(file({ ...c, research: { warpDrive: 1 } as never })))).toBeNull()
    expect(parseSave(packSave(file({ ...c, research: { carbonSkins: 11 } })))).toBeNull()
    expect(parseSave(packSave(file({ ...c, research: { carbonSkins: 1.5 } })))).toBeNull()
    expect(parseSave(packSave(file({ ...c, research: { carbonSkins: 10 } })))).not.toBeNull()
  })
})
