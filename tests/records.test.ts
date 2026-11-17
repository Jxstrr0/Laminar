import { describe, expect, it } from 'vitest'
import { RECORD_IDS, RECORD_RULES, RECORDS } from '../src/data/records'
import { STOCK_RECORD, type RecordDesign } from '../src/data/record'
import { DEFAULT_JUMPER } from '../src/data/jumper'
import { DEFAULT_TRUCK, RIG, type TruckDesign } from '../src/data/truck'
import { DEFAULT_CYCLIST, SIT_UP_CYCLIST, type CyclistDesign } from '../src/data/cyclist'
import { briefTemplate, deliver, deliverJump, deliverRecord, deliverTruck, firmRecords, newCareer, openTo, recordBonus, type CareerState } from '../src/sim/career'
import { beats, claim, measured, recordBoard, recordsHeld } from '../src/sim/records'
import { legacyOf } from '../src/sim/legacy'
import { packSave, parseSave, SAVE_VERSION, type SaveFile } from '../src/persist/save'
import { newLab } from '../src/sim/lab'

/** A career with this job in hand, on a given day seed. */
function onJob(id: string, seed: number, base: CareerState = newCareer(3)): CareerState {
  const b = briefTemplate(id)!
  return { ...base, job: { brief: { id, fee: 100000, days: b.days, seed }, promise: 1, startDay: base.day, daysLeft: b.days, spent: 0 } }
}

const seeds = Array.from({ length: 30 }, (_, i) => i + 1)

/** A well-sorted truck for the fleet's trailer. */
function goodTruck(setup: TruckDesign): TruckDesign {
  return { ...DEFAULT_TRUCK, trailerTop: setup.trailerTop, cab: { ...DEFAULT_TRUCK.cab, fairing: setup.trailerTop - RIG.cabTop }, trailer: { skirts: 0.9, tail: 1.4, tailAngle: 12 } }
}
const GOOD_JET: RecordDesign = { ...STOCK_RECORD.jet, nose: { length: 4.5, droop: 3.5 }, canopy: 0.25, fin: 2.9, fairings: 1, waist: 0.6 }
const GOOD_STREAMLINER: RecordDesign = { ...STOCK_RECORD.streamliner, nose: { length: 2, droop: 2 }, canopy: 0.25, fin: 0.6, fairings: 1 }
const fastRider = (s: CyclistDesign): CyclistDesign => ({
  ...s,
  posture: { ...s.posture, torsoDeg: 12, headDrop: 0.55, armWidth: 0.28 },
  helmet: { kind: 'aero', tail: 0.5, vents: 0.05 },
  suit: { fabric: 'smooth', armTrips: true },
  bars: 'aero',
  wheels: { front: 'deep', rear: 'disc' },
  frame: 'kamm',
})

describe('the standing board', () => {
  it('lists the five Tarnovian records in order, none of them the firm’s', () => {
    const board = firmRecords(newCareer(1))
    expect(board.map((h) => h.id)).toEqual([...RECORD_IDS])
    expect(board.every((h) => !h.ours && h.day === null && h.was === null)).toBe(true)
    expect(board.map((h) => h.holder)).toEqual(RECORD_IDS.map((id) => RECORDS[id].holder))
    expect(recordsHeld(board)).toBe(0)
  })

  it('counts a mark only past the precision it is measured to, and a fuel figure is beaten by a smaller one', () => {
    expect(beats('timeTrial', 49.24, 49.2)).toBe(false)
    expect(beats('timeTrial', 49.26, 49.2)).toBe(true)
    expect(beats('hour', 51.306, 51.3)).toBe(true)
    expect(beats('truckFuel', 32.5, 32.6)).toBe(true)
    expect(beats('truckFuel', 32.7, 32.6)).toBe(false)
    expect(measured('skiJump', 131.86)).toBe(131.9)
  })

  it('takes the newest mark for each record, keeping what it replaced', () => {
    const board = recordBoard([
      { day: 10, holder: 'A', mark: { record: 'skiJump', value: 132 } },
      { day: 20, holder: 'B' },
      { day: 30, holder: 'C', mark: { record: 'skiJump', value: 133 } },
    ])
    const jump = board.find((h) => h.id === 'skiJump')!
    expect(jump).toMatchObject({ holder: 'C', value: 133, ours: true, day: 30, was: { holder: 'A', value: 132 } })
    expect(claim(board, 'skiJump', 132.5)).toBeNull()
    expect(claim(board, 'skiJump', 133.04)).toBeNull()
    expect(claim(board, 'skiJump', 133.16)).toEqual({ record: 'skiJump', value: 133.2 })
    expect(claim(board, 'skiJump', Number.NaN)).toBeNull()
  })
})

