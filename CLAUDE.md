# CLAUDE.md: Laminar

A Longlight Interactive game. You run a small aerodynamics consultancy in
Tarnovia: clients bring a problem, you shape a fix in 3D, build a scale model,
prove it in the wind tunnel, then the real event shows whether your tunnel
told the truth. Career 2010–2040.

Read `docs/LAMINAR-PLAN.md` before touching gameplay or structure. Work through
its staged PRs (section 14) in order. `docs/STATUS.md` says where things stand.
Kelbo's design decisions are in section 2 of the plan. This file wins over the
plan and over `.github/LONGLIGHT-STUDIO.md` where they disagree.

## Working with Kelbo

- Use the name Kelbo only. No real name, initials or email anywhere in the repo.
- Kelbo is a beginner-plus coder who tests on his phone from the live site.
  End every task with a plain-language summary and how to test it on a phone.
- Canadian spelling in everything players and Kelbo read.
- Branch, PR, merge when the checks pass (Kelbo agreed on 15 November 2026
  that Claude merges on green). Never push to `main`. Keep each PR small
  enough to read on a phone.
- The plan pitches; Kelbo decides. Ask about real design questions.
- Read other Longlight repos, never change them.
- Commits are authored as Kelbo's GitHub account: `git config user.name "Jxstrr0"`,
  `git config user.email "322161611+Jxstrr0@users.noreply.github.com"`, with the
  Claude co-author trailer.
- Anything that costs money (ElevenLabs, paid assets, paid services) needs a
  quote and Kelbo's explicit yes first, every time.

## Stack (fixed; ask before changing)

