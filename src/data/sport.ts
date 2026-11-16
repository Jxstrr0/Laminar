/**
 * The sports a design can be for (PR 8), and the design type that covers
 * them all. A design with no `sport` is a cyclist (every save from before PR 8).
 */
import type { CyclistDesign } from './cyclist'
import type { SkaterDesign } from './skater'

export type Design = CyclistDesign | SkaterDesign
export type Sport = 'cycling' | 'skating'
export const SPORTS: readonly Sport[] = ['cycling', 'skating']
