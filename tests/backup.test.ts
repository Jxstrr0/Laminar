import { describe, expect, it } from 'vitest'
import { BACKUP_REMIND_DAYS, backupDue, backupFileName } from '../src/persist/backup'

const DAY = 24 * 60 * 60 * 1000

describe('backup file', () => {
  it('is named for the player’s own calendar day', () => {
    expect(backupFileName(new Date(2026, 10, 16, 23, 59))).toBe('laminar-backup-2026-11-16.txt')
    expect(backupFileName(new Date(2031, 0, 5))).toBe('laminar-backup-2031-01-05.txt')
  })
})

describe('backup reminder', () => {
  const now = Date.UTC(2026, 10, 30)
  it('waits two weeks from the first visit when there has never been a backup', () => {
    expect(BACKUP_REMIND_DAYS).toBe(14)
    expect(backupDue(now, { backedUpAt: null, firstSeen: now - 13 * DAY })).toBe(false)
    expect(backupDue(now, { backedUpAt: null, firstSeen: now - 14 * DAY })).toBe(true)
  })

  it('counts from the last backup once there is one', () => {
    expect(backupDue(now, { backedUpAt: now - 2 * DAY, firstSeen: now - 100 * DAY })).toBe(false)
    expect(backupDue(now, { backedUpAt: now - 20 * DAY, firstSeen: now - 100 * DAY })).toBe(true)
  })

  it('stays quiet when nothing is known (storage blocked)', () => {
    expect(backupDue(now, { backedUpAt: null, firstSeen: null })).toBe(false)
  })
})
