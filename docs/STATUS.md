# Laminar: status

Where the build stands against `docs/LAMINAR-PLAN.md` section 14.

| PR | Scope | State |
| --- | --- | --- |
| 0 | Scaffold, CI, deploy, loading screen, brand, look, address, grey tunnel with a sphere and a fan | **Done** (v0.1.0.0) |
| 1a | Aero sim core, part 1: shape descriptors and drag (friction with transition, separation, front corners, interference, cavities); the sphere's drag crisis in the tunnel | **Done** (v0.2.0.0) |
| 1b | Aero sim core, part 2: lift, stall, induced drag, ground effect, yaw forces | **Done** (v0.2.1.0) |
| 1c | Aero sim core, part 3: truth / tunnel / field split, reference rider, node harness | **Done** (v0.2.2.0) |
| 2 | Shaping: the cyclist, posture, kit, comfort, rule box, desk estimate | Next |
| 3–14 | See the plan | Not started |

## Versions

- **0.2.2.0** (PR 1c): one truth, three views. The model now gives three
  answers for any design: the hidden truth (full size, in the event's real
  air), the tunnel reading (a scale model with its own small build errors
  and surface finish, at tunnel speed, through the balance's scatter) and
  the field result (a seeded race day with its own wind, temperature and
  rider form, over a 40 km time trial). A plain reference rider reads CdA
  0.22 m² tucked and 0.31 m² on the hoods, and rides the 40 km in about
  54 minutes on a still day. Small models can fall into the Reynolds trap,
  reading laminar drag where the real thing is turbulent. `npm run aero --
  rider-tt` prints the numbers for a reference shape. Nothing new to see on
  the site yet.

- **0.2.1.0** (PR 1b): lift and crosswinds in the aero model. Wings, fins,
  disc wheels and diffusers make lift (or side force) with a stall, induced
  drag and ground effect that collapses when a wing gets too close. Bodies
  in a crosswind get side force and extra drag, and the model works out the
  centre of pressure, so it can tell whether a shape settles into the wind
  or gets pushed off line. Nothing new to see in the tunnel yet: the yaw
  turntable comes with the live sweep controls (PR 3).

- **0.2.0.0** (PR 1a): the aero model's drag. Bodies are described by their
  cross-sections; the model finds where the boundary layer goes turbulent
  and where the flow separates, and adds up skin friction, wake drag,
  front-corner drag, interference and cavity drag. Tests hold it to
  reference numbers (a sphere's drag crisis, flat-plate friction, a
  cylinder, a rounded box). In the tunnel the sphere now goes through its
  drag crisis near 20 m/s: its drag coefficient falls from 0.46 to 0.17,
  and a red ring marks where the flow leaves the sphere.

- **0.1.0.0** (PR 0): the repo, checks and deploy; the Longlight loading
  splash; the "Cobalt lab" look; a grey test section with a calibration
  sphere on a sting, a fan slider that spins up at the fan's ramp rate, smoke
  streaks over the sphere, and live air speed, dynamic pressure, Reynolds
  number and a textbook sphere drag.

## Build notes

- PR 1 is split into 1a, 1b and 1c so each PR stays small enough to read on
  a phone. Versions: PR n is 0.(n+1).x.0, and each part bumps the third
  number.

## Setup notes

- Repo: renamed from `Jxstrr0/Laminar-` to `Jxstrr0/Laminar` on
  15 November 2026. Old links redirect.
- DNS: `laminar.longlight.games` is a CNAME to `jxstrr0.github.io` in
  Cloudflare (added 15 November 2026, not proxied, like Quench).
- GitHub Pages: **Source: GitHub Actions** (switched on 15 November 2026),
  custom domain `laminar.longlight.games`, **Enforce HTTPS** on.

## Open questions for Kelbo

- Keep "Tarnovian Cycling Federation" as the cycling body's name?
