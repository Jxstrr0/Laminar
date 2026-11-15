/**
 * The tunnel's flow instruments round the rider model (plan section 7.1):
 * a smoke rake, a smoke wand you move with a finger, and wool tufts on the
 * surface. Everything follows the flow field (src/sim/flow/field.ts), which
 * takes its separation lines and wakes from the aero model, so the smoke
 * slows and churns exactly where the numbers say the flow has let go, and a
 * tuft flails only past its separation point.
 *
 * This group lives inside the scaled model, in the full-size rider's
 * coordinates (x forward, y up, z to the rider's right), so the field's
 * points need no conversion. The renderer only draws: emission jitter and
 * flapping use Math freely, but where the smoke goes is the field's call.
 */
import * as THREE from 'three'
import { SMOKE_VIZ, TUFT_VIZ } from '../data/flowViz'
import { FRAME } from '../data/pose'
import type { FlowField, Tuft } from '../sim/flow/field'
import type { Point } from '../sim/geom/pose'

const COLOURS = {
  smoke: 0xffffff,
  smokeTwin: 0x6b7885,
  /** Attached tufts: the lab's ink. Flailing ones: the --sep colour. Motion tells them apart too. */
  tuft: new THREE.Color(0x13202b),
  tuftSeparated: new THREE.Color(0xd2462b),
}

export interface Instruments {
  wand: boolean
  rake: boolean
  tufts: boolean
}

export interface FlowViz {
  /** Add to the model, at the drawn figure's transform. */
  readonly group: THREE.Group
  /** The air to draw, and the tufts on it (an empty list hides them). */
  setField(field: FlowField | null, tufts: readonly Tuft[]): void
  setInstruments(on: Instruments): void
  /** The wand's tip, in the rider's coordinates. */
  setWandTip(p: Point): void
  /** Advance the smoke and tufts; `fan` is the air speed over the fan's top speed. */
  frame(dt: number, fan: number): void
  dispose(): void
}

/** The bike's middle along its length: the instruments are placed from here. */
const MID: Point = { x: (FRAME.rearAxleX + FRAME.frontAxleX) / 2, y: 0, z: 0 }
const HIDDEN_Y = -1e4