describe('breaking records on the job', () => {
  it('a well-shaped truck beats the fuel record and puts the fleet on the board; the old truck does not', () => {
    const b = briefTemplate('kovyl-haulage')!
    const old = deliverTruck(onJob(b.id, 4), b.setup as TruckDesign, 40)!
    expect(old.mark).toBeNull()
    const d = deliverTruck(onJob(b.id, 4), goodTruck(b.setup as TruckDesign), 32)!
    expect(d.mark).toEqual({ record: 'truckFuel', value: measured('truckFuel', d.debrief.actual) })
    expect(d.state.history.at(-1)!.mark).toEqual(d.mark)
    const held = firmRecords(d.state).find((h) => h.id === 'truckFuel')!
    expect(held).toMatchObject({ holder: 'Kovyl Haulage', ours: true, was: { holder: RECORDS.truckFuel.holder, value: RECORDS.truckFuel.value } })
    expect(legacyOf(d.state).records).toBe(1)
    // The same truck again only ties the firm's own mark: no new record.
    const again = deliverTruck(onJob(b.id, 9, d.state), goodTruck(b.setup as TruckDesign), 32)!
    expect(again.mark).toBeNull()
    expect(again.state.history.at(-1)!.mark).toBeUndefined()
  })

  it('a jet car can take the land-speed record on its day; a streamliner never can', () => {
    const marks = seeds.map((s) => deliverRecord(onJob('proryv-jet', s), GOOD_JET, 330)!.mark)
    expect(marks.some((m) => m?.record === 'landSpeed' && m.value > RECORDS.landSpeed.value)).toBe(true)
    for (const s of seeds.slice(0, 8)) expect(deliverRecord(onJob('kalina-streamliner', s), GOOD_STREAMLINER, 170)!.mark).toBeNull()
    for (const s of seeds.slice(0, 8)) expect(deliverRecord(onJob('proryv-jet', s), briefTemplate('proryv-jet')!.setup as RecordDesign, 300)!.mark).toBeNull()
  })

  it('a fast position can take the 40 km time-trial record on a good day; a short club race never counts', () => {
    const b = briefTemplate('tvardov-national')!
    const ds = seeds.map((s) => deliver(onJob(b.id, s), fastRider(b.setup as CyclistDesign), 0.22)!)
    const broke = ds.filter((d) => d.mark)
    expect(broke.length).toBeGreaterThan(0)
    for (const d of broke) {
      expect(d.mark!.record).toBe('timeTrial')
      expect(d.mark!.value).toBeCloseTo((d.result.distance / d.result.time) * 3.6, 1)
      expect(d.mark!.value).toBeGreaterThan(RECORDS.timeTrial.value)
    }
    // The defending champion's own setup isn't fast enough.
    for (const s of seeds.slice(0, 8)) expect(deliver(onJob(b.id, s), b.setup, 0.22)!.mark).toBeNull()
    // The club race is 16 km: too short for the record however fast.
    for (const s of seeds.slice(0, 8)) expect(deliver(onJob('stavren-club', s), fastRider(DEFAULT_CYCLIST), 0.22)!.mark).toBeNull()
    expect(deliver(onJob('stavren-club', 1), SIT_UP_CYCLIST, 0.3)!.mark).toBeNull()
  })

  it('a big jump on the large hill can take the ski-jump record', () => {
    const marks = seeds.map((s) => deliverJump(onJob('kuzmenko-large', s), DEFAULT_JUMPER, 125)!.mark).filter((m) => m)
    expect(marks.length).toBeGreaterThan(0)
    for (const m of marks) expect(m).toMatchObject({ record: 'skiJump' })
    // The normal hill is too small for it.
    for (const s of seeds.slice(0, 8)) expect(deliverJump(onJob('vetrova-cup', s), DEFAULT_JUMPER, 95)!.mark).toBeNull()
  })
})

