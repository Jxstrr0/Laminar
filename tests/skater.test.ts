import { describe, expect, it } from 'vitest'
import { DEFAULT_SKATER, ICE, SKATER_RANGE, UPRIGHT_SKATER, type SkaterDesign } from '../src/data/skater'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { REFERENCE_RIDER } from '../src/data/field'
import { designComfort, designEvent, designShape, isCyclist, isSkater, sportOf, sportRider } from '../src/sim/design'
import { skaterShape, standFactor } from '../src/sim/geom/skater'
import { skaterComfort, skaterReadouts } from '../src/sim/skater'
import { partChanges, postureChanged, swapParts } from '../src/sim/remodel'
import { changedControls } from '../src/sim/designDiff'
import { strains } from '../src/sim/failure'
import { soundDesign } from '../src/persist/save'
import { REFERENCE_TT, truth } from '../src/sim/views'
import { STANDARD_ORDER } from '../src/data/model'

/** An indoor oval: still air at racing speed. */
const OVAL = { ...REFERENCE_TT, windSpeed: 0, riderSpeed: 14 }
const cda = (d: SkaterDesign) => truth(skaterShape(d), OVAL).windAveragedCdA
const tweak = (p: Partial<SkaterDesign['posture']>, rest: Partial<SkaterDesign> = {}): SkaterDesign => ({
  ...DEFAULT_SKATER,
  ...rest,
  posture: { ...DEFAULT_SKATER.posture, ...p },
})

describe('the skater', () => {
  it('reads like a racing crouch, and standing tall costs plenty', () => {
    expect(cda(DEFAULT_SKATER)).toBeGreaterThan(0.14)
    expect(cda(DEFAULT_SKATER)).toBeLessThan(0.2)
    expect(cda(UPRIGHT_SKATER)).toBeGreaterThan(cda(DEFAULT_SKATER) * 1.2)
  })

  it('gets faster lower, with the head down and a hood on', () => {
    expect(cda(tweak({ kneeDeg: 95 }))).toBeLessThan(cda(DEFAULT_SKATER))
    expect(cda(tweak({ kneeDeg: 150 }))).toBeGreaterThan(cda(DEFAULT_SKATER))
    expect(cda(tweak({ trunkDeg: 6 }))).toBeLessThan(cda(DEFAULT_SKATER))
    expect(cda(tweak({}, { hood: 'cap' }))).toBeGreaterThan(cda(DEFAULT_SKATER))
    expect(cda(tweak({}, { arms: 'swing' }))).toBeGreaterThan(cda(DEFAULT_SKATER))
  })

  it('trips the shins past the drag crisis at full scale', () => {
    const tripped = cda(tweak({}, { suit: { fabric: 'smooth', legTrips: true } }))
    expect(tripped).toBeLessThan(cda(DEFAULT_SKATER) * 0.95)
    expect(tripped).toBeGreaterThan(cda(DEFAULT_SKATER) * 0.8)
  })

  it('pays for a deep crouch in comfort, and a swinging arm pushes harder', () => {
    expect(skaterComfort(DEFAULT_SKATER).holdable).toBe(true)
    const deep = skaterComfort(tweak({ kneeDeg: 90, trunkDeg: 5, headDrop: 1 }))
    expect(deep.holdable).toBe(false)
    expect(deep.fade).toBeGreaterThan(0)
    expect(deep.worst).toBe('kneeDeg')
    expect(skaterComfort(tweak({}, { arms: 'swing' })).powerFactor).toBeGreaterThan(skaterComfort(DEFAULT_SKATER).powerFactor)
    expect(standFactor(SKATER_RANGE.kneeDeg.min)).toBe(0)
    expect(standFactor(SKATER_RANGE.kneeDeg.max)).toBe(1)
  })

  it('has readouts with no rules to break', () => {
    const r = skaterReadouts(tweak({}, { suit: { fabric: 'textured', legTrips: true } }))
    expect(r.breaks).toEqual([])
    expect(r.price).toBeGreaterThan(skaterReadouts(DEFAULT_SKATER).price)
    expect(r.frontalArea).toBeGreaterThan(0.2)
  })
})

