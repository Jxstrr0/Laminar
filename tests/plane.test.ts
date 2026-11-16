import { describe, expect, it } from 'vitest'
import { PLANE_CLASS, PLANE_RANGE, STOCK_PLANE, SURVEY_SITES, type PlaneDesign } from '../src/data/plane'
import { cameraDrop, cameraTooHigh, gustLimit, gustTurn, planeDrag, planeMass, planeRange, siteDensity, spanEfficiency, staticMargin } from '../src/sim/plane'

const site = SURVEY_SITES.ozimka
const STOCK = STOCK_PLANE.survey
const c = PLANE_CLASS.survey
/** A sensibly shaped survey drone: a finer nose and tail cone, the camera tucked to the rule and faired and slid forward, winglets, the tail a touch smaller. */
const GOOD: PlaneDesign = { ...STOCK, fuselage: { nose: 0.3, taper: 0.9 }, camera: { drop: 0.35, fairing: 1, at: 0.5 }, winglets: 0.12, tail: 0.95 }
const with_ = (patch: Partial<PlaneDesign>): PlaneDesign => ({ ...STOCK, ...patch })

describe('the survey drone (PR 10i)', () => {
  it('flies the makers’ plane some 85 km on a charge, and a well-shaped one over 100', () => {
    expect(planeRange(STOCK, site)).toBeGreaterThan(80)
    expect(planeRange(STOCK, site)).toBeLessThan(90)
    expect(planeRange(GOOD, site)).toBeGreaterThan(planeRange(STOCK, site) + 20)
    // Every slider's stock value is in its range.
    const r = PLANE_RANGE.survey
    expect(STOCK.fuselage.nose).toBeGreaterThanOrEqual(r.nose.min)
    expect(STOCK.tail).toBeLessThanOrEqual(r.tail.max)
  })

  it('adds up its drag, carrying its weight at survey speed', () => {
    const d = planeDrag(STOCK, c.survey, siteDensity(site))
    expect(d.cdA).toBeCloseTo(d.wing + d.induced + d.body + d.pod + d.tail + d.winglets + d.trim + d.misc, 12)
    // Banked round a turn it needs more lift, and makes more induced drag.
    const banked = planeDrag(STOCK, c.survey, siteDensity(site), 1.5)
    expect(banked.cl).toBeCloseTo(d.cl * 1.5, 9)
    expect(banked.induced).toBeGreaterThan(d.induced * 2)
    // Thinner air on a warm day: more lift needed from each square metre.
    expect(planeDrag(STOCK, c.survey, siteDensity(site, 30)).cl).toBeGreaterThan(d.cl)
  })

  it('drags less with the camera tucked up and faired, but the client’s rule keeps it seeing past the belly', () => {
    const tucked = with_({ camera: { ...STOCK.camera, drop: c.cameraMinDrop } })
    const faired = with_({ camera: { ...STOCK.camera, fairing: 1 } })
    const density = siteDensity(site)
    expect(planeDrag(tucked, c.survey, density).pod).toBeLessThan(planeDrag(STOCK, c.survey, density).pod)
    expect(planeDrag(faired, c.survey, density).pod).toBeLessThan(planeDrag(STOCK, c.survey, density).pod)
    expect(planeMass(faired)).toBeGreaterThan(planeMass(STOCK))
    // Tucked flush, the client lowers it to the rule: no better than the rule's limit.
    const flush = with_({ camera: { ...STOCK.camera, drop: 0 } })
    expect(cameraTooHigh(flush)).toBe(true)
    expect(cameraTooHigh(tucked)).toBe(false)
    expect(cameraDrop(flush)).toBe(c.cameraMinDrop)
    expect(planeRange(flush, site)).toBeCloseTo(planeRange(tucked, site), 9)
  })

  it('gains a little from winglets and a finer tail cone; a longer nose saves drag but loosens the pitch', () => {
    expect(spanEfficiency(with_({ winglets: 0.15 }))).toBeGreaterThan(spanEfficiency(STOCK))
    expect(planeRange(with_({ winglets: 0.15 }), site)).toBeGreaterThan(planeRange(STOCK, site))
    expect(planeRange(with_({ fuselage: { ...STOCK.fuselage, taper: 1 } }), site)).toBeGreaterThan(planeRange(STOCK, site) + 4)
    const long = with_({ fuselage: { ...STOCK.fuselage, nose: 0.4 } })
    expect(planeRange(long, site)).toBeGreaterThan(planeRange(STOCK, site))
    expect(staticMargin(long)).toBeLessThan(staticMargin(STOCK))
    // Sliding the camera forward steadies it.
    expect(staticMargin(with_({ camera: { ...STOCK.camera, at: 1 } }))).toBeGreaterThan(staticMargin(STOCK))
  })

  it('rides out the usual gust on a turn as sold; a cut-down tail or a long nose stalls in it', () => {
    expect(gustTurn(STOCK, site).stalls).toBe(false)
    expect(gustTurn(GOOD, site).stalls).toBe(false)
    const small = with_({ tail: 0.8 })
    expect(planeRange(small, site)).toBeGreaterThan(planeRange(STOCK, site))
    const t = gustTurn(small, site)
    expect(t.amplified).toBeGreaterThan(1)
    expect(t.stalls).toBe(true)
    expect(gustTurn(with_({ fuselage: { ...STOCK.fuselage, nose: 0.45 } }), site).stalls).toBe(true)
    // A bigger tail puts the long nose right.
    expect(gustTurn(with_({ fuselage: { ...STOCK.fuselage, nose: 0.45 }, tail: 1.3 }), site).stalls).toBe(false)
  })

  it('knows the strongest gust each one rides out, and a weaker wing rides out less', () => {
    const limit = gustLimit(STOCK, site)
    expect(gustTurn(STOCK, site, limit - 0.01).stalls).toBe(false)
    expect(gustTurn(STOCK, site, limit + 0.01).stalls).toBe(true)
    expect(gustLimit(STOCK, site, site.temperature, c.clMax * 0.8)).toBeLessThan(limit)
    expect(gustLimit(STOCK, site, site.temperature, 0.1)).toBe(0)
  })
})
