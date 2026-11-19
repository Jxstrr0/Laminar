import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OVAL, TRACK } from '../src/data/briefs'
import { HILLS } from '../src/data/hills'
import { FRAME, SKATER_SKELETON, SKELETON } from '../src/data/pose'
import { JUMP_SKIS } from '../src/data/jumper'
import { BIKE } from '../src/data/cyclist'
import { CIRCUITS, segmentLength } from '../src/data/circuits'
import { AIRFIELD_KIT, AIRFIELD_SCENE, CIRCUIT_KIT, DRONE_SCENE, JUMP_SCENE, MEADOW_KIT, LAKE_KIT, RECORD_SCENE, REPLAY_SCENE, ROAD_KIT, SALT_KIT, SLED_KIT, SLED_SCENE, SURVEY_KIT, SURVEY_SCENE } from '../src/data/replay'
import { turnRadius } from '../src/sim/planeJob'
import { TRACKS } from '../src/data/tracks'
import { pointAt, trackLine } from '../src/sim/sledReplay'
import { RECORD_RUN as RUN } from '../src/data/record'
import { CAR_BODY } from '../src/data/car'
import { DRONE_BODY } from '../src/data/drone'
import { AIRCRAFT_BODY } from '../src/data/aircraft'

const ROOT = join(__dirname, '..')

/** Every .py file under art/, as repo-relative paths with forward slashes. */
function scripts(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...scripts(path))
    else if (entry.name.endsWith('.py')) out.push(relative(ROOT, path).split('\\').join('/'))
  }
  return out
}

describe('the Blender models (PR 13b)', () => {
  it('were built from the art scripts as they are now', () => {
    // The same hash as input_hash() in art/tunnel/build.py: the scripts' bytes in path order.
    const h = createHash('sha256')
    for (const path of scripts(join(ROOT, 'art')).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))) h.update(readFileSync(join(ROOT, path)))
    const manifest = JSON.parse(readFileSync(join(ROOT, 'public/models/models.json'), 'utf8')) as { inputHash: string }
    // If this fails, an art script changed without a rebuild: run the art workflow, or Blender locally.
    expect(manifest.inputHash).toBe(h.digest('hex').slice(0, 16))
  })

  for (const id of ['university', 'own']) {
    it(`the ${id} tunnel has the pieces the game moves and recolours`, () => {
      const glb = readFileSync(join(ROOT, `public/models/tunnel-${id}.glb`))
      const length = glb.readUInt32LE(12)
      const json = JSON.parse(glb.subarray(20, 20 + length).toString('utf8')) as { nodes: { name: string }[]; materials: { name: string; doubleSided?: boolean }[] }
      const nodes = json.nodes.map((n) => n.name)
      expect(nodes).toContain('FanRotor')
      expect(nodes).toContain('Shell')
      const mats = new Map(json.materials.map((m) => [m.name, m]))
      for (const name of ['Wall', 'Floor', 'Seam']) expect(mats.has(name)).toBe(true)
      // One-sided, so the near wall vanishes from outside (the cutaway).
      expect(mats.get('Wall')!.doubleSided ?? false).toBe(false)
      // Small enough to load on the tunnel screen without a wait (PR 13d).
      expect(glb.length).toBeLessThan(400 * 1024)
    })
  }

  it('your own tunnel looks different from the university\'s (PR 13d)', () => {
    const names = (id: string) => {
      const glb = readFileSync(join(ROOT, `public/models/tunnel-${id}.glb`))
      return (JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { nodes: { name: string }[] }).nodes.map((n) => n.name)
    }
    expect(names('own')).toEqual(expect.arrayContaining(['Trim', 'YawMarks']))
    expect(names('university')).not.toContain('Trim')
  })
})

