/**
 * The crew you've hired (src/data/staff.ts), and what they change: model
 * orders, the balance, the mount and the desk estimate. One per role; their
 * wages are paid for each day that passes (career.passDays).
 */
import { STAFF, STAFF_IDS, STAFF_ROLES, type StaffId, type StaffRole } from '../data/staff'

/** Who holds each role (left out while it's empty). */
export type Crew = Partial<Record<StaffRole, StaffId>>

export const NO_CREW: Crew = {}

/** Everyone on the payroll. */
export function crewIds(crew: Crew): StaffId[] {
  return STAFF_ROLES.flatMap((r) => (crew[r] ? [crew[r]] : []))
}

/** The crew's wages for one day, ₽. */
export function wagesPerDay(crew: Crew): number {
  return crewIds(crew).reduce((sum, id) => sum + STAFF[id].wage, 0)
}

/** What the whole crew changes together (1s and 0 with nobody hired). */
export interface CrewEffects {
  modelPrice: number
  modelDays: number
  balanceNoise: number
  mountStrength: number
  deskLevel: number
}

export const NO_EFFECTS: CrewEffects = { modelPrice: 1, modelDays: 1, balanceNoise: 1, mountStrength: 1, deskLevel: 0 }

export function crewEffects(crew: Crew): CrewEffects {
  const out = { ...NO_EFFECTS }
  for (const id of crewIds(crew)) {
    const t = STAFF[id].trait
    out.modelPrice *= t.modelPrice ?? 1
    out.modelDays *= t.modelDays ?? 1
    out.balanceNoise *= t.balanceNoise ?? 1
    out.mountStrength *= t.mountStrength ?? 1
    out.deskLevel += t.deskLevel ?? 0
  }
  return out
}

/** Hire someone into their role (anyone already in it leaves). */
export function hire(crew: Crew, id: StaffId): Crew {
  return { ...crew, [STAFF[id].role]: id }
}

/** Let someone go. */
export function letGo(crew: Crew, id: StaffId): Crew {
  const role = STAFF[id].role
  if (crew[role] !== id) return crew
  const { [role]: _gone, ...rest } = crew
  return rest
}

/** A crew as read from a save, or null if it isn't one. */
export function soundCrew(x: unknown): Crew | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null
  const crew: Crew = {}
  for (const [role, id] of Object.entries(x as Record<string, unknown>)) {
    if (!(STAFF_ROLES as readonly string[]).includes(role)) return null
    if (typeof id !== 'string' || !(STAFF_IDS as readonly string[]).includes(id)) return null
    if (STAFF[id as StaffId].role !== role) return null
    crew[role as StaffRole] = id as StaffId
  }
  return crew
}
