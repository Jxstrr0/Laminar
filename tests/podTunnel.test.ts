import { describe, expect, it } from 'vitest'
import { OLD_POD, POD_BUFFET, STOCK_POD, TEST_RANGES, type PodDesign } from '../src/data/pod'
import { MODEL_SHOP, POD_SCALES, STANDARD_ORDER } from '../src/data/model'
import { TUNNEL_UPGRADES, UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { strains } from '../src/sim/failure'
import { newLab } from '../src/sim/lab'
import { makerScales, quote, scaleFamily } from '../src/sim/modelShop'
import { hoursOnStation, podBuffet, podDrag, podLengths } from '../src/sim/pod'
import { forecastPod, isPodRun, podReadings, podReynolds, preparePod, readPod } from '../src/sim/podTunnel'
import { isAircraftRun } from '../src/sim/aircraftTunnel'
import { Rng } from '../src/sim/rng'
import type { RunSample } from '../src/sim/run'
import type { ModelSpec, TunnelSpec } from '../src/sim/views'
import { soundLab } from '../src/persist/save'

const range = TEST_RANGES.stepnoy
const STOCK = STOCK_POD.patrol
const OLD = OLD_POD.patrol
const GOOD: PodDesign = { ...STOCK, nose: 0.85, tail: 0.95, gap: 0.46, at: 0.3 }
/** Well faired but hung tight under the wing: the pod a tunnel run on its own would pick. */
const TIGHT: PodDesign = { ...GOOD, gap: 0.1 }

const IDEAL: TunnelSpec = { turbulence: 0, balanceNoise: 0 }
const model = (scale: number): ModelSpec => ({ scale: 1 / scale, finish: 'sanded', accuracy: 0, seed: 1 })

/** Read a model at a few speeds and forecast. */
function forecast(design: PodDesign, wing: boolean) {
  const p = preparePod(design, model(2.4), wing)
  const rng = new Rng(3)
  const reads = [25, 30, 35, 40].map((speed) => readPod(p, IDEAL, { speed }, rng))
  return forecastPod(reads, design, OLD, range)!
}

describe('a pod model in the tunnel (PR 10aa)', () => {
  it('reads only its own drag on its own; under its stretch of wing, the gap and the pylon too', () => {
    const alone = readPod(preparePod(GOOD, model(2.4), false), IDEAL, { speed: 35 }, new Rng(1))
    const winged = readPod(preparePod(GOOD, model(2.4), true), IDEAL, { speed: 35 }, new Rng(1))
    const d = podDrag(GOOD)
    expect(alone.cdA).toBeCloseTo(d.alone, 9)
    expect(winged.cdA).toBeCloseTo(d.alone + d.interference + d.pylon, 9)
    expect(alone.wing).toBe(false)
    expect(winged.wing).toBe(true)
    expect(podReynolds(preparePod(GOOD, model(2.4), false), 30)).toBeGreaterThan(2_000_000)
  })

  it('forecasts hours on station true with the wing fitted', () => {
    for (const d of [GOOD, TIGHT, STOCK]) {
      const f = forecast(d, true)
      expect(f.wing).toBe(true)
      expect(Math.abs(f.hours - hoursOnStation(d))).toBeLessThan(0.02)
    }
    expect(forecast(GOOD, true).gain).toBeGreaterThan(0)
  })

  it('on its own misses the gap: a tight pod forecasts better than it flies (Kelbo’s trap)', () => {
    const f = forecast(TIGHT, false)
    expect(f.wing).toBe(false)
    expect(f.hours - hoursOnStation(TIGHT)).toBeGreaterThan(0.5)
    // On its own the tight pod even looks better than the well-hung one; under the wing it's worse.
    expect(f.hours).toBeGreaterThan(forecast(GOOD, false).hours)
    expect(forecast(TIGHT, true).hours).toBeLessThan(forecast(GOOD, true).hours)
    // A well-hung pod barely cares: the handbook's pylon covers most of what it adds.
    expect(Math.abs(forecast(GOOD, false).hours - hoursOnStation(GOOD))).toBeLessThan(0.2)
  })

  it('shakes like the pod flies with the wing; on its own it misses the shake of hanging close', () => {
    // A cut-off tail shakes on its own; the workshop's pod only shakes past the limit once it hangs under the wing.
    expect(forecast({ ...STOCK, tail: 0 }, false).blurs).toBe(true)
    expect(forecast(STOCK, true).blurs).toBe(true)
    expect(forecast(STOCK, false).blurs).toBe(false)
    expect(podBuffet(TIGHT).blurs).toBe(true)
    expect(forecast(TIGHT, true).blurs).toBe(true)
    expect(forecast(TIGHT, false).blurs).toBe(false)
    expect(Math.abs(forecast(TIGHT, true).buffet - podBuffet(TIGHT).index)).toBeLessThan(0.1)
    expect(forecast(GOOD, true).buffet).toBeLessThan(POD_BUFFET.limit)
  })
})

describe('pod models in the shop and on the sting', () => {
  it('builds them at their own scales, a stretch of wing extra; they fit the test section', () => {
    for (const s of POD_SCALES) {
      expect(scaleFamily(s)).toBe('pod')
      expect(MODEL_SHOP.scale[s].price).toBeGreaterThan(0)
      expect(podLengths(GOOD).total / s).toBeLessThan(UNIVERSITY_TUNNEL.section.length / 3)
    }
    expect(makerScales('shop', 'pod')).toEqual([...POD_SCALES])
    const plain = { ...STANDARD_ORDER, scale: 2.4 as const }
    const withWing = quote({ ...plain, wing: true })
    expect(withWing.price - quote(plain).price).toBe(MODEL_SHOP.wing.price)
    expect(withWing.days - quote(plain).days).toBe(MODEL_SHOP.wing.days)
    // A pod's bench starts on the smaller pod, on its own.
    expect(newLab(GOOD).order.scale).toBe(2.4)
    expect(newLab(GOOD).order.wing).toBeUndefined()
  })

  it('sits on a sting that holds a blunt, tight 1:1.8 pod in the university fan, but not in the big one', () => {
    const blunt: PodDesign = { ...STOCK, nose: 0, tail: 0, gap: 0.1 }
    const big = { order: { ...STANDARD_ORDER, scale: 1.8 as const, wing: true }, design: blunt }
    const p = preparePod(blunt, model(1.8), true)
    const load = (speed: number) => readPod(p, IDEAL, { speed }, new Rng(1)).dragN
    const sting = (speed: number) => strains(big, speed, load(speed)).find((s) => s.part === 'sting')!.level
    expect(sting(UNIVERSITY_TUNNEL.topSpeed)).toBeLessThan(0.95)
    expect(sting(TUNNEL_UPGRADES.fan.topSpeed)).toBeGreaterThan(1)
  })
})

describe('a pod run’s samples', () => {
  it('read back for the forecast with whether the wing was fitted, and aren’t taken for another sport’s', () => {
    const p = preparePod(TIGHT, model(2.4), true)
    const rng = new Rng(4)
    const samples: RunSample[] = [25, 30, 35, 40].map((speed, i) => {
      const r = readPod(p, IDEAL, { speed }, rng)
      return { t: i, speed, yawDeg: 0, cdA: r.cdA, cyA: 0, dragN: r.dragN, shake: r.shake, re: r.re, steady: true }
    })
    samples.push({ ...samples[0]!, steady: false })
    const run = { samples, wing: true as const }
    expect(isPodRun(run)).toBe(true)
    expect(isAircraftRun(run)).toBe(false)
    const back = podReadings([run])
    expect(back).toHaveLength(4)
    expect(back.every((r) => r.wing)).toBe(true)
    expect(forecastPod(back, TIGHT, OLD, range)!.blurs).toBe(true)
    expect(podReadings([{ samples }])[0]!.wing).toBe(false)
  })

  it('keeps the wing and the shake in a save', () => {
    const lab = newLab(GOOD)
    const run = { id: 1, model: 'pod', samples: [{ t: 0, speed: 30, yawDeg: 0, cdA: 0.08, cyA: 0, dragN: 5, shake: 0.4, re: 3e6, steady: true }], duration: 1, energyKWh: 0.1, topSpeed: 30, wing: true as const }
    const back = soundLab(JSON.parse(JSON.stringify({ ...lab, order: { ...lab.order, wing: true }, runs: [run], nextRunId: 2 })), GOOD)!
    expect(back.order.wing).toBe(true)
    expect(back.runs[0]!.wing).toBe(true)
    expect(back.runs[0]!.samples[0]!.shake).toBe(0.4)
  })
})
