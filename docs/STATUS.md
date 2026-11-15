# Laminar: status

Where the build stands against `docs/LAMINAR-PLAN.md` section 14.

| PR | Scope | State |
| --- | --- | --- |
| 0 | Scaffold, CI, deploy, loading screen, brand, look, address, grey tunnel with a sphere and a fan | **Done** (v0.1.0.0) |
| 1a | Aero sim core, part 1: shape descriptors and drag (friction with transition, separation, front corners, interference, cavities); the sphere's drag crisis in the tunnel | **Done** (v0.2.0.0) |
| 1b | Aero sim core, part 2: lift, stall, induced drag, ground effect, yaw forces | **Done** (v0.2.1.0) |
| 1c | Aero sim core, part 3: truth / tunnel / field split, reference rider, node harness | **Done** (v0.2.2.0) |
| 2a | Shaping, part 1: the cyclist as numbers (posture, helmet, suit, bars, wheels, frame), comfort and power, TCF rule checks, readouts, desk estimate | **Done** (v0.3.0.0) |
| 2b | Shaping, part 2: the Shape screen (3D rider and bike from the design, slider sheet, readouts, comfort meter, rule breaks with a "change this" jump), Shape / Tunnel switch | **Done** (v0.3.1.0) |
| 2c | Shaping, part 3: drag handles, the rule box drawn in 3D, glossary and tooltips | **Done** (v0.3.2.0) |
| 3a | The tunnel, part 1: your design on the yaw turntable at 1:2, live balance readouts (model drag, side force, full-size CdA), Sphere / Your rider switch | **Done** (v0.3.3.0) |
| 3b | The tunnel, part 2: runs (fan-up to fan-down), run billing, live force charts | **Done** (v0.3.4.0) |
| 3c | The tunnel, part 3: run history with A/B compare and noise bands | Next |
| 3d | The tunnel, part 4: smoke wand and rake, tufts round the rider | Not started |
| 4–14 | See the plan | Not started |

## Versions

- **0.3.4.0** (PR 3b): tunnel runs and the bill. Every fan-up to fan-down
  is now a run: the balance logs a reading four times a second, and the
  sheet shows the run number, its time and what it has cost so far, plus
  the session's total. A run costs ₽ 500 plus the fan's power, which
  climbs with the cube of air speed (a minute at 30 m/s is about ₽ 1,330
  all in). New tabs swap the readouts for live charts: Drag over time, and
  a Yaw sweep that plots CdA against yaw using only settled readings. The
  last run shows faint behind this one. Swapping the model stops the fan
  and ends the run.

- **0.3.3.0** (PR 3a): your rider in the tunnel. The Tunnel screen now
  opens on a 1:2 scale model of whatever you shaped, standing on the yaw
  turntable. Turn the fan up and the balance reads the model's drag, the
  side force and the full-size CdA (the model's reading scaled up), with a
  small wobble from the balance's noise. A yaw slider turns the table up to
  20° each way; "Square on" brings it back. A Model switch swaps back to
  the calibration sphere and its smoke. The tunnel view now fits the space
  between the header and the sheet, so nothing hides behind them on short
  phones.

- **0.3.2.0** (PR 2c): pull the rider into shape. Six blue dots sit on the
  rider (hands, both elbows, back, head and helmet tail); press one and drag
  to reshape, or tap it to jump to its slider. A pull moves the same numbers
  the sliders do, stops at their limits and lands on their steps. The TCF
  rule box is drawn in 3D as see-through boxes around the hands and the
  helmet, which go red when a part breaks out. A glossary arrives: tap any
  dotted term (Reynolds number, drag, desk estimate, comfort and more) for a
  plain explanation, or open the Glossary from the Shape sheet to search all
  48 terms.

- **0.3.1.0** (PR 2b): the Shape screen. The game now opens on a 3D rider
  and bike you can turn with a finger, drawn from the design (the helmet's
  outline is the very shape the aero model tests). The sheet below has the
  desk estimate, a comfort meter, frontal area, mass and price, and the
  TCF rule check, plus three tabs of controls: Position (back angle, head,
  arm width, hand reach and height), Kit (helmet, tail, vents, fabric, arm
  trip strips) and Bike (bars, wheels, frame tubes). Broken rules turn the
  part red and list a "Change this" button that jumps to the control; a
  position that strains the rider lights the worst part amber. A Shape /
  Tunnel switch sits top right.

- **0.3.0.0** (PR 2a): the cyclist you'll shape. A design is a set of
  numbers (back angle, head, arm width, hand reach and height, helmet tail
  and vents, suit fabric and arm trip strips, drop or aero bars, spoked,
  deep or disc wheels, round or Kamm-tail tubes) that turns into the bodies
  the aero model reads. Each choice moves drag the way it does on a real
  bike: a flatter back is faster, a vented road helmet slower, a rear disc
  helps in a crosswind. Low positions strain the rider, costing a few per
  cent of power, and past their limit they can't be held. The Tarnovian
  Cycling Federation's time-trial rules check helmet length, hand reach
  and height, front wheels and tube shape. The desk estimate gives a
  wind-averaged CdA with error bars. Nothing new to see yet; the Shape
  screen comes next.

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
