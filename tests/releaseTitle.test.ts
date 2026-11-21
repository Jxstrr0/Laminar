// Adapted from a retired Longlight game, tests/releaseTitle.test.ts (15 November 2026)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The release's "what's new" line (scripts/release-title.mjs). The studio site
 * shows it on the game's card, so a release must never again be titled
 * "update" when the merge said what changed.
 */
const SCRIPT = fileURLToPath(new URL('../scripts/release-title.mjs', import.meta.url))
const WORKFLOW = fileURLToPath(new URL('../.github/workflows/publish-release.yml', import.meta.url))

function summary(version: string, titles: string[]): string {
  return execFileSync('node', [SCRIPT, version], { input: titles.join('\n'), encoding: 'utf8' }).trim()
}

describe('the release title', () => {
  it("reads this repo's merge titles", () => {
    expect(summary('0.12.3.0', ['PR 12d: Offline play and install — v0.12.3.0 (#68)'])).toBe(
      'Offline play and install',
    )
    expect(summary('1.0.0.0', ['PR 13b: The cover and 1.0.0.0 — v1.0.0.0 (#70)'])).toBe(
      'The cover and 1.0.0.0',
    )
  })

  it('reads the two older ways of naming a version', () => {
    expect(summary('0.2.0.0', ['0.2.0.0: The fan spins up'])).toBe('The fan spins up')
    expect(summary('0.2.0.0', ['The fan spins up (0.2.0.0) (#4)'])).toBe('The fan spins up')
  })

  it('takes the commit that shipped the version, not a newer one or another version', () => {
    const log = [
      'PR 14b: Calmer smoke on small phones — v1.0.2.0 (#73)',
      'Fix a typo in the notes — v1.0.1.0',
      'PR 14a: Disc wheels read less side force — v1.0.1.0 (#72)',
      'PR 13b: The cover and 1.0.0.0 — v1.0.0.0 (#70)',
    ]
    expect(summary('1.0.1.0', log)).toBe('Disc wheels read less side force')
    expect(summary('1.0.2.0', log)).toBe('Calmer smoke on small phones')
  })

  it('says nothing when no title names the version', () => {
    expect(summary('9.9.9.9', ['PR 13a: Crash screen and credits — v0.13.0.0 (#69)', 'Tidy up'])).toBe('')
    // 1.0.1.0 is not 11.0.1.0, and a version in the middle of a title is not its version.
    expect(summary('1.0.1.0', ['Something — v11.0.1.0', 'Notes on 1.0.1.0 and after'])).toBe('')
  })

  it('is what the release workflow runs', () => {
    expect(readFileSync(WORKFLOW, 'utf8')).toContain('node scripts/release-title.mjs "$V"')
  })
})
