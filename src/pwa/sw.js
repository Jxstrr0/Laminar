/*
 * Laminar's offline worker (PR 14a). The build (vite.config.ts,
 * laminarServiceWorker) puts this file at dist/sw.js with two lines in front:
 * the cache name for this build and the list of files to keep.
 *
 * - Install: fetch every file in the list into this build's cache.
 * - Wait: a new version waits until the player taps Reload on the
 *   "new version" bar (src/pwa/register.ts), so a game in progress never
 *   swaps files under itself.
 * - Activate: delete this game's old caches. Only names that start
 *   `laminar-` are touched; other Longlight games can share the origin.
 * - Fetch: the page itself and every built file come from the cache, so the
 *   game opens with no signal. Voice lines are cached the first time they play.
 */
const CACHE = self.__LAMINAR_CACHE__
const FILES = self.__LAMINAR_FILES__
const PREFIX = 'laminar-'
const VOICE = 'laminar-voice-1' // keep in step with VOICE_CACHE in src/pwa/precache.ts
// Match by address only. Servers add `Vary: Origin`, and the page's module
// scripts send an Origin header the install fetch didn't, so a strict match
// would miss every script and the game wouldn't open offline.
const MATCH = { ignoreVary: true }

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's HTTP cache, so the files match this build.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n.startsWith(PREFIX) && n !== CACHE && n !== VOICE).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  // Only this game's own files; anything else goes to the network untouched.
  if (!req.url.startsWith(self.registration.scope)) return
  // Audio can ask for a byte range; let the network answer those.
  if (req.headers.has('range')) return

  if (req.mode === 'navigate') {
    // Any page in the game is index.html (?try=, ?challenge= and the rest are read by the game).
    event.respondWith(
      caches
        .open(CACHE)
        .then((cache) => cache.match('index.html', MATCH))
        .then((hit) => hit || fetch(req)),
    )
    return
  }

  if (new URL(req.url).pathname.includes('/voice/')) {
    event.respondWith(
      caches.open(VOICE).then((cache) =>
        cache.match(req, MATCH).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) cache.put(req, res.clone())
              return res
            }),
        ),
      ),
    )
    return
  }

  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(req, MATCH))
      .then((hit) => hit || fetch(req)),
  )
})
