import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { DEFAULT_SKATER } from '../src/data/skater'
import { DEFAULT_JUMPER, JUMP_BODY, JUMP_SKIS, JUMPER_RANGE, type JumperDesign } from '../src/data/jumper'
import { PRACTICE_JUMP } from '../src/data/hills'
import { designComfort, designEvent, designPose, designReadouts, designShape, isCyclist, isJumper, isSkater, sportOf } from '../src/sim/design'
import { jumperParts } from '../src/sim/geom/jumper'
import { jumperPose } from '../src/sim/geom/jumperPose'
import { jumpDeskEstimate } from '../src/sim/desk'
import { referenceJump, jumperReadouts } from '../src/sim/jumper'
import { soundDesign } from '../src/persist/save'
import { changedControls } from '../src/sim/designDiff'
import { partChanges, postureChanged, swapParts } from '../src/sim/remodel'
import { designEllipsoids } from '../src/sim/flow/ellipsoids'
import { TCF_TIME_TRIAL } from '../src/data/rules'
import { REFERENCE_TT } from '../src/sim/views'

const tweak = (p: Partial<JumperDesign['posture']>, bagginess = DEFAULT_JUMPER.suit.bagginess): JumperDesign => ({
  sport: 'skijump',
  posture: { ...DEFAULT_JUMPER.posture, ...p },
  suit: { bagginess },
})
const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

describe('the jumper as a design', () => {
  it('is its own sport', () => {
    expect(sportOf(DEFAULT_JUMPER)).toBe('skijump')
    expect(isJumper(DEFAULT_JUMPER)).toBe(true)
    expect(isCyclist(DEFAULT_JUMPER)).toBe(false)
    expect(isSkater(DEFAULT_JUMPER)).toBe(false)
    expect(designShape(DEFAULT_JUMPER)).toEqual(jumperParts(DEFAULT_JUMPER))
  })

  it('has nothing to hold and no pedals to push', () => {
    const c = designComfort(DEFAULT_JUMPER)
    expect(c.holdable).toBe(true)
    expect(c.powerFactor).toBe(1)
    expect(designEvent(DEFAULT_JUMPER, REFERENCE_TT)).toBe(REFERENCE_TT)
    const r = designReadouts(DEFAULT_JUMPER, TCF_TIME_TRIAL)
    expect(r.breaks).toEqual([])
    expect(r.frontalArea).toBeCloseTo(jumperReadouts(DEFAULT_JUMPER).frontalArea, 9)
  })
})

describe('the jumper in flight, drawn', () => {
  const pose = jumperPose(DEFAULT_JUMPER)

  it('lays the skis out to the sim’s length, tips up, opening to the V', () => {
    for (const s of pose.skis) {
      expect(dist(s.tail, s.tip)).toBeCloseTo(JUMP_SKIS.length, 6)
      expect(s.tip.y).toBeGreaterThan(s.tail.y)
      expect(s.tip.x).toBeGreaterThan(s.tail.x)
    }
    const [near, far] = pose.skis
    const tipGap = far.tip.z - near.tip.z
    const tailGap = far.tail.z - near.tail.z
    expect(tipGap).toBeGreaterThan(tailGap)
    // The angle between the skis is the design's V.
    const v = (s: typeof near) => ({ x: s.tip.x - s.tail.x, y: s.tip.y - s.tail.y, z: s.tip.z - s.tail.z })
    const a = v(near)
    const b = v(far)
    const cos = (a.x * b.x + a.y * b.y + a.z * b.z) / (JUMP_SKIS.length * JUMP_SKIS.length)
    expect((Math.acos(cos) * 180) / Math.PI).toBeCloseTo(DEFAULT_JUMPER.posture.vAngleDeg, 4)
  })

  it('puts the boots on the skis and the head ahead of and above the hips', () => {
    pose.foot.forEach((f, i) => {
      const s = pose.skis[i]!
      expect(f.z).toBeGreaterThan(Math.min(s.tail.z, s.tip.z) - 1e-9)
      expect(f.z).toBeLessThan(Math.max(s.tail.z, s.tip.z) + 1e-9)
    })
    expect(pose.head.x).toBeGreaterThan(pose.hip[0].x)
    expect(pose.head.y).toBeGreaterThan(pose.hip[0].y)
  })

  it('stays above the floor in the Shape screen across the whole range', () => {
    for (const lean of [JUMPER_RANGE.leanDeg.min, JUMPER_RANGE.leanDeg.max]) {
      for (const v of [JUMPER_RANGE.vAngleDeg.min, JUMPER_RANGE.vAngleDeg.max]) {
        const p = jumperPose(tweak({ leanDeg: lean, vAngleDeg: v }))
        for (const s of p.skis) expect(Math.min(s.tail.y, s.tip.y)).toBeGreaterThan(0)
      }
    }
  })

  it('leans the body off the skis by the design’s lean', () => {
    const flat = jumperPose(tweak({ leanDeg: 6 }))
    const steep = jumperPose(tweak({ leanDeg: 26 }))
    expect(flat.head.y).toBeGreaterThan(steep.head.y)
    // Boots stay the body's length behind the hips either way.
    const feet = (p: typeof flat) => ({ x: (p.foot[0].x + p.foot[1].x) / 2, y: (p.foot[0].y + p.foot[1].y) / 2 })
    for (const p of [flat, steep]) expect(Math.hypot(feet(p).x - p.hip[0].x, feet(p).y - p.hip[0].y)).toBeLessThan(JUMP_BODY.hipToBoot + 0.05)
  })

  it('hands the pose to the flow visuals, body and skis included', () => {
    const ids = designEllipsoids(DEFAULT_JUMPER, designPose(DEFAULT_JUMPER)).map((e) => e.id)
    expect(ids).toEqual(expect.arrayContaining(['body', 'helmet', 'ski-1', 'ski-2']))
  })
})

