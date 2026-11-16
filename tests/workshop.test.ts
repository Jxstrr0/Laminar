import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST, type CyclistDesign } from '../src/data/cyclist'
import { MACHINE_IDS, MACHINE_PRICE, MAKERS, MAKER_IDS, STANDARD_ORDER } from '../src/data/model'
import { buyMachine, newCareer } from '../src/sim/career'
import { machineBlock, makersOwned } from '../src/sim/facility'
import { strains } from '../src/sim/failure'
import { canMake, forMaker, modelSpecOf, quote, type ModelOrder } from '../src/sim/modelShop'
import { newLab } from '../src/sim/lab'
import { packSave, parseSave, soundCareer, soundLab, SAVE_VERSION } from '../src/persist/save'

const order: ModelOrder = { ...STANDARD_ORDER }

describe('the workshop', () => {
  it('sells each machine once, for cash, and lists who can make models', () => {
    const poor = newCareer(2)
    expect(makersOwned(poor.facility)).toEqual(['shop'])
    expect(machineBlock(poor.facility, 0, 'fdm')).toBe('money')
    const rich = { ...poor, money: 2_000_000 }
    const one = buyMachine(rich, 'fdm')
    expect(one.money).toBe(rich.money - MACHINE_PRICE.fdm)
    expect(machineBlock(one.facility, 1e9, 'fdm')).toBe('owned')
    expect(buyMachine(one, 'fdm')).toBe(one)
    const all = MACHINE_IDS.reduce((c, id) => buyMachine(c, id), rich)
    expect(makersOwned(all.facility)).toEqual(MAKER_IDS)
  })

  it('makes models cheaper and quicker than the outside shop', () => {
    const shop = quote(order)
    for (const id of MACHINE_IDS) {
      const mine = quote(forMaker(order, id))
      expect(mine.price, id).toBeLessThan(shop.price)
      expect(mine.days, id).toBeLessThanOrEqual(shop.days)
      expect(mine.days).toBeGreaterThanOrEqual(1)
    }
  })

  it('moves an order to the nearest thing each maker can do', () => {
    const big: ModelOrder = { ...order, scale: 2, finish: 'printed', grade: 'fine' }
    const resin = forMaker(big, 'resin')
    expect(resin.scale).toBe(3)
    expect(resin.finish).toBe('sanded')
    expect(canMake(resin)).toBe(true)
    const fdm = forMaker(big, 'fdm')
    expect(fdm.grade).toBe('standard')
    expect(canMake(fdm)).toBe(true)
    const back = forMaker(fdm, 'shop')
    expect('maker' in back).toBe(false)
    expect(canMake({ ...order, maker: 'resin', scale: 2 })).toBe(false)
    for (const id of MAKER_IDS) expect(canMake(forMaker(big, id))).toBe(true)
  })

  it('builds the CNC model truer to size, and makes resin parts flutter soonest', () => {
    const cnc = forMaker(order, 'cnc')
    expect(modelSpecOf(cnc, 1).accuracy).toBeCloseTo(modelSpecOf(order, 1).accuracy * MAKERS.cnc.accuracyTimes, 12)
    // A long-tailed helmet at 1:3: the same air load, different materials.
    const design: CyclistDesign = { ...structuredClone(DEFAULT_CYCLIST), helmet: { ...DEFAULT_CYCLIST.helmet, tail: 0.6 } }
    const at = (o: ModelOrder) => strains({ order: o, design }, 40, 10).find((s) => s.mode === 'flutter')?.level ?? 0
    const base: ModelOrder = { ...order, scale: 3, finish: 'sanded' }
    const shopLevel = at(base)
    expect(shopLevel).toBeGreaterThan(0)
    expect(at(forMaker(base, 'resin'))).toBeGreaterThan(shopLevel)
    expect(at(forMaker(base, 'cnc'))).toBeLessThan(shopLevel)
  })

  it('keeps machines and the maker in a save, and old saves load without them', () => {
    const career = buyMachine({ ...newCareer(2), money: 1e6 }, 'resin')
    const lab = { ...newLab(), order: forMaker(order, 'resin') }
    const back = parseSave(packSave({ v: SAVE_VERSION, savedAt: 0, design: structuredClone(DEFAULT_CYCLIST), lab, career }))!
    expect(back.career.facility.machines).toEqual(career.facility.machines)
    expect(back.lab.order).toEqual(lab.order)
    expect(soundLab({ ...newLab(), order: { ...order, maker: 'resin', scale: 2 } }, DEFAULT_CYCLIST)).toBeNull()
    expect(soundCareer({ ...career, facility: { ownOrdered: null, upgrades: {}, machines: { laser: 1 } } })).toBeNull()
  })
})
