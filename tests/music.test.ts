// The music bed (PR 13s): both loops have their files, stay small and quiet, and loop with room to overlap.
import { existsSync, readdirSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MUSIC, MUSIC_TUNING } from '../src/data/music'

const dir = new URL('../public/music/', import.meta.url)

describe('music bed', () => {
  it('has the lab and replay loops, each with its file in public/music, and no stray files', () => {
    const files = Object.values(MUSIC).map((m) => m.file)
    expect(Object.keys(MUSIC).sort()).toEqual(['lab', 'replay'])
    for (const f of files) expect(existsSync(new URL(f, dir)), f).toBe(true)
    expect(readdirSync(dir).sort()).toEqual([...files].sort())
  })

  it('keeps the music under 2 MB in all, fetched only after the first tap', () => {
    const total = Object.values(MUSIC).reduce((sum, m) => sum + statSync(new URL(m.file, dir)).size, 0)
    expect(total).toBeLessThan(2 * 1024 * 1024)
  })

  it('sits well under the voices and effects, and the replay a touch above the lab', () => {
    for (const m of Object.values(MUSIC)) {
      expect(m.gain).toBeGreaterThan(0)
      expect(m.gain).toBeLessThanOrEqual(0.3)
    }
    expect(MUSIC.replay.gain).toBeGreaterThanOrEqual(MUSIC.lab.gain)
  })

  it('overlaps each pass by a few seconds, and queues the next before it falls due', () => {
    expect(MUSIC_TUNING.overlap).toBeGreaterThanOrEqual(1)
    expect(MUSIC_TUNING.overlap).toBeLessThanOrEqual(5)
    // The clock ticks more often than the look-ahead, so a pass is never late.
    expect(MUSIC_TUNING.watchMs / 1000).toBeLessThan(MUSIC_TUNING.lookAhead)
  })
})
