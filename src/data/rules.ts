/**
 * Rulebooks. The Tarnovian Cycling Federation (TCF) is fictional; its
 * numbers are made up for the game, loosely in the spirit of real time-trial
 * rules. Each brief carries a rulebook; parts that break it go red and the
 * design can't be delivered.
 */
import type { WheelKind } from './cyclist'

export interface CyclingRules {
  id: string
  /** Longest helmet, m. */
  maxHelmetLength: number
  /** Hands no further ahead of the bottom bracket than this, m. */
  maxHandReach: number
  /** Hands no higher above the saddle than this, m. */
  maxHandHeight: number
  /** Front wheels allowed. */
  frontWheels: WheelKind[]
  /** Frame tubes no longer than this many times their width. */
  maxTubeAspect: number
}

export const TCF_TIME_TRIAL: CyclingRules = {
  id: 'tcf-tt',
  maxHelmetLength: 0.4,
  maxHandReach: 0.8,
  maxHandHeight: 0.1,
  frontWheels: ['spoked', 'deep'],
  maxTubeAspect: 3,
}
