import { describe, expect, it } from 'vitest'
import { COMPRESSIBILITY, RECORD_RUN, STOCK_RECORD, type RecordDesign } from '../src/data/record'
import { SALT_FLATS } from '../src/data/saltFlats'
import { soundDesign } from '../src/persist/save'
import { criticalMach, dragRise, flatDensity, frontKept, risePeak, shockLift, sideCentre, soundSpeed, stillDay, thrustKept, twoWay } from '../src/sim/record'

const flat = SALT_FLATS.sukhoye
const sound = soundSpeed(flat.temperature)
const still = (d: RecordDesign, opts = {}) => twoWay(d, flat, stillDay(flat), opts)
const JET = STOCK_RECORD.jet
/** A jet car shaped for the barrier: a long nose drooped well down, the canopy low, the wheels covered, fin to match the nose, and the waist pinched to the engine's room. */
const GOOD: RecordDesign = { ...JET, nose: { length: 4.5, droop: 3.5 }, canopy: 0.25, fin: 2.9, fairings: 1, waist: 0.6 }

describe('the jet car', () => {
  it('as the teams run it, tops out short of the sound barrier, pointing straight', () => {
    const a = still(JET)
    expect(a.mean).not.toBeNull()
    expect(a.runs[0].topMach).toBeGreaterThan(0.85)
    expect(a.runs[0].topMach).toBeLessThan(0.95)
    expect(sideCentre(JET).margin).toBeGreaterThan(0)
  })

  it('shaped well, goes through the sound barrier on a still day', () => {
    const a = still(GOOD)
    expect(a.runs[0].abort).toBeNull()
    expect(a.runs[0].topMach).toBeGreaterThan(1)
    expect(a.mean!).toBeGreaterThan(sound)
    // A good 150 km/h and more over the team's car.
    expect((a.mean! - still(JET).mean!) * 3.6).toBeGreaterThan(150)
  })

  it('needs its long run-up', () => {
    expect(RECORD_RUN.runUp.jet).toBeGreaterThan(RECORD_RUN.runUp.streamliner)
    expect(still(GOOD).runs[0].speeds).toHaveLength((RECORD_RUN.runUp.jet + RECORD_RUN.timed) / RECORD_RUN.step + 1)
  })

  it('goes light at the barrier with too little droop, which nothing below it shows', () => {
    const light: RecordDesign = { ...GOOD, nose: { length: 4.5, droop: 2 } }
    const run = still(light).runs[0]
    expect(run.abort?.cause).toBe('lift')
    // The shock under the nose did it: close to Mach 1, after a clean run-up.
    expect(run.abort!.speed / sound).toBeGreaterThan(1 - COMPRESSIBILITY.shock.width)
    // Without the shock (as the tunnel sees it) the nose would have held at that speed.
    expect(frontKept(light, run.abort!.speed, flatDensity(flat))).toBeGreaterThan(RECORD_RUN.frontKeep)
  })

  it('shows the shock only near Mach 1', () => {
    expect(shockLift(1)).toBeCloseTo(COMPRESSIBILITY.shock.lift, 9)
    expect(shockLift(1 - COMPRESSIBILITY.shock.width)).toBe(0)
    expect(shockLift(0.6)).toBe(0)
    expect(shockLift(1.02)).toBeGreaterThan(0)
  })
})

describe('the waist and the nose', () => {
  it('let the air squeeze later and less, up to the engine’s room', () => {
    const pinched = { ...JET, waist: 0.6 }
    expect(criticalMach(pinched)).toBeGreaterThan(criticalMach(JET))
    expect(risePeak(pinched)).toBeLessThan(risePeak(JET))
    expect(thrustKept(pinched)).toBe(1)
    expect(thrustKept({ ...JET, waist: 1 })).toBeLessThan(1)
    // Pinched past the room, the thrust it costs outweighs the drag it saves.
    expect(still({ ...GOOD, waist: 1 }).mean!).toBeLessThan(still(GOOD).mean!)
    expect(still({ ...GOOD, waist: 0 }).mean!).toBeLessThan(still(GOOD).mean!)
  })

  it('a longer nose makes the jet’s climb smaller, the streamliner’s no different', () => {
    expect(risePeak({ ...JET, nose: { length: 4.5, droop: 2 } })).toBeLessThan(risePeak(JET))
    const s = STOCK_RECORD.streamliner
    expect(risePeak({ ...s, nose: { length: 3, droop: 2 } })).toBe(risePeak(s))
  })

  it('eases the drag off past Mach 1, without a jump at it', () => {
    expect(dragRise(GOOD, 1.0001)).toBeCloseTo(dragRise(GOOD, 1), 2)
    expect(dragRise(GOOD, 1.1)).toBeLessThan(dragRise(GOOD, 1))
    expect(dragRise(GOOD, 2)).toBeCloseTo(1 + risePeak(GOOD) * COMPRESSIBILITY.supersonic.floor, 9)
  })
})

describe('saves', () => {
  it('keep a jet car, and give a streamliner from before the waist a straight body', () => {
    expect(soundDesign(GOOD)).toEqual(GOOD)
    const { waist: _, ...old } = STOCK_RECORD.streamliner
    expect(soundDesign(old)).toEqual(STOCK_RECORD.streamliner)
    // A streamliner can't be pinched.
    expect(soundDesign({ ...STOCK_RECORD.streamliner, waist: 0.5 })).toEqual(STOCK_RECORD.streamliner)
  })
})
