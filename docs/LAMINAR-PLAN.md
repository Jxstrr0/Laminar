# Laminar: design plan

> Longlight Interactive design doc. Drafted 15 November 2026 with Kelbo;
> revised the same day after a gap review.
> **Status: planned, not started.** Written so a Claude Code session can build
> it in staged PRs. Read `LONGLIGHT-STUDIO.md` first; this game's own
> `CLAUDE.md` (written in PR 0) wins over both files inside the repo.

### Revision notes (15 Nov 2026, PR 0 build session)

- **Rubles kept.** Hull Down's plan gives Tarnovia the korona (Kr) and keeps
  Mostograd out of it. Kelbo chose rubles and Mostograd anyway: Laminar's
  Tarnovia is its own take, and it doesn't reuse Hull Down's names
  (`docs/NAMES.md`).
- **Look chosen:** "Cobalt lab", Instrument Sans + Spline Sans Mono (`CLAUDE.md`).
- **Address chosen:** `laminar.longlight.games`; the repo is `Jxstrr0/Laminar` (renamed from `Laminar-`).
- **Cycling body proposed:** the Tarnovian Cycling Federation (TCF).

### Revision notes (15 Nov 2026, gap review)

- Settled all five open questions, plus currency, career span, going broke and
  how cyclists are tested (section 2).
- **New section 6.8: truth, tunnel and field.** The plan never said how the
  tunnel reading, the field result and the promise relate. Now it does: one
  hidden full-scale truth, a tunnel that measures it through quirks and noise,
  and a field event that adds real conditions.
- **Days budget per job** (section 4): model orders and repairs spend days;
  tunnel runs never do. Fixes the clash between "money only" and model lead
  times.
- **Promise metric defined** (section 4.1): wind-averaged CdA and similar
  per-sector numbers, so bids are checkable.
- **Run billing defined** (section 7.1): energy used over the sweep, not a flat
  fee per run.
- **Repeatability noise** and repeat runs (section 7.3).
- **Cycling slice quirks**: static wheels and static legs (section 7.2).
- **Field model for time trials** (section 8.3): rider power, course, wind.
- **Going broke** has a soft landing (section 9.8).
- **Build plan reordered**: saves and autosave move up to PR 5 so the first
  playable keeps progress; glossary and tooltips get a home in PR 2–3; a
  tutorial-lite job ships with the first playable.
- Added: accessibility, first-load budget, CI checks, brand pieces, a
  fictional cycling federation, more clashing names to avoid, and a hosting
  note about the custom domain and the shared origin.

---

## 1. Pitch

You run a small aerodynamics consultancy in Tarnovia. Cyclists, ski jumpers,
truck fleets, race teams and eventually the defence ministry bring you a
problem. You shape a fix in 3D, build a scale model, and prove it in the wind
tunnel: smoke, tufts, force balance, pressure maps. Then the real event
happens, and the field result tells you whether your tunnel was telling the
truth.

The name is the thing you're fighting for. Laminar flow is smooth and
attached; the enemy is **separation** (flow tearing off the body into a
draggy wake) and **flutter** (a model shaking itself apart). Like Rollback,
Flutter and Hot Fire, the title points at the failure.

**What hooks Kelbo:** tuning numbers until they're right, watching a build
break and learning why, and a real physics core. Here the numbers are CdA,
downforce and yaw curves, the dyno is the tunnel, and the tunnel itself has
quirks you have to learn.

---

## 2. Decisions (Kelbo, 15 Nov 2026)

