import { describe, expect, it } from 'vitest'
import { bodyDrag, shapeDrag } from '../src/sim/aero/drag'
import type { Flow } from '../src/sim/aero/flow'
import { laminarCf, mixedCf, turbulentCf } from '../src/sim/aero/friction'
import { describeBody, describeShape } from '../src/sim/geom/body'
import { box, crossCylinder, sphere, streamlined } from '../src/sim/geom/shapes'

const AIR = { density: 1.225, viscosity: 1.81e-5 }
const air = (speed: number, turbulence = 0): Flow => ({ ...AIR, speed, turbulence })
/** The speed that gives Reynolds number re on length L. */
const atRe = (re: number, length: number, turbulence = 0): Flow =>
  air((re * AIR.viscosity) / (AIR.density * length), turbulence)

/** First Re (on the diameter) where a sphere's Cd drops below 0.3. */
function crisisRe(body: ReturnType<typeof describeBody>, d: number, turbulence = 0): number {
  for (let re = 2e4; re < 1e6; re *= 1.02) {
    if (bodyDrag(body, atRe(re, d, turbulence)).cd < 0.3) return re
  }
  return Infinity
}

describe('flat-plate friction', () => {
  it('matches Blasius and Prandtl', () => {
    expect(laminarCf(1e5)).toBeCloseTo(0.0042, 4)
    expect(turbulentCf(1e7)).toBeCloseTo(0.00295, 4)
  })
  it('sits between laminar and turbulent when transition happens part way', () => {
    const re = 3e6
    const mixed = mixedCf(re, 5e5)
    expect(mixed).toBeGreaterThan(laminarCf(re))
    expect(mixed).toBeLessThan(turbulentCf(re))
  })
  it('is fully laminar when transition never comes', () => {
    expect(mixedCf(2e5, 5e5)).toBe(laminarCf(2e5))
  })
})

describe('a smooth sphere', () => {
  const D = 0.25
  const s = describeBody(sphere('sphere', D))

  it('reads about 0.47 below the drag crisis', () => {
    const cd = bodyDrag(s, atRe(1e5, D)).cd
    expect(cd).toBeGreaterThan(0.4)
    expect(cd).toBeLessThan(0.52)
  })
  it('drops to about a third past it', () => {
    const cd = bodyDrag(s, atRe(1e6, D)).cd
    expect(cd).toBeGreaterThan(0.08)
    expect(cd).toBeLessThan(0.25)
  })
  it('has its crisis between Re 2 × 10⁵ and 5 × 10⁵', () => {
    const re = crisisRe(s, D)
    expect(re).toBeGreaterThan(2e5)
    expect(re).toBeLessThan(5e5)
  })
  it('separates later once the layer is turbulent', () => {
    const low = bodyDrag(s, atRe(1e5, D))
    const high = bodyDrag(s, atRe(1e6, D))
    expect(low.regime).toBe('laminar')
    expect(high.regime).toBe('turbulent')
    expect(high.lines.top.separationX).toBeGreaterThan(low.lines.top.separationX)
    expect(high.wakeArea).toBeLessThan(low.wakeArea)
  })
  it('hits its crisis sooner in turbulent air', () => {
    expect(crisisRe(s, D, 0.01)).toBeLessThan(crisisRe(s, D, 0))
  })
  it('has no drag in still air', () => {
    expect(bodyDrag(s, air(0)).cdA).toBe(0)
  })
})

describe('roughness and trip strips', () => {
  it('a dimpled ball goes through its crisis far earlier than a smooth one', () => {
    const d = 0.0427
    const smooth = describeBody(sphere('smooth', d))
    const dimpled = describeBody(sphere('dimpled', d, 0.0003))
    const re = crisisRe(dimpled, d)
    expect(re).toBeLessThan(1e5)
    expect(re).toBeLessThan(crisisRe(smooth, d) / 2)
  })
  it('a trip strip ahead of separation forces the turbulent result early', () => {
    const D = 0.25
    const bare = describeBody(sphere('bare', D))
    const tripped = describeBody({ ...sphere('tripped', D), trip: { at: 0.3, height: 0.0015 } })
    const flow = atRe(1.5e5, D)
    expect(bodyDrag(bare, flow).cd).toBeGreaterThan(0.4)
    expect(bodyDrag(tripped, flow).cd).toBeLessThan(0.3)
  })
})

