import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

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

  it('the tunnel has the pieces the game moves and recolours', () => {
    const glb = readFileSync(join(ROOT, 'public/models/tunnel-university.glb'))
    const length = glb.readUInt32LE(12)
    const json = JSON.parse(glb.subarray(20, 20 + length).toString('utf8')) as { nodes: { name: string }[]; materials: { name: string; doubleSided?: boolean }[] }
    const nodes = json.nodes.map((n) => n.name)
    expect(nodes).toContain('FanRotor')
    expect(nodes).toContain('Shell')
    const mats = new Map(json.materials.map((m) => [m.name, m]))
    expect(mats.has('Wall')).toBe(true)
    expect(mats.has('Floor')).toBe(true)
    // One-sided, so the near wall vanishes from outside (the cutaway).
    expect(mats.get('Wall')!.doubleSided ?? false).toBe(false)
  })
})