| Topic | Decision |
| --- | --- |
| View | **3D.** |
| Aero model | **Hybrid, not full CFD.** A fast, deterministic gameplay aero model gives the numbers; 3D smoke, tufts and pressure maps follow a cheap flow field so it *looks* like CFD. A real coarse GPU CFD solver is a late-game upgrade on capable devices only (section 6.6). |
| Shaping | **Hybrid.** The client supplies a base body; you bolt on parts; morph sliders and a few drag handles reshape surfaces. No free mesh sculpting. |
| Career | **Rollback-style firm.** Two-person consultancy start, briefs and sealed bids, named rival firms, reputation. |
| Sectors | **Sport, Road & motorsport, Air & defence.** No structures/buildings. |
| Failures | **Tunnel + field.** Models flutter, snap and tear off the mount in the tunnel; designs that pass the tunnel can still fail in the real event. |
| Test limit | **Money for runs, days for models.** Every tunnel run costs money (rent or power, model wear) and no time. Ordering, making and repairing models spends days from the job's days budget (section 4). |
| Correlation | **Learnable quirks.** Each tunnel has hidden biases (blockage, fixed floor, turbulence, sting interference, static wheels). You uncover and calibrate them out over time. |
| Instruments | **All four:** smoke + tufts, force balance, pressure taps, PIV / CFD (later ones are unlocks). |
| Run style | **Live sweep.** You spin up the fan, ramp speed and turn the yaw table yourself while the charts draw in real time. |
| Facility | **Rent, then build.** Rent time in a university's old tunnel, then build your own and upgrade it. |
| Models | **Workshop chain.** Order models from an outside shop at first (slow), then bring in your own printers and CNC. Model quality affects accuracy and strength. |
| Cyclist testing | **Scale models from day one**, same loop as every sector. The university tunnel is too small for a full-size rider, so the Reynolds trap is part of the first playable. |
| Long arc | **Records, R&D tree, defence contracts, export abroad.** |
| People | **Two named rival firms + a small staff** (model maker, tunnel tech, analyst) whose traits matter. |
| Platform | **Phone first, desktop second.** Portrait. |
| Art | **Clean lab + Blender hero assets**, plus CC0 or CC BY (credited) assets, plus ElevenLabs audio (**quoted first, every time**). |
| Field result | **Short 3D event replay** with a live data overlay next to your tunnel prediction. |
| First playable | **Cycling slice.** |
| Session length | **One job = 10–20 minutes**; autosave between every step. |
| Sim depth | **Real terms, readable.** Real CdA, L/D, yaw curves, Reynolds effects, named and explained in tooltips; tuned for fun. |
| Voice | **Clients, staff barks, field commentary, tunnel SFX**, all via ElevenLabs with a credit quote and Kelbo's yes first. |
| Name | **Laminar.** |
| Setting | **Tarnovia** (section 12). |
| Currency | **Rubles (₽)** across Tarnovia, matching Lombard and Ink. |
| Career span | **2010–2040**; retire any time. 2040 ends the career with the legacy card. |
| Going broke | **Soft landing.** No game over: sell kit, drop back to renting the university tunnel, take small jobs (section 9.8). |
| Design codes | **Share and challenge.** `LAMD1:` codes share a design; "beat my CdA" challenges on the same brief come in a later PR (with the records board). |
| Defence tone | **Pods, vehicles, aircraft.** A clearance track and secrecy rules; no espionage layer. |
| Between jobs | **The lab stays open** (runs cost ₽); no model orders without a job. *(15 Nov 2026, for PR 5)* |
| Bid promise | **A % drag cut** on the client's current setup, checked as a ceiling on the field result. |
| Missing the promise | **A slice of the fee per 1 % missed, at most half the fee**, with a small allowance for the field's own spread. |
| Model orders | **Days pass at once** when you order; the model arrives straight away. |
| Rivals in PR 5 | **One unnamed firm** bids against you (seeded); the named rivals come in PR 7. |
| First job guide | **Partner's cards plus a highlighted checklist**, skippable. |
| Re-modelling | **Parts swap, position re-orders.** Swapping a helmet, wheels, bars, frame or suit on the model costs a small fee (about ₽1,500 a part) and no days; changing the rider's position needs a new model from the shop (money and days). *(15 Nov 2026, for PR 5)* |
| Model breaks | **Repair: half the model's price and half its build days**, plus the university's bill for the screens if it tore off the mount. *(16 Nov 2026, for PR 6)* |
| Break warnings | **Always warn first**: the part buzzes, the trace wobbles, the partner shouts; a model breaks only if the fan stays past the limit. *(16 Nov 2026, for PR 6)* |
| Crosswind steer | **Loses time in gusts**: the rider eases off to stay on line; never a stop, never hurt. *(16 Nov 2026, for PR 6)* |
| Unholdable position | **Fades in the last third**: power drops late as the rider sits up, instead of a flat loss all race. *(16 Nov 2026, for PR 6)* |
| Reputation | **Bigger briefs and close bids**: a good name opens national-level clients and tips a close sealed bid; it never changes the tunnel or the race. *(16 Nov 2026, for PR 7)* |
| Own tunnel | **Save up, cash only** (about ₽2M); no loans. *(16 Nov 2026, for PR 7)* |
| Staff pay | **Per day that passes**, so a slow job costs wages as well as time. *(16 Nov 2026, for PR 7)* |
| Rival firms | **Bystro Aero** (cheap, sloppy correlation) and **Vysota Aerolab** (prestige, big tunnel, overcharges). *(16 Nov 2026, for PR 7)* |
| Tunnel build time | **90 days, keep working**: you keep renting the university's tunnel while yours is built. *(16 Nov 2026, for PR 7)* |
| Own tunnel running cost | **Cheap runs plus daily upkeep**: no run fee, power at an industrial rate, and upkeep for every day that passes. *(16 Nov 2026, for PR 7)* |
| Staff size | **One per role, three at most**: model maker, tunnel tech and analyst, each role with a couple of people to choose from (different traits and wages). *(16 Nov 2026, for PR 7)* |
| Poaching | **No poaching**: staff stay until you let them go. *(16 Nov 2026, for PR 7)* |
| Going broke: what sells | **Kit first, tunnel last**: machines and upgrades, cheapest first, until cash is back above zero; the tunnel only if that isn't enough. *(16 Nov 2026, for PR 7)* |
| Going broke: sale price | **Half** of what each thing cost. *(16 Nov 2026, for PR 7)* |
| Going broke: staff | **Staff stay** (and keep being paid). *(16 Nov 2026, for PR 7)* |
| Going broke: reputation | **Small dip, −5.** *(16 Nov 2026, for PR 7)* |
| The 2040 end | **Legacy card, then the career closes**; start a new one from Saves. *(16 Nov 2026, for PR 7)* |
| Retiring early | **Ends it, two taps**, the same legacy card. *(16 Nov 2026, for PR 7)* |
| Sharing the legacy | **A picture to share** (PR 7j). *(16 Nov 2026, for PR 7)* |
| Bobsled bid | **Run time gain**: hundredths of a second off a run. *(16 Nov 2026, for PR 8)* |
| Bobsled crews | **Two-man and four-man**; four-man comes later, at higher reputation. *(16 Nov 2026, for PR 8)* |
| Bobsled shaping | **The sled and the crew's tuck**: nose and tail length, cowling height, and how low the crew fold. *(16 Nov 2026, for PR 8)* |
| Bobsled rules | **A rule box**, like the cycling federation's: a fictional sliding federation caps the sled's length and the cowling's height. *(16 Nov 2026, for PR 8)* |
| Bobsled in the tunnel | **A ground board**: the tunnel's still floor hides some of the runners' drag, so an untreated sled reads too slippery. The model shop mounts the model on a raised board with a sharp edge, a small extra like trip strips, which removes most of the error; a rolling road (later, with cars) removes all of it. *(16 Nov 2026, for PR 8)* |
| Ski-jump suit rules | **None**: bagginess only trades lift against stability. *(16 Nov 2026, for PR 8)* |
| Ski-jump declaration | **Predicted distance**: you declare the reference jump's length, forecast from the tunnel's lift and drag. *(16 Nov 2026, for PR 8)* |
| Ski-jump hills | **A normal hill and a large hill**; the large hill comes later, at higher reputation. *(16 Nov 2026, for PR 8)* |
| Jumps past the hill size | **Capped at HS**: tuned so only a near-perfect stable design reaches HS, and metres past it don't count (the jumper bails out to a safe landing). *(16 Nov 2026, for PR 8)* |
| Speed skating venues | **Indoor 400 m oval, plus one outdoor marathon** on natural lake ice. *(16 Nov 2026, for PR 8)* |
| PR 9 order | **Trucks first**: regional truck fleets (fuel saving %), then touring and open-wheel cars, the land-speed record last. *(16 Nov 2026, for PR 9)* |
| Truck rules | **A road-code cap**: a fictional Tarnovian Road Code caps the boat-tail's length and the skirts' ground gap; Shape shows the box and flags a break, like the cycling and bobsled rules. *(16 Nov 2026, for PR 9)* |
| Truck floor | **A ground board now**: trucks sit on the model shop's ground board, like the bobsled. A rolling road (an own-tunnel upgrade) comes with race cars and fixes all of the floor's error. *(16 Nov 2026, for PR 9)* |
| Gravel skirts | **Costs the promise**: some fleets' yards are gravel; skirts below a set height crack there, the trucks run without them, and the saving is judged that way. The brief says which yards are gravel, and the debrief names the skirts with a fix. *(16 Nov 2026, for PR 9)* |
| Car classes | **Both together**: touring cars and open-wheel single-seaters arrive at the same time, on one car model with a class the client sets. *(16 Nov 2026, for PR 9)* |
| Rolling road | **An own-tunnel upgrade**, about ₽900,000 and 30 days, like the wheel-drive rig. Before it, car models sit on the ground board, which fixes part of the floor error, so downforce reads somewhat off. *(16 Nov 2026, for PR 9)* |
| Balance window | **The driver loses time**: outside the window the car understeers or oversteers, the driver lifts in the corners and the lap gets slower, judged that way; the debrief names it with a fix. *(16 Nov 2026, for PR 9)* |
| Car rules | **A rule box**: a fictional Tarnovian Motor Racing Federation rulebook sets a minimum ride height (the skid plank) and a maximum rear-wing chord; Shape flags a break and the scrutineers make the team trim it. *(16 Nov 2026, for PR 9)* |
| Race-car promise | **Lap-time gain**: tenths off a reference lap. Downforce and drag both feed the lap, and a balance window must hold. *(16 Nov 2026, for PR 9)* |
| Record cars | **Streamliner, then jet**: first a long, low wheel-driven streamliner on the salt (about 500–650 km/h), later a jet car chasing the sound barrier, where the air squeezes near Mach 1. *(16 Nov 2026, for PR 9)* |
| Record cars in the tunnel | **Read low, learn the trap**: the firm reads at the tunnel's top speed and the forecast scales up. Lift and stability scale fine, but above about 650 km/h the air squeezes and drag grows that the tunnel never sees; learning that correction is the skill. No high-speed upgrade. *(16 Nov 2026, for PR 9)* |
| Jet car target | **Through the sound barrier**: the jet car's hardest job asks for more than Mach 1 (about 1,250 km/h on the salt). Past Mach 1 the drag eases off a little from its peak, and right at it a shock under the nose lifts it, so droop that held below the barrier may not hold there. The tunnel sees neither. *(16 Nov 2026, for PR 9)* |
| Jet car's new part | **A waist (area rule)**: pinching the body where the engine sits lets the air squeeze later and climb less; pinch past the engine's room and it loses thrust. A longer, finer nose also shrinks the climb. *(16 Nov 2026, for PR 9)* |
| Drones | **Racing quads, then survey drones**: hobby racing quadcopters early in a career (shape the body pod's length, rake and vents, and the arm fairings, for the club's race time), then fixed-wing survey drones mid-career, flying for range. *(16 Nov 2026, for PR 10)* |
| Light aircraft | **The add-ons**: on a fixed kit plane the firm shapes the speed mods (wheel spats, engine cowling, wingtips, strut fairings, an under-wing pod), as real speed-mod shops do. The promise is cruise speed or range; stall speed and handling are the safety floors. *(16 Nov 2026, for PR 10)* |
| Defence clearance | **Apply, then wait**: once the firm's reputation and correlation score are high enough it applies; vetting takes weeks of game time and a fee, then defence briefs appear. Going broke or a run of bad reads can lose it. *(16 Nov 2026, for PR 10)* |
| Defence secrecy | **Big fees, no fame**: defence jobs pay well and count toward the correlation score, but never raise the firm's public reputation or appear on the records board or legacy card. Their replays are a plain test-range view. *(16 Nov 2026, for PR 10)* |
| Survey drones | **Range on a charge**: a two-metre electric survey plane; the promise is extra kilometres on one battery at survey speed, on the site's usual day. The firm shapes the camera pod (how far it hangs, its fairing, where it sits; the client's rule keeps the camera seeing past the belly), the winglets, the fuselage's nose and tail cone, and the tail's size. *(16 Nov 2026, for PR 10i)* |
| Survey drone traps | **Small-model wing stall** in the tunnel: a half-size model's wing flies at a lower Reynolds number and stalls early, so the tunnel says it can't take a gust it can; trip strips or a bigger model fix it. In the field, **a gust on a turn stalls it**: too small a tail or too long a nose and it noses up into a gust past the stall, spins and lands in the crop (the drone breaks). *(16 Nov 2026, for PR 10i)* |
| Light aircraft promise | **Cruise speed**: km/h gained at cruise power, at cruise height on the airfield's usual day, over the client's kit plane on paper. The plane is the Lastochka L-2, a two-seat high-wing kit on struts, flown from Belyanka airfield. *(16 Nov 2026, for PR 10p)* |
| Defence jobs | **Sensor pods first**: a patrol plane must carry a new, bigger sensor pod under its wing. Vehicle crosswind and radomes may follow later. *(16 Nov 2026, for PR 10x on)* |
| Sensor pod promise | **Hours on station**: how long the patrol plane can stay on patrol on a tank with the new pod, against the ministry's plane with its old pod; drag at slow patrol speed decides it. *(16 Nov 2026)* |
| Sensor pod traps | **Pod tested alone** in the tunnel reads less drag than it makes under the wing: the pylon's gap to the wing adds interference drag, so test it on a wing model. On the range, **the pod buffets**: a blunt tail or a pod hung too close to the wing sheds a shaking wake at speed, the sensor's picture blurs and the ministry rejects the run (the debrief names the tail or the gap). Nobody is hurt. *(16 Nov 2026)* |
| Light aircraft traps | **No prop wash** in the tunnel: the model goes in with its prop stopped, but in flight the slipstream blows the cowling, nose wheel, fuselage front and the struts' roots harder, and its swirl meets the strut fairings' roots at an angle; a powered prop on the model catches it. In the field, **stall speed creeps up**: square tips and a pod slid forward under the wing lower the wing's most lift, and past the certified stall speed the inspector won't sign the mod off, so it gains nothing. *(16 Nov 2026, for PR 10p)* |
| Survey drone span | **Add a wing-span slider**: one small PR after the light aircraft gives the survey drone a span slider (a longer wing flies further but weighs more). Nothing else on the drone changes. *(16 Nov 2026)* |
| Quad tunnel trap | **Props stopped**: a quad model goes in with its props still, so the tunnel can't see the downwash on the arms and the arm fairings read less useful than they are. A powered model with spinning props catches it, at more ₽ per run. *(16 Nov 2026, for PR 10c)* |
| Record rules | **Two-way mean, chutes out**: a run each way within an hour, and the mean speed counts, so the wind mostly cancels. If the nose lifts or the car wanders, the driver aborts with the parachutes: nobody's hurt, but the run doesn't count. *(16 Nov 2026, for PR 9)* |
| Firm name | **Asked at career start**, with a ready-made name to keep; renamable. *(16 Nov 2026, for PR 7)* |
| CFD Cluster access | **A tunnel upgrade**, bought like the PIV (₽900,000 and 21 days to fit) once the firm owns its tunnel. *(17 Nov 2026, for PR 12)* |
| CFD run cost | **Free to run**: the phone does the work. *(17 Nov 2026, for PR 12)* |
| Lab sounds | **Made in code** (Web Audio), with ElevenLabs effects perhaps added later, after a quote. *(17 Nov 2026, for PR 13)* |
| Voices | **Quote first**: a script sheet, voices to audition and a credit quote in CAD before anything is generated. *(17 Nov 2026, for PR 13)* |
| Art pass | **Blender via Actions**: hero models scripted and built headless in GitHub Actions, like Lombard. *(17 Nov 2026, for PR 13)* |

