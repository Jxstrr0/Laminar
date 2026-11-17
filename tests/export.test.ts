import { describe, expect, it } from 'vitest'
import { BRIEFS } from '../src/data/briefs'
import { COUNTRIES, COUNTRY_IDS } from '../src/data/export'
import { FOREIGN_RIVAL_IDS, RIVALS, RIVAL_IDS } from '../src/data/rivals'
import { RECORDS } from '../src/data/records'
import { TCF_TIME_TRIAL } from '../src/data/rules'
import { DEFAULT_JUMPER } from '../src/data/jumper'
import type { CyclistDesign } from '../src/data/cyclist'
import { biddersFor, boardFor, briefTemplate, deliver, deliverJump, newCareer, openTo, rulesFor, type CareerState } from '../src/sim/career'
import { checkRules } from '../src/sim/cyclist'

const exportBriefs = BRIEFS.filter((b) => b.country)

function onJob(id: string, seed: number): CareerState {
  const b = briefTemplate(id)!
  return { ...newCareer(3), job: { brief: { id, fee: 100000, days: b.days, seed }, promise: 1, startDay: 0, daysLeft: b.days, spent: 0 } }
}

const fastRider = (s: CyclistDesign): CyclistDesign => ({
  ...s,
  posture: { ...s.posture, torsoDeg: 12, headDrop: 0.55, armWidth: 0.28 },
  helmet: { kind: 'aero', tail: 0.3, vents: 0.05 },
  suit: { fabric: 'smooth', armTrips: true },
  bars: 'aero',
  wheels: { front: 'deep', rear: 'disc' },
  frame: 'kamm',
})

describe('export countries (PR 11f)', () => {
  it('two countries, each with two briefs, its own rulebook and its own firm', () => {
    expect(COUNTRY_IDS).toHaveLength(2)
    for (const c of COUNTRY_IDS) {
      expect(exportBriefs.filter((b) => b.country === c)).toHaveLength(2)
      expect(COUNTRIES[c].rules.id).not.toBe(TCF_TIME_TRIAL.id)
      expect(FOREIGN_RIVAL_IDS.filter((f) => RIVALS[f].country === c)).toHaveLength(1)
    }
    // The Tarnovian firms stay at home.
    for (const f of RIVAL_IDS) expect(RIVALS[f].country).toBeUndefined()
  })

  it('clients abroad call only once the firm’s name is good enough', () => {
    for (const b of exportBriefs) {
      const gate = COUNTRIES[b.country!].minRep
      expect(openTo(b, gate - 1)).toBe(false)
      expect(openTo(b, Math.max(gate, b.minRep ?? 0))).toBe(true)
    }
    const seen = (rep: number) => {
      const ids = new Set<string>()
      for (let round = 1; round < 120; round++) for (const b of boardFor(5, round, false, rep)) ids.add(b.id)
      return ids
    }
    const low = seen(55)
    const high = seen(100)
    for (const b of exportBriefs) {
      expect(low.has(b.id)).toBe(false)
      expect(high.has(b.id)).toBe(true)
    }
  })

  it('each country’s own firm bids against you there, and nobody else', () => {
    expect(biddersFor('kostka-altitude')).toEqual(['vershina'])
    expect(biddersFor('lisac-coast')).toEqual(['bereg'])
    expect(biddersFor('tvardov-national')).not.toContain('vershina')
  })

  it('rides abroad under that country’s rulebook', () => {
    expect(rulesFor('kostka-altitude')).toBe(COUNTRIES.gornova.rules)
    expect(rulesFor('lisac-coast')).toBe(COUNTRIES.zelenia.rules)
    expect(rulesFor('tvardov-national')).toBe(TCF_TIME_TRIAL)
    expect(rulesFor(undefined)).toBe(TCF_TIME_TRIAL)
    // A front disc is legal in Gornova, not at home; hands high enough for the Gornovans break the Zelenian league's rule.
    const disc: CyclistDesign = { ...(briefTemplate('kostka-altitude')!.setup as CyclistDesign), wheels: { front: 'disc', rear: 'disc' } }
    expect(checkRules(disc, COUNTRIES.gornova.rules).some((r) => r.rule === 'frontWheel')).toBe(false)
    expect(checkRules(disc, TCF_TIME_TRIAL).some((r) => r.rule === 'frontWheel')).toBe(true)
    const high: CyclistDesign = { ...disc, wheels: { front: 'deep', rear: 'disc' }, posture: { ...disc.posture, handHeight: 0.1 } }
    expect(checkRules(high, COUNTRIES.gornova.rules)).toEqual([])
    expect(checkRules(high, COUNTRIES.zelenia.rules).length).toBeGreaterThan(0)
  })

  it('a well-shaped design keeps the promise abroad; their old setups gain nothing', () => {
    for (const b of exportBriefs.filter((x) => !x.event.jump)) {
      const old = deliver(onJob(b.id, 2), b.setup, 0.25)!
      expect(Math.abs(old.debrief.achieved)).toBeLessThan(0.5)
      const good = deliver(onJob(b.id, 2), fastRider(b.setup as CyclistDesign), 0.22)!
      expect(good.debrief.achieved).toBeGreaterThan(b.target)
      expect(checkRules(fastRider(b.setup as CyclistDesign), rulesFor(b.id))).toEqual([])
    }
  })

  it('a fast ride or a long jump abroad never counts for a Tarnovian record', () => {
    const b = briefTemplate('kostka-altitude')!
    const fast = [1, 2, 3, 4, 5, 6].map((s) => deliver(onJob(b.id, s), fastRider(b.setup as CyclistDesign), 0.22)!)
    // The thin air makes it quick: faster than the Tarnovian record on some days.
    expect(fast.some((d) => (d.result.distance / d.result.time) * 3.6 > RECORDS.timeTrial.value)).toBe(true)
    for (const d of fast) expect(d.mark).toBeNull()
    for (const s of [1, 2, 3, 4, 5, 6]) expect(deliverJump(onJob('horakova-hill', s), DEFAULT_JUMPER, 125)!.mark).toBeNull()
  })
})

describe('export on screen (PR 11g)', () => {
  it('every rulebook a job can be ridden under has a name for the rule-break lines', async () => {
    const { STRINGS } = await import('../src/data/strings')
    for (const rules of [TCF_TIME_TRIAL, ...COUNTRY_IDS.map((c) => COUNTRIES[c].rules)]) expect(STRINGS).toHaveProperty(`book.${rules.id}`)
  })
})
