import { describe, expect, it } from 'vitest'
import { DEFAULT_BOBSLED } from '../src/data/bobsled'
import { ROUTES } from '../src/data/routes'
import { TCF_TIME_TRIAL } from '../src/data/rules'
import { DEFAULT_TRUCK, FLEET_TRUCK, TRUCK_RANGE, type TruckDesign } from '../src/data/truck'
import { designComfort, designEvent, designPose, designReadouts, designShape, isBobsled, isCyclist, isTruck, sportOf } from '../src/sim/design'
import { changedControls } from '../src/sim/designDiff'
import { truckDeskEstimate } from '../src/sim/desk'
import { designEllipsoids } from '../src/sim/flow/ellipsoids'
import { truckLength, truckShape } from '../src/sim/geom/truck'
import { truckX } from '../src/sim/geom/truckPose'
import { partChanges, postureChanged, swapParts } from '../src/sim/remodel'
import { fuelSaving, truckReadouts } from '../src/sim/truck'
import { REFERENCE_TT } from '../src/sim/views'
import { soundDesign } from '../src/persist/save'

const route = ROUTES['stavren-mostograd']
type Patch = { cab?: Partial<TruckDesign['cab']>; gap?: Partial<TruckDesign['gap']>; trailer?: Partial<TruckDesign['trailer']> }
const truck = (p: Patch = {}, base: TruckDesign = DEFAULT_TRUCK): TruckDesign => ({
  ...base,
  cab: { ...base.cab, ...p.cab },
  gap: { ...base.gap, ...p.gap },
  trailer: { ...base.trailer, ...p.trailer },
})

describe('the truck as a design', () => {
  it('is its own sport, with the rig’s box as its shape', () => {
    expect(sportOf(DEFAULT_TRUCK)).toBe('truck')
    expect(isTruck(DEFAULT_TRUCK)).toBe(true)
    expect(isCyclist(DEFAULT_TRUCK)).toBe(false)
    expect(isBobsled(DEFAULT_TRUCK)).toBe(false)
    expect(designShape(DEFAULT_TRUCK)).toEqual(truckShape(DEFAULT_TRUCK))
  })

  it('has nobody to tire and no cycling rules: the road code is the sheet’s own', () => {
    expect(designComfort(DEFAULT_TRUCK).holdable).toBe(true)
    expect(designEvent(DEFAULT_TRUCK, REFERENCE_TT)).toBe(REFERENCE_TT)
    const r = designReadouts(truck({ trailer: { tail: 1.6 } }), TCF_TIME_TRIAL)
    expect(r.breaks).toEqual([])
    expect(r.mass).toBe(truckReadouts(truck({ trailer: { tail: 1.6 } })).mass)
  })

  it('draws the rig centred on its middle, nose forward', () => {
    expect(truckX(DEFAULT_TRUCK, 0)).toBeCloseTo(truckLength(DEFAULT_TRUCK) / 2, 9)
    expect(truckX(DEFAULT_TRUCK, truckLength(DEFAULT_TRUCK))).toBeCloseTo(-truckLength(DEFAULT_TRUCK) / 2, 9)
    // The driver sits in the cab, near the front.
    expect(designPose(DEFAULT_TRUCK).head.x).toBeGreaterThan(truckLength(DEFAULT_TRUCK) / 2 - 2)
  })

  it('shows the flow one oval as long as the rig', () => {
    const e = designEllipsoids(DEFAULT_TRUCK, designPose(DEFAULT_TRUCK))
    expect(e).toHaveLength(1)
    expect(e[0]!.id).toBe('rig')
  })
})

describe('the desk on a truck', () => {
  it('guesses the saving within its bars most of the time, the same guess for the same truck and job', () => {
    const real = fuelSaving(DEFAULT_TRUCK, FLEET_TRUCK, route)
    let inside = 0
    for (let seed = 1; seed <= 40; seed++) {
      const d = truckDeskEstimate(DEFAULT_TRUCK, FLEET_TRUCK, route, seed, 'k')
      expect(d.low).toBeLessThan(d.value)
      expect(d.high).toBeGreaterThan(d.value)
      if (real >= d.low && real <= d.high) inside++
    }
    expect(inside).toBeGreaterThan(28)
    expect(truckDeskEstimate(DEFAULT_TRUCK, FLEET_TRUCK, route, 7, 'k')).toEqual(truckDeskEstimate(DEFAULT_TRUCK, FLEET_TRUCK, route, 7, 'k'))
  })

  it('is unsure by a point or two of saving, and less with a better analyst', () => {
    const d = truckDeskEstimate(DEFAULT_TRUCK, FLEET_TRUCK, route, 1, 'k')
    const spread = (d.high - d.low) / 2
    expect(spread).toBeGreaterThan(1)
    expect(spread).toBeLessThan(6)
    const sharp = truckDeskEstimate(DEFAULT_TRUCK, FLEET_TRUCK, route, 1, 'k', 3)
    expect(sharp.high - sharp.low).toBeLessThan(d.high - d.low)
    // A crosswind costs more drag than straight on.
    expect(d.cdA10).toBeGreaterThan(d.cdA)
  })
})

describe('the truck in saves, run reports and the model shop', () => {
  it('round-trips through a save and turns away a truck it couldn’t have written', () => {
    expect(soundDesign(structuredClone(DEFAULT_TRUCK))).toEqual(DEFAULT_TRUCK)
    expect(soundDesign({ ...DEFAULT_TRUCK, cab: { nose: 'round', fairing: 1, extenders: 0 } })).toBeNull()
    expect(soundDesign({ ...DEFAULT_TRUCK, trailerTop: undefined })).toBeNull()
    const wild = soundDesign(truck({ trailer: { tail: 9, tailAngle: -3 }, gap: { fill: 2 } })) as TruckDesign
    expect(wild.trailer.tail).toBe(TRUCK_RANGE.tail.max)
    expect(wild.trailer.tailAngle).toBe(TRUCK_RANGE.tailAngle.min)
    expect(wild.gap.fill).toBe(1)
  })

  it('names the truck parts that changed', () => {
    expect(changedControls(DEFAULT_TRUCK, truck({ cab: { fairing: 0.6 }, trailer: { skirts: 0.3 } }))).toEqual(['fairing', 'skirts'])
    expect(changedControls(DEFAULT_TRUCK, truck({ gap: { length: 1.2 } }))).toEqual(['gapLength'])
    expect(changedControls(DEFAULT_TRUCK, DEFAULT_BOBSLED)).toContain('boatTail')
  })

  it('builds a new model for any change, for now: bolt-on swaps come with the truck tunnel', () => {
    expect(partChanges(DEFAULT_TRUCK, truck({ trailer: { skirts: 0.3 } }))).toEqual([])
    expect(postureChanged(DEFAULT_TRUCK, truck({ trailer: { skirts: 0.3 } }))).toBe(true)
    expect(postureChanged(DEFAULT_TRUCK, structuredClone(DEFAULT_TRUCK))).toBe(false)
    expect(swapParts(DEFAULT_TRUCK, truck({ trailer: { skirts: 0.3 } }))).toEqual(DEFAULT_TRUCK)
  })
})