---

## 3. Why it isn't another Longlight craft career

The catalogue says a new craft game should break at least two shared habits
(weekly clock, a workshop that grows, rival shops). Laminar breaks two:

- **No weekly clock and no test clock.** Time moves **by job**: each brief
  has a days budget to its event date, spent only on model lead times and
  repairs. Delivering jumps the calendar to the event. Tunnel runs only cost
  money, so the tension is the budget, not a timer.
- **The client list is the variety, not the workshop.** Every job is a new
  body and a new physics problem (a crouched rider, a truck trailer, a ski
  jumper in flight, a drone). The facility does grow, but the game's range
  comes from the brief board.

It also fills open space in the studio line-up: a **clean, bright lab look**
and a sim built on fluid flow instead of mechanics or ballistics.

---

## 4. Core loop (one job, 10–20 minutes)

1. **Brief.** A client card: who they are, the base body, the goal (e.g. "cut
   wind-averaged CdA 6%"), the rulebook (the federation's legality box, a
   truck length limit, a series' wing rules), a fee range, the event, and the
   **days to event**.
2. **Bid.** Sealed bid: price plus a **promised result** band on the brief's
   promise metric (section 4.1). Rivals bid too. The client weighs price,
   promise and reputation (including correlation score). Overpromise to win
   and the field result catches you.
3. **Shape.** Load the base body; bolt on parts; morph and drag handles.
   Live readouts show **geometry only** (frontal area, rule checks, mass,
   cost) plus a rough **desk estimate** with wide error bars. The analyst
   narrows those bars; they never vanish.
4. **Model.** Order or make a scale model. Scale, material and finish set its
   accuracy, its stiffness (flutter limit), its cost and its **lead time in
   days**.
5. **Tunnel.** Mount the model, start the fan, run a live sweep. Smoke and
   tufts show where flow separates; the force balance draws drag, lift or
   downforce, side force and yaw curves. Every run costs money, no days.
6. **Iterate.** Change the design, re-model (cheap and quick for small parts
   if you own a printer; expensive and slow otherwise), re-test. Calibrate the
   tunnel's quirks when results look suspicious.
7. **Deliver.** Lock the design and **declare your prediction** (the number
   that goes on the overlay and into your correlation score). The calendar
   jumps to the event.
8. **Field replay.** A short 3D replay of the event (time trial, ski jump,
   highway fuel run, race stint, flight) with a data overlay: your prediction
   vs the real number. Hit the promise and get paid plus a reputation bump;
   miss it and penalties apply. Some failures only show up here (section 8).

**Days budget rules**
- Each brief starts with a days budget (e.g. 21 days to a regional time trial).
- Model orders, in-house builds, part reprints and post-crash repairs spend
  days. Tunnel runs, shaping and analysis spend none.
- Run out of days and you must deliver what you have (or the last design you
  tested). There is no time penalty beyond that.
- One active job at a time. The calendar between jobs is skipped; the brief
  board refreshes each time you deliver.

### 4.1 Promise metrics (what the bid promises)

| Sector | Promise metric |
| --- | --- |
| Cycling, skating | **Wind-averaged CdA**: CdA over the yaw curve, weighted by the event's expected wind (calm velodrome = near 0°; exposed time trial = wider). Time saved is shown alongside. |
| Ski jump | Distance gain at a reference speed, with a pitch-stability floor. |
| Trucks | Fuel saving (%) on the client's route at highway speed, wind-averaged. |
| Motorsport | Lap-time gain, or downforce at a drag cap, with a balance window. |
| Land-speed | Top speed at the car's power. |
| Drones, aircraft | Endurance or range gain, with stability floors. |

Every metric is computed the same way for the desk estimate, the tunnel
reading and the field truth, so they can be compared directly.

---

## 5. Shaping (hybrid)

**Base bodies** are Blender-authored meshes with **morph targets** (blend
shapes). A cyclist base body has morphs for torso angle, head drop, arm width,
elbow height, hand position; a truck has cab roof height, nose radius, trailer
gap.

**Parts** snap to named mount points, each with 2–5 sliders:

| Sector | Example parts |
| --- | --- |
| Cycling | helmet shape (tail length, vents), skinsuit texture zones (trip strips), wheel type (spoked, deep rim, disc), bar extensions, frame tube profiles (round, Kamm-tail) |
| Speed skating / bobsled | suit zones, hood, sled nose and cowling |
| Ski jump | suit cut and fit, ski V-angle, body lean (posture) |
| Trucks | cab roof fairing, side extenders, trailer skirts, boat-tail, gap filler |
| Motorsport | front wing, rear wing, diffuser, floor edge, sidepod inlet, ride height |
| Land-speed | nose cone, canopy, tail fin, wheel fairings |
| Drones / aircraft | arm fairings, body pod, winglets, intake lips, external pods |

**Posture has a cost.** For riders and athletes, extreme positions cost power
or comfort (a "comfort / power" meter per client). A position the rider can't
hold loses watts in the field. This stops "lowest possible head" from being
the only answer.

**Drag handles:** a small number (6–12) of FFD-lattice handles on the body
for local reshaping, constrained so the mesh never self-intersects. Phone
touch: tap a handle, drag on the screen plane; a slider sheet is always
there as the precise fallback.

**Rule box:** every brief draws its legality envelope as a translucent volume.
Parts that break it go red; you can't deliver an illegal design. Sport rules
come from fictional federations (cycling: name it in PR 0, e.g. a Tarnovian
cycling union); never the real UCI.

**The sim never reads the GPU mesh.** Shaping produces a parameter vector;
pure geometry code in `src/sim/geom/` turns that into a **shape descriptor**
(section 6.1). Base-body morph data ships as plain JSON vertex arrays so the
sim stays DOM-free and three.js-free.

---

## 6. The aero model

Everything in `src/sim/`, deterministic maths, seeded RNG only, every tuning
number in data tables. Real equations where cheap, game-tuned heuristics where
real ones would need CFD.

### 6.1 Shape descriptor
From the parameter vector, compute:
- **Cross-section slices** along the flow axis (area, perimeter, width,
  height, centroid offset): frontal area, fineness ratio, rear closure angle.
- **Surface curvature profile** along streamwise lines (top, sides, bottom).
- **Wetted area** and **roughness zones** (skinsuit texture, panel gaps,
  model finish).
- **Lifting elements** (wings, diffusers, ski planform, rider torso as a
  bluff lifting body) with span, chord, camber, angle, end conditions.
- **Gaps and cavities** (trailer gap, wheel wells, spokes).
- **Flexible parts** (wings, fairings, thin edges) with stiffness from the
  model's material and scale, for flutter and divergence (section 8).

### 6.2 Drag
`D = ½ ρ V² · CdA`, where CdA is the sum of:
- **Skin friction:** flat-plate laminar/turbulent friction on wetted area,
  with a **transition point** that moves with Reynolds number, roughness and
  trip strips. Keeping flow laminar longer saves drag, until it separates
  instead.
- **Pressure (form) drag:** a separation-point estimate from each streamwise
  line's curvature and closure angle (a simplified adverse-pressure-gradient
  criterion). Earlier separation → bigger wake area → more drag. Turbulent
  boundary layers resist separation better than laminar ones; this trade is
  the core puzzle (the golf-ball / skinsuit effect).
