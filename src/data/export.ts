/**
 * Export (PR 11f; Kelbo, 16 November 2026: "Reputation gate", two countries
 * to start). Clients from neighbouring countries call once the firm's name
 * is good enough: their own air (a high, thin-aired upland and a hot, windy
 * coast), their own cycling rulebooks and their own aero firm bidding
 * against you. Results abroad never count for Tarnovian records. Every name
 * here is fictional and listed in docs/NAMES.md.
 */
import type { CyclingRules } from './rules'

export type CountryId = 'gornova' | 'zelenia'
export const COUNTRY_IDS: readonly CountryId[] = ['gornova', 'zelenia']

export interface Country {
  name: string
  /** One line for the brief card. */
  blurb: string
  /** Its cycling body, in full and short. */
  federation: string
  short: string
  /** The reputation a firm needs before this country's clients call. */
  minRep: number
  /** Its cycling federation's rulebook (time trials). */
  rules: CyclingRules
}

export const COUNTRIES: Record<CountryId, Country> = {
  gornova: {
    name: 'Gornova',
    blurb: 'Tarnovia’s mountain neighbour: high roads and thin, cold air.',
    federation: 'Gornovan Cycling Union',
    short: 'GCU',
    minRep: 60,
    // The Gornovan Cycling Union: longer helmets and a front disc are allowed, but the hands stay closer in.
    rules: { id: 'gcu-tt', maxHelmetLength: 0.45, maxHandReach: 0.75, maxHandHeight: 0.15, frontWheels: ['spoked', 'deep', 'disc'], maxTubeAspect: 3 },
  },
  zelenia: {
    name: 'Zelenia',
    blurb: 'The warm country down the coast: hot air and a sea wind most days.',
    federation: 'Zelenian Cycling League',
    short: 'ZCL',
    minRep: 70,
    // The Zelenian Cycling League: short helmets and low hands, but a longer reach and deeper frame tubes.
    rules: { id: 'zcl-tt', maxHelmetLength: 0.35, maxHandReach: 0.85, maxHandHeight: 0.05, frontWheels: ['spoked', 'deep'], maxTubeAspect: 4 },
  },
}
