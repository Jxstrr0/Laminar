import { describe, expect, it } from 'vitest'
import { PLANE_CLASS, PLANE_RANGE, STOCK_PLANE, SURVEY_SITES, type PlaneDesign } from '../src/data/plane'
import { soundDesign } from '../src/persist/save'
import { changedControls } from '../src/sim/designDiff'
import { planeMass, planeRange, wingArea, wingSpan } from '../src/sim/plane'
import { modelReynolds } from '../src/sim/planeTunnel'

const site = SURVEY_SITES.ozimka
/** The sorted survey plane (as in the survey tests), with a span. */
const GOOD: PlaneDesign = { ...STOCK_PLANE.survey, fuselage: { nose: 0.3, taper: 0.9 }, camera: { drop: 0.35, fairing: 1, at: 0.5 }, winglets: 0.12, tail: 0.95 }
const span = (k: number): PlaneDesign => ({ ...GOOD, span: k })

describe('the survey wing’s span slider (PR 10w)', () => {
  it('at the maker’s span changes nothing', () => {
    expect(STOCK_PLANE.survey.span).toBe(1)
    expect(wingSpan(GOOD)).toBe(PLANE_CLASS.survey.span)
    expect(wingArea(GOOD)).toBe(PLANE_CLASS.survey.wingArea)
  })

  it('flies further a little longer, but past the sweet spot the weight takes it back; a short wing flies much less far', () => {
    const r = (k: number) => planeRange(span(k), site)
    expect(planeMass(span(1.2))).toBeGreaterThan(planeMass(span(1.1)))
    expect(planeMass(span(0.9))).toBeLessThan(planeMass(GOOD))
    expect(r(1.1) - r(1)).toBeGreaterThan(1)
    expect(r(1.25)).toBeLessThan(r(1.15))
    expect(r(1) - r(0.8)).toBeGreaterThan(5)
    // The best lies inside the slider's range.
    const R = PLANE_RANGE.survey.span
    const ks = Array.from({ length: Math.round((R.max - R.min) / R.step) + 1 }, (_, i) => R.min + i * R.step)
    const best = ks.reduce((a, k) => (r(k) > r(a) ? k : a))
    expect(best).toBeGreaterThan(1)
    expect(best).toBeLessThan(R.max)
  })

  it('keeps the root chord, so the model wing’s Reynolds number doesn’t move', () => {
    expect(modelReynolds({ design: span(1.25), scale: 1 / 1.5 }, 30)).toBe(modelReynolds({ design: GOOD, scale: 1 / 1.5 }, 30))
  })

  it('is kept in saves (an older save gets the maker’s wing, a wild one is held to the slider) and names itself in a run’s changes', () => {
    expect(soundDesign(JSON.parse(JSON.stringify(span(1.15))))).toMatchObject({ sport: 'plane', span: 1.15 })
    const { span: _gone, ...older } = GOOD
    expect(soundDesign(older)).toMatchObject({ span: 1 })
    expect(soundDesign(span(9))).toMatchObject({ span: PLANE_RANGE.survey.span.max })
    expect(changedControls(GOOD, span(1.15))).toEqual(['wingSpan'])
  })
})