- **Interference:** added drag where parts meet (wheel and frame, mirror and
  cab, pod and wing).
- **Gap and cavity drag:** trailer gaps, wheel wells, spinning wheels.
- **Induced drag** from lifting elements (`CL² / (π · AR · e)`).

### 6.3 Lift and downforce
- Thin-airfoil lift slope corrected for aspect ratio (lifting-line
  approximation), with a stall model (soft or sharp by profile).
- **Ground effect** for road vehicles: downforce rises as ride height drops,
  then stalls and collapses below a critical height. That collapse is
  **porpoising** (section 8).
- Element interaction: a rear wing in a dirty wake makes less.

### 6.4 Yaw and stability
- Side force, yaw moment and the drag-vs-yaw curve from 0° to ±20°.
- **Centre of pressure vs centre of mass:** decides whether a body
  self-corrects in a gust or gets pushed off line. Deep-rim wheels and big
  side area save drag but steer the rider in crosswinds.
- Ski jumpers, drones and aircraft also get pitch stability (moment curve vs
  angle of attack).

### 6.5 Reynolds and scale
- Scale models run at a lower Reynolds number than the real thing unless you
  run faster. Lower Re moves transition and separation.
- A built-in correlation trap: a 1:4 model can lie about separation on curved
  surfaces. Fixes: bigger models (more blockage), faster runs (more power
  cost), or trip strips on the model.