describe('the jumper on the desk', () => {
  it('guesses close to the reference jump, and the bias belongs to the job', () => {
    const real = referenceJump(DEFAULT_JUMPER, PRACTICE_JUMP).distance
    const a = jumpDeskEstimate(DEFAULT_JUMPER, PRACTICE_JUMP, 7, 'a')
    expect(Math.abs(a.value / real - 1)).toBeLessThan(0.15)
    expect(a.low).toBeLessThan(a.value)
    expect(a.high).toBeGreaterThan(a.value)
    expect(jumpDeskEstimate(DEFAULT_JUMPER, PRACTICE_JUMP, 7, 'a')).toEqual(a)
    // A good analyst narrows the bars.
    const sharp = jumpDeskEstimate(DEFAULT_JUMPER, PRACTICE_JUMP, 7, 'a', 3)
    expect(sharp.high - sharp.low).toBeLessThan(a.high - a.low)
  })

  it('reads the stability floor as the sim does', () => {
    expect(jumpDeskEstimate(DEFAULT_JUMPER, PRACTICE_JUMP, 1, 'x').stable).toBe(true)
    expect(jumpDeskEstimate(tweak({ leanDeg: 6 }, 1), PRACTICE_JUMP, 1, 'x').stable).toBe(false)
  })
})

describe('the jumper in saves and the lab', () => {
  it('saves and loads, with numbers pulled into range', () => {
    expect(soundDesign(structuredClone(DEFAULT_JUMPER))).toEqual(DEFAULT_JUMPER)
    const wild = soundDesign({ sport: 'skijump', posture: { leanDeg: 99, vAngleDeg: -5 }, suit: { bagginess: 3 } }) as JumperDesign
    expect(wild.posture.leanDeg).toBe(JUMPER_RANGE.leanDeg.max)
    expect(wild.posture.vAngleDeg).toBe(JUMPER_RANGE.vAngleDeg.min)
    expect(wild.suit.bagginess).toBe(JUMPER_RANGE.bagginess.max)
    expect(soundDesign({ sport: 'skijump', posture: { leanDeg: 10 }, suit: { bagginess: 0 } })).toBeNull()
    expect(soundDesign({ sport: 'skijump', posture: { leanDeg: 10, vAngleDeg: 30 } })).toBeNull()
  })

  it('names what changed between two jumpers', () => {
    expect(changedControls(DEFAULT_JUMPER, tweak({ vAngleDeg: 40 }, 0.6))).toEqual(['vAngleDeg', 'bagginess'])
    expect(changedControls(DEFAULT_JUMPER, DEFAULT_JUMPER)).toEqual([])
  })

  it('needs a new model for any change: the suit is cut into the body', () => {
    expect(partChanges(DEFAULT_JUMPER, tweak({}, 0.8))).toEqual([])
    expect(postureChanged(DEFAULT_JUMPER, tweak({}, 0.8))).toBe(true)
    expect(postureChanged(DEFAULT_JUMPER, tweak({ leanDeg: 20 }))).toBe(true)
    expect(postureChanged(DEFAULT_JUMPER, structuredClone(DEFAULT_JUMPER))).toBe(false)
    expect(postureChanged(DEFAULT_JUMPER, DEFAULT_CYCLIST)).toBe(true)
    expect(postureChanged(DEFAULT_SKATER, DEFAULT_JUMPER)).toBe(true)
    expect(swapParts(DEFAULT_JUMPER, tweak({}, 0.8))).toEqual(DEFAULT_JUMPER)
  })
})
