/**
 * Offline play (PR 14a): register the worker that keeps the game's files
 * (src/pwa/sw.js), and show a bar when a new version is ready.
 *
 * A new version never swaps in by itself mid-game. The bar asks; Reload saves
 * the career first, then tells the waiting worker to take over and reloads.
 *
 * `?nosw` is the escape hatch: it removes this game's worker and its caches
 * (only names starting `laminar-`), then runs straight from the network.
 * Adapted in spirit from Frontier Lab's `?nosw` (studio catalogue, reuse map).
 */
import { t } from '../data/strings'
import { CACHE_PREFIX } from './precache'

/** How often a long-open game checks for a new version when it comes back to the front. */
const CHECK_EVERY_MS = 60 * 60 * 1000

export type OfflineState = 'ready' | 'pending' | 'off'

/** For the credits sheet: is this copy of the game kept for offline play? */
export function offlineState(): OfflineState {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV || noWorker()) return 'off'
  return navigator.serviceWorker.controller ? 'ready' : 'pending'
}

function noWorker(): boolean {
  return new URLSearchParams(location.search).has('nosw')
}

/** This game's own folder: the worker's scope. */
function ourScope(): string {
  return new URL('./', location.href).href
}

export function startOffline(beforeReload: () => Promise<void>): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  if (noWorker()) {
    void removeOurs()
    return
  }
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The first install also takes control; only reload when the player asked.
    if (reloading) location.reload()
  })
  const offer = (worker: ServiceWorker) => {
    if (!navigator.serviceWorker.controller) return // first visit: nothing to update from
    showBar(async () => {
      reloading = true
      try {
        await beforeReload()
      } finally {
        worker.postMessage({ type: 'skip-waiting' })
        // If the switch never reports back, reload anyway.
        window.setTimeout(() => location.reload(), 4000)
      }
    })
  }
  navigator.serviceWorker
    .register('./sw.js', { scope: './' })
    .then((reg) => {
      if (reg.waiting) offer(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') offer(worker)
        })
      })
      let lastCheck = Date.now()
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || Date.now() - lastCheck < CHECK_EVERY_MS) return
        lastCheck = Date.now()
        reg.update().catch(() => {})
      })
    })
    .catch(() => {
      // No offline copy (private mode, storage blocked): the game still runs from the network.
    })
}

/** `?nosw`: unregister this game's worker (never one with another scope) and drop its caches. */
async function removeOurs(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration('./')
    if (reg && reg.scope === ourScope()) await reg.unregister()
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX)) await caches.delete(name)
    }
  } catch {
    // Nothing to remove.
  }
}

let bar: HTMLElement | null = null

function showBar(reload: () => Promise<void>): void {
  if (bar) return
  bar = document.createElement('div')
  bar.className = 'update-bar'
  bar.setAttribute('role', 'status')
  const text = document.createElement('p')
  text.textContent = t('offline.update')
  const later = document.createElement('button')
  later.type = 'button'
  later.className = 'update-later'
  later.textContent = t('offline.later')
  const go = document.createElement('button')
  go.type = 'button'
  go.className = 'update-go'
  go.textContent = t('offline.reload')
  later.addEventListener('click', () => {
    bar?.remove()
    bar = null
  })
  go.addEventListener('click', () => {
    go.disabled = true
    void reload()
  })
  bar.append(text, later, go)
  document.body.append(bar)
}