- In the cycling slice, the university tunnel's top speed and test section
  force small models, so the first lesson is "your skinsuit result at 1:4
  isn't the full-size result".

### 6.6 Late-game CFD Cluster
- An optional real solver: a coarse **lattice Boltzmann (D3Q19)** grid on
  **WebGPU**, roughly 96×48×48 cells, run on the voxelized shape.
- Shows a true flow field slice and a second drag estimate. It's coarse, so
  it has its own biases (too much numerical viscosity, poor at transition).
  Good players use it for trends and the tunnel for numbers.
- **Feature-detected:** if WebGPU isn't available or the device is too slow,
  the upgrade shows "needs a capable device" and the game stays fully playable
  without it. Its numbers never feed the sim's truth; it is an instrument.
- The CFD run is **not deterministic across GPUs**; it is display and advice
  only, never saved into design codes or used for scoring.

### 6.7 What the visuals show (not the sim)
- **Smoke and particles** move through a cheap flow field: a potential-flow
  approximation around the body (source panels or fitted ellipsoids) plus a
  wake region past each separation line with seeded turbulence noise.
- **Tufts** on the surface point along the local flow and flail where the sim
  says flow is separated.
- **Pressure map** colours the surface by a Cp estimate from the same field.
- The visuals are **driven by** the sim's separation lines and forces, so
  what the player sees always agrees with the numbers.

### 6.8 Truth, tunnel and field (how the numbers relate)

One model, three views of it:

1. **Truth.** The aero model run on the **full-size** shape at the **real
   event's** Reynolds number and air density. Hidden from the player. All
   promise metrics are judged against truth plus field conditions.
2. **Tunnel reading.** The aero model run on the **model** (its scale, its
   finish and accuracy errors from the workshop) at the **tunnel's** speed and
   Re, then passed through the tunnel's quirks (section 7.2) and a small
   seeded repeatability noise (section 7.3). This is everything the player
   sees on the balance.
3. **Field result.** Truth plus the event's seeded conditions: wind speed and
   direction, temperature and density, the athlete's or driver's day
   (power, line, tuck), and course details. Field-only failures (section 8)
   are checked here.

- The **desk estimate** is truth plus a seeded error, with error bars the
  analyst narrows.
- **Correlation score** = how close your declared predictions have been to
  field results, over a rolling window of jobs (the last 10). Clients see it.
- A well-calibrated player should land within the field's own spread most of
  the time. Field conditions are seeded per event, so a design code replays
  the same event the same way.

---

## 7. The tunnel and its quirks

### 7.1 Live sweep
- **Fan speed** slider (hold to ramp), **yaw turntable** dial, **ride
  height** for ground vehicles, **angle of attack** for air.
- Force balance charts draw live as you sweep: drag, lift/downforce, side
  force, yaw moment, plus derived CdA, L/D and the yaw curve.
- Instruments toggle on top: smoke wand (drag it around the model), smoke
  rake, tufts, pressure taps (if fitted to the model), PIV slice (later).
- **A run** starts at fan-up and ends at fan-down. It is saved whole (every
  sample), so the run report can replay it.
- **Billing:** power is billed by energy used over the run (∝ V³ × time at
  each speed), so holding top speed is what costs. Renting adds a booking fee
  per session and a per-run fee. Model wear builds with time at high speed.
- **Sweep presets** ("standard yaw sweep", "speed sweep at 0°") are a tunnel
  tech perk that runs the controls for you; manual control is always there.