/** A model's glTF JSON, read from the front of its .glb. */
function gltfOf(file: string) {
  const glb = readFileSync(join(ROOT, 'public/models', file))
  type Accessor = { min?: number[]; max?: number[] }
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as {
    nodes: { name: string; mesh?: number; extras?: { length?: number; radius?: number; size?: number[] } }[]
    meshes: { primitives: { attributes: { POSITION: number } }[] }[]
    accessors: Accessor[]
  }
  return { size: glb.length, json }
}

describe('the velodrome (PR 13k)', () => {
  it('has the track, the stands and the infield, and loads without a wait', () => {
    const { size, json } = gltfOf('velodrome.glb')
    expect(json.nodes.map((n) => n.name)).toEqual(expect.arrayContaining(['Track', 'Infield', 'Barrier', 'Stands', 'HallWall', 'InfieldKit']))
    expect(size).toBeLessThan(400 * 1024)
  })

  it('lies on the replay’s lap, so the riders stay on the boards', () => {
    const { json } = gltfOf('velodrome.glb')
    const track = json.nodes.find((n) => n.name === 'Track')!
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const p of json.meshes[track.mesh!]!.primitives) {
      const a = json.accessors[p.attributes.POSITION]!
      minX = Math.min(minX, a.min![0]!)
      maxX = Math.max(maxX, a.max![0]!)
      minZ = Math.min(minZ, a.min![2]!)
      maxZ = Math.max(maxZ, a.max![2]!)
    }
    // The circle through the ends of the replay's bend pieces (src/data/briefs.ts ovalCourse).
    const straight = TRACK.lap * TRACK.straight
    const piece = (TRACK.lap * (1 - 2 * TRACK.straight)) / 2 / TRACK.bendPieces
    const radius = piece / (2 * Math.sin(Math.PI / (2 * TRACK.bendPieces)))
    // The boards reach 8 m out from the course's centre line (RAIL in art/velodrome/build.py); the apron 4.4 m in.
    const rail = 8
    expect(maxZ).toBeCloseTo(rail, 1)
    expect(minZ).toBeCloseTo(-(2 * radius + rail), 1)
    expect(maxX).toBeCloseTo(straight + radius + rail, 0)
    expect(minX).toBeCloseTo(-(radius + rail), 0)
    // Both riders' lines lie on the flat of the boards, inside the rail.
    for (const lane of [REPLAY_SCENE.laneMine, REPLAY_SCENE.laneOld]) {
      expect(lane).toBeGreaterThan(-1.2)
      expect(lane).toBeLessThan(3.2)
    }
  })
})

describe('the Stavren Ice Oval (PR 13x)', () => {
  it('has the ice, the lane blocks, the pads, the stands and the infield, and loads without a wait', () => {
    const { size, json } = gltfOf('iceoval.glb')
    expect(json.nodes.map((n) => n.name)).toEqual(expect.arrayContaining(['Ice', 'Blocks', 'Pads', 'Stands', 'HallWall', 'InfieldKit']))
    expect(size).toBeLessThan(400 * 1024)
  })

  it('lies on the replay’s lap, both skaters in the inner lane', () => {
    const { json } = gltfOf('iceoval.glb')
    const ice = json.nodes.find((n) => n.name === 'Ice')!
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const p of json.meshes[ice.mesh!]!.primitives) {
      const a = json.accessors[p.attributes.POSITION]!
      minX = Math.min(minX, a.min![0]!)
      maxX = Math.max(maxX, a.max![0]!)
      minZ = Math.min(minZ, a.min![2]!)
      maxZ = Math.max(maxZ, a.max![2]!)
    }
    const straight = OVAL.lap * OVAL.straight
    const piece = (OVAL.lap * (1 - 2 * OVAL.straight)) / 2 / OVAL.bendPieces
    const radius = piece / (2 * Math.sin(Math.PI / (2 * OVAL.bendPieces)))
    // The outer lane's edge is 7 m out from the course's centre line (OUTER in art/iceoval/build.py).
    const outer = 7
    expect(maxZ).toBeCloseTo(outer, 1)
    expect(minZ).toBeCloseTo(-(2 * radius + outer), 1)
    expect(maxX).toBeCloseTo(straight + radius + outer, 0)
    expect(minX).toBeCloseTo(-(radius + outer), 0)
    // Both skaters' lines lie in the inner lane: from INNER (-1 m) to the lane line (3 m).
    const script = readFileSync(join(ROOT, 'art/iceoval/build.py'), 'utf8')
    expect(script).toContain(`LAP = ${OVAL.lap.toFixed(1)}`)
    expect(script).toContain(`STRAIGHT = LAP * ${OVAL.straight}`)
    for (const lane of [REPLAY_SCENE.laneMine, REPLAY_SCENE.laneOld]) {
      expect(lane).toBeGreaterThan(-1)
      expect(lane).toBeLessThan(3)
    }
  })
})

