import { describe, expect, it } from 'vitest'
import { HILLS } from '../src/data/hills'
import { CLUB_JUMPER, DEFAULT_JUMPER, PITCH, type JumperDesign } from '../src/data/jumper'
import { attitudeAt, fly, hillSurface, jumpDay, jumperForces, jumperReadouts, referenceJump, staticMargin, wobbleLoss, type JumpEvent } from '../src/sim/jumper'

const tweak = (p: Partial<JumperDesign['posture']>, bagginess = DEFAULT_JUMPER.suit.bagginess): JumperDesign => ({
  ...DEFAULT_JUMPER,
  posture: { ...DEFAULT_JUMPER.posture, ...p },
  suit: { bagginess },
})
const event = (hill: keyof typeof HILLS, headwind = 0): JumpEvent => ({
  hill: HILLS[hill],
  mass: 65,
  temperature: -2,
  altitude: 700,
  headwind,
  spread: { temperature: 3, wind: 1, speed: 0.3 },
})
const still = (hill: keyof typeof HILLS, headwind = 0) => ({ temperature: -2, altitude: 700, headwind, takeoffSpeed: HILLS[hill].takeoffSpeed, mass: 65 })

describe('the ski jumper in the air', () => {
  it('flies like a wing: lift a little over drag at the held angle', () => {
    const f = jumperForces(DEFAULT_JUMPER, 34, 0.03)
    expect(f.clA).toBeGreaterThan(0.45)
    expect(f.clA).toBeLessThan(0.8)
    expect(f.lOverD).toBeGreaterThan(1)
    expect(f.lOverD).toBeLessThan(1.5)
  })

  it('lifts more with a baggier suit, a flatter body and a wider V', () => {
    const lift = (d: JumperDesign) => jumperForces(d, 34, 0).clA
    expect(lift(tweak({}, 0.8))).toBeGreaterThan(lift(tweak({}, 0.1)))
    expect(lift(tweak({ leanDeg: 8 }))).toBeGreaterThan(lift(tweak({ leanDeg: 20 })))
    expect(lift(tweak({ vAngleDeg: 42 }))).toBeGreaterThan(lift(tweak({ vAngleDeg: 15 })))
  })

  it('pays for a baggy suit in pitch stability', () => {
    expect(staticMargin(DEFAULT_JUMPER, 34)).toBeGreaterThan(PITCH.floor)
    expect(staticMargin(tweak({}, 0.6), 34)).toBeLessThan(staticMargin(DEFAULT_JUMPER, 34))
    expect(staticMargin(tweak({}, 1), 37)).toBeLessThan(0)
  })

  it('settles into its angle after the take-off, then floats up a little', () => {
    expect(attitudeAt(0)).toBeLessThan(attitudeAt(0.7))
    expect(attitudeAt(3)).toBeGreaterThan(attitudeAt(0.7))
  })
})

describe('the hills', () => {
  it('steepen to the landing slope, then flatten into the outrun', () => {
    for (const hill of Object.values(HILLS)) {
      const s = hillSurface(hill)
      for (let i = 1; i < s.y.length; i++) {
        expect(s.y[i]!).toBeLessThanOrEqual(s.y[i - 1]!)
        expect(s.s[i]!).toBeGreaterThan(s.s[i - 1]!)
      }
    }
  })

  it('puts a sound jumper near the K point of each hill in still air', () => {
    for (const id of ['normal', 'large'] as const) {
      const f = fly(DEFAULT_JUMPER, HILLS[id], still(id))
      expect(f.distance).toBeGreaterThan(HILLS[id].k - 8)
      expect(f.distance).toBeLessThan(HILLS[id].k + 8)
      expect(f.time).toBeGreaterThan(2.5)
      expect(f.time).toBeLessThan(5)
    }
  })

  it('sends an old-school flight well short', () => {
    expect(fly(CLUB_JUMPER, HILLS.normal, still('normal')).distance).toBeLessThan(fly(DEFAULT_JUMPER, HILLS.normal, still('normal')).distance - 15)
  })

  it('flies further into a headwind and shorter with a tailwind', () => {
    const d = (w: number) => fly(DEFAULT_JUMPER, HILLS.normal, still('normal', w)).distance
    expect(d(2)).toBeGreaterThan(d(0))
    expect(d(-2)).toBeLessThan(d(0))
  })
})

describe('pitch trouble', () => {
  const baggy = tweak({}, 1)

  it('tips a jumper with no margin forward, and the jump ends short', () => {
    const tipped = fly(baggy, HILLS.normal, still('normal'))
    const held = fly(baggy, HILLS.normal, still('normal'), false)
    expect(tipped.pitchedAt).not.toBeNull()
    expect(held.pitchedAt).toBeNull()
    expect(tipped.distance).toBeLessThan(held.distance - 20)
  })

  it('wobbles the landing between zero and the floor', () => {
    expect(wobbleLoss(PITCH.floor)).toBe(0)
    expect(wobbleLoss(PITCH.floor / 2)).toBeGreaterThan(0)
    expect(wobbleLoss(0)).toBeGreaterThan(wobbleLoss(PITCH.floor / 2))
    expect(wobbleLoss(-0.01)).toBe(0)
  })

  it('names the trouble on the day and says what it cost', () => {
    const r = jumpDay(baggy, event('normal'), 3)
    expect(r.trouble).toBe('pitch')
    expect(r.lostToPitch).toBeGreaterThan(10)
    expect(r.distance).toBeCloseTo(r.clean - r.lostToPitch, 6)
    const sound = jumpDay(DEFAULT_JUMPER, event('normal'), 3)
    expect(sound.trouble).toBeNull()
    expect(sound.lostToPitch).toBe(0)
  })

  it('judges the promise in still air, and only for a stable flight', () => {
    const sound = referenceJump(DEFAULT_JUMPER, event('large', 3))
    expect(sound.stable).toBe(true)
    expect(sound.distance).toBeCloseTo(fly(DEFAULT_JUMPER, HILLS.large, still('large'), false).distance, 6)
    const loose = referenceJump(baggy, event('large'))
    expect(loose.stable).toBe(false)
    // The yardstick ignores the pitch itself: a long clean flight that doesn't count.
    expect(loose.distance).toBeGreaterThan(sound.distance)
  })
})

describe('the jump day', () => {
  it('is the same for the same seed, and the day varies with it', () => {
    const a = jumpDay(DEFAULT_JUMPER, event('normal'), 11)
    expect(jumpDay(DEFAULT_JUMPER, event('normal'), 11)).toEqual(a)
    const b = jumpDay(DEFAULT_JUMPER, event('normal'), 12)
    expect(b.distance).not.toBe(a.distance)
  })

  it('reads out the kit and the flight', () => {
    const r = jumperReadouts(DEFAULT_JUMPER)
    expect(r.liftArea).toBeGreaterThan(1)
    expect(r.margin).toBeGreaterThan(PITCH.floor)
    expect(jumperReadouts(tweak({}, 1)).price).toBeGreaterThan(r.price)
  })
})