### 7.2 Quirks (hidden per tunnel, seeded)

| Quirk | Effect | How you find and fix it |
| --- | --- | --- |
| **Blockage** | A model too big for the test section reads high drag | Run the same shape at two scales; buy a bigger test section; apply the blockage correction once learned |
| **Fixed floor** | Ground vehicles read wrong downforce and drag on a stationary floor | Moving belt / rolling road upgrade |
| **Turbulence intensity** | High freestream turbulence trips transition early, flattering bluff bodies | Turbulence screens upgrade; reference-model calibration |
| **Sting / mount interference** | The support strut adds its own drag and disturbs the wake | Tare runs (run the mount with no model); alternate mounts |
| **Flow angularity** | The air isn't quite straight; yaw curves come out lopsided | Run the model flipped; flow-straightener upgrade |
| **Temperature drift** | Long runs heat the air; density changes | Climate control upgrade; note the reading |
| **Static wheels** | Wheels that don't spin read the wrong wheel drag and side force (cycling, cars) | Wheel-drive rig upgrade; a known-wheel calibration |
| **Static legs** | A rider model with fixed legs misses the drag swing of pedalling | Leg-cycle averaging (run several crank angles); later a pedalling-legs rig |

- **Calibration runs** with a reference body (sphere, standard car shape)
  reveal quirks as soon as you compare them with the published reference
  number. The analyst turns calibration data into a correction you can apply.
- **Cycling slice quirks:** the university tunnel has blockage, turbulence
  intensity, sting interference, static wheels and static legs (fixed floor
  and flow angularity arrive with road vehicles).
- Your own tunnel starts with fewer quirks; upgrades remove them.
- **Correlation score** (section 6.8) is a reputation stat clients see.

### 7.3 Repeatability
- Every reading carries a small seeded noise; cheap balances and rough models
  carry more. Repeat runs average it down (at a money cost).
- The run report shows the spread of repeated runs, so "did that change
  really help, or is it noise?" is a real question. The analyst flags changes
  smaller than the noise.

---

## 8. Failures

### Tunnel (spectacular, models only)
- **Flutter:** a wing, fairing or thin part starts to oscillate at a critical
  speed set by its stiffness and the model material; it gets worse until it
  snaps off. Tufts and the force trace show the warning first.
- **Divergence:** a flexible lifting part twists into more load until it
  breaks.
- **Sting failure:** too much load on a cheap mount; the model tears off and
  hits the tunnel floor or the screens (repair bill and repair days).
- **Part detachment:** a badly fixed printed part comes off at speed.
- **Model shatter:** brittle resin model at high speed.

### Field (in the replay)
- **Crosswind steer:** deep wheels or a big side area push the cyclist or
  truck off line in a gust; time lost or a run aborted.
- **Unholdable position:** a posture past the rider's comfort limit loses
  power late in the event (section 5).
- **Porpoising:** a race car's floor stalls in ground effect and bounces down
  the straight.
- **Ski-jump instability:** a fast suit cut that pitches the jumper forward
  late in flight; a shorter jump and a wobbly landing.
- **Drone tumble:** too much side area or an unstable pod; the drone
  tumbles and crashes (unmanned).
- **Aircraft departure:** a pod or fairing causes buffeting or a stall
  warning; the test pilot aborts the point and lands safely.
- **Heat and debris:** a truck skirt cracks on a gravel road; a fairing
  blocks brake cooling.

**Safety tone:** people are never hurt. Cyclists lose time or stop, pilots
abort and land, jumpers land short. Drones and models break spectacularly.

**Crash cost:** money (new model, tunnel repairs), days from the job's budget,
and reputation on a missed promise. No injuries, no press scandal system.

Every failure is shown in 3D, marked on the trace, and gets one "change this
next time" line with a jump to the part to fix (Escapement's `goFix`
pattern).

### 8.3 Field models (cycling slice first)
- **Time trial:** rider power curve (with a day-to-day seeded spread), mass,
  rolling resistance, course profile (gradient segments), wind field along the
  course, and air density from temperature and altitude. Time comes from a
  power balance per segment. Crosswind steer is checked against gusts.
- **Velodrome:** near-still air, banked laps, a target pace; tests whether the
  position holds over the distance.
- Later sectors add their own field models in their PRs (ski-jump flight,
  truck fuel run, race stint, flight test).

---

## 9. Career

### 9.1 Start
- A **two-person consultancy** (you and one partner), a tiny budget, renting
  runs in a **university's old low-speed tunnel** with known-bad quirks.
- The first job doubles as the tutorial: a local time-trial cyclist wants a
  faster position for a regional championship.
- Career runs **2010–2040**; retire any time.

### 9.2 Facility growth
1. **Rent** the university tunnel (per-run fees, booking fee, its quirks).
2. **Build your own** small closed-return tunnel.
3. **Upgrades:** bigger fan (top speed, higher Re), bigger test section (less
   blockage), yaw turntable range, rolling road, wheel-drive rig, pedalling
   legs, turbulence screens, flow straightener, climate control,
   six-component force balance, pressure scanner, PIV laser, **CFD Cluster**
   (section 6.6).

### 9.3 Workshop chain
- Early: order models from an **outside model shop**. Slow lead time (days)
  and a fixed quality grade. Pay extra for rush (fewer days) or better finish.
- Mid: buy a **resin 3D printer** (fast small parts, brittle), then an **FDM
  printer** (cheap, rough), then a **CNC mill** (accurate, stiff, expensive).
- Model choices: scale, material (resin, nylon, aluminium, carbon), finish
  grade, pressure-tap fit-out. They decide accuracy, stiffness (flutter
  speed), cost and lead time.

### 9.4 Staff
A few specialists, each with 2–3 traits:
- **Model maker:** build quality, speed, material skills.
- **Tunnel tech:** quirk discovery, fewer mount failures, cheaper runs, sweep
  presets.
- **Analyst:** narrows desk-estimate error bars, turns calibration data into
  corrections, spots flutter early, flags noise-sized changes.
Light touch: hire, pay, let go. No staff minigame, and no poaching (Kelbo, 16 Nov 2026).

### 9.5 Rivals
- **Two named rival firms**: a cheap firm with sloppy correlation, and a
  prestige firm with a big tunnel that overcharges. Their correlation scores
  are public like yours.
- Rivals win jobs, set records and win clients (they never poach staff).
- International rival firms arrive with export (section 9.7).

