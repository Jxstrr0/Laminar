/**
 * The R&D tree (PR 11d; Kelbo, 16 November 2026: "Money and days"). Each
 * project costs rubles up front and takes days, like a tunnel upgrade, while
 * the firm keeps working; one runs at a time. A finished project changes
 * the firm for good, through the same levers staff traits pull (plan
 * section 9.7: materials, techniques, instruments, analysis).
 */
import type { StaffTrait } from './staff'

export type ResearchArea = 'analysis' | 'instruments' | 'materials' | 'techniques'
export const RESEARCH_AREAS: readonly ResearchArea[] = ['analysis', 'instruments', 'materials', 'techniques']

export type ResearchId = 'deskMethods' | 'fieldStudy' | 'balanceCal' | 'steadyBalance' | 'carbonSkins' | 'quickMoulds' | 'stiffStings' | 'flexureMounts'

export interface ResearchProject {
  area: ResearchArea
  /** ₽, paid when the project starts. */
  price: number
  /** Days from starting to done. */
  days: number
  /** A project that must be finished first. */
  needs?: ResearchId
  /** What it changes once done (the same levers as a staff trait; they stack). */
  effect: StaffTrait
}

export const RESEARCH: Record<ResearchId, ResearchProject> = {
  // Analysis: the desk estimate's spread narrows, a level at a time (DESK.perLevel each).
  deskMethods: { area: 'analysis', price: 120000, days: 20, effect: { deskLevel: 1 } },
  fieldStudy: { area: 'analysis', price: 350000, days: 45, needs: 'deskMethods', effect: { deskLevel: 2 } },
  // Instruments: a quieter force balance.
  balanceCal: { area: 'instruments', price: 200000, days: 25, effect: { balanceNoise: 0.75 } },
  steadyBalance: { area: 'instruments', price: 450000, days: 40, needs: 'balanceCal', effect: { balanceNoise: 0.75 } },
  // Materials: cheaper models, then quicker ones.
  carbonSkins: { area: 'materials', price: 150000, days: 20, effect: { modelPrice: 0.85 } },
  quickMoulds: { area: 'materials', price: 300000, days: 30, needs: 'carbonSkins', effect: { modelDays: 0.8 } },
  // Techniques: mounts that take more load before they give.
  stiffStings: { area: 'techniques', price: 160000, days: 20, effect: { mountStrength: 1.3 } },
  flexureMounts: { area: 'techniques', price: 380000, days: 35, needs: 'stiffStings', effect: { mountStrength: 1.3 } },
}

/** Display order: by area, first tier first. */
export const RESEARCH_IDS = Object.keys(RESEARCH) as ResearchId[]
