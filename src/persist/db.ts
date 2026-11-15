/**
 * Career slots in the browser's IndexedDB (database `laminar`, store
 * `slots`). A slot holds one packed save file as text. If IndexedDB won't
 * open (some private windows), slots fall back to localStorage under
 * `laminar.slot.<n>`. Only the game's own database and keys are ever
 * touched.
 */

const DB_NAME = 'laminar'
const DB_VERSION = 1
const STORE = 'slots'
const fallbackKey = (slot: number) => `laminar.slot.${slot}`
const LAST_SLOT_KEY = 'laminar.lastSlot'

/** How many career slots there are. */
export const SLOTS = 3
const inRange = (slot: number) => Number.isInteger(slot) && slot >= 1 && slot <= SLOTS

/** The slot that was in play last visit (1 if none was recorded). */
export function lastSlot(): number {
  try {
    const n = Number(localStorage.getItem(LAST_SLOT_KEY))
    return inRange(n) ? n : 1
  } catch {
    return 1
  }
}

export function setLastSlot(slot: number): void {
  try {
    if (inRange(slot)) localStorage.setItem(LAST_SLOT_KEY, String(slot))
  } catch {
    // Storage blocked: the game opens slot 1 next time.
  }
}

let opening: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  opening ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return opening
}

function request<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = run(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error ?? new Error('save failed'))
    tx.onabort = () => reject(tx.error ?? new Error('save aborted'))
  })
}

function fallbackGet(slot: number): string | null {
  try {
    return localStorage.getItem(fallbackKey(slot))
  } catch {
    return null
  }
}

/** A slot's text, or null when it is empty or storage is blocked. */
export async function readSlot(slot: number): Promise<string | null> {
  if (!inRange(slot)) return null
  const db = await openDb()
  if (!db) return fallbackGet(slot)
  try {
    const value = await request<unknown>(db, 'readonly', (s) => s.get(slot))
    return typeof value === 'string' ? value : null
  } catch {
    return fallbackGet(slot)
  }
}

/** Write a slot. False when it couldn't be written anywhere (storage blocked or full). */
export async function writeSlot(slot: number, text: string): Promise<boolean> {
  if (!inRange(slot)) return false
  const db = await openDb()
  if (db) {
    try {
      await request(db, 'readwrite', (s) => s.put(text, slot))
      return true
    } catch {
      // Fall through to localStorage.
    }
  }
  try {
    localStorage.setItem(fallbackKey(slot), text)
    return true
  } catch {
    return false
  }
}
