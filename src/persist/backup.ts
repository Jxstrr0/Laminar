/**
 * Backups (plan section 13): the career as a text file
 * (`laminar-backup-YYYY-MM-DD.txt`, holding its save code), a reminder when
 * the last backup is BACKUP_REMIND_DAYS old, and a request that the browser
 * keep the game's storage instead of clearing it when space runs low.
 * Only `laminar.` keys are touched.
 */

/** Remind the player to back up once the last backup (or their first visit) is this many days old. */
export const BACKUP_REMIND_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000
const BACKED_UP_KEY = 'laminar.backedUpAt'
const FIRST_SEEN_KEY = 'laminar.firstSeen'

/** When the player last backed up, and when they first played (ms since 1970), if known. */
export interface BackupMarks {
  backedUpAt: number | null
  firstSeen: number | null
}

/** The backup file's name for a date (the player's own calendar day). */
export function backupFileName(date: Date): string {
  const two = (n: number) => String(n).padStart(2, '0')
  return `laminar-backup-${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}.txt`
}

/** Whether it's time to remind the player to back up. */
export function backupDue(now: number, marks: BackupMarks): boolean {
  const since = marks.backedUpAt ?? marks.firstSeen
  return since !== null && now - since >= BACKUP_REMIND_DAYS * DAY_MS
}

const readTime = (key: string): number | null => {
  try {
    const n = Number(localStorage.getItem(key))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

const writeTime = (key: string, at: number): void => {
  try {
    localStorage.setItem(key, String(Math.round(at)))
  } catch {
    // Storage blocked: the reminder just can't keep track.
  }
}

export function readMarks(): BackupMarks {
  return { backedUpAt: readTime(BACKED_UP_KEY), firstSeen: readTime(FIRST_SEEN_KEY) }
}

/** Note the first visit, once, so a player who never backs up is reminded in time. */
export function noteFirstSeen(now: number): void {
  if (readTime(FIRST_SEEN_KEY) === null) writeTime(FIRST_SEEN_KEY, now)
}

/** A backup was made (a file saved or a save code copied). */
export function markBackedUp(now: number): void {
  writeTime(BACKED_UP_KEY, now)
}

/** Ask the browser to keep the game's storage (quietly; some browsers never ask the player). */
export async function askToKeepStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** Hand the player a text file to save (it lands in their downloads). */
export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text + '\n'], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  // Give the browser a moment to start the download before letting go of the file.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
