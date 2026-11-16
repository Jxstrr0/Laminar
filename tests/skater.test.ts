import { describe, expect, it } from 'vitest'
import { DEFAULT_SKATER, ICE, SKATER_RANGE, UPRIGHT_SKATER, type SkaterDesign } from '../src/data/skater'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { REFERENCE_RIDER } from '../src/data/field'
import { designComfort, designEvent, designPose, designShape, isCyclist, isSkater, sportOf, sportRider } from '../src/sim/design'
import { designEllipsoids } from '../src/sim/flow/ellipsoids'
import { BRIEFS } from '../src/data/briefs'
import { eventOf } from '../src/sim/career'
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

describe('the skater in 3D and on the board (PR 8b)', () => {
  const finite = (pose: ReturnType<typeof designPose>) =>
    Object.values(pose).every((v) =>
      typeof v === 'number' ? Number.isFinite(v) : (Array.isArray(v) ? v : [v]).every((q: { x: number; y: number; z: number }) => [q.x, q.y, q.z].every(Number.isFinite)),
    )

  it('crouches lower with bent knees and a flat back', () => {
    const deep = designPose(tweak({ kneeDeg: 95, trunkDeg: 8 }))
    const tall = designPose(tweak({ kneeDeg: 155, trunkDeg: 45 }))
    expect(finite(deep)).toBe(true)
    expect(finite(tall)).toBe(true)
    expect(deep.hip[0].y).toBeLessThan(tall.hip[0].y)
    expect(deep.shoulder[0].y).toBeLessThan(tall.shoulder[0].y)
  })

  it('folds the hands on the back, or swings them', () => {
    const back = designPose(DEFAULT_SKATER)
    const swing = designPose(tweak({}, { arms: 'swing' }))
    // Folded hands rest above the hips; a swinging arm hangs below the shoulder.
    expect(back.hand[0].y).toBeGreaterThan(back.hip[0].y)
    expect(swing.hand[0].y).toBeLessThan(swing.shoulder[0].y)
  })

  it('gives the flow field a body for each part the shape has', () => {
    const d = DEFAULT_SKATER
    const ids = new Set(designEllipsoids(d, designPose(d)).map((e) => e.bodyId))
    for (const id of ['head', 'torso', 'arm-1', 'thigh-1', 'shin-1']) expect(ids.has(id)).toBe(true)
  })

  it('has two skating briefs whose clients skate, on ice', () => {
    const oval = BRIEFS.find((b) => b.id === 'lenok-oval')!
    const lake = BRIEFS.find((b) => b.id === 'kosov-marathon')!
    for (const b of [oval, lake]) {
      expect(isSkater(b.setup)).toBe(true)
      expect(b.event.ice).toBe(true)
      expect(eventOf(b).rider.rollingResistance).toBe(ICE.friction)
    }
    const km = (b: typeof oval) => b.event.course.reduce((s, c) => s + c.length, 0) / 1000
    expect(km(oval)).toBeCloseTo(10, 6)
    expect(km(lake)).toBeCloseTo(40, 6)
    expect(oval.event.indoor).toBe(true)
    expect(oval.event.lap).toBe(400)
    // A good crouch keeps each client's ask with room to spare.
    for (const b of [oval, lake]) {
      const ev = eventOf(b)
      const cut = (1 - truth(designShape(DEFAULT_SKATER), ev).windAveragedCdA / truth(designShape(b.setup), ev).windAveragedCdA) * 100
      expect(cut).toBeGreaterThan(b.target)
    }
  })
})
