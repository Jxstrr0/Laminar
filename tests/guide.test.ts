import { describe, expect, it } from 'vitest'
import { asCyclist } from '../src/sim/design'
import { acceptBrief, newCareer, type CareerState } from '../src/sim/career'
import { afterDesign, afterOrder, afterRun, afterSwap, currentStep, GUIDE_STEPS, guideOn, hideGuide, stepDone } from '../src/sim/guide'
import { briefTemplate } from '../src/sim/career'

const start = () => acceptBrief(newCareer(7), 'selivan-regional')
const setup = () => structuredClone(asCyclist(briefTemplate('selivan-regional')!.setup))

describe('the guided first job', () => {
  it('starts on the bid and moves on once the job is taken', () => {
    const c = newCareer(7)
    expect(guideOn(c)).toBe(true)
    expect(currentStep(c)).toBe('bid')
    expect(currentStep(start())).toBe('model')
  })

  it('walks the steps in order as the player really does them', () => {
    let c: CareerState = start()
    // Running with no model yet ticks nothing.
    c = afterRun(c)
    expect(currentStep(c)).toBe('model')
    c = afterOrder(c)
    expect(currentStep(c)).toBe('baseline')
    // Swapping parts before any shaping isn't the remodel.
    expect(afterSwap(c)).toBe(c)
    c = afterRun(c)
    expect(currentStep(c)).toBe('shape')
    // Her own setup on the bench isn't a new shape.
    expect(afterDesign(c, setup())).toBe(c)
    const faster = setup()
    faster.posture.torsoDeg -= 6
    c = afterDesign(c, faster)
    expect(currentStep(c)).toBe('remodel')
    c = afterSwap(c)
    expect(currentStep(c)).toBe('test')
    c = afterRun(c)
    expect(currentStep(c)).toBe('deliver')
    expect(GUIDE_STEPS.filter((s) => stepDone(c, s))).toHaveLength(6)
  })

  it('counts a new model of the design as the remodel', () => {
    let c = afterRun(afterOrder(start()))
    const faster = setup()
    faster.posture.headDrop += 0.1
    c = afterOrder(afterDesign(c, faster))
    expect(currentStep(c)).toBe('test')
  })

  it('goes away after the first delivery, or when hidden', () => {
    const c = start()
    const hidden = hideGuide(c)
    expect(guideOn(hidden)).toBe(false)
    expect(currentStep(hidden)).toBeNull()
    expect(afterOrder(hidden)).toBe(hidden)
    const later = { ...c, jobsDone: 1, job: null }
    expect(currentStep(later)).toBeNull()
  })
})
