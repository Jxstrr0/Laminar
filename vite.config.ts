// Adapted from a retired Longlight game, vite.config.ts (15 November 2026), which came from Lombard.
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { cacheName, precacheList } from './src/pwa/precache'

function shortSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

const buildDate = new Date().toISOString().slice(0, 10)

// The player-facing version, Major.Minor.Patch.Build (see CLAUDE.md, Versions).
// It lives in the VERSION file at the repo root so there is one place to bump it.
const gameVersion = readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim()
if (!/^\d+\.\d+\.\d+\.\d+$/.test(gameVersion)) {
  throw new Error(`VERSION must be four numbers like 0.1.0.0, got "${gameVersion}"`)
}

/** Every file under a folder, as forward-slash paths relative to it. */
function listFiles(root: string, dir = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...listFiles(root, rel))
    else out.push(rel)
  }
  return out
}

/**
 * Offline play (PR 14a): after the build, write dist/sw.js from src/pwa/sw.js
 * with this build's cache name and file list in front. The name comes from a
 * hash of every kept file, so any change to the game makes a new cache.
 */
function laminarServiceWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'laminar-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const files = precacheList(listFiles(outDir))
      const hash = createHash('sha256')
      for (const f of files) hash.update(f).update(readFileSync(path.join(outDir, f)))
      const head =
        `self.__LAMINAR_CACHE__ = ${JSON.stringify(cacheName(hash.digest('hex')))}\n` +
        `self.__LAMINAR_FILES__ = ${JSON.stringify(files)}\n`
      const body = readFileSync(new URL('./src/pwa/sw.js', import.meta.url), 'utf8')
      writeFileSync(path.join(outDir, 'sw.js'), head + body)
    },
  }
}

export default defineConfig({
  plugins: [laminarServiceWorker()],
  // Relative base: the same dist/ works at the root of laminar.longlight.games
  // and under a sub-path such as jxstrr0.github.io/Laminar/.
  base: './',
  define: {
    __BUILD_SHA__: JSON.stringify(shortSha()),
    __BUILD_DATE__: JSON.stringify(buildDate),
    __GAME_VERSION__: JSON.stringify(gameVersion),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // three.js sits in its own chunk so a new deploy re-downloads only what changed.
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 30 }],
        },
      },
    },
  },
})
