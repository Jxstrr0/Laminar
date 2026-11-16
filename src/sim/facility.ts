/**
 * Where the firm tests (plan section 9.2): the university's tunnel, rented
 * by the run, until your own is built. Building it is a cash purchase
 * (Kelbo: save up, no loans) that takes OWN_TUNNEL_BUILD.days while you keep
 * working; once it's open, its upkeep is paid for every day that passes.
 */
import { OWN_BILLING, OWN_QUIRKS, OWN_TUNNEL_BUILD, TUNNEL_BILLING, UNIVERSITY_QUIRKS, UNIVERSITY_TUNNEL } from '../data/tunnel'
import { rollQuirks, type QuirkRanges, type TunnelQuirks } from './quirks'
import { hashString } from './rng'

export type TunnelId = 'university' | 'own'

export interface Facility {
  /** The career day your own tunnel was paid for, or null if it hasn't been. */
  ownOrdered: number | null
}

export const NO_FACILITY: Facility = { ownOrdered: null }

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

/** The tunnel's build: test section, fan and turntable (the same for both, for now). */
export function tunnelBuild(_id: TunnelId): typeof UNIVERSITY_TUNNEL {
  return UNIVERSITY_TUNNEL
}
