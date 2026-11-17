/**
 * The firm's R&D (PR 11d): which projects were started and when. A project
 * is done once its days have passed; one runs at a time; what a finished
 * project changes stacks with the staff's traits (src/sim/staff.ts).
 */
import { RESEARCH, RESEARCH_IDS, type ResearchId } from '../data/research'
import { NO_EFFECTS, type CrewEffects } from './staff'

/** The career day each project was started (left out until it is). */
export type Research = Partial<Record<ResearchId, number>>

export const NO_RESEARCH: Research = {}

/** The day a project is done, or null if it hasn't been started. */
export function researchReadyDay(r: Research, id: ResearchId): number | null {
  const started = r[id]
  return started === undefined ? null : started + RESEARCH[id].days
}

/** The projects done by this day, in display order. */
export function finishedResearch(r: Research, day: number): ResearchId[] {
  return RESEARCH_IDS.filter((id) => {
    const ready = researchReadyDay(r, id)
    return ready !== null && day >= ready
  })
}

/** The project under way on this day, or null. */
export function researchUnderWay(r: Research, day: number): ResearchId | null {
  return (
    RESEARCH_IDS.find((id) => {
      const ready = researchReadyDay(r, id)
      return ready !== null && day < ready
    }) ?? null
  )
}

/** Why a project can't start now, or null if it can. */
export type ResearchBlock = 'started' | 'busy' | 'needs' | 'money' | null

export function researchBlock(r: Research, day: number, money: number, id: ResearchId): ResearchBlock {
  if (r[id] !== undefined) return 'started'
  if (researchUnderWay(r, day) !== null) return 'busy'
  const needs = RESEARCH[id].needs
  if (needs && !finishedResearch(r, day).includes(needs)) return 'needs'
  return money < RESEARCH[id].price ? 'money' : null
}

/** What the finished projects change together (1s and 0 with none done). */
export function researchEffects(done: readonly ResearchId[]): CrewEffects {
  const out = { ...NO_EFFECTS }
  for (const id of done) {
    const e = RESEARCH[id].effect
    out.modelPrice *= e.modelPrice ?? 1
    out.modelDays *= e.modelDays ?? 1
    out.balanceNoise *= e.balanceNoise ?? 1
    out.mountStrength *= e.mountStrength ?? 1
    out.deskLevel += e.deskLevel ?? 0
  }
  return out
}

/** Two sets of effects together: the factors multiply and the desk levels add. */
export function combineEffects(a: CrewEffects, b: CrewEffects): CrewEffects {
  return {
    modelPrice: a.modelPrice * b.modelPrice,
    modelDays: a.modelDays * b.modelDays,
    balanceNoise: a.balanceNoise * b.balanceNoise,
    mountStrength: a.mountStrength * b.mountStrength,
    deskLevel: a.deskLevel + b.deskLevel,
  }
}

/** A saved R&D record, or null if it isn't one the game could have written. */
export function soundResearch(x: unknown): Research | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null
  const out: Research = {}
  for (const [k, v] of Object.entries(x)) {
    if (!(RESEARCH_IDS as readonly string[]).includes(k)) return null
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return null
    out[k as ResearchId] = v
  }
  return out
}