describe('a cylinder across the flow', () => {
  it('reads about 1.2 when long', () => {
    const c = describeBody(crossCylinder('tube', 0.1, 10))
    const cd = bodyDrag(c, atRe(1e5, 0.1)).cd
    expect(cd).toBeGreaterThan(1.0)
    expect(cd).toBeLessThan(1.3)
  })
  it('reads less when short (the ends let air round it)', () => {
    const long = bodyDrag(describeBody(crossCylinder('long', 0.1, 10)), atRe(1e5, 0.1)).cd
    const short = bodyDrag(describeBody(crossCylinder('short', 0.1, 0.6)), atRe(1e5, 0.1)).cd
    expect(short).toBeLessThan(long * 0.8)
  })
  it('has a drag crisis too', () => {
    const c = describeBody(crossCylinder('tube', 0.1, 10))
    expect(bodyDrag(c, atRe(1e6, 0.1)).cd).toBeLessThan(0.5)
  })
})

describe('bluff and streamlined bodies', () => {
  it('rounding a box nose cuts its drag by over 40 %', () => {
    const sharp = bodyDrag(describeBody(box('sharp', 4, 1, 1, 0)), air(30)).cd
    const round = bodyDrag(describeBody(box('round', 4, 1, 1, 0.15)), air(30)).cd
    expect(sharp).toBeGreaterThan(0.6)
    expect(round).toBeLessThan(sharp * 0.6)
  })
  it('a streamlined body has a tiny fraction of a sphere’s drag', () => {
    const tear = bodyDrag(describeBody(streamlined('tear', 0.6, 0.2)), air(30)).cd
    expect(tear).toBeLessThan(0.1)
  })
  it('cutting a tail off shorter leaves a bigger base and more drag', () => {
    const cds = [0, 0.3, 0.5, 0.7].map((k) => bodyDrag(describeBody(streamlined('k', 1, 0.25, 0.35, k)), air(30)).cd)
    for (let i = 1; i < cds.length; i++) expect(cds[i]).toBeGreaterThan(cds[i - 1] as number)
  })
})

describe('whole shapes', () => {
  it('add interference and cavity drag on top of the bodies', () => {
    const bodies = [sphere('a', 0.2), sphere('b', 0.2)]
    const plain = shapeDrag(describeShape({ bodies }), air(20))
    const joined = shapeDrag(
      describeShape({
        bodies,
        junctions: [{ kind: 'generic', thickness: 0.05 }],
        cavities: [{ kind: 'gap', area: 0.01, depth: 1 }],
      }),
      air(20),
    )
    expect(joined.interferenceCdA).toBeGreaterThan(0)
    expect(joined.cavityCdA).toBeGreaterThan(0)
    expect(joined.cdA).toBeCloseTo(plain.cdA + joined.interferenceCdA + joined.cavityCdA, 12)
  })
  it('a fillet cuts interference drag', () => {
    const bodies = [sphere('a', 0.2)]
    const bare = shapeDrag(describeShape({ bodies, junctions: [{ kind: 'strut', thickness: 0.05 }] }), air(20))
    const filleted = shapeDrag(describeShape({ bodies, junctions: [{ kind: 'strut', thickness: 0.05, fillet: 1 }] }), air(20))
    expect(filleted.interferenceCdA).toBeLessThan(bare.interferenceCdA * 0.5)
  })
  it('gives the same answer every time', () => {
    const shape = describeShape({ bodies: [sphere('a', 0.25), box('b', 2, 0.5, 0.5, 0.05)] })
    expect(shapeDrag(shape, air(23.7))).toEqual(shapeDrag(shape, air(23.7)))
  })
})
