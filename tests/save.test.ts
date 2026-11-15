import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST, POSTURE_RANGE, SIT_UP_CYCLIST } from '../src/data/cyclist'
import { packSave, parseSave, SAVE_VERSION, soundDesign, type SaveFile } from '../src/persist/save'
import { newLab, type LabState } from '../src/sim/lab'
import type { Run } from '../src/sim/run'

const run = (id: number, model = 'rider'): Run => ({
  id,
  model,
  samples: [
    { t: 0.25, speed: 30, yawDeg: 0, cdA: 0.2143217, cyA: 0.0012, dragN: 25.1234567, steady: true },
    { t: 0.5, speed: 30, yawDeg: 0, cdA: 0.2141, cyA: -0.0003, dragN: 25.09, steady: false },
  ],
  duration: 0.5,
  energyKWh: 0.0021,
  topSpeed: 30,
})

function file(lab: Partial<LabState> = {}): SaveFile {
  return {
    v: SAVE_VERSION,
    savedAt: 1_763_200_000_000,
    design: structuredClone(SIT_UP_CYCLIST),
    lab: { ...newLab(), runs: [run(1, 'sphere'), run(2)], notes: { 2: { design: structuredClone(DEFAULT_CYCLIST), crank: 45, build: 1 } }, nextRunId: 3, build: 1, ...lab },
  }
}
const roundTrip = (s: SaveFile) => parseSave(packSave(s))

describe('the save file', () => {
  it('comes back as it went in, readings to six places', () => {
    const back = roundTrip(file())!
    expect(back).not.toBeNull()
    expect(back.design).toEqual(SIT_UP_CYCLIST)
    expect(back.lab.notes[2]!.design).toEqual(DEFAULT_CYCLIST)
    expect(back.lab.nextRunId).toBe(3)
    expect(back.lab.runs[1]!.samples[0]!.cdA).toBe(0.214322)
    expect(back.lab.runs[1]!.samples[0]!.dragN).toBe(25.123457)
  })

  it('turns away anything the game could not have written', () => {
    expect(parseSave(null)).toBeNull()
    expect(parseSave('')).toBeNull()
    expect(parseSave('{not json')).toBeNull()
    expect(parseSave(packSave(file()).slice(0, 200))).toBeNull()
    expect(parseSave(JSON.stringify({ ...file(), v: 2 }))).toBeNull()
    // Two runs with one id, or a run from the future.
    expect(roundTrip(file({ runs: [run(1), run(1)] }))).toBeNull()
    expect(roundTrip(file({ nextRunId: 2 }))).toBeNull()
    // A crank the dial can't be set to, an unknown model scale, a broken sample.
    expect(roundTrip(file({ crank: 20 }))).toBeNull()
    expect(roundTrip(file({ order: { ...newLab().order, scale: 5 as never } }))).toBeNull()
    const bad = run(1)
    bad.samples[0]!.cdA = Number.NaN
    expect(roundTrip(file({ runs: [bad], notes: {} }))).toBeNull()
  })

  it('pulls stray design numbers back inside the sliders, and rejects unknown parts', () => {
    const wild = structuredClone(DEFAULT_CYCLIST)
    wild.posture.torsoDeg = 400
    expect(soundDesign(wild)!.posture.torsoDeg).toBe(POSTURE_RANGE.torsoDeg.max)
    expect(soundDesign({ ...DEFAULT_CYCLIST, bars: 'triathlon' })).toBeNull()
    expect(soundDesign({ ...DEFAULT_CYCLIST, wheels: { front: 'disc' } })).toBeNull()
  })

  it('drops notes on runs that are not on file', () => {
    const back = roundTrip(file({ notes: { 2: file().lab.notes[2]!, 9: file().lab.notes[2]! } }))!
    expect(Object.keys(back.lab.notes)).toEqual(['2'])
  })

  it('reads a model order saved before taps existed', () => {
    const old = JSON.parse(packSave(file())) as { lab: { order: Record<string, unknown> } }
    delete old.lab.order.taps
    expect(parseSave(JSON.stringify(old))!.lab.order.taps).toBe(false)
  })

  it('keeps a long session small enough for any phone', () => {
    // 40 two-minute runs at four samples a second.
    const long = Array.from({ length: 40 }, (_, i) => ({ ...run(i + 1), samples: Array.from({ length: 480 }, () => run(1).samples[0]!) }))
    const text = packSave(file({ runs: long, notes: {}, nextRunId: 41 }))
    expect(text.length).toBeLessThan(5_000_000)
  })
})
