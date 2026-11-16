import { describe, expect, it } from 'vitest'
import { PLANE_CLASS, PLANE_TUNNEL, STOCK_PLANE, SURVEY_SITES, type PlaneDesign } from '../src/data/plane'
import { MAKERS, MODEL_SHOP, PLANE_SCALES } from '../src/data/model'
import { gustLimit, gustTurn, planeRange, staticMargin } from '../src/sim/plane'
import { fieldReynolds, forecastPlane, isPlaneRun, planeReadings, liftAt, lowness, modelReynolds, planeEvent, preparePlane, readPlane, readStalled, wingAt } from '../src/sim/planeTunnel'
import { makerScales, matchedSpeed, scaleFamily } from '../src/sim/modelShop'
import { DEG } from '../src/sim/num'
import { Rng } from '../src/sim/rng'
import type { ModelSpec, TunnelSpec } from '../src/sim/views'
import { STANDARD_ORDER } from '../src/data/model'
import { TUNNEL_UPGRADES, UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { strains } from '../src/sim/failure'
import { newLab } from '../src/sim/lab'
import type { RunSample } from '../src/sim/run'
import { soundLab } from '../src/persist/save'

const site = SURVEY_SITES.ozimka
const STOCK = STOCK_PLANE.survey
/** The sorted survey drone: a longer, finer fuselage, the camera tucked to the rule and faired, winglets, the maker's tail. */
const GOOD: PlaneDesign = { ...STOCK, fuselage: { nose: 0.3, taper: 0.9 }, camera: { drop: 0.35, fairing: 1, at: 0.5 }, winglets: 0.12, tail: 1 }
/** Cut down too far: a long nose and a small tail, so it holds its nose loosely and stalls in the usual gust. */
const LOOSE: PlaneDesign = { ...GOOD, fuselage: { ...GOOD.fuselage, nose: 0.45 }, tail: 0.8 }

const IDEAL: TunnelSpec = { turbulence: 0, balanceNoise: 0 }
const REAL: TunnelSpec = { turbulence: 0, balanceNoise: 0.01 }
const model = (scale: number, trips = false): ModelSpec => ({ scale: 1 / scale, finish: 'sanded', accuracy: 0, seed: 1, trips })
/** A sweep up past the full-size stall (about 15°). */
const SWEEP = [0, 2, 4, 6, 8, 10, 12, 14, 15, 16, 18]

/** Read a model through a pitch sweep at a speed and forecast the survey. */
function forecast(design: PlaneDesign, scale: number, speed: number, opts: { trips?: boolean; pitches?: number[]; tunnel?: TunnelSpec } = {}) {
  const prepared = preparePlane(design, model(scale, opts.trips))
  const rng = new Rng(3)
  const reads = (opts.pitches ?? SWEEP).map((pitchDeg) => readPlane(prepared, opts.tunnel ?? IDEAL, { speed, pitchDeg }, rng))
  return forecastPlane(reads, design, STOCK, site)!
}

describe('a survey drone’s wing and its Reynolds number', () => {
  it('flies full size above the trouble, so the field sees the maker’s wing', () => {
    expect(fieldReynolds(GOOD, site)).toBeGreaterThan(PLANE_TUNNEL.reFull)
    expect(wingAt(GOOD, fieldReynolds(GOOD, site), false)).toEqual({ clMax: PLANE_CLASS.survey.clMax, cd: 1 })
  })

  it('stalls early and drags more on a small, slow model, and trip strips take back most of it', () => {
    const small = preparePlane(GOOD, model(2.5))
    const re = modelReynolds(small, 16)
    expect(re).toBeLessThan(130_000)
    expect(lowness(re)).toBeGreaterThan(0.8)
    const bare = wingAt(GOOD, re, false)
    const tripped = wingAt(GOOD, re, true)
    expect(bare.clMax).toBeLessThan(1.05)
    expect(bare.cd).toBeGreaterThan(1.25)
    expect(tripped.clMax).toBeGreaterThan(1.2)
    expect(tripped.cd).toBeLessThan(bare.cd)
    // A faster fan or a bigger model matches the Reynolds number instead.
    expect(lowness(modelReynolds(small, 40))).toBe(0)
    expect(modelReynolds(preparePlane(GOOD, model(1.5)), 16)).toBeGreaterThan(re)
  })

  it('makes lift along a straight line to the stall, then loses it', () => {
    const c = PLANE_CLASS.survey.clMax
    expect(liftAt(GOOD, 8 * DEG, c)).toEqual({ cl: PLANE_CLASS.survey.liftSlope * 8 * DEG, stalled: false })
    const past = liftAt(GOOD, 18 * DEG, c)
    expect(past.stalled).toBe(true)
    expect(past.cl).toBeLessThan(c)
    expect(past.cl).toBeGreaterThanOrEqual(c * PLANE_TUNNEL.stalledLift)
  })
})

describe('a plane model in the tunnel', () => {
  it('reads the drag, the lift and the moment true at a matched Reynolds number in an ideal tunnel', () => {
    const p = preparePlane(GOOD, model(2.5))
    const r = readPlane(p, IDEAL, { speed: 40, pitchDeg: 6 }, new Rng(1))
    expect(r.cl).toBeCloseTo(PLANE_CLASS.survey.liftSlope * 6 * DEG, 9)
    expect(r.cm).toBeCloseTo(-staticMargin(GOOD) * r.cl, 9)
    expect(readStalled(GOOD, r)).toBe(false)
    expect(readStalled(GOOD, readPlane(p, IDEAL, { speed: 40, pitchDeg: 18 }, new Rng(1)))).toBe(true)
  })

  it('forecasts the range, the margin and the stall true from a sweep past the stall at a matched Reynolds number', () => {
    const f = forecast(GOOD, 2.5, 40)
    expect(f.range).toBeCloseTo(planeRange(GOOD, site), 6)
    expect(f.gain).toBeGreaterThan(15)
    expect(f.margin!).toBeCloseTo(staticMargin(GOOD), 9)
    expect(f.clMax!).toBeGreaterThan(PLANE_CLASS.survey.clMax - 0.06)
    expect(f.stalls).toBe(false)
    expect(f.gustLimit!).toBeGreaterThan(site.gust)
    expect(Math.abs(f.gustLimit! - gustLimit(GOOD, site)) / gustLimit(GOOD, site)).toBeLessThan(0.1)
  })

  it('sees a loose plane stall in the usual gust', () => {
    const f = forecast(LOOSE, 2.5, 40)
    expect(gustTurn(LOOSE, site).stalls).toBe(true)
    expect(f.stalls).toBe(true)
    expect(f.margin!).toBeLessThan(0.1)
  })

  it('falls for the trap on a small model at survey speed: short range, and a stall in a gust it rides out', () => {
    const f = forecast(GOOD, 2.5, 16)
    expect(gustTurn(GOOD, site).stalls).toBe(false)
    expect(f.stalls).toBe(true)
    expect(f.clMax!).toBeLessThan(1.05)
    expect(f.range).toBeLessThan(planeRange(GOOD, site) * 0.97)
    expect(f.re).toBeLessThan(f.fieldRe / 2)
  })

  it('gets out of it with trip strips, a bigger model or a faster fan', () => {
    expect(forecast(GOOD, 2.5, 16, { trips: true }).stalls).toBe(false)
    expect(forecast(GOOD, 1.5, 27).stalls).toBe(false)
    expect(forecast(GOOD, 2.5, 40).stalls).toBe(false)
  })

  it('can’t judge a gust without a reading past the stall, and forecasts nothing from nothing', () => {
    const f = forecast(GOOD, 2.5, 40, { pitches: [0, 4, 8] })
    expect(f.clMax).toBeNull()
    expect(f.margin).not.toBeNull()
    expect(f.gustLimit).toBeNull()
    expect(f.stalls).toBeNull()
    expect(f.range).toBeCloseTo(planeRange(GOOD, site), 6)
    expect(forecastPlane([], GOOD, STOCK, site)).toBeNull()
  })

  it('stays close with the balance’s noise', () => {
    const f = forecast(GOOD, 2.5, 40, { tunnel: REAL })
    expect(Math.abs(f.range - planeRange(GOOD, site)) / planeRange(GOOD, site)).toBeLessThan(0.03)
    expect(Math.abs(f.margin! - staticMargin(GOOD))).toBeLessThan(0.03)
    expect(f.stalls).toBe(false)
  })
})

describe('plane models in the shop', () => {
  it('builds them at their own scales, matched to survey speed at the site', () => {
    for (const s of PLANE_SCALES) {
      expect(scaleFamily(s)).toBe('plane')
      expect(MODEL_SHOP.scale[s].price).toBeGreaterThan(0)
    }
    expect(makerScales('shop', 'plane')).toEqual([...PLANE_SCALES])
    expect(MAKERS.resin.scales).not.toContain(1.5)
    // A 1:2.5 model needs about 2.5 times survey speed to match.
    const v = matchedSpeed(1 / 2.5, planeEvent(site))
    expect(v).toBeGreaterThan(36)
    expect(v).toBeLessThan(44)
  })
})

describe('a plane model on the Tunnel screen (PR 10l)', () => {
  it('keeps the lift, the moment and the Reynolds number in run samples and reads them back for the forecast', () => {
    const p = preparePlane(GOOD, model(2.5))
    const rng = new Rng(4)
    const samples: RunSample[] = SWEEP.map((pitchDeg, i) => {
      const r = readPlane(p, IDEAL, { speed: 40, pitchDeg }, rng)
      return { t: i, speed: 40, yawDeg: pitchDeg, cdA: r.cdA, cyA: 0, dragN: r.dragN, cl: r.cl, cm: r.cm, re: r.re, steady: true }
    })
    // A sample taken while the sting was still turning is left out.
    samples.push({ ...samples[0]!, steady: false })
    const run = { samples }
    expect(isPlaneRun(run)).toBe(true)
    expect(isPlaneRun({ samples: [{ ...samples[0]!, cm: undefined }] })).toBe(false)
    const back = planeReadings([run])
    expect(back).toHaveLength(SWEEP.length)
    const direct = forecast(GOOD, 2.5, 40)
    const f = forecastPlane(back, GOOD, STOCK, site)!
    expect(f.range).toBeCloseTo(direct.range, 6)
    expect(f.stalls).toBe(false)
  })

  it('a save keeps a plane run’s lift, moment and Reynolds number, and refuses a broken one', () => {
    const lab = newLab(GOOD)
    const sample: RunSample = { t: 0, speed: 40, yawDeg: 8, cdA: 0.05, cyA: 0, dragN: 7, cl: 0.7, cm: -0.08, re: 270_000, steady: true }
    const run = { id: 1, model: 'rider', samples: [sample], duration: 10, energyKWh: 0.01, topSpeed: 40 }
    const kept = soundLab(JSON.parse(JSON.stringify({ ...lab, runs: [run], nextRunId: 2 })), GOOD)!
    expect(kept.runs[0]!.samples[0]!.cl).toBe(0.7)
    expect(kept.runs[0]!.samples[0]!.cm).toBe(-0.08)
    expect(kept.runs[0]!.samples[0]!.re).toBe(270_000)
    expect(soundLab(JSON.parse(JSON.stringify({ ...lab, runs: [{ ...run, samples: [{ ...sample, cm: 'x' }] }], nextRunId: 2 })), GOOD)).toBeNull()
  })

  it('starts on the small model, matched within the university fan’s reach', () => {
    expect(newLab(GOOD).order.scale).toBe(2.5)
    expect(matchedSpeed(1 / 2.5, planeEvent(site))).toBeLessThanOrEqual(UNIVERSITY_TUNNEL.topSpeed + 0.5)
  })

  it('pitches on a sting that holds a stalled 1:1.5 model at its matched speed, but not in the big fan', () => {
    const big = { order: { ...STANDARD_ORDER, scale: 1.5 as const }, design: GOOD }
    const sting = (loadN: number) => strains(big, 30, loadN).find((s) => s.part === 'sting')!.level
    const s2 = 1 / (1.5 * 1.5)
    const load = (speed: number) => 0.5 * 1.225 * speed * speed * PLANE_CLASS.survey.wingArea * PLANE_CLASS.survey.clMax * s2
    expect(sting(load(matchedSpeed(1 / 1.5, planeEvent(site))))).toBeLessThan(0.95)
    expect(sting(load(TUNNEL_UPGRADES.fan.topSpeed))).toBeGreaterThan(1)
  })
})
