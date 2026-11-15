import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST, SIT_UP_CYCLIST, type CyclistDesign } from '../src/data/cyclist'
import { SKELETON } from '../src/data/pose'
import { riderPose, twoBone, type Point } from '../src/sim/geom/pose'

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

describe('the rider’s pose', () => {
  it('puts the hands where the design says', () => {
    const pose = riderPose(DEFAULT_CYCLIST)
    const p = DEFAULT_CYCLIST.posture
    expect(pose.hand[0].x).toBeCloseTo(SKELETON.bottomBracket.x + p.handReach, 9)
    expect(pose.hand[1].z - pose.hand[0].z).toBeCloseTo(p.armWidth, 9)
    expect(pose.hand[0].y).toBeCloseTo(SKELETON.bottomBracket.y + SKELETON.saddle.y + p.handHeight, 9)
  })
  it('raises the shoulders as the back comes up', () => {
    expect(riderPose(SIT_UP_CYCLIST).shoulder[0].y).toBeGreaterThan(riderPose(DEFAULT_CYCLIST).shoulder[0].y + 0.2)
  })
  it('lays the forearms flat on aero bars', () => {
    const pose = riderPose(DEFAULT_CYCLIST)
    expect(pose.elbow[0].y).toBeCloseTo(pose.hand[0].y, 9)
    expect(dist(pose.elbow[0], pose.hand[0])).toBeCloseTo(SKELETON.forearm, 9)
  })
  it('bends the knees forward and keeps the bones their length', () => {
    const pose = riderPose(DEFAULT_CYCLIST)
    for (const i of [0, 1] as const) {
      expect(dist(pose.hip[i], pose.knee[i])).toBeCloseTo(SKELETON.thigh, 6)
      expect(pose.knee[i].x).toBeGreaterThan(pose.hip[i].x)
    }
  })
  it('tilts the helmet up as the head tucks', () => {
    const tuck = (h: number): CyclistDesign => ({ ...DEFAULT_CYCLIST, posture: { ...DEFAULT_CYCLIST.posture, headDrop: h } })
    expect(riderPose(tuck(1)).headPitchDeg).toBeGreaterThan(riderPose(tuck(0)).headPitchDeg)
  })
  it('reaches straight for a target out of reach', () => {
    const a = { x: 0, y: 0, z: 0 }
    const mid = twoBone(a, { x: 10, y: 0, z: 0 }, 1, 1, 1)
    expect(mid.x).toBeCloseTo(1, 3)
    expect(Math.abs(mid.y)).toBeLessThan(0.01)
  })
})