export function createFlowViz(dot: THREE.Texture): FlowViz {
  const group = new THREE.Group()
  let field: FlowField | null = null
  let on: Instruments = { wand: false, rake: false, tufts: false }
  let wandTip: Point = { x: MID.x + SMOKE_VIZ.upstream, y: 0.9, z: 0.1 }
  let clock = 0

  // --- Smoke: a ring of puffs; a new puff takes the oldest slot.
  const max = SMOKE_VIZ.maxPuffs
  const pos = new Float32Array(max * 3).fill(HIDDEN_Y)
  const age = new Float32Array(max)
  const alive = new Uint8Array(max)
  let next = 0
  const smokeGeo = new THREE.BufferGeometry()
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const smokeMat = new THREE.PointsMaterial({ color: COLOURS.smoke, map: dot, size: 0.02, transparent: true, opacity: 0.9, depthWrite: false })
  // White smoke on a pale lab gets a faint grey twin so it always reads.
  const twinMat = new THREE.PointsMaterial({ color: COLOURS.smokeTwin, map: dot, size: 0.03, transparent: true, opacity: 0.4, depthWrite: false })
  const smoke = new THREE.Points(smokeGeo, smokeMat)
  const twin = new THREE.Points(smokeGeo, twinMat)
  twin.renderOrder = -1
  smoke.frustumCulled = twin.frustumCulled = false
  group.add(twin, smoke)

  const emit = (x: number, y: number, z: number) => {
    const i = next
    next = (next + 1) % max
    pos[i * 3] = x
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = z
    age[i] = 0
    alive[i] = 1
  }
  const kill = (i: number) => {
    alive[i] = 0
    pos[i * 3 + 1] = HIDDEN_Y
  }
  const clearSmoke = () => {
    for (let i = 0; i < max; i++) if (alive[i]) kill(i)
    smokeGeo.attributes.position!.needsUpdate = true
  }
  /** Puffs owed to each emitter, carried between frames. */
  let rakeDue = 0
  let wandDue = 0

  // --- Tufts: one short line each, redrawn every frame.
  let tuftList: readonly Tuft[] = []
  let tuftGeo = new THREE.BufferGeometry()
  const tuftMat = new THREE.LineBasicMaterial({ vertexColors: true })
  const tuftLines = new THREE.LineSegments(tuftGeo, tuftMat)
  tuftLines.frustumCulled = false
  group.add(tuftLines)
  let phases = new Float32Array(0)

  function buildTufts(list: readonly Tuft[]) {
    tuftList = list
    tuftGeo.dispose()
    tuftGeo = new THREE.BufferGeometry()
    tuftGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(list.length * 6), 3))
    const colours = new Float32Array(list.length * 6)
    list.forEach((t, i) => {
      const c = COLOURS.tuft.clone().lerp(COLOURS.tuftSeparated, t.strength)
      for (let k = 0; k < 2; k++) c.toArray(colours, i * 6 + k * 3)
    })
    tuftGeo.setAttribute('color', new THREE.BufferAttribute(colours, 3))
    tuftLines.geometry = tuftGeo
    // Each tuft gets its own rhythm (fixed per tuft, so it doesn't jump between rebuilds).
    phases = new Float32Array(list.length * 2)
    list.forEach((t, i) => {
      const h = Math.sin(t.point.x * 127.1 + t.point.y * 311.7 + t.point.z * 74.7) * 43758.5453
      phases[i * 2] = (h - Math.floor(h)) * Math.PI * 2
      phases[i * 2 + 1] = 0.7 + ((h * 7.13) % 1 + 1) % 1 * 0.6
    })
  }

  const DEG = Math.PI / 180
  function placeTufts(fan: number) {
    const p = tuftGeo.attributes.position as THREE.BufferAttribute | undefined
    if (!p) return
    const arr = p.array as Float32Array
    const L = TUFT_VIZ.length
    // With the fan off a tuft just hangs where it is.
    const moving = Math.min(1, fan * 6)
    for (let i = 0; i < tuftList.length; i++) {
      const t = tuftList[i]!
      const { point: pt, normal: n, direction: d } = t
      // A second direction across the surface, for the tuft to swing towards.
      const sx = n.y * d.z - n.z * d.y
      const sy = n.z * d.x - n.x * d.z
      const sz = n.x * d.y - n.y * d.x
      const ph = phases[i * 2]!
      const rate = TUFT_VIZ.rate * phases[i * 2 + 1]!
      const wave = Math.sin(clock * rate * Math.PI * 2 + ph) * 0.65 + Math.sin(clock * rate * 4.3 + ph * 1.7) * 0.35
      const swing = (t.strength * TUFT_VIZ.flail + TUFT_VIZ.tremble + t.buffet * TUFT_VIZ.buffet) * DEG * wave * moving
      const c = Math.cos(swing)
      const s = Math.sin(swing)
      // A flailing tuft also lifts off the surface.
      const up = t.strength * 0.5 * Math.abs(Math.sin(clock * rate * 3.1 + ph)) * moving
      const bx = pt.x + n.x * TUFT_VIZ.lift
      const by = pt.y + n.y * TUFT_VIZ.lift
      const bz = pt.z + n.z * TUFT_VIZ.lift
      arr[i * 6] = bx
      arr[i * 6 + 1] = by
      arr[i * 6 + 2] = bz
      arr[i * 6 + 3] = bx + L * (d.x * c + sx * s + n.x * up)
      arr[i * 6 + 4] = by + L * (d.y * c + sy * s + n.y * up)
      arr[i * 6 + 5] = bz + L * (d.z * c + sz * s + n.z * up)
    }
    p.needsUpdate = true
  }

  function stepSmoke(dt: number, fan: number) {
    if (!field) return
    const f = field
    const d = f.downstream
    const running = fan > 0.012
    const shown = running ? Math.max(SMOKE_VIZ.minSpeed, SMOKE_VIZ.speedAtTop * Math.sqrt(fan)) : 0
    const k = shown / Math.max(1e-6, f.speed)

    // New puffs from the rake and the wand.
    if (running && on.rake) {
      const r = SMOKE_VIZ.rake
      rakeDue += r.perSecond * dt
      const ox = MID.x - d.x * SMOKE_VIZ.upstream
      const oz = MID.z - d.z * SMOKE_VIZ.upstream
      // Each puff starts a random part of a gap downstream, so the nozzles don't puff in step.
      const gap = shown / r.perSecond
      while (rakeDue >= 1) {
        rakeDue -= 1
        for (let j = 0; j < r.nozzles; j++) {
          const lead = Math.random() * gap
          emit(ox + d.x * lead, r.low + ((r.high - r.low) * j) / (r.nozzles - 1), oz + d.z * lead)
        }
      }
    }
    if (running && on.wand) {
      wandDue += SMOKE_VIZ.wandPerSecond * dt
      while (wandDue >= 1) {
        wandDue -= 1
        emit(wandTip.x + (Math.random() - 0.5) * 0.004, wandTip.y + (Math.random() - 0.5) * 0.004, wandTip.z + (Math.random() - 0.5) * 0.004)
      }
    }

    // Move every puff with the air.
    const p: Point = { x: 0, y: 0, z: 0 }
    for (let i = 0; i < max; i++) {
      if (!alive[i]) continue
      age[i]! += dt
      p.x = pos[i * 3]!
      p.y = pos[i * 3 + 1]!
      p.z = pos[i * 3 + 2]!
      if (k > 0) {
        const v = f.velocity(p)
        const g = f.gust(p, clock)
        p.x += (v.x + g.x * SMOKE_VIZ.churn) * k * dt
        p.y += (v.y + g.y * SMOKE_VIZ.churn) * k * dt
        p.z += (v.z + g.z * SMOKE_VIZ.churn) * k * dt
        if (f.clearance(p) < 0) {
          const out = f.pushOutside(p, 0.004)
          p.x = out.x
          p.y = out.y
          p.z = out.z
        }
      }
      const along = (p.x - MID.x) * d.x + (p.z - MID.z) * d.z
      if (age[i]! > SMOKE_VIZ.life || along > SMOKE_VIZ.reach || p.y < 0) {
        kill(i)
        continue
      }
      pos[i * 3] = p.x
      pos[i * 3 + 1] = p.y
      pos[i * 3 + 2] = p.z
    }
    smokeGeo.attributes.position!.needsUpdate = true
  }

  return {
    group,
    setField(next, list) {
      field = next
      if (!next) clearSmoke()
      buildTufts(on.tufts && next ? list : [])
    },
    setInstruments(next) {
      if (!next.wand && !next.rake && (on.wand || on.rake)) clearSmoke()
      on = { ...next }
      if (!on.tufts) buildTufts([])
    },
    setWandTip(p) {
      wandTip = { ...p }
    },
    frame(dt, fan) {
      const step = Math.min(dt, 0.05)
      clock += step
      stepSmoke(step, fan)
      tuftLines.visible = on.tufts && tuftList.length > 0
      if (tuftLines.visible) placeTufts(fan)
    },
    dispose() {
      smokeGeo.dispose()
      tuftGeo.dispose()
      smokeMat.dispose()
      twinMat.dispose()
      tuftMat.dispose()
    },
  }
}
