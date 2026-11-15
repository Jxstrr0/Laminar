/**
 * The grey tunnel (PR 0): the university's test section with a calibration
 * sphere on a sting, the fan at the far end, and a light smoke rake so you can
 * see the air move. Placeholder geometry until the Blender art pass (PR 13).
 *
 * The renderer only draws. It reads the air speed the sim worked out and
 * never decides anything itself.
 *
 * Axes: the air flows along +x. y is up. The sphere sits at the origin.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { UNIVERSITY_TUNNEL, REFERENCE_SPHERE } from '../data/tunnel'

/** Scene colours: a bright, clean lab (plan section 11). */
const COLOURS = {
  background: 0xe9edf0,
  wall: 0xf3f5f7,
  floor: 0xc9d0d6,
  ceilingLight: 0xffffff,
  frame: 0x8c97a1,
  window: 0x9fb4c6,
  sphere: 0xfafbfc,
  sting: 0x5d6873,
  fanRing: 0x6b7680,
  fanBlade: 0x3c4650,
  screen: 0xb7c1c9,
  smoke: 0xffffff,
  turntable: 0xb3bcc4,
  accent: 0x2456e8,
} as const

/** How much slower than real life the smoke drifts, so 40 m/s is still visible. */
const SMOKE_TIME_SCALE = 0.08
/**
 * Smoke rake upstream of the sphere: a cross of nozzles, one line up and down
 * and one side to side, so the smoke draws two slices through the flow.
 */
const RAKE = { x: -2.2, perArm: 9, spread: 0.24 }
/** Vertical field of view of the part of the picture you see, in degrees. */
const PORTRAIT_FOV = 55
const LANDSCAPE_FOV = 45
/** Fan turns per second at top speed (just for looks). */
const FAN_REVS_AT_TOP = 6

export interface TunnelView {
  /** Draw one frame. speed is the air speed in m/s; dt is real seconds since the last frame. */
  frame(speed: number, dt: number): void
  /** Keep the sphere clear of the bottom sheet: pass its height in CSS pixels. */
  setSheetHeight(px: number): void
  dispose(): void
}

