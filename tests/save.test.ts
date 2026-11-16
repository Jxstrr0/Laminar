import { describe, expect, it } from 'vitest'
import { asCyclist } from '../src/sim/design'
import { DEFAULT_CYCLIST, POSTURE_RANGE, SIT_UP_CYCLIST } from '../src/data/cyclist'
import { packSave, parseSave, SAVE_VERSION, soundDesign, type SaveFile } from '../src/persist/save'
import { newLab, type LabState } from '../src/sim/lab'
import { acceptBrief, newCareer } from '../src/sim/career'
import { DEMO_TUNNEL_SEED } from '../src/data/tunnel'
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
    career: newCareer(99),
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
    expect(parseSave(JSON.stringify({ ...file(), v: SAVE_VERSION + 1 }))).toBeNull()
    // Two runs with one id, or a run from the future.
    expect(roundTrip(file({ runs: [run(1), run(1)] }))).toBeNull()
    expect(roundTrip(file({ nextRunId: 2 }))).toBeNull()
    // A crank the dial can't be set to, an unknown model scale, a broken sample.
    expect(roundTrip(file({ crank: 20 }))).toBeNull()
    expect(roundTrip(file({ order: { ...newLab().order, scale: 7 as never } }))).toBeNull()
    const bad = run(1)
    bad.samples[0]!.cdA = Number.NaN
    expect(roundTrip(file({ runs: [bad], notes: {} }))).toBeNull()
  })

  it('pulls stray design numbers back inside the sliders, and rejects unknown parts', () => {
    const wild = structuredClone(DEFAULT_CYCLIST)
    wild.posture.torsoDeg = 400
    expect(asCyclist(soundDesign(wild)!).posture.torsoDeg).toBe(POSTURE_RANGE.torsoDeg.max)
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

  it('keeps a sled model’s ground board, and drops anything else in its place', () => {
    const boarded = parseSave(packSave(file({ order: { ...newLab().order, board: true } })))!
    expect(boarded.lab.order.board).toBe(true)
    const odd = JSON.parse(packSave(file())) as { lab: { order: Record<string, unknown> } }
    odd.lab.order.board = 'yes'
    expect(parseSave(JSON.stringify(odd))!.lab.order.board).toBeUndefined()
  })

  it('keeps a long session small enough for any phone', () => {
    // 40 two-minute runs at four samples a second.
    const long = Array.from({ length: 40 }, (_, i) => ({ ...run(i + 1), samples: Array.from({ length: 480 }, () => run(1).samples[0]!) }))
    const text = packSave(file({ runs: long, notes: {}, nextRunId: 41 }))
    expect(text.length).toBeLessThan(5_000_000)
  })

  it('keeps the career, job and all', () => {
    const career = acceptBrief(newCareer(99), 'selivan-regional')
    const back = roundTrip({ ...file(), career })!
    expect(back.career).toEqual(career)
    expect(roundTrip({ ...file(), career: { ...career, board: [{ ...career.board[0]!, id: 'nobody' }] } })).toBeNull()
    expect(roundTrip({ ...file(), career: { ...career, job: { ...career.job!, daysLeft: 99 } } })).toBeNull()
  })

  it('gives careers from before bids a board round and no lost briefs', () => {
    const raw = JSON.parse(packSave({ ...file(), career: { ...newCareer(99), jobsDone: 2, round: 2 } })) as { career: Record<string, unknown> }
    delete raw.career.round
    delete raw.career.lost
    const back = parseSave(JSON.stringify(raw))!
    expect(back.career.round).toBe(2)
    expect(back.career.lost).toEqual([])
    raw.career.lost = ['nobody']
    expect(parseSave(JSON.stringify(raw))).toBeNull()
  })

  it('keeps the guide, and hides it for careers from before it that already delivered', () => {
    const career = { ...newCareer(99), guide: { off: false, done: ['model' as const] } }
    expect(roundTrip({ ...file(), career })!.career.guide).toEqual(career.guide)
    const raw = JSON.parse(packSave({ ...file(), career: { ...newCareer(99), jobsDone: 3, round: 3 } })) as { career: Record<string, unknown> }
    delete raw.career.guide
    expect(parseSave(JSON.stringify(raw))!.career.guide).toEqual({ off: true, done: [] })
    raw.career.jobsDone = 0
    raw.career.round = 0
    expect(parseSave(JSON.stringify(raw))!.career.guide).toEqual({ off: false, done: [] })
    raw.career.guide = { off: false, done: ['dance'] }
    expect(parseSave(JSON.stringify(raw))).toBeNull()
  })

  it('keeps a broken model and a run that broke one, and accepts labs from before failures', () => {
    const broken = { mode: 'flutter' as const, part: 'tail' as const }
    const back = roundTrip(file({ broken, runs: [{ ...run(1, 'sphere'), failure: { mode: 'mount', part: 'posts' } }, run(2)] }))!
    expect(back.lab.broken).toEqual(broken)
    expect(back.lab.runs[0]!.failure).toEqual({ mode: 'mount', part: 'posts' })
    expect(roundTrip(file({ broken: { mode: 'flutter', part: 'posts' } as never }))).toBeNull()
    // A jumper's broken sting (PR 8k) keeps too.
    expect(roundTrip(file({ broken: { mode: 'mount', part: 'sting' } }))!.lab.broken).toEqual({ mode: 'mount', part: 'sting' })
    const raw = JSON.parse(packSave(file())) as { lab: Record<string, unknown> }
    delete raw.lab.broken
    expect(parseSave(JSON.stringify(raw))!.lab.broken).toBeNull()
  })

  it('brings a v1 save up to date with a career on the old tunnel seed', () => {
    const { career: _drop, ...rest } = file()
    const old = JSON.stringify({ ...rest, v: 1 })
    const back = parseSave(old)!
    expect(back.v).toBe(SAVE_VERSION)
    expect(back.career).toEqual(newCareer(DEMO_TUNNEL_SEED))
    expect(back.lab.nextRunId).toBe(3)
  })

  it('remembers what the model was built of, and assumes the bench design for older saves', () => {
    const back = roundTrip(file({ modelDesign: structuredClone(DEFAULT_CYCLIST) }))!
    expect(back.lab.modelDesign).toEqual(DEFAULT_CYCLIST)
    const raw = JSON.parse(packSave(file())) as { lab: Record<string, unknown> }
    delete raw.lab.modelDesign
    expect(parseSave(JSON.stringify(raw))!.lab.modelDesign).toEqual(SIT_UP_CYCLIST)
  })
})
