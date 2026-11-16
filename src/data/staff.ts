/**
 * The firm's staff (PR 7f). Kelbo (16 November 2026): one person per role,
 * three at most; each is paid for every day that passes; nobody is poached,
 * so staff stay until you let them go. Each role has two people to choose
 * from, each with one trait and a daily wage.
 */

export type StaffRole = 'maker' | 'tech' | 'analyst'
export const STAFF_ROLES: readonly StaffRole[] = ['maker', 'tech', 'analyst']

export type StaffId = 'orlik' | 'venko' | 'basov' | 'krasna' | 'zhelin' | 'sorokova'

/** What one person changes. Left-out fields change nothing. */
export interface StaffTrait {
  /** Model orders and repairs: price times this. */
  modelPrice?: number
  /** Model orders and repairs: days times this. */
  modelDays?: number
  /** The balance's noise times this. */
  balanceNoise?: number
  /** How much load the mount posts take before they give, times this. */
  mountStrength?: number
  /** Analyst levels for the desk estimate (DESK.perLevel each). */
  deskLevel?: number
}

export interface StaffMember {
  role: StaffRole
  /** Full name, as the player reads it. */
  name: string
  /** ₽ per day that passes. */
  wage: number
  trait: StaffTrait
}

export const STAFF: Record<StaffId, StaffMember> = {
  orlik: { role: 'maker', name: 'Daria Orlik', wage: 600, trait: { modelDays: 0.7 } },
  venko: { role: 'maker', name: 'Bogdan Venko', wage: 450, trait: { modelPrice: 0.8 } },
  basov: { role: 'tech', name: 'Timur Basov', wage: 500, trait: { balanceNoise: 0.5 } },
  krasna: { role: 'tech', name: 'Lidiya Krasna', wage: 400, trait: { mountStrength: 1.4 } },
  zhelin: { role: 'analyst', name: 'Artyom Zhelin', wage: 650, trait: { deskLevel: 3 } },
  sorokova: { role: 'analyst', name: 'Milena Sorokova', wage: 350, trait: { deskLevel: 1 } },
}

export const STAFF_IDS = Object.keys(STAFF) as StaffId[]