### 9.6 Sectors and tiers
| Tier | Sport | Road & motorsport | Air & defence |
| --- | --- | --- | --- |
| Early | club cyclists, speed skaters | regional truck fleets (fuel savings) | hobby drone racers |
| Mid | national cycling team, ski jump, bobsled | touring-car team, open-wheel series | survey drones, light aircraft kit makers |
| Late | the hour record, world-cup ski jumpers | land-speed record attempt | **Tarnovian defence contracts** (clearance required): aircraft pods and fairings, vehicle crosswind stability, radome shapes |

### 9.7 Long arc
- **Records board:** hour record, ski-jump distance, land-speed, fastest
  time trial, best truck fuel figure. Clients commission record attempts.
- **R&D tree:** materials (model and real parts), techniques (trip strips,
  boundary-layer suction for later aircraft work, active aero), instruments,
  analysis (better corrections, CFD).
- **Defence contracts:** a clearance track. Secrecy rules (no publicity, no
  records) but big fees and the hardest physics. No espionage layer.
- **Export:** clients from neighbouring countries with their own rulebooks,
  climates (air density, temperature, altitude) and rival international firms.
- **Challenge codes:** "beat my CdA" on the same brief (built with the
  records board, PR 11).
- **End:** retire any time, or reach 2040; a legacy card (adapt Escapement's
  `share.js` and `cards.js`): records held, correlation score, best job.

### 9.8 Going broke (soft landing)
- If cash goes below zero after a job, you sell kit (printers, upgrades) at
  half price, cheapest first, to cover it; your own tunnel goes only if that
  isn't enough, and then you drop back to renting the university tunnel.
  Staff stay.
- Small, low-fee briefs always appear on the board so you can rebuild.
- Reputation dips 5, but there is no game over.

---

## 10. Screens and camera (phone first, portrait)

