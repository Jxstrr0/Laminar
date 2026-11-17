// Offline play (PR 14a): what the worker keeps, and that it only ever deletes this game's caches.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CACHE_PREFIX, VOICE_CACHE, cacheName, precacheList, staleCaches } from '../src/pwa/precache'

describe('offline cache', () => {
  it('names every cache with the laminar- prefix', () => {
    expect(cacheName('0123456789abcdef')).toBe('laminar-0123456789')
    expect(VOICE_CACHE.startsWith(CACHE_PREFIX)).toBe(true)
  })

  it('keeps the game and leaves out the worker, CNAME, maps, old fonts, voice, sound effects and music', () => {
    const list = precacheList([
      'index.html',
      'sw.js',
      'CNAME',
      'assets/index-abc.js',
      'assets/index-abc.js.map',
      'assets/font-400.woff',
      'assets/font-400.woff2',
      'models/tunnel.glb',
      'voice/lam_basov_lam-basov-0001.mp3',
      'sfx/lam_sfx_0001_tunnel.mp3',
      'music/lam_mus_0001_lab.mp3',
    ])
    expect(list).toEqual(['assets/font-400.woff2', 'assets/index-abc.js', 'index.html', 'models/tunnel.glb'])
  })

  it("deletes only this game's old caches, never another game's or the voice cache", () => {
    const names = ['laminar-aaaa', 'laminar-bbbb', VOICE_CACHE, 'quench-1', 'longlight-3', 'pew-x']
    expect(staleCaches(names, 'laminar-bbbb')).toEqual(['laminar-aaaa'])
  })

  it('the worker source keeps the same prefix and voice cache name, and guards every delete', () => {
    const src = readFileSync(new URL('../src/pwa/sw.js', import.meta.url), 'utf8')
    expect(src).toContain(`const PREFIX = '${CACHE_PREFIX}'`)
    expect(src).toContain(`const VOICE = '${VOICE_CACHE}'`)
    // The only delete sits behind the prefix check.
    expect(src.match(/caches\.delete/g)).toHaveLength(1)
    expect(src).toMatch(/n\.startsWith\(PREFIX\)[^\n]*caches\.delete/)
  })

  it('the register code never clears storage wholesale', () => {
    const src = readFileSync(new URL('../src/pwa/register.ts', import.meta.url), 'utf8')
    expect(src).not.toContain('localStorage.clear')
    expect(src).toMatch(/startsWith\(CACHE_PREFIX\)\) await caches\.delete/)
  })
})
