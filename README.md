# Laminar

An aerodynamics consultancy game by Longlight Interactive. Shape a fix in 3D,
build a scale model, prove it in the wind tunnel, then find out at the real
event whether your tunnel told the truth.

**Play:** https://laminar.longlight.games/ (work in progress)

## What's here so far

PR 0 of the plan: a grey wind tunnel with a sphere on a sting. Move the **Fan**
slider and the fan spins up, smoke streams round the sphere, and the readouts
show air speed, dynamic pressure, Reynolds number and drag.

## Editing guide

- `docs/LAMINAR-PLAN.md`: the design plan, built in staged PRs.
- `docs/STATUS.md`: what's done and what's next.
- `docs/NAMES.md`: every name used, and names to avoid.
- `src/data/`: every tuning number and every word players read.
  `src/data/tunnel.ts` has the tunnel's size and fan speed;
  `src/data/strings.ts` has the text.
- `src/style.css`: the colours, at the top.
- `VERSION`: the game's version number. Bump it in each change.

Changes go through a pull request; the `deploy` check must pass, and merging
publishes the game.

© 2026 Kelbo / Longlight Interactive · https://longlight.games/
