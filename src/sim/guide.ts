/**
 * The guided first job (plan section 2: "partner's cards plus a highlighted
 * checklist, skippable"). Your partner walks you through the first brief one
 * step at a time. Each step ticks when you really do it (the tunnel, the
 * model shop and the Shape screen report what happened), so the guide never
 * gets ahead of you. It shows only until the first job is delivered, and
 * can be hidden for good.
 */
import { briefTemplate, type CareerState } from './career'
import type { CyclistDesign } from '../data/cyclist'

/** The first job, in order. */
export const GUIDE_STEPS = ['bid', 'model', 'baseline', 'shape', 'remodel', 'test', 'deliver'] as const
export type GuideStep = (typeof GUIDE_STEPS)[number]

export interface Guide {
  /** Hidden for the rest of this career. */
  off: boolean
  /** Steps ticked by what you did (bid and deliver are read from the job itself). */
  done: GuideStep[]
}

export function guideOn(state: CareerState): boolean {
  return !state.guide.off && state.jobsDone === 0
}

export function stepDone(state: CareerState, step: GuideStep): boolean {
  if (step === 'bid') return state.job !== null || state.jobsDone > 0
  if (step === 'deliver') return state.jobsDone > 0
  return state.guide.done.includes(step)
}

/** The step to do next, or null when the guide is hidden or finished. */
export function currentStep(state: CareerState): GuideStep | null {
  if (!guideOn(state)) return null
  return GUIDE_STEPS.find((s) => !stepDone(state, s)) ?? null
}

/** Tick a step (once, and only while the guide is showing). */
export function tickGuide(state: CareerState, step: GuideStep): CareerState {
  if (!guideOn(state) || state.guide.done.includes(step)) return state
  return { ...state, guide: { ...state.guide, done: [...state.guide.done, step] } }
}

export function hideGuide(state: CareerState): CareerState {
  return state.guide.off ? state : { ...state, guide: { ...state.guide, off: true } }
}

/** A model was ordered: of her setup before any shaping, or of your design after. */
export function afterOrder(state: CareerState): CareerState {
  return tickGuide(state, stepDone(state, 'shape') ? 'remodel' : 'model')
}

/** Parts were swapped on the model: that counts as modelling your design, once you've shaped one. */
export function afterSwap(state: CareerState): CareerState {
  return stepDone(state, 'shape') ? tickGuide(state, 'remodel') : state
}

/** A tunnel run ended: the baseline once her setup is modelled, the test once your design is. */
export function afterRun(state: CareerState): CareerState {
  if (stepDone(state, 'remodel')) return tickGuide(state, 'test')
  if (stepDone(state, 'model')) return tickGuide(state, 'baseline')
  return state
}

/** The bench design changed: once it differs from how the client rides, you've shaped a position. */
export function afterDesign(state: CareerState, design: CyclistDesign): CareerState {
  if (!state.job) return state
  const setup = briefTemplate(state.job.brief.id)?.setup
  if (!setup || JSON.stringify(setup) === JSON.stringify(design)) return state
  return tickGuide(state, 'shape')
}
