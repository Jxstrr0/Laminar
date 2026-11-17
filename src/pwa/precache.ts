/**
 * What the offline copy keeps (PR 14a). Pure, so the build step and the tests
 * share it. The build (`laminarServiceWorker` in vite.config.ts) lists every
 * file in dist/, keeps the ones below, and names the cache after a hash of
 * their contents, so a new deploy gets a fresh cache and the old one goes.
 *
 * Every cache this game makes starts `laminar-`, and the worker only ever
 * deletes caches with that prefix: other Longlight games may share the origin
 * (jxstrr0.github.io), and their offline copies are theirs.
 */

/** Every cache name starts with this. */
export const CACHE_PREFIX = 'laminar-'

/**
 * Voice lines and sound effects (PR 13r) are cached the first time they
 * play, not up front, and kept across deploys (their file names never change). Bump the number to drop
 * them all if a take is ever replaced under the same name.
 */
export const VOICE_CACHE = `${CACHE_PREFIX}voice-1`

/** The cache for one build: `laminar-` plus the first 10 characters of its hash. */
export function cacheName(hash: string): string {
  return `${CACHE_PREFIX}${hash.slice(0, 10)}`
}

/**
 * The files to fetch when the worker installs, from every path in dist/
 * (forward slashes, relative). Left out: the worker itself, the CNAME file,
 * source maps, the older `.woff` fonts (every phone that runs the game reads
 * `.woff2`) and the voice and sound-effect folders (cached on first play instead).
 */
export function precacheList(paths: readonly string[]): string[] {
  return paths
    .filter((p) => p !== 'sw.js' && p !== 'CNAME')
    .filter((p) => !p.endsWith('.map') && !p.endsWith('.woff'))
    .filter((p) => !p.startsWith('voice/') && !p.startsWith('sfx/'))
    .slice()
    .sort()
}

/** Old caches to delete when a new worker takes over: ours only, never another game's. */
export function staleCaches(names: readonly string[], current: string): string[] {
  return names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== current && n !== VOICE_CACHE)
}
