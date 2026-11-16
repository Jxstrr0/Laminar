/**
 * The sports a design can be for (PR 8), road vehicles too (PR 9), and the
 * design type that covers them all. A design with no `sport` is a cyclist (every save from before PR 8).
 */
import type { AircraftDesign } from './aircraft'
import type { BobsledDesign } from './bobsled'
import type { CarDesign } from './car'
import type { CyclistDesign } from './cyclist'
import type { DroneDesign } from './drone'
import type { JumperDesign } from './jumper'
import type { PlaneDesign } from './plane'
import type { RecordDesign } from './record'
import type { SkaterDesign } from './skater'
import type { TruckDesign } from './truck'

export type Design = CyclistDesign | SkaterDesign | JumperDesign | BobsledDesign | TruckDesign | CarDesign | RecordDesign | DroneDesign | PlaneDesign | AircraftDesign
/** What a design is for: a sport, or (from PR 9) a road vehicle, or (from PR 10) something that flies. */
export type Sport = 'cycling' | 'skating' | 'skijump' | 'bobsled' | 'truck' | 'car' | 'record' | 'drone' | 'plane' | 'aircraft'
export const SPORTS: readonly Sport[] = ['cycling', 'skating', 'skijump', 'bobsled', 'truck', 'car', 'record', 'drone', 'plane', 'aircraft']
