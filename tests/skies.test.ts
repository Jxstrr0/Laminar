import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { GROUND_TILE, type GroundKind } from '../src/data/ground'
import { REPLAY_SCENE, SURVEY_SCENE } from '../src/data/replay'
import { lateDraw } from '../src/render/lateDraw'
import { pickSky, SKIES, SKY_FOR, WEATHER, weatherByAir, weatherByWind, type SkyId } from '../src/data/skies'

const ROOT = join(__dirname, '..')

describe('the replays’ skies (PR 13az)', () => {
  it('has a picture for every sky, small enough for a phone', () => {
    for (const id of Object.keys(SKIES) as SkyId[]) {
      const path = join(ROOT, 'public/sky', `${id}.jpg`)
      expect(existsSync(path)).toBe(true)
      expect(statSync(path).size).toBeLessThan(400 * 1024)
    }
  })

  it('reads the day’s sky from its wind, or from its air against the venue’s usual (PR 13bd)', () => {
    // Calm is clear; a stiff wind is overcast; each threshold starts the next sky.
    expect(weatherByWind(0)).toBe(0)
    expect(weatherByWind(WEATHER.wind[0])).toBe(1)
    expect(weatherByWind(WEATHER.wind[1])).toBe(2)
    expect(weatherByWind(WEATHER.wind[2])).toBe(3)
    expect(weatherByWind(20)).toBe(3)
    // In summer the warmer day is the clear one, and the usual day has some cloud.
    expect(weatherByAir(6)).toBe(0)
    expect(weatherByAir(0)).toBe(1)
    expect(weatherByAir(-2)).toBe(2)
    expect(weatherByAir(-8)).toBe(3)
    // On snow and ice it's the cold day that's clear.
    expect(weatherByAir(-6, true)).toBe(0)
    expect(weatherByAir(8, true)).toBe(3)
  })

  it('gives every mood a sky for each weather, uses every sky it ships, and keeps Kelbo’s picks for the usual day', () => {
    const used = new Set<SkyId>()
    for (const mood of ['day', 'winter', 'dusk'] as const) {
      for (const weather of [0, 1, 2, 3] as const) {
        const id = pickSky(mood, weather)
        expect(SKIES[id]).toBeDefined()
        used.add(id)
      }
    }
    expect([...used].sort()).toEqual((Object.keys(SKIES) as SkyId[]).sort())
    // Cumulus by day and dusk in dark mode (Kelbo, 20 November 2026) are the skies of a venue with no weather.
    expect(SKIES[pickSky('day', WEATHER.usual)].name).toBe('cumulus')
    expect(SKIES[pickSky('dusk', WEATHER.usual)].name).toBe('dusk')
    // A rougher day never has a clearer daytime sky.
    expect(SKY_FOR.day.map((id) => SKIES[id].name)).toEqual(['clear', 'wisps', 'cumulus', 'overcast'])
  })

  it('names every sky differently', () => {
    const names = Object.values(SKIES).map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('says where every sky’s sun sits, so a venue can turn it to its own light (PR 13bc)', () => {
    for (const sky of Object.values(SKIES)) {
      expect(sky.sunAt).toBeGreaterThanOrEqual(-180)
      expect(sky.sunAt).toBeLessThanOrEqual(180)
    }
  })

  it('moves the ground in steps that keep its grid, crop rows and textures still (PR 13bc)', () => {
    const whole = (n: number) => Math.abs(n - Math.round(n)) < 1e-9
    const step = REPLAY_SCENE.groundStep
    expect(whole(step / REPLAY_SCENE.gridCell)).toBe(true)
    expect(whole(step / SURVEY_SCENE.rows)).toBe(true)
    // The textures the moving ground wears: grass, and snow on the salt and the ice.
    for (const kind of ['grass', 'snow'] as const) expect(whole(step / GROUND_TILE[kind])).toBe(true)
  })

  it('draws a late arrival once on the next frame, and never after the replay has closed (PR 13bc)', () => {
    const frames: (() => void)[] = []
    vi.stubGlobal('requestAnimationFrame', (f: () => void) => frames.push(f))
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    let draws = 0
    const late = lateDraw(() => draws++)
    late.ask()
    late.ask()
    expect(frames.length).toBe(1)
    frames.shift()!()
    expect(draws).toBe(1)
    // A second arrival, after the first was drawn, draws again.
    late.ask()
    frames.shift()!()
    expect(draws).toBe(2)
    late.ask()
    late.stop()
    frames.shift()!()
    late.ask()
    expect(draws).toBe(2)
    expect(frames.length).toBe(0)
    vi.unstubAllGlobals()
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
