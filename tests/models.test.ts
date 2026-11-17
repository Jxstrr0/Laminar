import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TRACK } from '../src/data/briefs'
import { HILLS } from '../src/data/hills'
import { CIRCUITS, segmentLength } from '../src/data/circuits'
import { CIRCUIT_KIT, JUMP_SCENE, RECORD_SCENE, REPLAY_SCENE, SALT_KIT } from '../src/data/replay'
import { RECORD_RUN as RUN } from '../src/data/record'

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
    nodes: { name: string; mesh?: number }[]
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
    expect(size).toBeLessThan(200 * 1024)
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
    expect(size).toBeLessThan(200 * 1024)
  })

  it('keeps everything off the 16 m course, and the recovery truck short of its end', () => {
    const edge = RECORD_SCENE.roadWidth / 2
    expect(SALT_KIT.markers.out).toBeGreaterThan(edge)
    for (const out of [SALT_KIT.camp.out, SALT_KIT.hut.out, SALT_KIT.posts.out, SALT_KIT.boards.out, SALT_KIT.viewing.out, SALT_KIT.recovery.out]) expect(Math.abs(out)).toBeGreaterThan(edge + 1)
    for (const runUp of Object.values(RUN.runUp)) expect(SALT_KIT.recovery.afterTimed).toBeLessThan(runUp)
  })
})