describe('the ski-jump hill’s buildings (PR 13l)', () => {
  it('has every piece the jump scene places, and loads without a wait', () => {
    const { size, json } = gltfOf('skijump.glb')
    const names = json.nodes.map((n) => n.name)
    for (const name of ['Inrun', 'Table', 'StartHouse', 'JudgesTower', 'CoachStand', 'LightMast', 'Grandstand', 'FencePanel']) expect(names).toContain(name)
    expect(size).toBeLessThan(200 * 1024)
  })

  it('has a deck as long as the scene’s in-run and table, wide enough for both lanes', () => {
    const { json } = gltfOf('skijump.glb')
    const extent = (name: string) => {
      const node = json.nodes.find((n) => n.name === name)!
      const a = json.accessors[json.meshes[node.mesh!]!.primitives[0]!.attributes.POSITION]!
      return { minX: a.min![0]!, maxX: a.max![0]!, minZ: a.min![2]!, maxZ: a.max![2]! }
    }
    expect(extent('Inrun').minX).toBeCloseTo(-JUMP_SCENE.inrun.length, 1)
    expect(extent('Table').minX).toBeCloseTo(-JUMP_SCENE.table, 1)
    for (const lane of [JUMP_SCENE.laneMine, JUMP_SCENE.laneOld]) {
      expect(lane).toBeGreaterThan(extent('Table').minZ)
      expect(lane).toBeLessThan(extent('Table').maxZ)
    }
    // Every hill's buildings stand off the slope's far edge, clear of the trees.
    expect(JUMP_SCENE.buildings.coach.out).toBeGreaterThan(JUMP_SCENE.treeOut + 1)
    for (const hill of Object.values(HILLS)) expect(hill.k - JUMP_SCENE.buildings.judges.beforeK).toBeGreaterThan(0)
  })
})

describe('the circuit’s trackside (PR 13m)', () => {
  it('has every piece the race-lap replay stands along the lap, and loads without a wait', () => {
    const { size, json } = gltfOf('circuit.glb')
    const names = json.nodes.map((n) => n.name)
    for (const name of ['StartGantry', 'GridLine', 'PitBuilding', 'Grandstand', 'Footbridge', 'Barrier', 'Kerb', 'MarshalPost']) expect(names).toContain(name)
    expect(size).toBeLessThan(300 * 1024) // 284 KB since PR 13at's polish
  })

  it('fits the pits, the stand and the footbridge on every circuit’s main straight, off the road', () => {
    for (const c of Object.values(CIRCUITS)) {
      const first = c.segments[0]!
      expect(first.kind, c.id).toBe('straight')
      const straight = segmentLength(first)
      expect(CIRCUIT_KIT.pits.from + CIRCUIT_KIT.pits.length, c.id).toBeLessThan(straight)
      expect(CIRCUIT_KIT.stand.from + 100, c.id).toBeLessThan(straight)
      expect(CIRCUIT_KIT.bridgeAt + 5, c.id).toBeLessThan(straight)
    }
    const edge = REPLAY_SCENE.car.roadWidth / 2
    // The pit wall stands 8 m in front of the building, still off the road; the barriers and stand clear of it too.
    expect(CIRCUIT_KIT.pits.out - 8).toBeGreaterThan(edge)
    expect(CIRCUIT_KIT.barrier.out).toBeGreaterThan(edge)
    expect(CIRCUIT_KIT.stand.out).toBeGreaterThan(CIRCUIT_KIT.barrier.out)
  })
})