- TypeScript (strict), Vite, three.js from npm (0.187, same as Lombard and Quench), in its own chunk.
- UI is plain DOM and CSS. No framework.
- Vitest for the sim. ESLint plus `tsc`.
- Hosting: GitHub Pages from Actions. Repo `Jxstrr0/Laminar` (renamed from
  `Laminar-` on 15 November 2026; GitHub redirects the old name).
  Address `https://laminar.longlight.games/`, chosen in PR 0 and **never to
  move** (a new address strands players' saves).
  Vite `base: './'` so the build also works at `jxstrr0.github.io/Laminar/`.
- No backend, accounts, analytics, ads or API keys.

## Folders

```
src/sim/      pure aero model, fan, field models, career rules
src/data/     every tuning number and all player-facing text
src/render/   three.js scenes (tunnel, shape, field replay)
src/ui/       DOM screens, sheets, charts
src/audio/    cues (pure) and engine            (PR 13a; mute in `laminar.muted`)
src/persist/  saves, save code, safety          (PR 5)
src/cfd/      the CFD Cluster's solver: CPU reference and WebGPU (PR 12)
scripts/      bundle check, icons, release title
docs/         the plan, NAMES.md, STATUS.md
```

## Rules for the sim

- `src/sim/` and `src/data/` import nothing from three.js, the DOM, `render`,
  `ui`, `audio` or `persist`. ESLint enforces it.
- No `Math.random`, `Date.now` or `performance.now` in the sim. Seeded RNG only
  (`src/sim/rng.ts`; use `rng.fork('name')` for a named stream per system).
  Fixed time step.
- No `Math.sin`, `Math.exp`, `Math.pow` and friends in the sim: use
  `src/sim/det.ts`, so a design and seed give the same tunnel reading and field
  result on every phone. `tests/simPurity.test.ts` scans for all of these.
- Every tuning number lives in a table in `src/data/`, never inline.
- The sim never reads the GPU mesh. Shaping makes a parameter vector; geometry
  code in `src/sim/geom/` turns it into a shape descriptor (plan section 5).
- One truth, three views: hidden full-scale truth, the tunnel reading through
  quirks and noise, and the field result with real conditions (plan section 6.8).
- The renderer only draws what the sim says. Smoke, tufts and pressure maps
  follow the sim's separation lines and forces, never the other way round.
- Every failure gets a cause the report can name and a "change this" jump.

## Design rules from Kelbo (15 November 2026)

- Money: **rubles (₽)**. Hull Down's plan gives Tarnovia the korona (Kr) and
  keeps Mostograd out of it; Kelbo chose rubles anyway, with Mostograd a city
  in Laminar's Tarnovia. Laminar's Tarnovia is its own take: don't import
  Hull Down's canon, and don't reuse its names (see `docs/NAMES.md`).
- Tunnel runs cost money, never days. Model orders and repairs spend days from
  the job's budget.
- People are never hurt. Riders lose time, pilots abort and land, models break.
- Phone first, portrait first. Touch must work before a feature is done.
- Every chart has a readable number, not colour alone.

## Look ("Cobalt lab", chosen by Kelbo 15 November 2026)

A bright, clean wind-tunnel lab, light first, with a dark mode. Every colour is
a CSS variable at the top of `src/style.css`.

| Token | Light | Dark |
| --- | --- | --- |
| `--bg` | `#F5F7F9` | `#0E141A` |
| `--panel` / `--panel-2` | `#FFFFFF` / `#E6EBEF` | `#16202A` / `#1E2A35` |
| `--line` | `#D3DAE0` | `#2A3A47` |
| `--ink` / `--muted` | `#13202B` / `#5A6875` | `#E8EEF3` / `#93A3B1` |
| `--accent` (instruments, cobalt) | `#2456E8` | `#6E93FF` |
| `--warn` | `#E08A00` | `#F2A93B` |
| `--sep` (separation, failures) | `#D2462B` | `#F07158` |

- Fonts, self-hosted from `@fontsource`: **Instrument Sans** (400/600/700) for
  the UI and **Spline Sans Mono** (400/500) for numbers. No other Longlight
  game uses either.
- The 3D lab stays bright in both themes. Smoke is white with a grey twin so it
  reads on pale walls; a dark-backdrop option comes with the instruments (PR 3).
- The Cp map (PR 4) must use a perceptual, colour-blind-safe diverging palette.

## Versions

- Four numbers, Major.Minor.Patch.Build, in the root `VERSION` file.
  `vite.config.ts` reads it and the build fails if it isn't four numbers.
- It shows in the sheet footer as `v0.1.0.0 · <sha> · <date>` so a fresh deploy is easy to spot.
- Bump `VERSION` in the PR that makes the change, and add a line to `docs/STATUS.md`.
- Title each PR `PR <n>: <summary> — v<version>`: `publish-release.yml` makes a
  GitHub Release from it when `VERSION` changes on `main`, and the studio site
  reads that for this game's version and "what's new" line.
- `package.json` keeps its own three-part number; players never see it.

## Storage

- localStorage keys start `laminar.`; IndexedDB database `laminar`; cache
  names start `laminar-`; save code `LAM1:`; design codes `LAMD1:`.
- Never clear or delete anything outside those prefixes. No `localStorage.clear()`.
- Saves since PR 5a/5b: three slots in IndexedDB `laminar` (store `slots`), falling back to `laminar.slot.<n>`; the slot in play is `laminar.lastSlot`. No service worker yet (PR 14).

## Branding

Laminar keeps its own look. The Longlight brand applies only to studio pieces:
the loading splash, the credit line, the studio link, and later the credits screen.

- Logo: the official files in `public/brand/`, copied from `Kelbo.Website`
  `assets/press/`. Never redraw, recolour or replace the letters with live text.
- Colours for studio pieces: clay `#D97757`, purple `#7B3FC4`, slate `#141413`,
  ivory `#FAF9F5`, lilac `#B48CE8`.
- Font for studio pieces: Space Grotesk, self-hosted.
- Always "Longlight Interactive" in full. Credit line: `© 2026 Kelbo / Longlight Interactive`.
- Studio link: https://longlight.games/

## Content rules

- Fictional people, companies, federations and places. Real aero terms (CdA,
  Reynolds number, L/D, yaw) used as they are. Never the real UCI or other real
  sport bodies.
- Check section 8 of the catalogue and `docs/NAMES.md` before adding a name;
  add every new name to `docs/NAMES.md`.
- Copied code gets `// Adapted from <Repo> <path> (<date>)` at the top. Never
  import across repos or hotlink.
- CC0 and CC BY assets are allowed; every third-party file gets a line in
  `CREDITS.md` (author, source, licence).

## Commands

- `npm run dev`: Vite dev server
- `npm run lint`: ESLint and typecheck
- `npm run test`: Vitest
- `npm run build`: production build to `dist/`, then the first-load budget check (15 MiB)
- `npm run icons`: redraw `public/icons/` from `public/icon.svg` (needs Playwright)

The PR check is the `deploy` workflow: lint, test, build. Merging to `main`
publishes to Pages.

## Studio catalogue

`.github/LONGLIGHT-STUDIO.md` covers every Longlight game: shared rules, names
already taken, storage prefixes and a reuse map. Don't edit the copy here; the
master lives in `Jxstrr0/Kelbo.Website`.