describe('record attempts (PR 11c)', () => {
  const hour = briefTemplate('shubina-hour')!

  it('the hour attempt is a cycling job on the boards that a well-known firm is offered', () => {
    expect(hour.attempt).toBe('hour')
    expect(hour.event.hour).toBe(true)
    expect(hour.event.indoor).toBe(true)
    expect(openTo(hour, (hour.minRep ?? 0) - 1)).toBe(false)
    expect(openTo(hour, hour.minRep ?? 0)).toBe(true)
  })

  it('her old position falls short of the hour; a sharp one breaks it and earns the bonus', () => {
    for (const s of seeds.slice(0, 6)) {
      const d = deliver(onJob(hour.id, s), hour.setup, 0.22)!
      expect(d.mark).toBeNull()
      expect(d.bonus).toBe(0)
    }
    const d = deliver(onJob(hour.id, 1), fastRider(hour.setup as CyclistDesign), 0.2)!
    expect(d.mark?.record).toBe('hour')
    expect(d.mark!.value).toBeGreaterThan(RECORDS.hour.value)
    expect(d.bonus).toBe(recordBonus(100000))
    expect(d.bonus).toBe(Math.round(100000 * RECORD_RULES.bonus))
    expect(d.paid).toBe(100000 - d.debrief.penalty + d.bonus)
    expect(d.state.history.at(-1)!.paid).toBe(d.paid)
    expect(firmRecords(d.state).find((h) => h.id === 'hour')!.holder).toBe(hour.client)
  })

  it('a record broken on a job that wasn’t an attempt pays no bonus', () => {
    const b = briefTemplate('kovyl-haulage')!
    const d = deliverTruck(onJob(b.id, 4), goodTruck(b.setup as TruckDesign), 32)!
    expect(d.mark).not.toBeNull()
    expect(d.bonus).toBe(0)
  })

  it('the Proryv Project is out for the land-speed record, and gets the bonus when it falls', () => {
    expect(briefTemplate('proryv-jet')!.attempt).toBe('landSpeed')
    const broke = seeds.map((s) => deliverRecord(onJob('proryv-jet', s), GOOD_JET, 330)!).filter((d) => d.mark)
    expect(broke.length).toBeGreaterThan(0)
    for (const d of broke) expect(d.bonus).toBe(recordBonus(100000))
  })
})

describe('saving records', () => {
  const withMark = (): CareerState => {
    const b = briefTemplate('kovyl-haulage')!
    return deliverTruck(onJob(b.id, 4), goodTruck(b.setup as TruckDesign), 32)!.state
  }
  const file = (career: CareerState): SaveFile => ({ v: SAVE_VERSION, savedAt: 1_763_200_000_000, design: structuredClone(DEFAULT_CYCLIST), lab: newLab(), career })

  it('keeps a broken record through a save', () => {
    const career = withMark()
    const back = parseSave(packSave(file(career)))!
    expect(back.career.history.at(-1)!.mark).toEqual(career.history.at(-1)!.mark)
    expect(firmRecords(back.career)).toEqual(firmRecords(career))
  })

  it('refuses a record that is not one of the five, or on a secret job', () => {
    const career = withMark()
    const job = career.history.at(-1)!
    const bad = (mark: unknown, extra: object = {}) => parseSave(packSave(file({ ...career, history: [{ ...job, ...extra, mark } as never] })))
    expect(bad({ record: 'mile', value: 3 })).toBeNull()
    expect(bad({ record: 'hour', value: -1 })).toBeNull()
    expect(bad({ record: 'hour', value: 52 }, { secret: true })).toBeNull()
    expect(bad({ record: 'hour', value: 52 })).not.toBeNull()
  })
})