describe('the salt flat’s camp and course furniture (PR 13n)', () => {
  it('has every piece the record replay stands along the course, and loads without a wait', () => {
    const { size, json } = gltfOf('saltflat.glb')
    const names = json.nodes.map((n) => n.name)
    for (const name of ['TeamCamp', 'TimingHut', 'TimingPost', 'KmBoard', 'Marker', 'ViewingArea', 'RecoveryTruck']) expect(names).toContain(name)
    expect(size).toBeLessThan(300 * 1024) // 260 KB since PR 13as's polish
  })

  it('keeps everything off the 16 m course, and the recovery truck short of its end', () => {
    const edge = RECORD_SCENE.roadWidth / 2
    expect(SALT_KIT.markers.out).toBeGreaterThan(edge)
    for (const out of [SALT_KIT.camp.out, SALT_KIT.hut.out, SALT_KIT.posts.out, SALT_KIT.boards.out, SALT_KIT.viewing.out, SALT_KIT.recovery.out]) expect(Math.abs(out)).toBeGreaterThan(edge + 1)
    for (const runUp of Object.values(RUN.runUp)) expect(SALT_KIT.recovery.afterTimed).toBeLessThan(runUp)
  })
})

describe('Belyanka airfield’s buildings and runway furniture (PR 13o)', () => {
  it('has every piece the kit-plane replay stands round the runway, and loads without a wait', () => {
    const { size, json } = gltfOf('airfield.glb')
    const names = json.nodes.map((n) => n.name)
    for (const name of ['Buildings', 'Threshold', 'RunwayLight', 'Windsock']) expect(names).toContain(name)
    expect(size).toBeLessThan(420 * 1024) // 401 KB since PR 13as's polish
  })

  it('keeps the lights off the runway and the buildings clear of the timing masts', () => {
    const edge = AIRFIELD_SCENE.runway.width / 2
    expect(AIRFIELD_KIT.lights.out).toBeGreaterThan(edge)
    expect(AIRFIELD_KIT.buildings.out).toBeGreaterThan(AIRFIELD_SCENE.mast.out + 5)
    expect(Math.abs(AIRFIELD_KIT.windsock.out)).toBeGreaterThan(AIRFIELD_SCENE.mast.out)
    expect(AIRFIELD_KIT.buildings.from).toBeGreaterThan(AIRFIELD_SCENE.runway.from)
  })
})

describe('the Lugovoy meadow’s kit (PR 13v)', () => {
  it('has every piece the quad replay stands round the line, and loads without a wait', () => {
    const { size, json } = gltfOf('meadow.glb')
    const names = json.nodes.map((n) => n.name)
    for (const name of ['TreeRound', 'TreePine', 'TreeBirch', 'HayBale', 'Bunting', 'StartPads', 'PilotTent', 'TimingTower', 'Spectators', 'ClubHut']) expect(names).toContain(name)
    // Polished in Blender: round people on chairs, a braced tower, a plank hut and real cars (PR 13au).
    expect(size).toBeLessThan(240 * 1024)
  })

  it('is built for the mown line the scene draws, with a launch pad in each quad’s lane', () => {
    const script = readFileSync(join(ROOT, 'art/meadow/build.py'), 'utf8')
    expect(Number(/^LINE = ([0-9.]+)/m.exec(script)?.[1])).toBe(DRONE_SCENE.roadWidth)
    expect(Number(/^FLY = ([0-9.]+)/m.exec(script)?.[1])).toBe(DRONE_SCENE.flyHeight)
    expect(script).toContain(`for y in (${DRONE_SCENE.laneOld}, ${DRONE_SCENE.laneMine}):`)
  })

  it('keeps the bales and bunting off the line, outside the gates', () => {
    const gateHalf = DRONE_SCENE.gate.width / 2 + DRONE_SCENE.gate.bar
    for (const out of [MEADOW_KIT.bales.out, MEADOW_KIT.bunting.out, MEADOW_KIT.tower.out, MEADOW_KIT.tent.out]) expect(DRONE_SCENE.roadWidth / 2 + out).toBeGreaterThan(gateHalf)
  })
})