export function createTunnelView(host: HTMLElement): TunnelView {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  // Drawing every device pixel on a phone is the biggest cost; two is plenty.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.setAttribute('aria-label', 'The wind tunnel test section with a sphere on a sting')
  renderer.domElement.setAttribute('role', 'img')
  host.prepend(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COLOURS.background)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 40)
  // Start outside the near wall, looking in as if through the observation glass.
  camera.position.set(-0.85, 0.3, 1.65)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, 0)
  controls.enableDamping = true
  controls.enablePan = false
  // The near wall is never drawn from outside (see the box below), so the
  // camera can back out through it like an observation window. Keep it on
  // that side so the far wall and its windows stay behind the model.
  controls.minDistance = 0.45
  controls.maxDistance = 3.2
  controls.minAzimuthAngle = -1.25
  controls.maxAzimuthAngle = 1.25
  controls.minPolarAngle = 0.35
  controls.maxPolarAngle = Math.PI - 0.55
  controls.update()

  // --- Light: soft lab light from above, plus one key light for shape.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c2cb, 1.6))
  const key = new THREE.DirectionalLight(0xffffff, 1.4)
  key.position.set(-1.5, 3, 2)
  scene.add(key)

  const { length: L, width: W, height: H } = UNIVERSITY_TUNNEL.section
  const floorY = -H / 2

  // --- The test section: floor, ceiling and two walls seen from inside.
  // BackSide means a wall only draws when seen from inside the box, so from
  // outside the near wall vanishes and the section reads as a cutaway.
  const wallMat = new THREE.MeshStandardMaterial({ color: COLOURS.wall, roughness: 0.85, side: THREE.BackSide })
  const box = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), wallMat)
  scene.add(box)

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(L, W),
    new THREE.MeshStandardMaterial({ color: COLOURS.floor, roughness: 0.9 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = floorY + 0.001
  scene.add(floor)

  // Panel seams on the floor, so speed and depth read at a glance.
  const seams = new THREE.GridHelper(L, 16, COLOURS.frame, COLOURS.frame)
  seams.scale.z = W / L
  seams.position.y = floorY + 0.003
  ;(seams.material as THREE.Material).transparent = true
  ;(seams.material as THREE.Material).opacity = 0.35
  scene.add(seams)

  // Turntable under the model (the yaw table arrives in PR 3).
  const turntable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.01, 64),
    new THREE.MeshStandardMaterial({ color: COLOURS.turntable, roughness: 0.6, metalness: 0.1 }),
  )
  turntable.position.y = floorY + 0.006
  scene.add(turntable)

  // Ceiling light strips.
  const lightMat = new THREE.MeshBasicMaterial({ color: COLOURS.ceilingLight })
  for (const z of [-W / 4, W / 4]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(L * 0.8, 0.02, 0.12), lightMat)
    strip.position.set(0, H / 2 - 0.011, z)
    scene.add(strip)
  }

  // Observation windows on the far wall, with frames.
  const frameMat = new THREE.MeshStandardMaterial({ color: COLOURS.frame, roughness: 0.5, metalness: 0.3 })
  const glassMat = new THREE.MeshStandardMaterial({ color: COLOURS.window, roughness: 0.15, metalness: 0.2 })
  for (const x of [-1.6, 0, 1.6]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.02), frameMat)
    frame.position.set(x, 0.05, -W / 2 + 0.011)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), glassMat)
    glass.position.set(x, 0.05, -W / 2 + 0.023)
    scene.add(frame, glass)
  }

  // A cobalt reference stripe along the near wall at sphere height.
  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(L, 0.025),
    new THREE.MeshBasicMaterial({ color: COLOURS.accent }),
  )
  stripe.position.set(0, 0, W / 2 - 0.002)
  stripe.rotation.y = Math.PI
  scene.add(stripe)

  // Flow screens at the upstream end.
  const screen = new THREE.GridHelper(Math.max(W, H), 24, COLOURS.screen, COLOURS.screen)
  screen.rotation.z = Math.PI / 2
  screen.position.x = -L / 2 + 0.02
  scene.add(screen)

  // --- The model: a sphere on a sting from behind, down to the floor.
  const r = REFERENCE_SPHERE.diameter / 2
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(r, 48, 32),
    new THREE.MeshStandardMaterial({ color: COLOURS.sphere, roughness: 0.35, metalness: 0.05 }),
  )
  scene.add(sphere)

  const stingMat = new THREE.MeshStandardMaterial({ color: COLOURS.sting, roughness: 0.4, metalness: 0.6 })
  const stingLen = 0.7
  const sting = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, stingLen, 16), stingMat)
  sting.rotation.z = Math.PI / 2
  sting.position.set(r + stingLen / 2 - 0.01, 0, 0)
  const strutHeight = -floorY
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, strutHeight, 16), stingMat)
  strut.position.set(r + stingLen - 0.01, floorY + strutHeight / 2, 0)
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), stingMat)
  elbow.position.set(r + stingLen - 0.01, 0, 0)
  scene.add(sting, strut, elbow)

  // --- The fan at the downstream end.
  const fan = new THREE.Group()
  fan.position.x = L / 2 - 0.05
  const fanRadius = Math.min(W, H) * 0.45
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(fanRadius, 0.035, 12, 64),
    new THREE.MeshStandardMaterial({ color: COLOURS.fanRing, roughness: 0.5, metalness: 0.4 }),
  )
  ring.rotation.y = Math.PI / 2
  fan.add(ring)
  const rotor = new THREE.Group()
  const bladeMat = new THREE.MeshStandardMaterial({ color: COLOURS.fanBlade, roughness: 0.6, metalness: 0.3 })
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), bladeMat)
  rotor.add(hub)
  for (let i = 0; i < 7; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, fanRadius * 0.85, 0.16), bladeMat)
    blade.position.y = fanRadius * 0.47
    blade.rotation.y = 0.5
    const arm = new THREE.Group()
    arm.rotation.x = (i / 7) * Math.PI * 2
    arm.add(blade)
    rotor.add(arm)
  }
  fan.add(rotor)
  scene.add(fan)

  // --- Smoke rake: dashes of smoke that ride ideal flow around the sphere.
  // A stand-in for the proper smoke and tufts in PR 3, driven by the same speed.

  /**
   * Ideal (potential) flow past a sphere of radius r in a unit stream along
   * +x. It never separates, so it is only a look, not the answer: the aero
   * model in PR 1 decides where flow really tears off.
   */
  const r3 = r * r * r
  const flowAt = (x: number, y: number, z: number): [number, number, number] => {
    const d2 = x * x + y * y + z * z
    const d = Math.sqrt(d2)
    const k = (1.5 * r3) / (d2 * d2 * d)
    return [1 + r3 / (2 * d2 * d) - k * x * x, -k * x * y, -k * x * z]
  }

  // Each nozzle's path is worked out once, as positions SAMPLE_DT apart in
  // time. A puff then just moves along its path, so puffs bunch up where the
  // air slows in front of the sphere and spread out over its shoulders.
  const SAMPLE_DT = 0.005
  const endX = L / 2 - 0.3
  const paths: Float32Array[] = []
  for (let i = 0; i < RAKE.perArm; i++) {
    const a = ((i / (RAKE.perArm - 1)) * 2 - 1) * RAKE.spread
    // The line straight at the sphere would stall on its nose, so it is left out.
    if (Math.abs(a) < 0.01) continue
    for (const [y0, z0] of [[a, 0], [0, a]] as const) {
      const pts: number[] = []
      let x = RAKE.x, y = y0, z = z0
      while (x < endX && pts.length < 30000) {
        pts.push(x, y, z)
        // Midpoint step: accurate enough for a smooth line.
        const [u1, v1, w1] = flowAt(x, y, z)
        const [u2, v2, w2] = flowAt(x + u1 * SAMPLE_DT * 0.5, y + v1 * SAMPLE_DT * 0.5, z + w1 * SAMPLE_DT * 0.5)
        x += u2 * SAMPLE_DT
        y += v2 * SAMPLE_DT
        z += w2 * SAMPLE_DT
      }
      paths.push(new Float32Array(pts))
    }
  }

  // Puffs come in short packets with gaps, so the motion is easy to see.
  const PUFF_GAP = 1 // samples between puffs
  const PACKET = 12 // puffs per packet
  const PACKET_GAP = 14 // empty puff slots after each packet
  const slots = PACKET + PACKET_GAP
  type Puff = { path: Float32Array; start: number }
  const puffs: Puff[] = []
  for (const path of paths) {
    const n = path.length / 3
    for (let j = 0; j * PUFF_GAP < n; j++) {
      if (j % slots < PACKET) puffs.push({ path, start: j * PUFF_GAP })
    }
  }
  const smokePos = new Float32Array(puffs.length * 3)
  const smokeGeo = new THREE.BufferGeometry()
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3))

  /** Place every puff `travel` samples along its path, wrapping at the end. */
  const placePuffs = (travel: number) => {
    for (let k = 0; k < puffs.length; k++) {
      const { path, start } = puffs[k] as Puff
      const n = path.length / 3
      let t = (start + travel) % n
      if (t < 0) t += n
      const i0 = Math.floor(t)
      const i1 = i0 + 1 < n ? i0 + 1 : i0
      const f = t - i0
      for (let c = 0; c < 3; c++) {
        const p0 = path[i0 * 3 + c] as number
        const p1 = path[i1 * 3 + c] as number
        smokePos[k * 3 + c] = p0 + (p1 - p0) * f
      }
    }
    smokeGeo.attributes.position!.needsUpdate = true
  }
  placePuffs(0)

  // Round, soft puffs instead of square points.
  const dotCanvas = document.createElement('canvas')
  dotCanvas.width = dotCanvas.height = 32
  const dot = dotCanvas.getContext('2d')
  if (dot) {
    const g = dot.createRadialGradient(16, 16, 0, 16, 16, 16)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.6)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    dot.fillStyle = g
    dot.fillRect(0, 0, 32, 32)
  }
  const dotTexture = new THREE.CanvasTexture(dotCanvas)
  const smokeMat = new THREE.PointsMaterial({
    color: COLOURS.smoke,
    map: dotTexture,
    size: 0.016,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const smoke = new THREE.Points(smokeGeo, smokeMat)
  scene.add(smoke)
  // White smoke on a pale lab is hard to see, so the puffs get a faint grey twin.
  const smokeShadowMat = new THREE.PointsMaterial({
    color: 0x6b7885,
    map: dotTexture,
    size: 0.024,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const smokeShadow = new THREE.Points(smokeGeo, smokeShadowMat)
  smokeShadow.renderOrder = -1
  scene.add(smokeShadow)

  /** How far along their paths the puffs have travelled, in samples. */
  let travel = 0
  let fanAngle = 0
  let sheetPx = 0

  const resize = () => {
    const w = host.clientWidth || 1
    const h = host.clientHeight || 1
    renderer.setSize(w, h, false)
    // Shift the picture so the sphere sits in the middle of the space above
    // the sheet. The camera draws a taller picture (window plus sheet) and we
    // show its top part; the field of view widens to match, so the part we
    // show keeps the intended FOV instead of looking zoomed in.
    const sheet = Math.min(sheetPx, h * 0.6)
    const full = h + sheet
    const visibleFov = h > w ? PORTRAIT_FOV : LANDSCAPE_FOV
    const half = (visibleFov * Math.PI) / 360
    camera.fov = (360 / Math.PI) * Math.atan(Math.tan(half) * (full / h))
    camera.aspect = w / full
    camera.setViewOffset(w, full, 0, sheet, w, h)
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  return {
    frame(speed, dt) {
      const step = Math.min(dt, 0.1)
      const top = UNIVERSITY_TUNNEL.topSpeed

      fanAngle += (speed / top) * FAN_REVS_AT_TOP * Math.PI * 2 * step
      rotor.rotation.x = fanAngle

      // Smoke fades in as the air starts to move, and drifts with it.
      const visible = Math.min(1, speed / 3)
      smokeMat.opacity = 0.9 * visible
      smokeShadowMat.opacity = 0.45 * visible
      if (speed > 0.05) {
        travel += (speed * SMOKE_TIME_SCALE * step) / SAMPLE_DT
        placePuffs(travel)
      }

      controls.update()
      renderer.render(scene, camera)
    },
    setSheetHeight(px) {
      sheetPx = px
      resize()
    },
    dispose() {
      observer.disconnect()
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
