#!/usr/bin/env node
// Adapted from Quench scripts/check-bundle.mjs (15 November 2026), which came from Lombard
/**
 * First-load guard. Runs after `vite build` (npm's postbuild) and fails the
 * build when dist/ grows past the plan's 15 MiB first-load budget (Lombard's
 * cap, plan section 13). For now the whole of dist/ loads up front, so the
 * check simply adds up every file. When venues and later sectors load on
 * demand, this check should count only what the first screen needs. The voice
 * lines (public/voice/, PR 14b) already load only when a line first plays,
 * so they're left out, and so are the sound effects (public/sfx/, PR 13r)
 * and the music (public/music/, PR 13s).
 * Sizes are on disk, uncompressed (GitHub Pages gzips JS and CSS).
 */
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const DIST = 'dist'
const LIMIT_MIB = 15
const LIMIT = LIMIT_MIB * 1024 * 1024

/** Folders that load on demand, not on the first screen. */
const ON_DEMAND = new Set([path.join(DIST, 'voice'), path.join(DIST, 'sfx'), path.join(DIST, 'music')])

async function walk(dir) {
  let total = 0
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (ON_DEMAND.has(p)) continue
    total += entry.isDirectory() ? await walk(p) : (await stat(p)).size
  }
  return total
}

const total = await walk(DIST)
const mib = (total / 1024 / 1024).toFixed(2)
if (total > LIMIT) {
  console.error(`check-bundle: dist is ${mib} MiB, over the ${LIMIT_MIB} MiB first-load budget.`)
  process.exit(1)
}
console.log(`check-bundle: dist is ${mib} MiB (budget ${LIMIT_MIB} MiB).`)