describe('the Ozimka fields’ kit (PR 13w)', () => {
  it('has every piece the survey replay stands round the field, and loads without a wait', () => {
    const { size, json } = gltfOf('fields.glb')
    const names = json.nodes.map((n) => n.name)
    for (const name of ['Hedge', 'Oak', 'Poplars', 'PowerSpan', 'Track', 'Farmstead', 'Combine', 'BaleStack', 'HayShed']) expect(names).toContain(name)
    // Polished in Blender: braced barn doors, ribbed bins, a combine with its reel and real tractors (PR 13au).
    expect(size).toBeLessThan(260 * 1024)
  })

  it('is built for the planes’ height, its hedge and track pieces as long as the scene steps them, and the yard the size the scene leaves room for', () => {
    const script = readFileSync(join(ROOT, 'art/fields/build.py'), 'utf8')
    expect(Number(/^FLY = ([0-9.]+)/m.exec(script)?.[1])).toBe(SURVEY_SCENE.flyHeight)
    expect(script).toContain('x = 2.2 + k * 4.3') // seven lumps, the last ending at 30 m
    expect(script).toContain(`m.flat(0, ${SURVEY_KIT.hedge}, -2.2, 2.2, 0.02, "Verge")`)
    expect(script).toContain(`for x in range(0, ${SURVEY_KIT.power.span + 1}, 10)`)
    const yard = /m\.flat\(0, (\d+), 0, (\d+), 0\.03, "Concrete"\)/.exec(script)
    expect(Number(yard?.[1])).toBe(SURVEY_KIT.farm.length)
    // Nothing in the next field east stands in the yard.
    expect(SURVEY_KIT.next.from).toBeGreaterThan(SURVEY_KIT.farm.out + Number(yard?.[2]))
  })

  it('keeps the hedges clear of the planes’ turns, and the yard, poplars and power line beyond them', () => {
    expect(SURVEY_KIT.headland).toBeGreaterThan(turnRadius('survey') + 5)
    expect(SURVEY_KIT.power.out).toBeGreaterThan(SURVEY_KIT.track + 5)
    expect(SURVEY_KIT.poplars.out).toBeGreaterThan(5)
    expect(SURVEY_KIT.farm.out).toBeGreaterThan(5)
  })
})

describe('Lake Dolgo’s kit (PR 13y)', () => {
  it('has every piece the ice-marathon replay stands round the loop, and loads without a wait', () => {
    const { size, json } = gltfOf('lake.glb')
    const names = json.nodes.map((n) => n.name)
    for (const name of ['Snowbank', 'Broom', 'StartBanner', 'WarmingHut', 'Plough', 'Crowd', 'Shacks', 'ShorePines']) expect(names).toContain(name)
    // Polished in Blender: people in coats and hats, board huts, a plough with a curved blade (PR 13au).
    expect(size).toBeLessThan(230 * 1024)
  })

  it('is built for the loop the scene draws, its banks as long as the scene steps them', () => {
    const script = readFileSync(join(ROOT, 'art/lake/build.py'), 'utf8')
    expect(Number(/^ROAD = ([0-9.]+)/m.exec(script)?.[1])).toBe(REPLAY_SCENE.roadWidth)
    expect(script).toContain('x = 1.7 + k * 3.3') // six lumps, the last ending at 20 m
    expect(LAKE_KIT.bank.every).toBe(20)
    expect(script).toContain(`m.roof(0, ${LAKE_KIT.shore.piece}, 0, 14, 0, 1.4, "Snow2")`)
  })

  it('keeps the banks clear of the skaters and of the corners, and everything else beyond the banks', () => {
    // The old setup skates furthest out; the banks start beyond the ice's edge.
    expect(REPLAY_SCENE.roadWidth / 2 + LAKE_KIT.bank.out).toBeGreaterThan(REPLAY_SCENE.laneOld + 1)
    // Stopping short of a corner by more than the ice's half-width and a bank's depth (2.5 m), no bank cuts across the next side.
    expect(LAKE_KIT.corner).toBeGreaterThan(REPLAY_SCENE.roadWidth / 2 + LAKE_KIT.bank.out + 2.5)
    for (const out of [LAKE_KIT.hut.out, LAKE_KIT.plough.out, LAKE_KIT.crowd.out]) expect(out).toBeGreaterThan(LAKE_KIT.bank.out)
    expect(LAKE_KIT.shacks.from).toBeGreaterThan(LAKE_KIT.plough.out + 20)
  })
})