describe('one design, any sport', () => {
  it('tells the sports apart (a design with no sport is a cyclist)', () => {
    expect(sportOf(DEFAULT_CYCLIST)).toBe('cycling')
    expect(isCyclist(DEFAULT_CYCLIST)).toBe(true)
    expect(sportOf(DEFAULT_SKATER)).toBe('skating')
    expect(isSkater(DEFAULT_SKATER)).toBe(true)
    expect(designShape(DEFAULT_SKATER)).toEqual(skaterShape(DEFAULT_SKATER))
    expect(designComfort(DEFAULT_SKATER).worst).not.toBe('torsoDeg')
  })

  it('puts skaters on ice', () => {
    const ice = sportRider('skating', REFERENCE_RIDER)
    expect(ice.rollingResistance).toBe(ICE.friction)
    expect(ice.drivetrain).toBe(ICE.drivetrain)
    expect(sportRider('cycling', REFERENCE_RIDER)).toBe(REFERENCE_RIDER)
    const swing = designEvent(tweak({}, { arms: 'swing' }), OVAL)
    expect(swing.rider.power).toBeGreaterThan(OVAL.rider.power)
  })

  it('swaps a skater model\'s hood and suit, but a new crouch or arms is a new model', () => {
    const bench = tweak({}, { hood: 'cap', suit: { fabric: 'textured', legTrips: true } })
    expect(partChanges(DEFAULT_SKATER, bench)).toEqual(['hood', 'suit'])
    expect(postureChanged(DEFAULT_SKATER, bench)).toBe(false)
    const swapped = swapParts(DEFAULT_SKATER, bench)
    expect(partChanges(swapped, bench)).toEqual([])
    expect(postureChanged(DEFAULT_SKATER, tweak({}, { arms: 'swing' }))).toBe(true)
    expect(postureChanged(DEFAULT_SKATER, tweak({ kneeDeg: 100 }))).toBe(true)
    // A model of another sport can't take the bench's parts.
    expect(partChanges(DEFAULT_CYCLIST, DEFAULT_SKATER)).toEqual([])
    expect(postureChanged(DEFAULT_CYCLIST, DEFAULT_SKATER)).toBe(true)
    expect(swapParts(DEFAULT_CYCLIST, DEFAULT_SKATER)).toEqual(DEFAULT_CYCLIST)
  })

  it('names what changed between two skater runs', () => {
    expect(changedControls(DEFAULT_SKATER, tweak({ kneeDeg: 100 }, { hood: 'cap' }))).toEqual(['kneeDeg', 'hood'])
  })

  it('gives a skater model no flutter or loose-helmet weak points, only the posts', () => {
    const s = strains({ order: { ...STANDARD_ORDER, finish: 'printed' }, design: DEFAULT_SKATER }, 40, 10)
    expect(s.map((x) => x.mode)).toEqual(['mount'])
  })

  it('saves and checks a skater', () => {
    expect(soundDesign(structuredClone(DEFAULT_SKATER))).toEqual(DEFAULT_SKATER)
    const wild = { ...DEFAULT_SKATER, posture: { ...DEFAULT_SKATER.posture, kneeDeg: 10 } }
    expect((soundDesign(wild) as SkaterDesign).posture.kneeDeg).toBe(SKATER_RANGE.kneeDeg.min)
    expect(soundDesign({ ...DEFAULT_SKATER, hood: 'balaclava' })).toBeNull()
    expect(soundDesign({ ...DEFAULT_SKATER, sport: 'curling' })).toBeNull()
    expect(soundDesign({ ...DEFAULT_CYCLIST, sport: 'cycling' })).toEqual(DEFAULT_CYCLIST)
  })
})
