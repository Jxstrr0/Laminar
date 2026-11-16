import { describe, expect, it } from 'vitest'
import { DEFAULT_JUMPER, JUMP_TUNNEL, type JumperDesign } from '../src/data/jumper'
import { PRACTICE_JUMP } from '../src/data/hills'
import { UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { STANDARD_MODEL } from '../src/data/model'
import { forecastJump, polar, polarAero, prepareJumper, readJumper, type JumpReading } from '../src/sim/jumpTunnel'
import { designAero, flyAero, jumperForces, referenceJump, staticMargin } from '../src/sim/jumper'
import { Rng } from '../src/sim/rng'
import type { TunnelSpec } from '../src/sim/views'

const ideal: TunnelSpec = { turbulence: 0, balanceNoise: 0, section: UNIVERSITY_TUNNEL.section }
const model = (accuracy = 0, scale = 0.5) => ({ scale, finish: STANDARD_MODEL.finish, accuracy, seed: 3 })
const tweak = (lean: number, v: number, bag: number): JumperDesign => ({ sport: 'skijump', posture: { leanDeg: lean, vAngleDeg: v }, suit: { bagginess: bag } })

/** A sweep: one reading per angle, every `step` degrees. */
function sweep(design: JumperDesign, tunnel: TunnelSpec, from: number, to: number, step = 1, seed = 1, accuracy = 0): JumpReading[] {
  const prepared = prepareJumper(design, model(accuracy))
  const rng = new Rng(seed).fork('sweep')
  const out: JumpReading[] = []
  for (let a = from; a <= to + 1e-9; a += step) out.push(readJumper(prepared, tunnel, { speed: 30, alphaDeg: a, mount: 'sting' }, rng))
  return out
}

describe('the jumper on the sting', () => {
  it('reads the truth in a perfect tunnel', () => {
    const r = sweep(DEFAULT_JUMPER, ideal, 30, 30)[0]!
    const f = jumperForces(DEFAULT_JUMPER, 30, 0)
    expect(r.clA).toBeCloseTo(f.clA, 9)
    expect(r.pitchA).toBeCloseTo(f.pitchA, 9)
    // Drag adds the helmet and boots.
    expect(r.cdA).toBeGreaterThan(f.cdA)
    expect(r.liftN).toBeGreaterThan(0)
  })

  it('barely feels the Reynolds trap: plates lift from their edges at any size', () => {
    const half = readJumper(prepareJumper(DEFAULT_JUMPER, model(0, 0.5)), ideal, { speed: 30, alphaDeg: 30 }, new Rng(1))
    const quarter = readJumper(prepareJumper(DEFAULT_JUMPER, model(0, 0.25)), ideal, { speed: 30, alphaDeg: 30 }, new Rng(1))
    expect(quarter.clA).toBeCloseTo(half.clA, 9)
    expect(Math.abs(quarter.cdA / half.cdA - 1)).toBeLessThan(0.05)
  })

  it('goes through the tunnel’s faults: blockage lifts the readings, the sting adds drag', () => {
    const quirky: TunnelSpec = { ...ideal, quirks: { blockage: 1, turbulence: 0, mountCdA: { sting: 0.004, posts: 0.01 } } }
    const clean = sweep(DEFAULT_JUMPER, ideal, 30, 30)[0]!
    const faulty = sweep(DEFAULT_JUMPER, quirky, 30, 30)[0]!
    expect(faulty.clA).toBeGreaterThan(clean.clA)
    expect(faulty.cdA - clean.cdA).toBeGreaterThan(0.004 / 0.25 - 1e-9)
  })

  it('scatters with the balance’s noise, the same way for the same seed', () => {
    const noisy: TunnelSpec = { ...ideal, balanceNoise: 0.01 }
    const a = sweep(DEFAULT_JUMPER, noisy, 20, 30, 1, 5)
    expect(sweep(DEFAULT_JUMPER, noisy, 20, 30, 1, 5)).toEqual(a)
    expect(sweep(DEFAULT_JUMPER, noisy, 20, 30, 1, 6)).not.toEqual(a)
  })
})

describe('the polar', () => {
  it('pools readings at the same angle and sorts by angle', () => {
    const p = polar([
      { alphaDeg: 30, clA: 1, cdA: 0.5, pitchA: 0.1 },
      { alphaDeg: 20, clA: 0.8, cdA: 0.3, pitchA: 0.05 },
      { alphaDeg: 30.1, clA: 1.2, cdA: 0.7, pitchA: 0.3 },
    ])
    expect(p.map((x) => x.n)).toEqual([1, 2])
    expect(p[1]!.clA).toBeCloseTo(1.1, 9)
    expect(p[0]!.alphaDeg).toBe(20)
  })

  it('gives the truth’s margin from a fine, clean sweep', () => {
    const aero = polarAero(polar(sweep(DEFAULT_JUMPER, ideal, 20, 40)))
    for (const a of [24, 30, 34]) expect(aero.margin(a + 0.5)).toBeCloseTo(staticMargin(DEFAULT_JUMPER, a + 0.5), 2)
  })
})

/** The truth's reference flight, but with the helmet and boots' drag as the tunnel read it. */
function truthWithTunnelParts(d: JumperDesign): number {
  const r = sweep(d, ideal, 30, 30)[0]!
  const partsCdA = r.cdA - jumperForces(d, 30, 0).cdA
  const e = PRACTICE_JUMP
  return flyAero(designAero(d, partsCdA), e.hill, { temperature: e.temperature, altitude: e.altitude, headwind: 0, takeoffSpeed: e.hill.takeoffSpeed, mass: e.mass }, false).distance
}

describe('the forecast', () => {
  it('flies the reference jump on a full, clean sweep', () => {
    for (const d of [DEFAULT_JUMPER, tweak(20, 30, 0.2), tweak(8, 40, 0.5)]) {
      const f = forecastJump(sweep(d, ideal, 8, 42), PRACTICE_JUMP)!
      const ref = referenceJump(d, PRACTICE_JUMP)
      expect(Math.abs(f.distance - truthWithTunnelParts(d))).toBeLessThan(0.5)
      expect(f.minMargin).toBeCloseTo(ref.minMargin, 2)
      expect(f.stable).toBe(ref.stable)
      expect(f.covered).toBe(true)
    }
  })

  it('says when the sweep misses the angles the flight passes through', () => {
    const narrow = forecastJump(sweep(DEFAULT_JUMPER, ideal, 24, 32), PRACTICE_JUMP)!
    expect(narrow.covered).toBe(false)
    expect(narrow.need.from).toBeLessThan(narrow.have.from)
    expect(narrow.need.to).toBeGreaterThan(narrow.have.to)
    // A coarse sweep still covers, and lands near.
    const coarse = forecastJump(sweep(DEFAULT_JUMPER, ideal, 10, 40, 6), PRACTICE_JUMP)!
    expect(coarse.covered).toBe(true)
    expect(Math.abs(coarse.distance - truthWithTunnelParts(DEFAULT_JUMPER))).toBeLessThan(3)
  })

  it('reads short on a small, slow model: the helmet and boots fall into the Reynolds trap', () => {
    const ref = referenceJump(DEFAULT_JUMPER, PRACTICE_JUMP).distance
    const at = (scale: number, speed: number) => {
      const prepared = prepareJumper(DEFAULT_JUMPER, model(0, scale))
      const rng = new Rng(1)
      const rs: JumpReading[] = []
      for (let a = 8; a <= 42; a++) rs.push(readJumper(prepared, ideal, { speed, alphaDeg: a }, rng))
      return forecastJump(rs, PRACTICE_JUMP)!.distance
    }
    const small = at(0.25, 20)
    const big = at(1, 40)
    expect(small).toBeLessThan(ref - 2)
    expect(Math.abs(big - ref)).toBeLessThan(Math.abs(small - ref))
  })

  it('needs two angles', () => {
    expect(forecastJump(sweep(DEFAULT_JUMPER, ideal, 30, 30), PRACTICE_JUMP)).toBeNull()
    expect(forecastJump([], PRACTICE_JUMP)).toBeNull()
  })

  it('reads a jump long through blockage, and a sloppy model off', () => {
    const quirky: TunnelSpec = { ...ideal, quirks: { blockage: 1.5, turbulence: 0, mountCdA: { sting: 0, posts: 0 } } }
    const ref = truthWithTunnelParts(DEFAULT_JUMPER)
    expect(forecastJump(sweep(DEFAULT_JUMPER, quirky, 8, 42), PRACTICE_JUMP)!.distance).toBeGreaterThan(ref + 0.5)
    const sloppy = forecastJump(sweep(DEFAULT_JUMPER, ideal, 8, 42, 1, 1, 0.05), PRACTICE_JUMP)!.distance
    expect(Math.abs(sloppy - ref)).toBeGreaterThan(0.2)
  })

  it('keeps its dial inside the readings it can pool', () => {
    expect(JUMP_TUNNEL.pitch.step).toBeGreaterThan(2 * JUMP_TUNNEL.sameAngle)
  })
})