describe('the open road’s roadside (PR 13t)', () => {
  it('has every piece the time trials and fuel runs stand along the road, and loads without a wait', () => {
    const { size, json } = gltfOf('road.glb')
    const names = json.nodes.map((n) => n.name)
    for (const name of ['TreeRound', 'TreePine', 'TreeBirch', 'KmPost', 'Sign', 'Farm', 'Village', 'WindTurbine', 'StartRamp', 'FinishArch', 'FinishCrowd', 'FuelDepot', 'Warehouse']) expect(names).toContain(name)
    expect(size).toBeLessThan(420 * 1024) // 404 KB since PR 13at's polish
  })

  it('builds the finish arch for the time trial’s road, and keeps the buildings off it', () => {
    const script = readFileSync(join(ROOT, 'art/road/build.py'), 'utf8')
    expect(Number(/^ROAD = ([0-9.]+)/m.exec(script)?.[1])).toBe(REPLAY_SCENE.roadWidth)
    expect(ROAD_KIT.farms.out).toBeGreaterThan(ROAD_KIT.trees.out)
    expect(ROAD_KIT.villages.out).toBeGreaterThan(ROAD_KIT.trees.out)
    expect(ROAD_KIT.turbines.out).toBeGreaterThan(ROAD_KIT.villages.out)
  })
})

describe('the Belogor sliding track’s buildings (PR 13p)', () => {
  it('has every piece the sled scene stands along the channel, and loads without a wait', () => {
    const { size, json } = gltfOf('bobsled.glb')
    const names = json.nodes.map((n) => n.name)
    for (const name of ['StartHouse', 'TimingArch', 'FinishArch', 'Shade', 'Terrace', 'LightMast', 'FinishArea']) expect(names).toContain(name)
    expect(size).toBeLessThan(300 * 1024)
  })

  it('is built round the same channel the scene sweeps', () => {
    const script = readFileSync(join(ROOT, 'art/bobsled/build.py'), 'utf8')
    const num = (name: string) => Number(new RegExp(`^${name} = ([0-9.]+)`, 'm').exec(script)?.[1])
    expect(num('TROUGH')).toBe(SLED_SCENE.trough)
    expect(num('WALL_DEG')).toBe(SLED_SCENE.wallDeg)
    expect(num('BANK')).toBe(SLED_SCENE.bank)
    const track = TRACKS.belogor
    expect(num('FINISH_GRADE')).toBeCloseTo(track.stretches[track.stretches.length - 1]!.grade / 100, 6)
  })

  it('puts the split arches on straights and the sun roof inside the long horseshoe', () => {
    const line = trackLine(TRACKS.belogor)
    for (const s of SLED_KIT.splits) {
      expect(s).toBeGreaterThan(TRACKS.belogor.push.length)
      for (const d of [-6, 0, 6]) expect(pointAt(line, s + d).curve).toBe(0)
    }
    for (const s of [SLED_KIT.shade.from, SLED_KIT.shade.to]) expect(pointAt(line, s).curve).not.toBe(0)
  })
})

