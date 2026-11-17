/**
 * The tunnel's flow instruments round the rider model (plan section 7.1):
 * a smoke rake, a smoke wand you move with a finger, and wool tufts on the
 * surface. Everything follows the flow field (src/sim/flow/field.ts), which
 * takes its separation lines and wakes from the aero model, so the smoke
 * slows and churns exactly where the numbers say the flow has let go, and a
 * tuft flails only past its separation point. Pressure taps, when the
 * model has them, show as small dots coloured by their Cp reading.
 *
 * This group lives inside the scaled model, in the full-size rider's
 * coordinates (x forward, y up, z to the rider's right), so the field's
 * points need no conversion. The renderer only draws: emission jitter and
 * flapping use Math freely, but where the smoke goes is the field's call.
 */
import * as THREE from 'three'
import { SMOKE_VIZ, TAPS, TUFT_VIZ } from '../data/flowViz'
import { FRAME } from '../data/pose'
import type { FlowField, Tuft } from '../sim/flow/field'
import type { Tap } from '../sim/flow/taps'
import type { PivGrid } from '../sim/flow/piv'
import { PIV_PALETTE } from '../data/piv'
import { cpRgb } from './cpScale'
import { pivRgb } from './pivScale'
import { sceneColours, type SceneColours } from './theme'
import type { Point } from '../sim/geom/pose'

/**
 * Smoke is white. Its twin and the attached tufts follow the phone's theme
 * (src/render/theme.ts): a faint ink twin on pale walls, white on dark ones;
 * tufts in the lab's ink. Flailing tufts are --sep coral; motion tells them apart too.
 */
const COLOURS = {
  smoke: 0xffffff,
}

export interface Instruments {
  wand: boolean
  rake: boolean
  tufts: boolean
  /** The pressure taps' Cp dots. */
  taps: boolean
}

export interface FlowViz {
  /** Add to the model, at the drawn figure's transform. */
  readonly group: THREE.Group
  /** The air to draw, and the tufts on it (an empty list hides them). */
  setField(field: FlowField | null, tufts: readonly Tuft[]): void
  setInstruments(on: Instruments): void
  /** The taps and their latest scan (an empty list hides them). */
  setTaps(taps: readonly Tap[], cps: readonly number[]): void
  /** The PIV's side sheet (PR 10ah), coloured by the air's speed; null hides it. */
  setPiv(grid: PivGrid | null): void
  /** The phone switched between light and dark (Isobar, PR 13h). */
  setTheme(colours: SceneColours): void
  /** The wand's tip, in the rider's coordinates. */
  setWandTip(p: Point): void
  /** Advance the smoke and tufts; `fan` is the air speed over the fan's top speed. */
  frame(dt: number, fan: number): void
  dispose(): void
}

/** The bike's middle along its length: the instruments are placed from here. */
const MID: Point = { x: (FRAME.rearAxleX + FRAME.frontAxleX) / 2, y: 0, z: 0 }
const HIDDEN_Y = -1e4
/** A tap's dot: radius, and how far it sits off the skin so it isn't buried, m at full size. */
const TAP_DOT = { radius: 0.028, raise: 0.003 }

