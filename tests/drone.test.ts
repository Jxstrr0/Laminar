import { describe, expect, it } from 'vitest'
import { DRONE_CLASS, DRONE_COURSES, DRONE_RACE, STOCK_DRONE, type DroneDesign } from '../src/data/drone'
import { courseDensity, downwashLoss, droneDrag, droneMass, droneRace, heatLoss, pitchMoment, steadyTilt, thrustAt, topSpeed } from '../src/sim/drone'

const course = DRONE_COURSES.lugovoy
const rho = courseDensity(course)
const STOCK = STOCK_DRONE.racer
const DEG = Math.PI / 180
const pod = (change: Partial<DroneDesign['pod']>, arms = STOCK.arms): DroneDesign => ({ ...STOCK, pod: { ...STOCK.pod, ...change }, arms })
/** A sorted club racer: short pod raked to the racing tilt, just the vents it needs, arms faired. */
const GOOD = pod({ length: 0.12, rake: 70, vents: DRONE_CLASS.racer.coolNeed }, 1)

describe('the racing quad', () => {
  it('as the club flies it, tops out a little over 110 km/h, steeply tilted, and finishes the race', () => {
    const top = topSpeed(STOCK, rho)
    expect(top * 3.6).toBeGreaterThan(105)
    expect(top * 3.6).toBeLessThan(125)
    expect(steadyTilt(STOCK, top, rho) / DEG).toBeGreaterThan(60)
    const race = droneRace(STOCK, course)
    expect(race.time).not.toBeNull()
    expect(race.tumble).toBeNull()
    expect(race.hotAt).toBeNull()
    expect(race.speeds).toHaveLength(race.lengths.length)
  })

  it('loses thrust as it speeds up, and to the downwash on its arms', () => {
    expect(thrustAt(STOCK, 30)).toBeLessThan(thrustAt(STOCK, 0))
    expect(thrustAt(STOCK, DRONE_CLASS.racer.pitchSpeed)).toBe(0)
    expect(thrustAt(STOCK, 0)).toBeCloseTo(DRONE_CLASS.racer.thrust * (1 - downwashLoss(STOCK)), 9)
  })
})

describe('what the firm shapes', () => {
  it('arm fairings cut the drag and the downwash, at a little weight', () => {
    const faired = { ...STOCK, arms: 1 }
    expect(droneDrag(faired, 1.2).cdA).toBeLessThan(droneDrag(STOCK, 1.2).cdA)
    expect(downwashLoss(faired)).toBeLessThan(downwashLoss(STOCK))
    expect(droneMass(faired)).toBeGreaterThan(droneMass(STOCK))
    expect(topSpeed(faired, rho)).toBeGreaterThan(topSpeed(STOCK, rho))
  })

  it('a pod raked to the racing tilt meets the air head-on: least drag and no twist at top speed', () => {
    const raked = pod({ rake: 70 })
    expect(topSpeed(raked, rho)).toBeGreaterThan(topSpeed(STOCK, rho))
    const top = topSpeed(raked, rho)
    expect(Math.abs(pitchMoment(raked, top, steadyTilt(raked, top, rho), rho))).toBeLessThan(0.05)
    expect(droneRace(raked, course).time!).toBeLessThan(droneRace(STOCK, course).time!)
  })

  it('a longer pod is finer but heavier', () => {
    const long = pod({ length: 0.2, rake: 50 })
    const short = pod({ length: 0.12, rake: 50 })
    expect(droneDrag(long, 50 * DEG).parts.pod).toBeLessThan(droneDrag(short, 50 * DEG).parts.pod)
    expect(droneMass(long)).toBeGreaterThan(droneMass(short))
  })

  it('closing the vents past what the controllers need overheats them partway through, and costs time', () => {
    const shut = pod({ vents: 0 })
    expect(heatLoss(shut)).toBeGreaterThan(0)
    expect(heatLoss(pod({ vents: DRONE_CLASS.racer.coolNeed }))).toBe(0)
    const race = droneRace(shut, course)
    expect(race.hotAt).toBe(DRONE_CLASS.racer.heatAfter)
    expect(race.time!).toBeGreaterThan(droneRace(shut, course, course.temperature, { relief: { heat: true } }).time!)
  })

  it('a sorted quad beats the club’s by a second or more over the race', () => {
    expect(droneRace(STOCK, course).time! - droneRace(GOOD, course).time!).toBeGreaterThan(1.5)
  })
})

describe('tumbling', () => {
  it('a long pod met at an angle twists the quad past what its motors hold, and it crashes', () => {
    const twisty = pod({ length: 0.24, rake: 20 })
    const race = droneRace(twisty, course)
    expect(race.time).toBeNull()
    expect(race.tumble).not.toBeNull()
    expect(race.tumble!.speed * 3.6).toBeGreaterThan(80)
    // Without the twist it would have finished.
    expect(droneRace(twisty, course, course.temperature, { relief: { tumble: true } }).time).not.toBeNull()
  })

  it('raked hard for the straights, a long pod twists hardest on the brakes; less rake holds', () => {
    const raked = pod({ length: 0.2, rake: 70 })
    const top = topSpeed(raked, rho)
    // Straight and level at top speed it's fine...
    expect(Math.abs(pitchMoment(raked, top, steadyTilt(raked, top, rho), rho))).toBeLessThan(DRONE_CLASS.racer.authority)
    // ...but it tumbles all the same, braking for a corner.
    const race = droneRace(raked, course)
    expect(race.tumble).not.toBeNull()
    expect(droneRace(pod({ length: 0.2, rake: 50 }), course).tumble).toBeNull()
    // A short pod never twists that hard.
    expect(droneRace(pod({ length: 0.12, rake: 70 }), course).tumble).toBeNull()
  })
})

describe('the race', () => {
  it('runs the laps from a standing start, the same every time', () => {
    const a = droneRace(GOOD, course)
    const b = droneRace(GOOD, course)
    expect(a).toEqual(b)
    const lap = course.segments.reduce((s, seg) => s + (seg.kind === 'straight' ? seg.length : (seg.radius * seg.angle * Math.PI) / 180), 0)
    expect(a.lengths.reduce((s, x) => s + x, 0)).toBeCloseTo(lap * DRONE_RACE.laps, 6)
    // Off the line it pulls nearly 7 g: about 16 m/s after the first 2 m.
    expect(a.speeds[0]!).toBeLessThan(20)
  })

  it('corners slower than it flies the straights, and slower when heavier', () => {
    const a = droneRace(GOOD, course)
    expect(Math.min(...a.speeds.slice(100))).toBeLessThan(a.top * 0.6)
    const heavy = droneRace(pod({ length: 0.24, rake: 70 }, 1), course, course.temperature, { relief: { tumble: true } })
    expect(Math.min(...heavy.speeds.slice(100))).toBeLessThan(Math.min(...a.speeds.slice(100)))
  })
})
