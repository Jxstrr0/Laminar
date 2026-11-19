/**
 * A kit of Blender parts in one .glb (PR 13an), for the things a design is
 * made of but no slider reshapes: the bike's frame, wheels and drivetrain
 * (art/bike/build.py → public/models/bike.glb), then the winter sports'
 * skates, skis and sled gear (art/winter/build.py → winter.glb, PR 13ao), and the
 * vehicles' wheels, cockpit and cab parts (art/vehicles/build.py → vehicles.glb,
 * PR 13ap), and the aircraft's props, motors, lenses and gear
 * (art/aircraft/build.py → aircraft.glb, PR 13aq). Each mesh is one part,
 * by name, with any sizes the code needs as extras; the code gives it its
 * colour.
 *
 * The game asks for a kit once at start-up (main.ts). Until it arrives, or
 * if it never does (offline with an old cache), the figures keep drawing
 * those parts in code, so nothing ever waits on it. The tests never load it.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface KitPart {
  geometry: THREE.BufferGeometry
  /** The part's extras from Blender: sizes and anchor points. */
  extras: Record<string, unknown>
}

export interface PartKit<Name extends string> {
  /** A part, if the kit has loaded. */
  get(name: Name): KitPart | undefined
  /** True once every part is in. */
  ready(): boolean
  /** Load the kit once; resolves when it's in (or has failed: the code keeps drawing). */
  load(): Promise<void>
}

export function partKit<Name extends string>(file: string): PartKit<Name> {
  const parts = new Map<string, KitPart>()
  let loading: Promise<void> | null = null
  return {
    get: (name) => parts.get(name),
    ready: () => parts.size > 0,
    load() {
      loading ??= new Promise((resolve) => {
        new GLTFLoader().load(
          `${import.meta.env.BASE_URL}models/${file}`,
          (gltf) => {
            gltf.scene.traverse((o) => {
              if (o instanceof THREE.Mesh) parts.set(o.name, { geometry: o.geometry as THREE.BufferGeometry, extras: o.userData as Record<string, unknown> })
            })
            resolve()
          },
          undefined,
          () => resolve(),
        )
      })
      return loading
    },
  }
}

export type BikePartName =
  | 'Frame'
  | 'FrameKamm'
  | 'Tyre'
  | 'RimShallow'
  | 'RimDeep'
  | 'Disc'
  | 'Hub'
  | 'SpokesFront'
  | 'SpokesFrontDeep'
  | 'SpokesRear'
  | 'SpokesRearDeep'
  | 'Saddle'
  | 'Chainring'
  | 'CrankArm'
  | 'Pedal'
  | 'Cassette'
  | 'Chain'
  | 'Derailleurs'
  | 'Headset'
  | 'Stem'
  | 'BaseBar'
  | 'ArmPad'
  | 'DropBar'
  | 'DropHoods'

/** The bike's parts (PR 13an). */
export const bikeKit = partKit<BikePartName>('bike.glb')

export type WinterPartName = 'ClapBlade' | 'ClapFrame' | 'JumpSki' | 'JumpSkiStripe' | 'JumpBinding' | 'RunnerBlade' | 'RunnerCarrier' | 'Axle' | 'PushHandle' | 'PushBar' | 'SteerRing'

/** The winter sports' parts (PR 13ao): the clap skate, the jumping ski, the bobsled's running gear and handles. */
export const winterKit = partKit<WinterPartName>('winter.glb')

export type VehiclePartName =
  | 'CarTyre'
  | 'CarRim'
  | 'CarBrake'
  | 'Helmet'
  | 'Visor'
  | 'Halo'
  | 'CarMirror'
  | 'Lamp'
  | 'TruckTyre'
  | 'TruckRim'
  | 'TruckGrille'
  | 'TruckBumper'
  | 'TruckMirror'
  | 'FuelTank'
  | 'RecordWheel'
  | 'ChuteCan'
  | 'JetNozzle'
  | 'IntakeLip'
  | 'IntakeFan'
  | 'SensorFrame'
  | 'SensorWindow'

/** The vehicles' parts (PR 13ap): wheels, the single-seater's helmet and halo, mirrors and lamps, the truck's cab parts, the record cars' engine and chute parts, the pod's sensor window. */
export const vehicleKit = partKit<VehiclePartName>('vehicles.glb')

export type AircraftPartName = 'Prop2' | 'Prop3' | 'DroneMotor' | 'PusherMotor' | 'LensBarrel' | 'LensGlass' | 'GearTyre' | 'GearHub' | 'Windscreen' | 'NavLight'

/** The aircraft's parts (PR 13aq): props, motors, camera lenses, the light aircraft's wheels, windscreen and wingtip lights. */
export const aircraftKit = partKit<AircraftPartName>('aircraft.glb')

/** A kit part as a mesh in the given material (a clone, so disposing the figure never touches the kit), or null before the kit is in. */
export function kitPart<Name extends string>(kit: PartKit<Name>, name: Name, material: THREE.Material): THREE.Mesh | null {
  const part = kit.get(name)
  return part ? new THREE.Mesh(part.geometry.clone(), material) : null
}

/** A number from a part's extras (its size from Blender), or the fallback. */
export function extra(kit: PartKit<string>, name: string, key: string, fallback: number): number {
  const value = kit.get(name)?.extras[key]
  return typeof value === 'number' ? value : fallback
}
