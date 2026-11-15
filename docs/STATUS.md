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
| 3c | The tunnel, part 3: run history with A/B compare and noise bands | **Done** (v0.3.5.0) |
| 3d | The tunnel, part 4: smoke wand and rake, tufts round the rider | **Done** (v0.3.6.0) |
| 4a | Correlation, part 1: the tunnel's hidden quirks (blockage, turbulent air, mount drag), tare runs, sphere calibration against the book, corrections on the rider's CdA | **Done** (v0.4.0.0) |
| 4b | Correlation, part 2: static legs (crank-angle runs and the pedalling average), repeat runs pooled | **Done** (v0.4.1.0) |
| 4c | Correlation, part 3: static wheels and a known-wheel calibration | **Done** (v0.4.2.0) |
| 4d | Correlation, part 4: model shop (scale, finish, accuracy), the Reynolds trap and trip strips | **Done** (v0.4.3.0) |
| 4e | Correlation, part 5: pressure taps and the Cp map | Next |
| 5–14 | See the plan | Not started |

## Versions

- **0.4.3.0** (PR 4d): the model shop and the Reynolds trap. Kelbo's
  calls (15 November 2026): the shop is a sheet in the Tunnel, scales are
  1:4, 1:3 and 1:2, and until jobs arrive it shows ₽ and days without
  spending them.
  - **Model shop:** the "Model 1:2" button in the fan row opens it. Pick
    scale, finish (printed, sanded, polished), accuracy (standard ±1 %,
    fine ±0.4 %) and trip strips; see the price and days; order. Each
    build has its own small size errors.
  - **Reynolds trap:** the model drag readout now says how near the
    model's Reynolds number is to the full-size rider's on the day. A
    1:2 model matches at about 24 m/s; a 1:4 model would need 48, so even
    flat out it reads a few per cent high. Run a 1:2 flat out and its
    round parts hit their drag crisis early: it reads well low. A printed
    finish does that sooner.
  - **Trip strips on the model:** the shop tapes the long parts (torso,
    helmet, forearms), which go turbulent at full size but not on a small
    model. That brings a 1:4 or 1:3 model within about 1 %. A textured
    skinsuit still reads better on a small model than it really is: its
    weave doesn't shrink with the model.
  - Runs remember which build they used: the This design card pools only
    the current build, and A/B says when the model changed.

  The posts are the same for every scale, so their tare matters much more
  on a small model. "Reynolds trap" joins the glossary.
- **0.4.2.0** (PR 4c): the wheels stand still. The university tunnel has
  no wheel drive, so the rider model's wheels don't spin. A spinning
  wheel's spokes churn the air; still ones churn about half as much, so
  spoked wheels read low (about 3 % of the whole rider) and a disc looks
  less of a gain than it really is.
  - **Wheel:** a third model on the posts, the lab's 32-spoke reference
    wheel at 1:2, held still. Its readout shows its drag (with the posts
    taken off once tared) beside the book's figure for it spinning.
  - **Calibrate:** a new line holds the still wheel against the book and
    says how much your rider's spokes miss. The rider's CdA readout and
    the This design card then add it back, scaled by your own wheels
    (nothing for discs, less for deep rims).

  The corrected CdA's note now reads "Corrected · raw …" so it fits a
  phone; the This design card still lists what was corrected. "Static
  wheels" joins the glossary.
- **0.4.1.0** (PR 4b): the legs go round. A scale model's legs are fixed
  at one crank angle, and the legs' drag swings with the cranks: most with
  a thigh up in the air, least with the cranks level. A pedalling rider
  gets the average, so a single tunnel run can read up to about 6 % off.
  - **Cranks:** pick the model's crank angle beside the yaw setting.
    Changing it stops the fan while the tunnel is opened.
  - **This design:** a card at the top of the Runs tab pools every run of
    the design you're shaping at each crank angle, with the run-to-run
    spread. With two or more angles it gives the pedalling average. Four
    angles spread over half a turn (0°, 45°, 90°, 135°) cancel the swing
    exactly. Its numbers take off the tare and blockage once known.

  The standard pose's cranks moved from 20° to 15° to sit on the dial.
  "Pedalling average" joins the glossary.

- **0.4.0.0** (PR 4a): the tunnel lies, a little. The university tunnel
  now has hidden faults, drawn once from a seed, that creep into every
  reading:
  - **Blockage:** a big model squeezes the air, so it reads high.
  - **Turbulent air:** the drag crisis comes early.
  - **Mount drag:** the sting and the rider's posts add drag of their own.

  Your rider’s raw CdA now reads about 10–17 % high. To find out by how
  much:
  - **Tare:** take the model off and run the bare mount to measure its
    drag.
  - **Calibrate:** a new tab plots the sphere's Cd against Reynolds number
    over the book curve (a smooth sphere in calm air). Sweep the sphere
    through the crisis and it tells you how turbulent the air is. Tare the
    sting and hold a few slow speeds, and it finds the blockage too.

  Once a tare or calibration is done, the rider's CdA readout takes off
  what's known and shows the raw number beside it. "Calibration run" joins
  the glossary. Static wheels and legs, the model shop and the Cp map come
  in 4b to 4d.

- **0.3.6.0** (PR 3d): see the air. Four chips sit over the tunnel view
  when your rider is on the turntable:
  - **Rake:** a row of smoke streams up the rider's middle.
  - **Wand:** one stream from a tip you drag with a finger.
  - **Tufts:** wool tufts on the rider that lie flat where the air holds on
    and flail red where it lets go.
  - **Dark wall:** darkens the lab so the white smoke stands out.

  The smoke follows a flow field built from the model's own drag at tunnel
  speed, so it slows and churns in the wake exactly where the numbers say
  the flow separates, and it swings with the yaw. The turntable now turns
  the same way as the sim: positive yaw turns the rider's nose to its
  right, so the wind comes from its left. Also recorded: Kelbo's -ize
  spelling and the TCF name.

- **0.3.5.0** (PR 3c): is it real, or is it noise? A new Runs tab lists
  the session's runs, each with its CdA and noise band. Tap two to compare
  them: the first is A, the second B. The report says whether B is lower
  or higher than A beyond the noise, or within it, and lists what changed
  in the design between the two. A small chart shows both runs' readings
  at each yaw, with error bars (A as dots, B as rings). Only readings taken
  with the fan and table settled count, and holding a setting longer
  narrows the band. "Noise band" joins the glossary.

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

## Decisions (15 November 2026)

- Spelling: Canadian with **-ize** (organize, realize), as the Canadian
  Oxford does. `tests/glossary.test.ts` flags -ise forms in glossary text.
- The cycling body stays the **Tarnovian Cycling Federation** (TCF).