export function createFlowViz(dot: THREE.Texture): FlowViz {
  const group = new THREE.Group()
  let field: FlowField | null = null
  let on: Instruments = { wand: false, rake: false, tufts: false, taps: false }
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
  let theme = sceneColours()
  const tuftInk = new THREE.Color(theme.tuft)
  const tuftSep = new THREE.Color(theme.sep)
  const twinMat = new THREE.PointsMaterial({ color: theme.smokeTwin, map: dot, size: 0.03, transparent: true, opacity: 0.4, depthWrite: false })
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
      const c = tuftInk.clone().lerp(tuftSep, t.strength)
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

  // --- Taps: one flat dot per tap, facing out along the surface normal.
  const dotGeo = new THREE.CircleGeometry(TAP_DOT.radius, 12)
  const dotMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })
  let tapDots: THREE.InstancedMesh | null = null
  const tmpObj = new THREE.Object3D()
  const tmpColour = new THREE.Color()
  const zAxis = new THREE.Vector3(0, 0, 1)
  const tmpNormal = new THREE.Vector3()
  function buildTaps(taps: readonly Tap[], cps: readonly number[]) {
    if (tapDots) {
      group.remove(tapDots)
      tapDots.dispose()
      tapDots = null
    }
    if (taps.length === 0 || cps.length !== taps.length) return
    const mesh = new THREE.InstancedMesh(dotGeo, dotMat, taps.length)
    taps.forEach((t, i) => {
      const lift = TAPS.lift + TAP_DOT.raise
      tmpObj.position.set(t.point.x + t.normal.x * lift, t.point.y + t.normal.y * lift, t.point.z + t.normal.z * lift)
      tmpObj.quaternion.setFromUnitVectors(zAxis, tmpNormal.set(t.normal.x, t.normal.y, t.normal.z))
      tmpObj.updateMatrix()
      mesh.setMatrixAt(i, tmpObj.matrix)
      // Colours are given in sRGB; the renderer's colour management converts them.
      const [r, g, b] = cpRgb(cps[i]!)
      mesh.setColorAt(i, tmpColour.setRGB(r, g, b, THREE.SRGBColorSpace))
    })
    mesh.frustumCulled = false
    mesh.visible = on.taps
    tapDots = mesh
    group.add(mesh)
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

  // --- PIV (PR 10ah): the side sheet as a flat quad, one texel per sample.
  // The texture is linear-filtered so the slice reads as smooth air; cells
  // inside the model are clear.
  const pivMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: PIV_PALETTE.opacity, side: THREE.DoubleSide, depthWrite: false })
  let pivMesh: THREE.Mesh | null = null
  let pivTex: THREE.DataTexture | null = null
  function showPiv(grid: PivGrid | null) {
    if (pivMesh) {
      group.remove(pivMesh)
      pivMesh.geometry.dispose()
      pivMesh = null
    }
    pivTex?.dispose()
    pivTex = null
    pivMat.map = null
    if (!grid) return
    const { cols, rows } = grid
    const data = new Uint8Array(cols * rows * 4)
    grid.values.forEach((v, i) => {
      if (Number.isNaN(v)) return
      const [r, g, b] = pivRgb(v)
      const slow = 1 - Math.min(1, Math.max(0, v))
      data.set([r, g, b, Math.round(255 * (PIV_PALETTE.clearAlpha + (1 - PIV_PALETTE.clearAlpha) * slow))], i * 4)
    })
    pivTex = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat)
    pivTex.magFilter = THREE.LinearFilter
    pivTex.minFilter = THREE.LinearFilter
    pivTex.colorSpace = THREE.SRGBColorSpace
    pivTex.needsUpdate = true
    pivMat.map = pivTex
    pivMat.needsUpdate = true
    // The quad's corners are the grid's first and last samples; uv puts each texel's centre on its sample.
    const w = (cols - 1) * grid.du
    const h = (rows - 1) * grid.dv
    const o = grid.origin
    const u = grid.colAxis
    const v = grid.rowAxis
    const corner = (a: number, b: number) => [o.x + u.x * a + v.x * b, o.y + u.y * a + v.y * b, o.z + u.z * a + v.z * b]
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...corner(0, 0), ...corner(w, 0), ...corner(w, h), ...corner(0, h)], 3))
    const u0 = 0.5 / cols
    const u1 = 1 - u0
    const v0 = 0.5 / rows
    const v1 = 1 - v0
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v1], 2))
    geo.setIndex([0, 1, 2, 0, 2, 3])
    pivMesh = new THREE.Mesh(geo, pivMat)
    pivMesh.renderOrder = 2
    group.add(pivMesh)
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
      if (!on.taps) buildTaps([], [])
    },
    setTaps(taps, cps) {
      buildTaps(on.taps ? taps : [], cps)
    },
    setPiv(grid) {
      showPiv(grid)
    },
    setTheme(next) {
      theme = next
      twinMat.color.setHex(next.smokeTwin)
      tuftInk.setHex(next.tuft)
      tuftSep.setHex(next.sep)
      if (tuftList.length > 0) buildTufts(tuftList)
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
      showPiv(null)
      pivMat.dispose()
      smokeGeo.dispose()
      tuftGeo.dispose()
      smokeMat.dispose()
      twinMat.dispose()
      tuftMat.dispose()
      buildTaps([], [])
      dotGeo.dispose()
      dotMat.dispose()
    },
  }
}
