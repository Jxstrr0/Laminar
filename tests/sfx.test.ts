// The sound-effects pack (PR 13r): every effect has its file, and every replay note it listens for is real.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { REPLAY_SFX, SFX, replaySfxFor, type SfxName } from '../src/data/sfx'

const dir = new URL('../public/sfx/', import.meta.url)

/** The sim file whose notes each replay reads. */
const NOTES_IN: Record<string, string> = {
  ride: 'replay',
  jump: 'jumpReplay',
  sled: 'sledReplay',
  car: 'carReplay',
  truck: 'truckReplay',
  drone: 'droneReplay',
  plane: 'planeReplay',
  record: 'recordReplay',
  recordJet: 'recordReplay',
  aircraft: 'aircraftReplay',
  pod: 'podReplay',
}

describe('sound-effects pack', () => {
  it('has all 18 effects, each with its file in public/sfx, and no stray files', () => {
    const files = Object.values(SFX).map((s) => s.file)
    expect(files).toHaveLength(18)
    expect(new Set(files).size).toBe(18)
    for (const f of files) expect(existsSync(new URL(f, dir)), f).toBe(true)
    expect(readdirSync(dir).sort()).toEqual([...files].sort())
  })

  it('keeps the pack small: under 200 KB an effect and 1.2 MB in all', () => {
    let total = 0
    for (const { file } of Object.values(SFX)) {
      const size = statSync(new URL(file, dir)).size
      expect(size, file).toBeLessThan(200 * 1024)
      total += size
    }
    expect(total).toBeLessThan(1.2 * 1024 * 1024)
  })

  it('loops only the tunnel air and the sled runners, and keeps every level below full scale', () => {
    const loops = (Object.keys(SFX) as SfxName[]).filter((n) => SFX[n].loop)
    expect(loops.sort()).toEqual(['bob', 'tunnel'])
    for (const s of Object.values(SFX)) {
      expect(s.gain).toBeGreaterThan(0)
      expect(s.gain).toBeLessThanOrEqual(1)
    }
  })

  it('listens only for note kinds the replays really make', () => {
    for (const key of Object.keys(REPLAY_SFX)) {
      const [replay, kind] = key.split(':') as [string, string]
      const file = NOTES_IN[replay]
      expect(file, key).toBeDefined()
      const src = readFileSync(new URL(`../src/sim/${file}.ts`, import.meta.url), 'utf8')
      expect(src.includes(`'${kind}'`), key).toBe(true)
    }
  })

  it('gives every replay at least one sound, and cheers the sports finishes', () => {
    for (const replay of Object.keys(NOTES_IN)) expect(Object.keys(REPLAY_SFX).some((k) => k.startsWith(`${replay}:`)), replay).toBe(true)
    for (const replay of ['ride', 'sled', 'car', 'drone']) expect(replaySfxFor(replay, 'finish')).toBe('cheer')
    expect(replaySfxFor('record', 'start')).not.toBe(replaySfxFor('recordJet', 'start'))
    expect(replaySfxFor('ride', 'gust')).toBeNull()
  })
})
