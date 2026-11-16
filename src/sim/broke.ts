/**
 * Going broke, the soft landing (plan section 9.8): no game over. When a job
 * leaves cash below zero, kit is sold at a loss (BROKE.saleShare of what it
 * cost), cheapest first, until cash is back above zero. Your own tunnel goes
 * only once every machine and upgrade has, and the firm rents the
 * university's tunnel again. Staff stay (Kelbo, 16 November 2026).
 */
import { BROKE } from '../data/reputation'
import { MACHINE_IDS, MACHINE_PRICE, type MachineId } from '../data/model'
import { OWN_TUNNEL_BUILD, TUNNEL_UPGRADES, UPGRADE_IDS, type UpgradeId } from '../data/tunnel'
import type { Facility } from './facility'

/** One thing the firm owns that can be sold. */
export type KitItem = { kind: 'machine'; id: MachineId } | { kind: 'upgrade'; id: UpgradeId } | { kind: 'tunnel' }

/** What an item cost new, ₽. */
export function paidFor(item: KitItem): number {
  if (item.kind === 'machine') return MACHINE_PRICE[item.id]
  if (item.kind === 'upgrade') return TUNNEL_UPGRADES[item.id].price
  return OWN_TUNNEL_BUILD.price
}

/** What an item fetches in a fire sale, ₽. */
export function salePrice(item: KitItem): number {
  return Math.round((paidFor(item) * BROKE.saleShare) / BROKE.round) * BROKE.round
}

/** Everything that can be sold, in the order it goes: kit cheapest first, the tunnel last. */
export function sellable(f: Facility): KitItem[] {
  const kit: KitItem[] = [
    ...MACHINE_IDS.filter((id) => f.machines[id] !== undefined).map((id): KitItem => ({ kind: 'machine', id })),
    ...UPGRADE_IDS.filter((id) => f.upgrades[id] !== undefined).map((id): KitItem => ({ kind: 'upgrade', id })),
  ]
  // A stable sort keeps machines ahead of upgrades at the same price.
  kit.sort((a, b) => paidFor(a) - paidFor(b))
  return f.ownOrdered !== null ? [...kit, { kind: 'tunnel' }] : kit
}

/** What a fire sale sold, and for how much. */
export interface Sale {
  sold: { item: KitItem; price: number }[]
  /** ₽ raised. */
  total: number
}

/** Sell kit in order until `money` is back to zero or more (or nothing's left). */
export function sellToCover(money: number, f: Facility): { money: number; facility: Facility; sale: Sale } {
  let cash = money
  let facility: Facility = { ...f, machines: { ...f.machines }, upgrades: { ...f.upgrades } }
  const sold: Sale['sold'] = []
  for (const item of sellable(f)) {
    if (cash >= 0) break
    const price = salePrice(item)
    cash += price
    sold.push({ item, price })
    if (item.kind === 'machine') delete facility.machines[item.id]
    else if (item.kind === 'upgrade') delete facility.upgrades[item.id]
    else facility = { ...facility, ownOrdered: null, upgrades: {} }
  }
  return { money: cash, facility, sale: { sold, total: cash - money } }
}
