/**
 * Where the firm tests (plan section 9.2): the university's tunnel, rented
 * by the run, until your own is built. Building it is a cash purchase
 * (Kelbo: save up, no loans) that takes OWN_TUNNEL_BUILD.days while you keep
 * working; once it's open, its upkeep is paid for every day that passes.
 */
import { OWN_BILLING, OWN_QUIRKS, OWN_TUNNEL_BUILD, TUNNEL_BILLING, TUNNEL_UPGRADES, UNIVERSITY_QUIRKS, UNIVERSITY_TUNNEL, UPGRADE_IDS, type UpgradeId } from '../data/tunnel'
import { MACHINE_PRICE, MAKER_IDS, type MachineId, type MakerId } from '../data/model'
import { rollQuirks, type QuirkRanges, type TunnelQuirks } from './quirks'
import { hashString } from './rng'

export type TunnelId = 'university' | 'own'

export interface Facility {
  /** The career day your own tunnel was paid for, or null if it hasn't been. */
  ownOrdered: number | null
  /** The career day each upgrade was paid for (left out until it is). */
  upgrades: Partial<Record<UpgradeId, number>>
  /** The career day each workshop machine was bought (left out until it is). */
  machines: Partial<Record<MachineId, number>>
}

export const NO_FACILITY: Facility = { ownOrdered: null, upgrades: {}, machines: {} }

/** Who can make your models: the outside shop, and every machine you own. */
export function makersOwned(f: Facility): MakerId[] {
  return MAKER_IDS.filter((m) => m === 'shop' || f.machines[m] !== undefined)
}

/** Why a machine can't be bought now, or null if it can. */
export type MachineBlock = 'owned' | 'money' | null

export function machineBlock(f: Facility, money: number, id: MachineId): MachineBlock {
  if (f.machines[id] !== undefined) return 'owned'
  return money < MACHINE_PRICE[id] ? 'money' : null
}

/** The day your own tunnel opens, or null if it hasn't been ordered. */
export function ownReadyDay(f: Facility): number | null {
  return f.ownOrdered === null ? null : f.ownOrdered + OWN_TUNNEL_BUILD.days
}

/** The tunnel the firm tests in on this day. */
export function activeTunnel(f: Facility, day: number): TunnelId {
  const ready = ownReadyDay(f)
  return ready !== null && day >= ready ? 'own' : 'university'
}

/** Days of upkeep owed for the days after `from` up to and including `to`. */
export function upkeepDays(f: Facility, from: number, to: number): number {
  const ready = ownReadyDay(f)
  if (ready === null || to <= from) return 0
  return Math.max(0, to - Math.max(from, ready - 1))
}

/** Why the tunnel can't be ordered now, or null if it can. */
export type BuildBlock = 'ordered' | 'money' | null

export function buildBlock(f: Facility, money: number): BuildBlock {
  if (f.ownOrdered !== null) return 'ordered'
  return money < OWN_TUNNEL_BUILD.price ? 'money' : null
}

/** The day an upgrade is fitted, or null if it hasn't been ordered. */
export function upgradeReadyDay(f: Facility, id: UpgradeId): number | null {
  const ordered = f.upgrades[id]
  return ordered === undefined ? null : ordered + TUNNEL_UPGRADES[id].days
}

/** The upgrades fitted to your tunnel by this day, in display order. */
export function fittedUpgrades(f: Facility, day: number): UpgradeId[] {
  return UPGRADE_IDS.filter((id) => {
    const ready = upgradeReadyDay(f, id)
    return ready !== null && day >= ready
  })
}

/** Why an upgrade can't be ordered now, or null if it can. Upgrades are for your own tunnel, once it's open. */
export type UpgradeBlock = 'noTunnel' | 'ordered' | 'money' | null

export function upgradeBlock(f: Facility, day: number, money: number, id: UpgradeId): UpgradeBlock {
  if (activeTunnel(f, day) !== 'own') return 'noTunnel'
  if (f.upgrades[id] !== undefined) return 'ordered'
  return money < TUNNEL_UPGRADES[id].price ? 'money' : null
}

const QUIRK_RANGES: Record<TunnelId, QuirkRanges> = { university: UNIVERSITY_QUIRKS, own: OWN_QUIRKS }
const BILLING: Record<TunnelId, { perRun: number; perKWh: number }> = { university: TUNNEL_BILLING, own: OWN_BILLING }

/** A tunnel's hidden quirks in this career. The university's keep the career seed as before. */
export function tunnelQuirks(id: TunnelId, careerSeed: number): TunnelQuirks {
  const seed = id === 'university' ? careerSeed : hashString(`own-tunnel:${careerSeed}`)
  return rollQuirks(QUIRK_RANGES[id], seed)
}

/** What a run costs in a tunnel, ₽: its fee plus the fan's energy. */
export function tunnelRunCost(id: TunnelId, energyKWh: number): number {
  const b = BILLING[id]
  return b.perRun + energyKWh * b.perKWh
}

export type TunnelBuild = Omit<typeof UNIVERSITY_TUNNEL, 'topSpeed' | 'wheelDrive' | 'turntable'> & {
  topSpeed: number
  wheelDrive: boolean
  turntable: { min: number; max: number; step: number; rate: number }
}

/** Everything about the tunnel in use on a day: which it is, its build and its hidden quirks. */
export interface TunnelSetup {
  id: TunnelId
  build: TunnelBuild
  quirks: TunnelQuirks
  fitted: UpgradeId[]
  /** Changes whenever the setup does (a new tunnel, an upgrade fitted). */
  key: string
}

/** The tunnel the firm tests in on this day, with whatever upgrades are fitted. */
export function tunnelSetup(careerSeed: number, f: Facility, day: number): TunnelSetup {
  const id = activeTunnel(f, day)
  const fitted = id === 'own' ? fittedUpgrades(f, day) : []
  const has = (u: UpgradeId) => fitted.includes(u)
  const base = UNIVERSITY_TUNNEL
  const yaw = has('turntable') ? TUNNEL_UPGRADES.turntable.yawRange : base.turntable.max
  const build: TunnelBuild = {
    ...base,
    topSpeed: has('fan') ? TUNNEL_UPGRADES.fan.topSpeed : base.topSpeed,
    wheelDrive: has('wheelDrive'),
    turntable: { ...base.turntable, min: -yaw, max: yaw },
  }
  const raw = tunnelQuirks(id, careerSeed)
  const quirks = has('screens') ? { ...raw, turbulence: raw.turbulence * TUNNEL_UPGRADES.screens.turbulenceShare } : raw
  return { id, build, quirks, fitted, key: [id, ...fitted].join(':') }
}
