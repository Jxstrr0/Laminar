import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GROUND_TILE, type GroundKind } from '../src/data/ground'
import { pickSky, SKIES, SKY_FOR, type SkyId } from '../src/data/skies'

const ROOT = join(__dirname, '..')

describe('the replays’ skies (PR 13az)', () => {
  it('has a picture for every sky, small enough for a phone', () => {
    for (const id of Object.keys(SKIES) as SkyId[]) {
      const path = join(ROOT, 'public/sky', `${id}.jpg`)
      expect(existsSync(path)).toBe(true)
      expect(statSync(path).size).toBeLessThan(400 * 1024)
    }
  })

  it('gives each mood its sky, and lets the address try another or switch them off', () => {
    expect(pickSky('day', null)).toBe(SKY_FOR.day)
    expect(pickSky('winter', null)).toBe(SKY_FOR.winter)
    expect(pickSky('day', 'clear')).toBe('kloofendal_43d_clear_puresky')
    expect(pickSky('dusk', 'off')).toBeNull()
    // An unknown name is ignored.
    expect(pickSky('day', 'purple')).toBe(SKY_FOR.day)
  })

  it('names every sky differently', () => {
    const names = Object.values(SKIES).map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('has a ground texture for every surface', () => {
    for (const kind of Object.keys(GROUND_TILE) as GroundKind[]) expect(existsSync(join(ROOT, 'public/tex', `${kind}.jpg`))).toBe(true)
  })

  for (const id of ['university', 'own']) {
    it(`the ${id} tunnel's walls and floor carry texture coordinates, and nothing else does (PR 13ba)`, () => {
      const glb = readFileSync(join(ROOT, `public/models/tunnel-${id}.glb`))
      const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { meshes: { name: string; primitives: { attributes: Record<string, number> }[] }[] }
      for (const mesh of json.meshes) {
        const uv = mesh.primitives.some((p) => 'TEXCOORD_0' in p.attributes)
        expect(uv, mesh.name).toBe(mesh.name === 'Shell' || mesh.name === 'FarWall')
      }
    })
  }
})
