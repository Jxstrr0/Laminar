import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TRACK } from '../src/data/briefs'
import { REPLAY_SCENE } from '../src/data/replay'

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