describe('the people’s body parts (PR 13q)', () => {
  const { size, json } = gltfOf('body.glb')
  const node = (name: string) => json.nodes.find((n) => n.name === name)

  it('has every part riderFigure lays between the joints, and loads without a wait', () => {
    for (const name of ['Thigh', 'Shin', 'UpperArm', 'Forearm', 'Torso', 'Hand', 'Head', 'Shoe', 'Boot', 'RoadHelmet', 'BobHelmet']) expect(node(name)).toBeDefined()
    expect(size).toBeLessThan(150 * 1024)
  })

  it('carries the sizes the code scales by, built to the cyclist’s own skeleton', () => {
    expect(node('Thigh')!.extras).toEqual({ length: SKELETON.thigh, radius: 0.07 })
    expect(node('Shin')!.extras).toEqual({ length: SKELETON.shin, radius: 0.05 })
    expect(node('UpperArm')!.extras).toEqual({ length: SKELETON.upperArm, radius: 0.05 })
    expect(node('Forearm')!.extras).toEqual({ length: SKELETON.forearm, radius: 0.045 })
    expect(node('Torso')!.extras).toEqual({ length: SKELETON.torso, radius: 0.11 })
    expect(node('Hand')!.extras?.radius).toBeGreaterThan(0)
    expect(node('Head')!.extras?.radius).toBe(1)
    expect(node('BobHelmet')!.extras?.radius).toBe(1)
    expect(node('Shoe')!.extras?.size).toEqual([0.24, 0.05, 0.08])
    expect(node('Boot')!.extras?.size).toEqual([0.26, 0.11, 0.09])
  })
})

describe('the bike (PR 13an)', () => {
  const { size, json } = gltfOf('bike.glb')
  const node = (name: string) => json.nodes.find((n) => n.name === name)
  type Extras = Record<string, unknown>

  it('has every part riderFigure lays on the bike, and stays small', () => {
    // The same names as BikePartName in src/render/partKit.ts.
    for (const name of ['Frame', 'FrameKamm', 'Tyre', 'RimShallow', 'RimDeep', 'Disc', 'Hub', 'SpokesFront', 'SpokesFrontDeep', 'SpokesRear', 'SpokesRearDeep', 'Saddle', 'Chainring', 'CrankArm', 'Pedal', 'Cassette', 'Chain', 'Derailleurs', 'Headset', 'Stem', 'BaseBar', 'ArmPad', 'DropBar', 'DropHoods'])
      expect(node(name), name).toBeDefined()
    expect(size).toBeLessThan(600 * 1024)
  })

  it('is built round the frame points and skeleton the code draws to', () => {
    for (const name of ['Frame', 'FrameKamm']) {
      const x = node(name)!.extras as Extras
      expect(x.bottomBracket).toEqual([SKELETON.bottomBracket.x, SKELETON.bottomBracket.y])
      expect(x.seatTop).toEqual([FRAME.seatTop.x, FRAME.seatTop.y])
      expect(x.headTop).toEqual([FRAME.headTop.x, FRAME.headTop.y])
      expect(x.headBottom).toEqual([FRAME.headBottom.x, FRAME.headBottom.y])
      expect(x.axles).toEqual([FRAME.rearAxleX, FRAME.frontAxleX, FRAME.wheelRadius])
      const saddle = x.saddle as number[]
      expect(saddle[0]).toBeCloseTo(SKELETON.bottomBracket.x + SKELETON.saddle.x, 6)
      expect(saddle[1]).toBeCloseTo(SKELETON.bottomBracket.y + SKELETON.saddle.y, 6)
    }
    expect((node('CrankArm')!.extras as Extras).length).toBe(SKELETON.crank)
    expect((node('Stem')!.extras as Extras).length).toBeGreaterThan(0)
    expect((node('DropBar')!.extras as Extras).hood).toHaveLength(2)
    // The laced wheels have the sim's own spoke counts.
    expect(BIKE.wheels.front.spokes).toBe(20)
    expect(BIKE.wheels.rear.spokes).toBe(24)
  })
})

