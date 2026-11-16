/**
 * The sports a design can be for (PR 8), road vehicles too (PR 9), and the
 * design type that covers them all. A design with no `sport` is a cyclist (every save from before PR 8).
 */
import type { BobsledDesign } from './bobsled'
import type { CarDesign } from './car'
import type { CyclistDesign } from './cyclist'
import type { JumperDesign } from './jumper'
import type { SkaterDesign } from './skater'
import type { TruckDesign } from './truck'

export type Design = CyclistDesign | SkaterDesign | JumperDesign | BobsledDesign | TruckDesign | CarDesign
/** What a design is for: a sport, or (from PR 9) a road vehicle. */
export type Sport = 'cycling' | 'skating' | 'skijump' | 'bobsled' | 'truck' | 'car'
export const SPORTS: readonly Sport[] = ['cycling', 'skating', 'skijump', 'bobsled', 'truck', 'car']
