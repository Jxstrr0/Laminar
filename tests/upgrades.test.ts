import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { OWN_TUNNEL_BUILD, TUNNEL_UPGRADES, UNIVERSITY_TUNNEL, UPGRADE_IDS } from '../src/data/tunnel'
import { buildOwnTunnel, newCareer, orderUpgrade, type CareerState } from '../src/sim/career'
import { fittedUpgrades, ownReadyDay, tunnelQuirks, tunnelSetup, upgradeBlock, upgradeReadyDay } from '../src/sim/facility'
import { newLab } from '../src/sim/lab'
import { packSave, parseSave, soundCareer, SAVE_VERSION } from '../src/persist/save'

/** A career with its own tunnel open and money to spend. */
function opened(seed = 5): CareerState {
  const built = buildOwnTunnel({ ...newCareer(seed), money: OWN_TUNNEL_BUILD.price + 4_000_000, day: 10 })
  return { ...built, day: ownReadyDay(built.facility)! }
}

describe('tunnel upgrades', () => {
  it('need your own tunnel open, cash, and are bought once', () => {
    const c = newCareer(5)
    expect(upgradeBlock(c.facility, c.day, 1e9, 'screens')).toBe('noTunnel')
    const building = buildOwnTunnel({ ...c, money: OWN_TUNNEL_BUILD.price + 1e6 })
    expect(upgradeBlock(building.facility, building.day, 1e9, 'screens')).toBe('noTunnel')
    const o = opened()
    expect(upgradeBlock(o.facility, o.day, 0, 'fan')).toBe('money')
    const bought = orderUpgrade(o, 'fan')
    expect(bought.money).toBe(o.money - TUNNEL_UPGRADES.fan.price)
    expect(upgradeBlock(bought.facility, bought.day, 1e9, 'fan')).toBe('ordered')
    expect(orderUpgrade(bought, 'fan')).toBe(bought)
  })

  it('are fitted after their days and only then change the tunnel', () => {
    let o = opened()
    for (const id of UPGRADE_IDS) o = orderUpgrade(o, id)
    const before = tunnelSetup(o.seed, o.facility, o.day)
    expect(before.fitted).toEqual([])
    expect(before.build.topSpeed).toBe(UNIVERSITY_TUNNEL.topSpeed)
    const last = Math.max(...UPGRADE_IDS.map((id) => upgradeReadyDay(o.facility, id)!))
    expect(fittedUpgrades(o.facility, last - 1).length).toBeLessThan(UPGRADE_IDS.length)
    const after = tunnelSetup(o.seed, o.facility, last)
    expect(after.fitted).toEqual(UPGRADE_IDS)
    expect(after.key).not.toBe(before.key)
    expect(after.build.topSpeed).toBe(TUNNEL_UPGRADES.fan.topSpeed)
    expect(after.build.wheelDrive).toBe(true)
    expect(after.build.rollingRoad).toBe(true)
    expect(after.build.piv).toBe(true)
    expect(after.build.turntable.max).toBe(TUNNEL_UPGRADES.turntable.yawRange)
    expect(after.build.turntable.min).toBe(-TUNNEL_UPGRADES.turntable.yawRange)
    expect(after.quirks.turbulence).toBeCloseTo(tunnelQuirks('own', o.seed).turbulence * TUNNEL_UPGRADES.screens.turbulenceShare, 12)
    // The other quirks don't move.
    expect(after.quirks.blockage).toBe(before.quirks.blockage)
  })

  it('leaves the university’s tunnel as it always was', () => {
    const c = newCareer(9)
    const s = tunnelSetup(c.seed, c.facility, 500)
    expect(s.id).toBe('university')
    expect(s.build.wheelDrive).toBe(false)
    expect(s.build.rollingRoad).toBe(false)
    expect(s.build.piv).toBe(false)
    expect(s.build.topSpeed).toBe(UNIVERSITY_TUNNEL.topSpeed)
    expect(s.quirks).toEqual(tunnelQuirks('university', c.seed))
  })

  it('keep their order days in a save, and a bad one is refused', () => {
    const o = orderUpgrade(orderUpgrade(opened(), 'screens'), 'wheelDrive')
    const text = packSave({ v: SAVE_VERSION, savedAt: 0, design: structuredClone(DEFAULT_CYCLIST), lab: newLab(), career: o })
    expect(parseSave(text)!.career.facility).toEqual(o.facility)
    expect(soundCareer({ ...o, facility: { ownOrdered: 1, upgrades: { warpDrive: 3 } } })).toBeNull()
    expect(soundCareer({ ...o, facility: { ownOrdered: 1, upgrades: { fan: -1 } } })).toBeNull()
  })
})
