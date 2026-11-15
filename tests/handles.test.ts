import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST, type CyclistDesign } from '../src/data/cyclist'
import { HANDLES } from '../src/data/handles'
import { HELMET_MOUNT, SKELETON } from '../src/data/pose'
import { TCF_TIME_TRIAL } from '../src/data/rules'
import { helmetLength } from '../src/sim/geom/cyclist'
import { availableHandles, dragHandle, getParam, handlePoint, PARAM_RANGE, type Project } from '../src/sim/geom/handles'
import { riderPose } from '../src/sim/geom/pose'
import { ruleVolumes } from '../src/sim/geom/ruleBox'

/** Looking at the rider exactly side-on: x right, y up, 500 px per metre. */
const side: Project = (p) => ({ x: p.x * 500, y: -p.y * 500 })
/** From the front-right, so arm width shows too. */
const quarter: Project = (p) => ({ x: (p.x * 0.6 + p.z * 0.8) * 500, y: -p.y * 500 })

const design = (): CyclistDesign => structuredClone(DEFAULT_CYCLIST)

describe('drag handles', () => {
  it('has 6 to 12 handles, each moving numbers it owns', () => {
    expect(HANDLES.length).toBeGreaterThanOrEqual(6)
    expect(HANDLES.length).toBeLessThanOrEqual(12)
    for (const h of HANDLES) expect(h.params.length).toBeGreaterThan(0)
  })

  it('puts every dot somewhere real, even at the slider ends', () => {
    for (const end of ['min', 'max'] as const) {
      const d = design()
      for (const key of Object.keys(d.posture) as (keyof typeof d.posture)[]) d.posture[key] = PARAM_RANGE[key][end]
      for (const id of availableHandles(d)) {
        const p = handlePoint(d, id)
        expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true)
      }
    }
  })

  it('offers no tail handle on a road helmet', () => {
    const d = design()
    d.helmet.kind = 'road'
    expect(availableHandles(d)).not.toContain('tail')
    expect(availableHandles(design())).toContain('tail')
  })

  it('pulling the hands forward and up moves reach and height to follow the finger', () => {
    const d = design()
    const start = side(handlePoint(d, 'hands'))
    const target = { x: start.x + 20, y: start.y - 15 }
    let out = d
    for (let i = 0; i < 4; i++) out = dragHandle(out, 'hands', target, side)
    expect(out.posture.handReach).toBeGreaterThan(d.posture.handReach)
    expect(out.posture.handHeight).toBeGreaterThan(d.posture.handHeight)
    const end = side(handlePoint(out, 'hands'))
    // Within half a slider step on each axis (0.01 m is 5 px here).
    expect(Math.hypot(end.x - target.x, end.y - target.y)).toBeLessThan(4)
    // Only the hands' own numbers changed.
    expect(out.posture.torsoDeg).toBe(d.posture.torsoDeg)
    expect(out.helmet).toEqual(d.helmet)
  })

  it('stops at the slider limits however far you pull', () => {
    const d = design()
    const out = dragHandle(d, 'hands', { x: 1e5, y: -1e5 }, side)
    expect(out.posture.handReach).toBe(PARAM_RANGE.handReach.max)
    expect(out.posture.handHeight).toBe(PARAM_RANGE.handHeight.max)
  })

  it('leaves a number alone when the view cannot see it change', () => {
    const d = design()
    const out = dragHandle(d, 'elbowR', { x: 0, y: 0 }, side)
    expect(out.posture.armWidth).toBe(d.posture.armWidth)
    // From the quarter view the same pull does move it.
    const start = quarter(handlePoint(d, 'elbowR'))
    const wider = dragHandle(d, 'elbowR', { x: start.x + 20, y: start.y }, quarter)
    expect(wider.posture.armWidth).toBeGreaterThan(d.posture.armWidth)
  })

  it('a deeper back angle lifts the back handle, and the head handle drops the head', () => {
    const d = design()
    const back = side(handlePoint(d, 'back'))
    const up = dragHandle(d, 'back', { x: back.x, y: back.y - 30 }, side)
    expect(up.posture.torsoDeg).toBeGreaterThan(d.posture.torsoDeg)
    const head = side(handlePoint(d, 'head'))
    const down = dragHandle(d, 'head', { x: head.x, y: head.y + 15 }, side)
    expect(down.posture.headDrop).toBeGreaterThan(d.posture.headDrop)
  })

  it('pulling the helmet tail back makes it longer', () => {
    const d = design()
    const tail = side(handlePoint(d, 'tail'))
    const out = dragHandle(d, 'tail', { x: tail.x - 25, y: tail.y }, side)
    expect(getParam(out, 'tail')).toBeGreaterThan(d.helmet.tail)
  })

  it('lands on slider steps, so the rules read what the slider shows', () => {
    const out = dragHandle(design(), 'hands', { x: 413, y: -497 }, side)
    for (const key of ['handReach', 'handHeight'] as const) {
      const r = PARAM_RANGE[key]
      const steps = (out.posture[key] - r.min) / r.step
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6)
    }
  })

  it('gives the same answer every time', () => {
    const a = dragHandle(design(), 'hands', { x: 400, y: -500 }, side)
    const b = dragHandle(design(), 'hands', { x: 400, y: -500 }, side)
    expect(a).toEqual(b)
  })
})

describe('helmet on the pose', () => {
  it('puts the tail tip behind the mount by the helmet length behind the nose', () => {
    const d = design()
    const pose = riderPose(d)
    const gap = Math.hypot(pose.helmetTail.x - pose.helmet.x, pose.helmetTail.y - pose.helmet.y)
    expect(gap).toBeCloseTo((1 - HELMET_MOUNT.noseFraction) * helmetLength(d), 6)
    expect(pose.helmetTail.x).toBeLessThan(pose.helmet.x)
  })
})

describe('rule box', () => {
  it('draws the hand limits where the rules put them', () => {
    const d = design()
    const [hands] = ruleVolumes(d, riderPose(d), TCF_TIME_TRIAL)
    expect(hands!.id).toBe('hands')
    const front = hands!.centre.x + hands!.size.x / 2
    const top = hands!.centre.y + hands!.size.y / 2
    expect(front).toBeCloseTo(SKELETON.bottomBracket.x + TCF_TIME_TRIAL.maxHandReach, 9)
    expect(top).toBeCloseTo(SKELETON.bottomBracket.y + SKELETON.saddle.y + TCF_TIME_TRIAL.maxHandHeight, 9)
  })

  it('makes the helmet volume as long as the rules allow, tilted with the head', () => {
    const d = design()
    const pose = riderPose(d)
    const helmet = ruleVolumes(d, pose, TCF_TIME_TRIAL).find((v) => v.id === 'helmet')!
    expect(helmet.size.x).toBe(TCF_TIME_TRIAL.maxHelmetLength)
    expect(helmet.pitchDeg).toBe(pose.headPitchDeg)
  })

  it('keeps legal hands inside the hand volume', () => {
    const d = design()
    const pose = riderPose(d)
    const [hands] = ruleVolumes(d, pose, TCF_TIME_TRIAL)
    const p = handlePoint(d, 'hands', pose)
    expect(Math.abs(p.x - hands!.centre.x)).toBeLessThan(hands!.size.x / 2)
    expect(Math.abs(p.y - hands!.centre.y)).toBeLessThan(hands!.size.y / 2)
    expect(Math.abs(pose.hand[1].z)).toBeLessThan(hands!.size.z / 2)
  })
})
