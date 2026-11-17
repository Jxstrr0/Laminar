import { describe, expect, it } from 'vitest'
import { BRIEFS } from '../src/data/briefs'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { botBid, deliverAny, knobsOf, legal, modelQuote, playCareer, practise, runsCost, shapeFor, type ShapeCache } from '../src/sim/bot'
import { deliver, deliverSled, newCareer, ruleBreaksFor, type CareerState } from '../src/sim/career'
import type { BobsledDesign } from '../src/data/bobsled'
import { sportOf, SPORTS } from '../src/sim/design'

/** A career with this brief's job in hand at the client's ask. */
function onJob(id: string): CareerState {
  const t = BRIEFS.find((b) => b.id === id)!
  const state = newCareer(1)
  return { ...state, job: { brief: { id, fee: t.fee.min, days: t.days, seed: 1 }, promise: t.target, startDay: 0, daysLeft: t.days, spent: 0 } }
}

describe('the balance bot', () => {
  it('finds knobs on every sport, each a real part of the design', () => {
    for (const sport of SPORTS) {
      const t = BRIEFS.find((b) => sportOf(b.setup) === sport)
      if (!t) continue
      const knobs = knobsOf(t.setup)
      expect(knobs.length, sport).toBeGreaterThan(2)
      for (const k of knobs) {
        let node: unknown = t.setup
        for (const key of k.path) node = (node as Record<string, unknown>)[key]
        if (k.kind === 'num') expect(typeof node).toBe('number')
        if (k.kind === 'pick') expect(k.options).toContain(node)
        if (k.kind === 'flag') expect(typeof node).toBe('boolean')
      }
      // The client's kit stays theirs.
      expect(knobs.some((k) => ['sport', 'class', 'crew', 'trailerTop'].includes(k.path[k.path.length - 1]!))).toBe(false)
    }
  })

  it('delivers any sport and reads the day in the unit it declares in', () => {
    for (const sport of SPORTS) {
      const t = BRIEFS.find((b) => sportOf(b.setup) === sport)
      if (!t) continue
      const done = deliverAny(onJob(t.id), t.setup, 1)!
      expect(done.state.history).toHaveLength(1)
      expect(done.record.id).toBe(t.id)
      // The client's own setup gains nothing on itself.
      expect(done.record.achieved).toBeCloseTo(0, 6)
    }
  })

  it('holds itself to the cycling rule box', () => {
    expect(legal(DEFAULT_CYCLIST, 'selivan-regional')).toBe(true)
    const reach = { ...DEFAULT_CYCLIST, posture: { ...DEFAULT_CYCLIST.posture, handReach: 0.9 } }
    expect(legal(reach, 'selivan-regional')).toBe(false)
  })

  it('shapes a design that beats the client setup on its practice days, inside the rules', () => {
    const state = onJob('stepnoy-pod')
    const before = practise(state, BRIEFS.find((b) => b.id === 'stepnoy-pod')!.setup)
    const shot = shapeFor(state)!
    expect(shot.practice.mean).toBeGreaterThan(before.mean + 5)
    expect(shot.practice.worst).toBeLessThanOrEqual(shot.practice.mean)
    expect(legal(shot.design, 'stepnoy-pod')).toBe(true)
    // Same brief, same shape: the bot is deterministic.
    expect(shapeFor(state)).toEqual(shot)
  })

  it('bids its worst practice day less the margin, inside the limits, and passes on a thin one', () => {
    const bid = botBid('selivan-regional', { mean: 12, worst: 10, actual: 0.25 })!
    expect(bid.promise).toBe(9.5)
    const t = BRIEFS.find((b) => b.id === 'selivan-regional')!
    expect(bid.price).toBeGreaterThanOrEqual(t.fee.min)
    expect(bid.price).toBeLessThanOrEqual(t.fee.max)
    expect(botBid('selivan-regional', { mean: 1, worst: 1, actual: 0.25 })).toBeNull()
  })

  it('charges a model and runs, cheaper in its own tunnel', () => {
    expect(modelQuote('cycling').price).toBeGreaterThan(0)
    expect(modelQuote('truck').days).toBeGreaterThan(0)
    expect(runsCost('own')).toBeLessThan(runsCost('university'))
  })

  it('plays a career the same way twice, and keeps a tally', () => {
    // Skip the slow shaping: every brief as the client has it, with a made-up practice.
    const cache: ShapeCache = new Map(BRIEFS.map((b) => [b.id, { design: b.setup, practice: { mean: 6, worst: 5, actual: 1 } }]))
    const a = playCareer(3, cache, 12)
    const b = playCareer(3, cache, 12)
    expect(a.jobs.length).toBeGreaterThan(0)
    expect(a.jobs).toEqual(b.jobs)
    expect(a.bidsWon).toBe(a.jobs.length)
    expect(a.final.day).toBeGreaterThan(0)
    for (const j of a.jobs) expect(j.spent).toBeGreaterThan(0)
  })
})

describe('the rule box at delivery (PR 14d)', () => {
  it('won’t deliver a cyclist outside the rules, and says how many it breaks', () => {
    const state = onJob('selivan-regional')
    const illegal = { ...DEFAULT_CYCLIST, wheels: { front: 'disc' as const, rear: 'disc' as const }, posture: { ...DEFAULT_CYCLIST.posture, handReach: 0.9 } }
    expect(ruleBreaksFor('selivan-regional', illegal)).toBe(2)
    expect(deliver(state, illegal, 0.25)).toBeNull()
    expect(deliver(state, DEFAULT_CYCLIST, 0.25)).not.toBeNull()
    // Gornova's book allows a disc front wheel.
    expect(ruleBreaksFor('kostka-altitude', { ...DEFAULT_CYCLIST, wheels: { front: 'disc', rear: 'disc' } })).toBe(0)
  })

  it('won’t deliver a sled longer or higher than the sliding rules allow', () => {
    const state = onJob('kedrova-two')
    const setup = BRIEFS.find((b) => b.id === 'kedrova-two')!.setup as BobsledDesign
    const tall = { ...setup, sled: { ...setup.sled, cowl: 0.66 } }
    expect(ruleBreaksFor('kedrova-two', tall)).toBeGreaterThan(0)
    expect(deliverSled(state, tall, 50)).toBeNull()
    expect(deliverSled(state, setup, 50)).not.toBeNull()
  })

  it('leaves sports with no rule box alone', () => {
    for (const id of ['lenok-oval', 'zorin-junior', 'kovyl-haulage', 'belan-sport']) {
      expect(ruleBreaksFor(id, BRIEFS.find((b) => b.id === id)!.setup)).toBe(0)
    }
  })
})