describe('the winter kit (PR 13ao)', () => {
  const { size, json } = gltfOf('winter.glb')
  const node = (name: string) => json.nodes.find((n) => n.name === name)
  type Extras = Record<string, unknown>

  it('has every part riderFigure lays on the skater, the jumper and the sled, and stays small', () => {
    // The same names as WinterPartName in src/render/partKit.ts.
    for (const name of ['ClapBlade', 'ClapFrame', 'JumpSki', 'JumpSkiStripe', 'JumpBinding', 'RunnerBlade', 'RunnerCarrier', 'Axle', 'PushHandle', 'PushBar', 'SteerRing'])
      expect(node(name), name).toBeDefined()
    expect(size).toBeLessThan(150 * 1024)
  })

  it('is built to the sizes the code lays it at', () => {
    expect((node('ClapBlade')!.extras as Extras).length).toBe(SKATER_SKELETON.blade.length)
    const ski = node('JumpSki')!.extras as Extras
    expect(ski.length).toBe(JUMP_SKIS.length)
    expect(ski.width).toBe(JUMP_SKIS.width)
  })
})

describe('the vehicles kit (PR 13ap)', () => {
  const { size, json } = gltfOf('vehicles.glb')
  const node = (name: string) => json.nodes.find((n) => n.name === name)
  type Extras = Record<string, unknown>

  it('has every part the car, truck, record car and pod figures lay, and stays small', () => {
    // The same names as VehiclePartName in src/render/partKit.ts.
    for (const name of ['CarTyre', 'CarRim', 'CarBrake', 'Helmet', 'Visor', 'Halo', 'CarMirror', 'Lamp', 'TruckTyre', 'TruckRim', 'TruckGrille', 'TruckBumper', 'TruckMirror', 'FuelTank', 'RecordWheel', 'ChuteCan', 'JetNozzle', 'IntakeLip', 'IntakeFan', 'SensorFrame', 'SensorWindow'])
      expect(node(name), name).toBeDefined()
    expect(size).toBeLessThan(450 * 1024)
  })

  it('builds the racing wheel at the size both car classes share', () => {
    const tyre = node('CarTyre')!.extras as Extras
    expect(CAR_BODY.open.wheel).toBe(CAR_BODY.touring.wheel)
    expect(tyre.radius).toBe(CAR_BODY.touring.wheel)
    // The record car's wheel is a unit, scaled to its class.
    expect((node('RecordWheel')!.extras as Extras).radius).toBe(1)
  })
})

describe('the aircraft kit (PR 13aq)', () => {
  const { size, json } = gltfOf('aircraft.glb')
  const node = (name: string) => json.nodes.find((n) => n.name === name)
  type Extras = Record<string, unknown>

  it('has every part the quad, survey drone and light aircraft figures lay, and stays small', () => {
    // The same names as AircraftPartName in src/render/partKit.ts.
    for (const name of ['Prop2', 'Prop3', 'DroneMotor', 'PusherMotor', 'LensBarrel', 'LensGlass', 'GearTyre', 'GearHub', 'Windscreen', 'NavLight']) expect(node(name), name).toBeDefined()
    expect(size).toBeLessThan(250 * 1024)
  })

  it('is built to the sizes the code lays it at', () => {
    // Props are a unit radius, scaled to each craft's.
    expect((node('Prop2')!.extras as Extras).radius).toBe(1)
    expect((node('Prop3')!.extras as Extras).radius).toBe(1)
    const motor = node('DroneMotor')!.extras as Extras
    expect(motor.radius).toBe(DRONE_BODY.motor)
    expect(motor.height).toBe(DRONE_BODY.motorHeight)
    const tyre = node('GearTyre')!.extras as Extras
    expect(tyre.radius).toBe(AIRCRAFT_BODY.wheel.radius)
    expect(tyre.width).toBe(AIRCRAFT_BODY.wheel.width)
  })
})
