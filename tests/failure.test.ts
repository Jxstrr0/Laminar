import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST, type CyclistDesign } from '../src/data/cyclist'
import { DEFAULT_JUMPER } from '../src/data/jumper'
import { FAILURE } from '../src/data/failure'
import { STANDARD_ORDER } from '../src/data/model'
import { acceptBrief, newCareer, repairModel } from '../src/sim/career'
import { fixFor, flutterSpeed, repairQuote, stepStrain, strains, wobbleOf, type MountedModel, type Strain, type StrainClock } from '../src/sim/failure'
import { quote, type ModelOrder } from '../src/sim/modelShop'

const design = (patch: Partial<CyclistDesign> = {}): CyclistDesign => ({ ...structuredClone(DEFAULT_CYCLIST), ...patch })
const model = (order: Partial<ModelOrder> = {}, d: CyclistDesign = design()): MountedModel => ({ order: { ...STANDARD_ORDER, ...order }, design: d })
const longTail = design({ helmet: { kind: 'aero', tail: 0.8, vents: 0.1 } })

/** Hold one strain for `seconds` in 1/60 s steps; the step it broke on, or null. */
function hold(level: number, seconds: number, clock: StrainClock = {}) {
  const s: Strain = { mode: 'flutter', part: 'tail', level }
  let c = clock
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const step = stepStrain(c, [s], 1 / 60)
    if (step.broke) return { broke: i, clock: step.clock, warn: step.warn }
    c = step.clock
  }
  return { broke: null, clock: c, warn: stepStrain(c, [s], 0).warn }
}

describe('tunnel failures', () => {
  it('gives long helmet tails and disc covers a flutter speed, lower on big printed models', () => {
    expect(flutterSpeed(model({}, design({ helmet: { kind: 'road', tail: 0, vents: 0.8 } })), 'tail')).toBeNull()
    const sanded = flutterSpeed(model({}, longTail), 'tail')!
    expect(sanded).toBeCloseTo(FAILURE.flutter.tail.base - FAILURE.flutter.tail.perTail * 0.8)
    expect(flutterSpeed(model({ finish: 'printed' }, longTail), 'tail')!).toBeLessThan(sanded)
    expect(flutterSpeed(model({ scale: 4 }, longTail), 'tail')!).toBeGreaterThan(sanded)
    expect(flutterSpeed(model({}, design({ wheels: { front: 'deep', rear: 'deep' } })), 'disc')).toBeNull()
    expect(flutterSpeed(model({}, design({ wheels: { front: 'deep', rear: 'disc' } })), 'disc')).toBe(FAILURE.flutter.disc)
  })

  it('checks the posts on every rider model and the glued helmet only on printed ones', () => {
    const plain = strains(model(), 20, 30).map((s) => s.part)
    expect(plain).toContain('posts')
    expect(plain).not.toContain('helmet')
    const posts = strains(model(), 20, FAILURE.mountN).find((s) => s.part === 'posts')!
    expect(posts.level).toBe(1)
    expect(strains(model({ finish: 'printed' }), FAILURE.detachSpeed, 0).find((s) => s.part === 'helmet')!.level).toBe(1)
  })

  it('hangs a jumper on its sting, which takes lift and drag, not on the posts', () => {
    const jumper: MountedModel = { order: STANDARD_ORDER, design: DEFAULT_JUMPER }
    const parts = strains(jumper, 30, 100).map((s) => s.part)
    expect(parts).toEqual(['sting'])
    expect(strains(jumper, 30, FAILURE.stingN)[0]!.level).toBe(1)
    // A tunnel tech who's good with mounts makes the sting hold more too.
    expect(strains(jumper, 30, FAILURE.stingN, 1.25)[0]!.level).toBeCloseTo(0.8)
  })

  it('always warns before it breaks, and only breaks when held past the limit', () => {
    expect(hold(FAILURE.warnAt - 0.01, 10)).toMatchObject({ broke: null, warn: null })
    // In the warning band: it buzzes, but never breaks.
    const buzz = hold(0.97, 30)
    expect(buzz.broke).toBeNull()
    expect(buzz.warn?.part).toBe('tail')
    // Past the limit: it lets go after the hold time, not before.
    const over = hold(1.05, 10)
    expect(over.broke).toBe(Math.round(FAILURE.holdSeconds.flutter * 60) - 1)
    expect(over.clock).toEqual({})
  })

  it('forgives a quick touch past the limit once you back off', () => {
    const touched = hold(1.05, FAILURE.holdSeconds.flutter * 0.8)
    expect(touched.broke).toBeNull()
    const eased = hold(0.5, FAILURE.holdSeconds.flutter, touched.clock)
    expect(eased.clock).toEqual({})
    expect(hold(1.05, FAILURE.holdSeconds.flutter * 0.8, eased.clock).broke).toBeNull()
  })

  it('wobbles the balance more the deeper into the warning band', () => {
    expect(wobbleOf(null)).toBe(0)
    const at = (level: number) => wobbleOf({ mode: 'mount', part: 'posts', level })
    expect(at(FAILURE.warnAt)).toBe(0)
    expect(at(1)).toBeCloseTo(FAILURE.wobble)
    expect(at(2)).toBeCloseTo(FAILURE.wobble)
    expect(at(0.95)).toBeGreaterThan(0)
  })

  it('repairs for half the price and days, plus the screens when it tore off the mount', () => {
    const order = { ...STANDARD_ORDER }
    const full = quote(order)
    const flutter = repairQuote(order, { mode: 'flutter', part: 'tail' })
    expect(flutter.price).toBe(full.price / 2)
    expect(flutter.days).toBe(Math.ceil(full.days / 2))
    expect(flutter.screens).toBe(0)
    expect(repairQuote(order, { mode: 'mount', part: 'posts' }).screens).toBe(FAILURE.repair.screens)
  })

  it('spends the repair from the job, and refuses one the days can’t cover', () => {
    const c = acceptBrief(newCareer(7), 'selivan-regional')
    const r = repairModel(c, 13000, 4)
    expect(r.money).toBe(c.money - 13000)
    expect(r.job!.daysLeft).toBe(c.job!.daysLeft - 4)
    expect(r.day).toBe(c.day + 4)
    expect(repairModel(c, 13000, c.job!.daysLeft + 1)).toBe(c)
    const free = repairModel(newCareer(7), 13000, 4)
    expect(free.day).toBe(0)
  })

  it('points each break at what to change', () => {
    expect(fixFor({ mode: 'flutter', part: 'tail' })).toBe('helmet')
    expect(fixFor({ mode: 'flutter', part: 'disc' })).toBe('wheels')
    expect(fixFor({ mode: 'mount', part: 'posts' })).toBe('shop')
    expect(fixFor({ mode: 'mount', part: 'sting' })).toBe('shop')
    expect(fixFor({ mode: 'detach', part: 'helmet' })).toBe('shop')
  })
})