| Screen | Contents |
| --- | --- |
| **Brief board** | Open briefs by sector; brief detail with days to event; sealed bid form with promised result. |
| **Shape** | 3D model upper half (orbit with two fingers, tap parts and handles); bottom sheet with parts list, sliders, morph controls, rule box and geometry readouts plus the desk estimate and the comfort meter. |
| **Workshop** | Order or make a model: scale, material, finish, taps; lead time (days) and cost. |
| **Tunnel** | 3D lab view upper half; fan, yaw and ride-height controls on the thumb rail; live charts in the bottom sheet (swipe between drag, lift, yaw, Cp). Instrument toggles. |
| **Run report** | Saved runs overlaid; compare A vs B with noise bands; quirks found; "change this" jump. |
| **Deliver** | Final design, declared prediction, days left. |
| **Field replay** | Short 3D event with a prediction vs actual overlay and commentary. |
| **Firm** | Money, staff, facility upgrades, R&D tree, records, rivals, correlation score. |
| **Glossary** | Every aero term, reachable by tapping it anywhere (Escapement's `GLOSS` / `data-g`). |

**Camera:** orbit in Shape; fixed observation-window cam plus free orbit in the
tunnel; chase and broadcast cams in field replays (adapt The Whip's
`src/framing.js` to keep the subject clear of the bottom sheet).

**Desktop second:** mouse orbit, wheel zoom, keyboard shortcuts for fan and
yaw, side panels instead of bottom sheets.

**Accessibility:** colour-blind-safe Cp palette and tuft colour (checked with
a simulator), reduced-motion setting (calmer smoke, no camera shake), text
size setting, 44 px tap targets, and every chart has a readable number
readout, not colour alone.

---

## 11. Look and sound

### Look
- **Clean lab:** bright, crisp tunnel interior; white and pale grey test
  section, observation windows, a coloured accent for instruments. Smoke in
  white (with a dark-backdrop option so it reads), tufts in a strong contrast
  colour, Cp map in a perceptual diverging palette.
- **The lab follows the phone (Kelbo, 16 November 2026, Isobar PR 13h):** the
  3D lab used to stay bright in both themes; now it goes navy in dark mode,
  and the Dark wall goes near-black there so the chip still does something.
  Scene colours live in `src/render/theme.ts`.
- **Blender hero assets:** the tunnel (university and own, with upgrade
  variants), base bodies with morph targets, event venues for replays
  (velodrome, ski jump, highway, circuit, salt flat, airfield). Scripted and
  built headless in GitHub Actions like Lombard.
- **CC0 or CC BY assets** allowed anywhere; every CC BY asset credited in
  `CREDITS.md` and the in-game credits screen (Season Ticket's
  `tests/credits.test.ts` pattern).
- Fonts and palette: pick ones not already used in the catalogue's looks
  table; self-host them; decide in PR 0 and record in `CLAUDE.md`.
- **Studio brand:** official Longlight logo files copied in, the
  `© <year> Kelbo / Longlight Interactive` line on splash and credits, and the
  studio link. Brand on studio pieces only.

### Sound
- Procedural fan drone that follows speed (adapt PEW and Red Skies synth
  patterns), balance-motor whirr, turntable clunk.
- **ElevenLabs** (every batch goes through the **11l-base-skill**: script
  sheet, voice audition, **credit quote, Kelbo's explicit yes before anything
  is generated**):
  - **Clients:** short voiced brief intros and reactions.
  - **Staff barks:** tunnel tech and analyst callouts during runs
    ("Separation at the rear wheel!", "She's fluttering, back off!",
    "Tare run done").
  - **Field commentary:** race, ski-jump and flight commentators in replays.
  - **Tunnel SFX:** fan spin-up, roar, model snap, debris on the screens.
- The game must work muted, with text callouts.

---

## 12. Setting

- **Tarnovia**, currency **rubles (₽)**, career 2010–2040. Before naming
  anything:
  1. Read Hull Down's `HULL-DOWN-PLAN.md` for Tarnovia's canon. If it names a
     currency other than rubles, flag it to Kelbo.
  2. Read Lombard's `docs/01-GDD.md` **Setting** and **Brands**: Lombard owns
     Mostograd's canon (Mostograd is a city in Tarnovia).
  3. Read `ROLLBACK-PLAN.md` section 12 so Laminar doesn't reuse Rollback's
     rival, supplier or park names.
- Likely shape: the firm starts near a technical university (it could be in
  Mostograd); venues spread across Tarnovia (a velodrome, a ski-jump hill, a
  highway corridor, a circuit, a salt flat, a military airfield).
- Fresh names for rival firms, the university, clients, model shops, sport
  federations and export countries. Check `LONGLIGHT-STUDIO.md` section 8.
  Avoid Kestrel, Kessel, Harbourline, Hollis, Lantern, Halyard, Sable, Ember,
  Kite, Corvid, Tidewater, Northwind, Nimbus, Heron, Courier, Ledger,
  "Prairie", and another country starting with V. Don't use "Flutter" as a
  proper name (it's a saved game idea).
- The player names their own firm.
- **Possible link:** the saved idea Flutter (jet fighter design) has a wind
  tunnel step. A later shared Tarnovia design-bureau world could have
  Laminar's firm testing Flutter's prototypes. Laminar must stand alone first.

---

## 13. Tech

- **Stack:** TypeScript, Vite, three.js (npm), like Lombard, Station Keeper
  and Rollback. Vitest and ESLint (ban three.js and the DOM in `src/sim/`).
- **CI checks** (merge on green): `npm run lint`, `npm run test`,
  `npm run build` with a bundle budget gate (adapt Lombard's
  `scripts/check-bundle.mjs`), plus a determinism test.
- **Determinism:** seeded RNG with named streams (Frontier Lab `rng.ts`) and
  deterministic maths (Season Ticket's `det.ts` with its banned-`Math` test),
  so runs and field replays match on every device.
- **Sim tests vs references** (within game tolerances): sphere Cd vs Reynolds
  (including the drag crisis), flat-plate friction, thin-airfoil lift slope,
  a bluff-body yaw curve, a known cyclist CdA range, and a time-trial time for
  a reference rider.
- **Node harness:** prints a shape's polar, its tunnel reading in a given
  tunnel, and its field result for a seed.
- **Visual flow:** GPU particle system (instanced points or a small
  ping-pong texture) advected through the flow field in section 6.7.
  Particle budget scales with device tier (adapt Lombard's `src/render/perf.ts`).
- **CFD Cluster:** WebGPU compute (LBM D3Q19), feature-detected, optional,
  lazy-loaded; never required for progress.
- **Saves:** IndexedDB career slots with migrations (adapt Lombard's
  `src/persist/`); settings under `laminar.*` in localStorage.
  - Save code prefix **`LAM1:`** (free in `LONGLIGHT-STUDIO.md` section 5;
    note Lombard's similar-looking `LMB1.`).
  - Backup file `laminar-backup-YYYY-MM-DD.txt`, `persist()`, 14-day reminder.
  - **Design codes:** share one design, prefix `LAMD1:`; carries the brief id
    and seeds so a challenge replays the same tunnel and event.
  - Run histories are trimmed (keep summaries, drop old samples) so saves stay
    small.
- **Offline:** service worker with caches prefixed `laminar-` (never touch
  other prefixes on the shared origin).
- **Performance:** the tunnel must hold 30+ fps on a 2021 mid-range Android
  with smoke on. The sim computes forces; the renderer only draws. First load
  under 15 MiB (Lombard's cap); venues and later sectors load on demand.
- **Hosting:** public repo `Jxstrr0/Laminar`, GitHub Pages,
  `laminar.longlight.games`, listed on the studio site when playable.
  - A custom subdomain is **its own origin**, separate from
    `jxstrr0.github.io`. Pick the address in PR 0 and keep it: moving later
    strands players' saves on the old origin. Keep the `laminar` prefixes
    anyway.
- **Studio rules:** phone first, four-number versions, branch-PR-merge on
  green, fictional names, plain-language summary and a phone test step at
  the end of every task. No backend, accounts, analytics, ads or API keys.

---

## 14. Build plan

| PR | Scope |
| --- | --- |
| 0 | Repo scaffold, `CLAUDE.md`, CI, deploy, loading screen, studio brand pieces, fonts and palette chosen, address chosen; a grey tunnel with a sphere on a sting and a working fan slider. |
| 1 | **Aero sim core:** shape descriptor from parameters; skin friction with transition; separation-based form drag; interference and cavity drag; lift with stall and induced drag; yaw forces; Reynolds scaling; the truth / tunnel / field split (section 6.8). Reference tests plus the node harness. |
| 2 | **Shaping:** cyclist base body with morph targets (posture), helmet, skinsuit zones, wheels, bars; comfort meter; drag handles; rule box; geometry readouts and the desk estimate; glossary and tooltips. |
| 3 | **Tunnel:** 3D lab, model mount, live sweep controls, force balance charts, smoke wand and rake, tufts, run billing, run history with A/B compare and noise bands. |
| 4 | **Correlation:** cycling-slice quirks, calibration runs with a reference body, tare runs, model scale and quality effects, Reynolds trap and trip strips, repeat runs, pressure taps and Cp map. |
| 5 | **Contracts + field replay:** briefs with days budgets, model lead times, sealed bids, promise metrics, declared prediction, cycling field model and replay (time trial and velodrome), payment and penalties; **autosave, save slots and save code** so progress survives; a guided first job. **First playable: the cycling slice.** |
| 6 | **Failures:** flutter, divergence, sting failure, detachment, shatter; crosswind steer and unholdable positions in the field; debris and effects; the "change this" jump. |
| 7 | **Career:** full tutorial job, rent → build tunnel, upgrades, workshop chain (shop → printers → CNC), staff and traits, two rivals, reputation and correlation score, going broke, backup file and reminder, 2040 end. |
| 8 | **Rest of Sport:** speed skating, ski jump (pitch stability, flight replay), bobsled. |
| 9 | **Road & motorsport:** trucks (fuel run replay), touring and open-wheel cars (rolling road, ground effect, porpoising), land-speed record. |
| 10 | **Air & defence:** drones, light aircraft, defence clearance track and contracts; PIV instrument. |
| 11 | **Records board, R&D tree, export countries, challenge design codes.** |
| 12 | **CFD Cluster** (WebGPU LBM, feature-detected). |
| 13 | Blender art pass (tunnels, base bodies, venues), sound pass, ElevenLabs voice and SFX (**quote first**), credits screen. |
| 14 | Offline, balance bot (headless player across many seeds), release workflow, studio site listing. |

---

## 15. Open questions for Kelbo

All settled on 15 Nov 2026: model lead times spend days (section 4); two
rivals; rubles and 2010–2040; challenge codes in a later PR; defence stays
pods, vehicles and aircraft with no espionage; soft landing when broke;
scale models from day one.

Left for the build session to check, not Kelbo (done in PR 0):
- Hull Down's plan names the korona; Kelbo kept rubles (see revision notes).
- Cycling federation proposed: the Tarnovian Cycling Federation (TCF). Other
  bodies get named in the PRs that need them.
