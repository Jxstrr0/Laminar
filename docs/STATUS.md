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
| 4e | Correlation, part 5: pressure taps and the Cp map | **Done** (v0.4.4.0) |
| 5a | Contracts, part 1: the lab's state lifted out of the tunnel, and autosave (one slot) | **Done** (v0.5.0.0) |
| 5b | Save slots, save code (`LAM1:`) and a Saves sheet | **Done** (v0.5.1.0) |
| 5c | Briefs, money and the job clock: the Jobs screen, runs and models charged, days spent, deliver and get paid | **Done** (v0.5.2.0) |
| 5d | The model follows the design: parts swap for a fee, a new position needs a new model (Kelbo's call) | **Done** (v0.5.3.0) |
| 5e | Promise and prediction, the debrief, payment and penalties | **Done** (v0.5.4.0) |
| 5f | Sealed bids against a rival firm | **Done** (v0.5.5.0) |
| 5g | Time-trial replay | **Done** (v0.5.6.0) |
| 5h | Velodrome | **Done** (v0.5.7.0) |
| 5i | Guided first job | **Done** (v0.5.8.0) |
| 6a | Failures: the tunnel's failure model (sim, saves) | **Done** (v0.6.0.0) |
| 6b | Failures on the tunnel screen | **Done** (v0.6.1.0) |
| 6c | Failures in the field: crosswind steer, fading position | **Done** (v0.6.2.0) |
| 6d | Field failures in the 3D replay: the wobble in a gust, the rider sitting up | **Done** (v0.6.3.0) |
| 7a | Reputation and correlation score: bigger clients and close bids for a good name | **Done** (v0.7.0.0) |
| 7b | The named rivals, Bystro Aero and Vysota Aerolab | **Done** (v0.7.1.0) |
| 7c | Your own tunnel: save up and build it (cash only), 90 days, cheap runs and daily upkeep | **Done** (v0.7.2.0) |
| 7d | Tunnel upgrades: turbulence screens, bigger turntable, wheel-drive rig, bigger fan | **Done** (v0.7.3.0) |
| 7e | Workshop chain: FDM printer, resin printer, CNC mill | **Done** (v0.7.4.0) |
| 7f | Staff with traits, paid per day that passes | **Done** (v0.7.5.0) |
| 7g | Going broke: the soft landing | **Done** (v0.7.6.0) |
| 7h | Backup file and reminder | **Done** (v0.7.7.0) |
| 7i | The 2040 ending and legacy card | **Done** (v0.7.8.0) |
| 7j | The legacy card as a picture to share | **Done** (v0.7.9.0) |
| 8a | Sports in the sim: the speed skater | **Done** (v0.8.0.0) |
| 8b | The skater on screen, skating briefs | **Done** (v0.8.1.0) |
| 8c | Ski jump in the sim | **Done** (v0.8.2.0) |
| 8d | Ski jump on Shape: the jumper's figure, controls and readouts; a preview link | **Done** (v0.8.3.0) |
| 8e | Ski jump in the tunnel, part 1: readings and the distance forecast (sim) | **Done** (v0.8.4.0) |
| 8f | Ski jump in the tunnel, part 2: the pitch dial, readings and forecast on screen | **Done** (v0.8.5.0) |
| 8g | Ski-jump jobs in the career (sim): briefs, the promise in metres, delivering a jumper | **Done** (v0.8.6.0) |
| 8h | Ski-jump balance: the cap at the hill size, a retune, the large-hill job (sim) | **Done** (v0.8.7.0) |
| 8i | Ski-jump jobs on screen: the board, the bid in metres, declaring a distance, the jump-day debrief | **Done** (v0.8.8.0) |
| 8j | The flight replay on the hill | **Done** (v0.8.9.0) |
| 8k | A sting that can break, and a fairer read on the helmet and boots | **Done** (v0.8.10.0) |
| 8l | The bobsled in the sim: the sled, the crew's tuck, the rule box, the run down Belogor | **Done** (v0.8.11.0) |
| 8m | The bobsled on the Shape screen | **Done** (v0.8.12.0) |
| 8n | The bobsled in the tunnel | **Done** (v0.8.13.0) |
| 8o | Bobsled jobs in the career (sim): briefs, the promise in hundredths, race day | **Done** (v0.8.14.0) |
| 8p | Bobsled jobs on screen: the board, the bid in hundredths, declaring a run time, the race-day debrief | **Done** (v0.8.15.0) |
| 8q | The bobsled run replay | **Done** (v0.8.16.0) |
| 9a | Trucks in the sim: the rig and its parts, the Tarnovian Road Code, drag over yaw, the fuel run on the Stavren–Mostograd highway | **Done** (v0.9.0.0) |
| 9b | The truck on Shape: cab, gap and trailer sliders, the desk's fuel saving, road code breaks with "change this", the rig in 3D (`?try=truck`) | **Done** (v0.9.1.0) |
| 9c | The truck in the tunnel, sim side: truck model scales (1:12, 1:10, 1:8), parts drag that grows with yaw, the still floor and the ground board, bolt-on part swaps, the fuel-saving forecast from a yaw sweep | **Done** (v0.9.2.0) |
| 9d | The truck on the tunnel screen: its own small model on a ground board, the camera framing the rig, runs pooled by yaw into a fuel-saving forecast with the straight-on and bare-floor traps named, truck scales in the model shop, stouter struts | **Done** (v0.9.3.0) |
| 9e | Truck jobs in the sim: three fleets' briefs (closed until 9f), a coast route, the promise on wind-averaged fuel saved, the declared fuel figure judged on drag, the road code cutting back illegal parts, the lab's full-size friction correction on truck readings | **Done** (v0.9.4.0) |
| 9f | Truck jobs on the board: the brief card (route, trailer), bids in per cent of fuel, the job's route and fleet truck in Shape and the tunnel, a Deliver sheet that declares a fuel figure from the tunnel's forecast, and the fuel-trial debrief with a "change this" for any part the road code cut back | **Done** (v0.9.5.0) |
| 9g | The gravel yard: Prichal's yard on the Kosa spit is gravel, skirts lower than 0.45 m above the road crack there and the trucks run without them, judged that way; the brief card, Shape and the Deliver sheet warn, the debrief names it with a "Raise the skirts" jump | **Done** (v0.9.6.0) |
| 9h | The fuel-run replay: the trial day down the client's route, your truck and the fleet's old one side by side, with the distance, the wind's angle, your diesel and the saving so far, a commentator for the yard, the windiest stretch, a slow climb and the arrival, then the fuel trial | **Done** (v0.9.7.0) |
| 9i | Racing cars in the sim: touring cars and single-seaters, front and rear wings, the floor in ground effect (stall and porpoising), ride heights that squash at speed, the balance window, the cooling inlet, the Tarnovian Motor Racing Federation's rulebook, and a flying lap on two circuits | **Done** (v0.9.8.0) |
| 9j | The racing car on Shape: a 3D touring car and single-seater drawn from the drag model's own shell, Floor and Wings tabs, the desk's lap-time gain on the Dolgo Ring, downforce and drag at 200 km/h, the balance against the drivers' window, the Motor Racing Federation's rule box, and amber warnings for porpoising, heat and balance. Try it with `?try=car` and `?try=car-open` | **Done** (v0.9.9.0) |
| 9k | The racing car in the tunnel, in the sim: the mount lowers the model to read an aero map (the model can't squat as the real car does), the floor read through the tunnel's floor (still floor, ground board, or the new rolling road upgrade at ₽900,000 and 30 days), standing wheels read draggy, and the lap forecast on the map, porpoising and all | **Done** (v0.9.10.0) |
| 9l | The racing car on the Tunnel screen: it hangs from a strut over the bare floor, the shop's ground board or the rolling road; the angle row becomes the ride drop; readouts for downforce, balance, drag and the lap forecast; the ride sweep chart (downforce against drop); the forecast in full on the Runs tab; the strut breaks past 1,500 N | **Done** (v0.9.11.0) |
| 9m | Car jobs in the sim: three teams (Belan Sport and Granit Motorsport in touring cars, Iskra Racing in the open-wheel series), the promise in tenths of a second off the lap on the circuit's usual day, scrutineers who raise or trim an illegal car, a seeded race day, the read judged on downforce, and a debrief that blames the rules, porpoising, balance or heat when one of them cost the promise. The Shape and Tunnel screens forecast at the job's circuit against the team's own car. Closed to the board until 9n | **Done** (v0.9.12.0) |
| 9n | Car jobs on the board: brief cards with the circuit, the car and the air; bids in tenths of a second; the Deliver sheet (the declared lap, filled in from the tunnel's lap forecast or the desk, with warnings for the floor it was read over, a map not read low enough, porpoising and the rulebook); the race weekend debrief with each trim and trouble and a "change this" | **Done** (v0.9.13.0) |
| 9o | The lap replay: race day round the circuit from behind your car, the team's old car as a see-through twin alongside, the lap clock, speed and gap, the commentator on the slowest corner, the top speed and porpoising (the car bounces where it porpoises), then the declared lap against the real one | **Done** (v0.9.14.0) |
| 9p | The land-speed streamliner in the sim: nose cone (length and droop), canopy, tail fin and wheel fairings; drag, nose lift and pointing straight (the side force behind the mass); the air squeezing near the speed of sound, which a longer nose puts off; a run from a standstill through the timed kilometre on the salt at Lake Sukhoye; chutes out if the nose goes light or the car wanders; the record as the mean of a run each way. Not on screen yet | **Done** (v0.9.15.0) |
| 9q | The streamliner on Shape: the car drawn from the drag model's own shell with its nose drooped, a glass canopy, the fin and the wheel fairings; Body and Fin & wheels tabs; the desk's record speed against the team's car at Lake Sukhoye, the nose's weight at top speed and the crosswind it holds straight in; a light nose, a wander, a low canopy and the air squeezing as amber warnings with a "Change this". Saves and the model shop know the car. Preview with `?try=record`. The tunnel reads it in 9r | **Done** (v0.9.16.0) |
| 9r | The streamliner in the tunnel, in the sim: a scale model read for drag, nose lift and side force over a still floor, a moving board or the rolling road; still wheels add drag unless the fairings cover them; the still floor reads the nose's lift low, so a nose that goes light on the salt can pass in a still tunnel; a yaw sweep finds the centre of side force. The forecast turns the readings into a record speed, the nose's weight and the crosswind held | **Done** (v0.9.17.0) |
| 9s | The streamliner on the Tunnel screen: it stands on two slim posts on the turntable (they take 60 N) over the bare floor, a ground board or the rolling road, at a truck's model scales. Readouts for yaw (with where the side force acts against the mass), nose lift, drag and the record forecast; the forecast in full on the Runs tab, with what the floor does to the nose's lift. Preview with `?try=record` | **Done** (v0.9.18.0) |
| 9t | Record jobs in the sim: Bogdan Lisovoy's home-built Kalina and the Zarya Land Speed Project (its canopy cut so low the driver gives up power) at Sukhoye Speed Week. The promise is km/h on the two-way mean on the salt's still day over the team's car, 2 km/h a point (Kelbo: "km/h on their car"); a car that pulls its chutes there gains nothing. Record day is seeded, the read is judged on drag, and the debrief names a light nose, a wander or the low canopy. Shape and Tunnel forecast at the job's flat against the team's own car. Closed to the board until 9u | **Done** (v0.9.19.0) |
| 9u | Record jobs on the board: the brief card (course, air, car), bids in km/h 2 at a time, a Deliver sheet that declares the two-way mean from the tunnel's forecast (warning if it was read over the bare floor, never yawed, or pulled its chutes) or the desk's, and a Speed week debrief with the still day, record day and its wind, the read, and a light nose, a wander or a low canopy with a "Change this". The bids sheet's Shape button now names a truck or a car | **Done** (v0.9.20.0) |
| 9v | The record-run replay: record day on the salt from behind your car, the team's old car as a slate twin, both runs (north, then back south), the run-up fast and the timed kilometre slower. Chutes at the end of each run, or early where the nose lifted or the car swung off the line; a readout of the run, the speed and the timed kilometre, and a commentator. Ends on record day's two-way means and the declared speed against the still day's, then speed week; "Watch the replay" brings it back | **Done** (v0.9.21.0) |
| 9w | The jet car in the sim: a second record class pushed by thrust on a 14 km run-up, with a waist (area rule) that lets the air squeeze later and less until it crowds the engine, a peak drag that also shrinks with a finer nose, drag easing off past Mach 1, and a shock under the nose at Mach 1 that can lift it (Kelbo: "through the sound barrier", "a waist"). The team's stock jet tops out near Mach 0.9; a well-shaped one breaks the barrier. Saves from before keep a straight body | **Done** (v0.9.22.0) |
| 9x | The jet car on Shape (`?try=jet` to preview): its own set of sliders with the waist added on the Body tab, a wider fin range, drawn at its own scale with the waist pinched in cobalt, intakes either side and the engine's nozzle. The desk's record speed shows its Mach number; amber warnings for a car short of the barrier (change the waist), a waist past the engine's room, and a nose that goes light at the barrier | **Done** (v0.9.23.0) |
| 9y | The jet car in the tunnel: the forecast keeps Kelbo's "read low, learn the trap" (it never sees the squeeze), but now says when it ran past it: the Record forecast readout turns amber with its Mach number, the Runs tab says where the squeeze starts and that the car will run slower, and near Mach 1 warns of the shock under the nose. The Deliver sheet repeats the warning. Only when the hidden drag would be 3 % or more, so the streamliner's forecasts are unchanged | **Done** (v0.9.24.0) |
| 9z | Jet car jobs: Tikhon Shatrov's Ognivo (a fighter engine in a fuel-tank body, reputation 75) and Raisa Belova's Proryv Project (reputation 85), whose target is a two-way mean just over the speed of sound. Speed week's debrief names the squeeze (the drag the tunnel can't see) with a jump to the waist, says when the shock under the nose lifted it, and says when a car went through the sound barrier both ways. Fixes found on the way: the Deliver sheet took no speed over 1,300 km/h and wrote its starting speed with a thousands comma it couldn't read back; a record bid can now promise up to 180 km/h (other jobs keep 30 points); and a missed promise costs at most 20 reputation for the points short, so one jet car that pulls its chutes can't wipe out a career | **Done** (v0.9.25.0) |
| 9z+ | The sound barrier in the record replay: a jet car's run shows its Mach number, the replay slows from the moment it goes through the barrier, the commentator calls it with a white flash (none with reduced motion), and past Mach 1 its shock trails across the salt from the nose as a V of lines. The land-speed record (PR 9) is finished | **Done** (v0.9.26.0) |
| 10a | The racing quad in the sim (Kelbo's PR 10 answers in the plan): the body pod's length, rake and vents and the arm fairings; drag at the quad's tilt, thrust falling with speed and lost to the downwash on the arms, the controllers overheating with too few vents, corners flown on the spare thrust, and the pod's twist tumbling the quad (hardest on the brakes); a race of five laps of the Lugovoy meadow gate course | **Done** (v0.10.0.0) |
| 10b | The racing quad on Shape (`?try=quad`): drawn flying flat out at its true tilt with streaks of oncoming air; Pod (length, rake, vents) and Arms (fairings) tabs; the desk's race time against the club's quad, top speed with the tilt and the pod's angle to the air, and the worst twist against what the motors hold; a tumble, a twist near the limit and overheating vents are amber warnings with "Change this"; saves, run reports and the model shop know the quad; glossary: flying tilted, twist, downwash | **Done** (v0.10.1.0) |
| 10c | The racing quad in the tunnel, in the sim: read full size on the sting at any tilt (nose down, or tipped back as when braking) for its drag and the twist on its pod; a powered model with spinning props also reads what the downwash on the arms takes. The forecast flies the race on the readings: with the props stopped it takes the motor maker's bare-arm downwash figure, so faired arms read about a second slow (Kelbo's "props stopped" trap); with no reading that meets the pod at an angle it can't see the twist, so it misses a tumble | **Done** (v0.10.2.0) |
| 10d | The racing quad on the Tunnel screen: a full-size (1:1) model from the shop on a slim sting that tips from 30° back to 85° nose-down. Readouts for its drag, the twist on its pod (nose up or down) and the forecast race time against the club's quad; a tilt sweep plots the twist against the tilt; the Runs tab has the forecast in full, with the props-stopped warning. The sting gives past 45 N (only the bigger fan, tipped far over) | **Done** (v0.10.3.0) |
| 10e | The powered quad model: the shop's new Props option (Spinning: motors wired down the sting, ₽ 15,000 and 2 days more) spins the model's props in the tunnel, so the balance reads the downwash on the arms and the forecast stops reading faired arms slow. Each powered run costs ₽ 2,000 more. A Downwash readout; still blades on a plain model, turning ones on a powered one | **Done** (v0.10.4.0) |
| 10f | Quad jobs in the sim: three hobby pilots at the Lugovoy Club Race (Yegor Shmel's stock quad, slow on the back straight; Inna Vertel's, its vents taped over; Strizh Racing's long camera pod, which tumbles braking once it's raked up and faired). The promise is tenths of a second off the five-lap race on the course's usual day over their own quad; a quad that tumbles crashes out and gains nothing. Race day is seeded, the read is judged on drag, and the debrief names a tumble or the overheating with a "change this". Off the board until 10g | **Done** (v0.10.5.0) |
| 10g | Quad jobs on the board: the brief card (course, laps, the quad), bids in tenths of a second, "Shape the quad", and a Deliver sheet that fills the race time from the tunnel's forecast (warning if it tumbles, the twist wasn't measured, it was read raw or with the props stopped) or the desk estimate. The club-race debrief shows both races, the read, and a tumble or overheating with its "change this". No replay yet | **Done** (v0.10.6.0) |
| 10h | The quad race replay: race day's five laps from close behind your quad, the pilot's old one see-through alongside, gates over a mown line, each quad leaning forward to pull away and back to brake (the lean the race model flew). A tumble plays slowly and the quad spins down onto the grass; the replay then ends. Lap, clock, speed and gap readouts and a commentator's line. The Lugovoy course now closes on itself (it drifted 50 m a lap), and the race model finds corner speeds by a search (a wide corner could flip it to a standstill); the jobs' balance is unchanged | **Done** (v0.10.7.0) |
| 10i | Survey drones in the sim: a two-metre electric mapping plane flying survey lines at the Ozimka fields. Range on a charge from the drag at survey speed (wing, lift, fuselage, camera pod, tail, winglets, trim); the static margin from the tail, nose and camera position; a gust on a banked turn lifts the wing, more on a plane held loosely in pitch, and past the wing's most lift it stalls. The makers' plane flies about 85 km; a sensible one over 100; a cut-down tail or a long nose stalls in the usual gust. Kelbo's survey-drone choices go in the plan | **Done** (v0.10.8.0) |
| 10j | The survey drone on Shape (`?try=plane`): drawn on a stand with its nose, tail cone and tail in cobalt, a pusher motor and the camera pod under the belly. Body tab (nose length, tail cone taper, tail size) and Camera · tips tab (camera drop, fairing, slide, winglets). The sheet reads the desk's range on a charge against the client's plane, the pitch margin and weight, the strongest gust it rides out on a turn, and whether the camera sees past the belly. A gust stall, a gust near the limit, a loose margin and a camera too high are amber warnings with a "Change this". Saves and run reports know the plane. Glossary: range on a charge, winglets, gust stall | **Done** (v0.10.9.0) |
| 10k | The survey drone in the tunnel, in the sim: a plane model (1:2.5 or 1:1.5, its own scales in the model shop) read on the sting with its wing pitched to an angle of attack: drag area, lift and pitching moment, through the blockage, the sting's tare and the balance's noise. A smaller, slower model's wing flies at a lower Reynolds number: it drags more and stalls sooner, so a 1:2.5 model at survey speed says the sorted plane stalls in the usual gust (Kelbo's "small-model wing stall" trap). Trip strips, the bigger model or a faster fan (about 40 m/s matches) get out of it. The forecast reads the range from the readings at survey-like lift, the margin from the moment against the lift, and the wing's most lift only from a reading past the stall; without both it can't judge a gust | **Done** (v0.10.10.0) |
| 10l | The survey drone on the Tunnel screen (`?try=plane`): the model on a sting, a wing-angle slider in place of yaw, readouts of air speed with the model's Reynolds number against the plane's, wing angle, drag area, lift (CL) and pitch moment, plus range. The Angle sweep tab plots lift against wing angle. A run's record gives the range on a charge against the client's plane, the pitch margin, the most lift and whether the usual gust on a turn stalls it, and warns when the model's wing flew at a much lower Reynolds number than the plane's. The model shop offers the plane's scales and trip strips, with no pressure taps | **Done** (v0.10.11.0) |
| 10m | Survey jobs in the sim: Daria Kolos (the co-op's stock plane), Pashnya Mapping (a bigger camera hung bare on its full mount) and Vekha Geodata (a cut-down tail and stretched nose that spins in on the turns), all at the Ozimka fields. The promise is kilometres on one charge on the usual day over the client's plane on paper; a plane the usual gust stalls on a turn gains nothing. Seeded survey day: its air and its strongest gust on a turn, somewhere along the flight. The read is judged on drag; the debrief names a stall (tail or nose) or a camera tucked past the rule. Closed to the board until 10n | **Done** (v0.10.12.0) |
| 10n | Survey jobs on the board (reputation 30 and up): bids move a kilometre at a time, the job card says "Shape the plane" and "Survey day", and the brief card shows the site's usual gust and the client's range. The Deliver sheet declares the range on a charge, filled in from the tunnel's forecast for this design (a new planeForecast store) or the desk estimate, with warnings when the forecast stalls in the usual gust (or may have stalled early on a small slow wing), couldn't judge the gust, was read raw or below the plane's Reynolds number, or the camera sits past the client's rule. The survey-day debrief shows both flights, the read on drag, and a stall or a camera past the rule with a "change this" jump | **Done** (v0.10.13.0) |
| 10o | The survey-day highlights in 3D (Kelbo's pick): both planes side by side over the wheat from a chase camera, in clips: the launch and first line, a cut to the day's big gust on a turn in slow motion (a plane held too loosely noses up and spins into the crop), then each plane gliding down at its reserve. Readouts of the survey clock, distance flown, your battery and their plane; a strip with the gust marked. The survey lines are 600 m back and forth with half-circle turns at the plane's bank, and the day's gust now comes on one turn, the same moment for both planes (a plane already landed misses it) | **Done** (v0.10.14.0) |
| 10p | The light aircraft in the sim: speed mods on the Lastochka L-2 kit plane (wheel spats, a tighter cowl, square wingtips, strut fairings with a toe, the client's pod faired and slid fore or aft). Cruise speed is where the prop's push at cruise power meets the drag, about 175 km/h stock and 15–20 km/h more well modded. In flight the prop's slipstream blows the nose parts harder and its swirl meets the strut fairings' roots at an angle, so a prop-off model reads about 8 km/h fast (Kelbo's "no prop wash" trap). Square tips and a pod forward lift the stall speed; past the certified 85 km/h the inspector won't sign it off | **Done** (v0.10.15.0) |
| 10q | The light aircraft on Shape (`?try=aircraft`): the Lastochka L-2 standing on its wheels, the mods in cobalt (cowl, wheel spats, wingtips, strut fairings, the pod under the right wing). Nose · wheels tab (cowl tightness, wheel spats) and Wing · pod tab (square tips, strut fairings and their toe, pod fairing and slide). The sheet reads the desk's cruise speed against the client's, the stall speed against the certified 85 km/h, and whether the inspector signs it off; a stall speed over or close to the limit is an amber warning with a "Change this" to the tips or the pod. Saves and run reports know the plane. Glossary: cruise speed, slipstream, wheel spats, stall speed | **Done** (v0.10.16.0) |
| 10r | The light aircraft in the tunnel, in the sim: model scales 1:6 and 1:5 (the 1:5 wing nearly fills the test section), a sting that holds a stalled 1:5 model in the university fan but not the bigger one, readings of drag and lift through a pitch sweep, and the forecast of cruise speed and stall speed against the inspector's limit. Kelbo's trap: a plain model's prop is stopped, so the tunnel reads the plane slicker than it flies and promises a cruise about 6 km/h too fast; a powered model blows the nose as flight does, and only it finds the strut toe that meets the prop's swirl | **Done** (v0.10.17.0) |
| 10s | The light aircraft on the Tunnel screen and in the model shop: a 1:6 or 1:5 model on a pitching sting into its tail, its gear on, the prop two still blades or driven (a turning disc). Readouts: speed, wing angle (prop stopped or driven), CdA, lift, the cruise forecast against the client's plane (saying when the slipstream was left out), and the stall speed against the inspector's limit once a reading goes past it. The Runs tab gives the forecast in full. The shop offers the prop stopped or driven (₽ 2,000 more a run) and explains why the kit's wing needs no Reynolds match | **Done** (v0.10.18.0) |
| 10t | Light aircraft jobs in the sim: the Belyanka Aero Club (the kit as built), Arkady Ozerov (square tips and the pod slid forward: faster on paper, but the inspector won't sign it off) and Dalny Ferry (struts faired but toed against the prop's swirl), all at Belyanka. The promise is km/h of cruise at cruise power on the usual day over the client's plane on paper; a mod whose stall speed creeps past the certified 85 km/h never flies and gains nothing. Seeded test day: its air and both planes' cruise runs in it, plus the inspector's check. The read is judged on drag; the debrief names the tips or the pod for a stall. Closed to the board until 10u | **Done** (v0.10.19.0) |
| 10u | Light aircraft jobs on the board for a well-known firm (rep 55+), bid a km/h at a time. The brief card names the airfield, its stall limit and the client's cruise. Deliver fills in the tunnel forecast (or the desk estimate) and warns about a stopped prop, a stall past the limit, no stall read or raw readings. The test-day debrief shows both planes' cruise on the day, the inspector's stall check, and for a stall a "Round the tips" or "Slide the pod back" jump to Shape | **Done** (v0.10.20.0) |
| 10v | The light aircraft's test day in 3D (Kelbo's pick: speed runs and the stall check). First the inspector slows your plane high over Belyanka, seen side-on: the nose comes up as it slows, until the wing lets go at its stall speed and the nose drops and a wing dips, with its airspeed, nose angle and the certified 85 km/h on screen. Past the limit, a cut to it parked by the runway. Signed off, both planes fly a timed low pass over the measured kilometre from a camera plane ahead, a stopwatch on each between the two masts. Then your declared cruise next to the real one, and the debrief | **Done** (v0.10.21.0) |
| 10w | A wing-span slider for the survey drone (Kelbo, 16 Nov), on the Camera · tips tab: 1.68–2.63 m, the maker's 2.1 m. Span is added or cut at the tapered tips (drawn in cobalt), so the root chord and the model's Reynolds number stay put. A longer wing makes less drag from lift but weighs more, and the spar stiffens as it grows: the best range is about 1.1–1.15× the maker's span (around +1.7 km on a sorted plane), the longest wing gives most of that back, and a short one costs about 9 km. Older saves load with the maker's wing | **Done** (v0.10.22.0) |
| 10x | Defence clearance and secrecy in the sim (Kelbo's calls): a firm with reputation 60 and a correlation score of 70 may apply; the ₽ 250,000 fee is paid and vetting takes 42 days, then defence briefs can reach its board. Going broke, or three poor reads in a row, loses it; it may apply again 180 days later. Defence jobs count toward the correlation score but never move the public reputation or reach the legacy card. Saves keep it; older careers have never applied. Closed until the sensor-pod jobs exist | **Done** (v0.10.23.0) |
| 10y | The patrol plane's sensor pod in the sim (Kelbo's calls): the ministry's Gorlitsa P-4 flies some 9½ hours on station with its old pod; the new, bigger sensor in the old shape loses over half an hour, and a fine nose, a long tail, a fair pylon gap and a little stagger win it back and more. Under the wing the pod drags more than on its own (the squeezed air in the gap, the pylon, the trim), so a pod tested alone can't tell a tight gap from a good one. A blunt tail or a tight gap buffets the pod and blurs the sensor; the debrief can name which | **Done** (v0.10.24.0) |
| 10z | The sensor pod on Shape (`?try=pod`): the pod on its pylon under a stretch of the Gorlitsa's wing, the shaped parts in cobalt. Nose · tail tab (nose fairing, tail cone) and Pylon tab (gap, stagger). The sheet reads the desk's hours on station against the old pod's, and the buffet against the ministry's limit, with an amber warning and "Change this" to the tail cone or the pylon gap, whichever shakes it more. Saves know the pod. Glossary: hours on station, buffet | **Done** (v0.10.25.0) |
| 10aa | The sensor pod in the tunnel, in the sim (Kelbo's trap): pod models at 1:2.4 and 1:1.8 on a sting, on their own or under a stretch of wing fixed to the walls (₽ 24,000 and 3 days more). On its own the pod reads only its own drag, and the firm adds the pylon from the handbook but nothing for the gap, so a pod hung tight forecasts over half an hour more than it flies, and its shake misses the wing's share. Under the wing it reads both true | **Done** (v0.10.26.0) |
| 10ab | The sensor pod on the Tunnel screen: the stretch of wing as a model-shop choice, the pod on a sting into its tail (the wing tied to the walls above it when ordered), readings of its drag, shake, hours on station and buffet, and the forecast on the Runs tab saying whether the gap was read | **Done** (v0.10.27.0) |
| 10ac | Sensor-pod jobs in the sim: three defence briefs for the Ministry of Defence over Stepnoy (Major Tumanova's workshop pod, Captain Grachyov's tight one from a contractor who tested it alone, Ksenia Varlamova's forward one with a cut-off tail). The promise is minutes on station over their pod as it hangs now; a pod that buffets past the limit blurs the picture, the run is rejected and gains nothing. Seeded range day, the read judged on drag, a debrief naming the tail or the gap, kept as a secret job. Closed to the board until clearance opens | **Done** (v0.10.28.0) |
| 10ad | Sensor-pod jobs on the board, for a cleared firm: the brief card names the range, the buffet limit and the ministry's pod (a "Defence · secret" line), bids go a minute at a time, Deliver fills in the tunnel's forecast (or the desk's) and warns about a pod read on its own, a buffet past the limit or raw readings, and the range-day debrief shows both pods' patrols, the buffet, "Lengthen the tail" or "Open the gap", and the public name unchanged. The read is now judged on the plane's whole drag area with the pod | **Done** (v0.10.29.0) |
| 10ae | Defence clearance opens: a "Defence clearance" card on the Jobs screen shows what the ministry wants (reputation 60, correlation score 70), the ₽ 250,000 fee and the 42 days of vetting; a two-tap Apply, then the vetting date, then "Cleared"; a lost clearance says why and when the firm may apply again. A glossary entry explains it. The ministry's pod jobs now reach a cleared firm's board | **Done** (v0.10.30.0) |
| 10af | Range day from the pod's sensor (Kelbo's pick): the sensor's grey picture of the Stepnoy steppe slides under a crosshair, shaking with the pod's buffet and blurring past the limit, while both pods' clocks on station run; a blurred run is called off part-way. Then the declared hours next to the real ones, and the debrief. Plain 2D, reduced motion holds the picture still | **Done** (v0.10.31.0) |
| 10ag | PIV in the sim (Kelbo's "wake slice + hint"): a side sheet of air speed down the middle of the model and a cross slice behind it, from the same field as the smoke. The wake's depth is fitted to the drag the tunnel measured (half the drag area, spread over the slice), with a thin friction wake for what the smoke doesn't draw, so the speed-loss number and the colours always agree. The hint nudges each wake-shaping slider a little and names the one that cuts drag most (sliders for downforce, stability, cooling or lift are left out) | **Done** (v0.10.32.0) |
| 10ah | PIV on screen (Kelbo's "own-tunnel upgrade"): the PIV laser is bought for your own tunnel (₽ 900,000, 21 days). Then a PIV chip lights a colour slice of air speed down the middle of any model (one hue, dark is still air, numbered scale), the sheet shows the wake's speed loss, and the hint names the slider with most to gain, with "Change this" jumping to it on Shape. Models the smoke can't follow (jumper, cars, record cars, quads, planes, pods) get the PIV chip on its own | **Done** (v0.10.33.0) |
| 11a | Tarnovian records in the sim: a standing board of five national records (the hour, the 40 km time trial, the ski jump, land speed, a truck fleet's fuel figure), each held by a fictional name; a job whose result on the day beats one puts the client on the board for the firm, kept on the job's record so saves carry it; defence jobs never do; the legacy card counts records held. Not on screen until 11b | **Done** (v0.12.0.0) |
| 11b | The records board on screen: a Tarnovian records card on the Jobs screen (each record, its mark, who holds it and since when, and what it beat once the firm breaks it, marked "Your firm" in words), a "new Tarnovian record" box in the debrief, records held on the legacy card and its picture; a truck fleet's record goes under the fleet's name | **Done** (v0.12.1.0) |
| 11c | Record attempts: clients out to break a Tarnovian record pay a bonus (40 % of the fee) when it falls. Elena Shubina's hour attempt on the Stavren boards (52 km of laps, the distance in the hour counts; reputation 55), and the Proryv Project is now out for the land-speed record. Brief and job cards say so; the debrief shows the new record and the bonus, or that the record stands | **Done** (v0.12.2.0) |
| 11d | The R&D tree in the sim: eight projects in four areas (analysis, instruments, materials, techniques), two tiers each, paid up front and done some days later while the firm works on, one at a time. A finished project changes the firm for good through the same levers as staff traits (a narrower desk estimate, a quieter balance, cheaper or quicker models, stronger mounts), stacking with them. Saves keep it. Not on screen until 11e | **Done** (v0.12.3.0) |
| 11e | The R&D card on the Jobs screen: the four areas and their projects, each with what it changes (with its number), price and days, a Start button that asks for a second tap, which project is under way and when it's done, and what a second-tier project needs first | **Done** (v0.12.4.0) |
| 11f | Export countries in the sim: Gornova (reputation 60) and Zelenia (reputation 70) send clients once the firm's name is good enough. Each has its own cycling rulebook (Gornova allows a front disc; Zelenia wants the hands lower), its own firm bidding against you (Vershina Aero, Bereg Windworks) and two briefs: a mountain pass at 1,800 m, a large hill at 1,250 m, a hot coast road and a crosswind headland. Rides abroad never count for a Tarnovian record. Not on screen until 11g | **Done** (v0.12.5.0) |
| 11g | Export on screen: a brief from abroad carries its country's tag and a note (what the country is like, which federation's rules a rider is checked against, that results there don't count for Tarnovian records); the rival strip gains an Abroad section showing each country's firm once its clients call, or the reputation still needed; the shaping screen checks a rider against the job's own rulebook (GCU or ZCL abroad) | **Done** (v0.12.6.0) |
| 11h | Challenge codes in the sim: a `LAMD1:` design code carries a delivered rider's or skater's design, its brief (with the seed, so the day's air is the same), the career's seed and day, and the firm's name, nothing else. It opens a practice copy of that one job outside the career, from the client's own setup; the CdA to beat is worked out from the design on the day, never taken from the code. Save codes and design codes share one wrapper. Not on screen until 11i | **Done** (v0.12.7.0) |
| 11i | Challenges on screen: after a rider's or skater's job, "Challenge a friend" copies a link to it. The link (or its code pasted under Saves → Challenges) opens a practice copy that writes nowhere: a "Challenge · not saved" chip, a card with the CdA to beat, the client's setup on the bench, and in the debrief whether you beat the sender's CdA on the day (with both numbers), Try again and Back to your game. PR 11 is done | **Done** (v0.12.8.0) |
| 12a | The CFD Cluster's solver, not yet in the game: a lattice Boltzmann grid (D3Q19, BGK) with the body as solid cells, bounce-back walls, inflow upstream, free outflow, and the force by momentum exchange. A CPU reference (`src/cfd/lbm.ts`, tested on small grids: uniform flow stays uniform, a sphere drags only downstream and slows its wake, thinner air lowers Cd) and the same scheme in WebGPU (`src/cfd/gpu.ts`). In a browser the two agree to 0.004 % on the force; the full 96 × 48 × 48 grid fits | **Done** (v0.13.0.0) |
| 12b | The CFD Cluster as a tunnel upgrade (Kelbo: ₽900,000 and 21 days to fit, free to run), offered only on a phone with WebGPU; elsewhere the card says the phone can't run it and the rest of the game doesn't need it. The model's surface for the grid: the tunnel's own figure for any sport, turned to the yaw, filled by rays along all three axes (two votes of three), so open-ended lofts still fill and overlapping parts add up; parts thinner than 1.5 cells (tyres, disc wheels, tubes) become one-cell shells | **Done** (v0.13.1.0) |
| 12c | The CFD panel in the tunnel: a CFD chip once the Cluster is fitted, a free Run button, progress, the CFD drag area (scaled by the grid's own sphere calibration) and the change on the last CFD run this visit, a side-on slice of the air's speed with a numbered scale, and a stale note when the model or yaw moves on. The first batch is timed and a run that would take over two minutes stops with an estimate. Never saved or scored | **Done** (v0.13.2.0) |
| 13a | Lab sounds made in code (Kelbo: code now, ElevenLabs effects maybe later): the fan's hum and rushing air follow its speed, the turntable whirrs while it turns and knocks as it stops, and a part snaps when it breaks. Sound starts on the first tap; a speaker button in the tunnel sheet mutes it, remembered in `laminar.muted`; it pauses in the background | **Done** (v0.14.0.0) |
| 13b | The first Blender model: the university test section (chamfered corners, panel seams, framed windows, light troughs, the inlet screen, the fan with its nacelle and stators), scripted in `art/tunnel/build.py` and loaded over the code-drawn box, which stays as the fallback. The `art` workflow builds and commits the models in Actions; a test checks they match the scripts | **Done** (v0.14.1.0) |
| 13c | The Credits sheet (from the shape sheet's footer): the studio block in Longlight colours, typefaces, code, models, sound and the setting; a test keeps it and `CREDITS.md` in step. The voice pack's script sheet and cast in `docs/voice/` (60 lines, quoted, approved and generated on ElevenLabs; takes not yet picked) | **Done** (v0.14.2.0) |
| 13d | Your own tunnel gets its own Blender model: the same size as the university's (the sim says they match) but newer, with one long panoramic window, light panels across the ceiling, a cobalt trim line, yaw marks round the turntable and a nine-blade fan with a cobalt ring. The tunnel screen loads the section for the tunnel in use and swaps when you move | **Done** (v0.14.3.0) |
| 13e | The Isobar look begins (`docs/UI-ISOBAR-PLAN.md`, the brief's 13a): the new colour tokens in both themes, Bricolage Grotesque and Geist Mono in place of Instrument Sans and Spline Sans Mono, the lowercase wordmark over its Cp bar, Jobs / Shape / Tunnel in a floating bottom dock with icons, and the money chip and Saves up in the top-right row | **Done** (v0.14.4.0) |
| 13f | Isobar surfaces and controls (the brief's 13b): the tunnel and shape sheets become a clear column of rounded cards; tabs and segmented controls share one pill style, and the tunnel's view tabs scroll sideways; chips over the view are 44px white pills; every slider gets a teal fill to a ringed thumb (`src/ui/range.ts`); primary buttons are dark 52px pills with a press feel; Irina's card gets her initials, a speech bubble and steps 01–07; a reputation ring on the firm strip; charts draw in the pressure colours; faint isobars behind the Jobs page | **Done** (v0.14.5.0) |
| 13g | The fan and yaw dials (the brief's 13c, `src/ui/dial.ts`): a semicircle to drag along, − / + steppers that repeat when held, and the native range kept underneath, hidden but focusable, so the keyboard and screen readers work. The fan's dial fills teal to the set speed with a thin mark for the actual speed; the yaw dial points a needle, and a tap on its value squares on. Off is a coral-outlined stop button. The sheet now scrolls inside itself so the 3D view keeps the top of the screen on shorter phones | **Done** (v0.14.6.0) |
| 13h | The 3D scenes take the Isobar look (the brief's 13d): every scene colour in `src/render/theme.ts`, light and dark, and the lab, the Shape bench and the field skies follow the phone's dark mode, even when it flips mid-game. The Dark wall goes near-black in dark mode. Models wear a matte "model shop" finish (indigo suit, teal shaped parts, coral when broken); Shape handles are white dots in a teal ring and the rule box is teal. A rounded frame in the page colour turns each 3D view into a card | **Done** (v0.14.7.0) |
| 13i | Pressure colour on the model (the brief's 13e, `src/render/cpSurface.ts`): while the Cp taps are on, the model's skin wears the latest scan, each vertex blending its four nearest taps and fading back to matte away from them, with thin isobar lines at each legend tick (skipped on four-core phones). Recoloured only when a new scan arrives. The Cp scale moves to the look's blue and coral (checked under three colour-blind simulations), and the legend becomes a white pill with an 8px bar and numbered ticks, top right | **Done** (v0.14.8.0) |
| 13j | Isobar's last pass (the brief's 13f): a new app icon (Kelbo picked the navy tile with a Cp-shaded ball), the manifest's theme colour, the PIV and CFD slices retinted deep indigo to pale teal (lightness still carries the speed), the replay's title and panel as Isobar pills and cards, the boom flash as a token, and the 3D screens' backdrop in `--scene`. Every other sheet already wore the new tokens. Screenshots of both themes in `docs/screenshots/` | **Done** (v0.14.9.0) |
| 14a | Offline play: a service worker keeps every built file in a `laminar-` cache named after a hash of the build, so the game opens with no signal; voice lines are cached on first play (`laminar-voice-1`). A new version waits for the player: a bar above the dock says it's ready, and Reload saves the career, then swaps. It only ever deletes `laminar-` caches. `?nosw` removes the worker and its caches. The Credits sheet says whether this copy works offline | **Done** (v0.15.0.0) |
| 14b | The voices: Kelbo's picks (take 2 of all 60 lines) in `public/voice/`, played one at a time through the game's sound with a caption. The tech (Basov or Krasna) calls the fan, the sweeps, the tare, the sphere, strain, flutter, breaks and smoke; the analyst (Zhelin or Sorokova) weighs compared runs, early separation on the tufts, the promise and the road's read; each is heard only once hired. The client speaks as a job starts, on the day and at the debrief; the commentator over every replay. Files load on first play, never in the first load; mute silences them | **Done** (v0.15.1.0) |
| 14c | The balance bot: `npm run balance` plays whole careers headless (a careful player whose tunnel tells the truth: it shapes each client's setup on practice days, bids its worst day less a margin, pays for a model and runs, builds its own tunnel, applies for clearance) and prints every brief's reachable cut against the ask, cash and reputation by year, each sport's share and pay, and flags. Nothing in the game changes. First findings in `docs/BALANCE.md` | **Done** (v0.15.2.0) |
| 14d | Balance, Kelbo's picks from the bot's report: reputation gains and losses about a sixth of what they were (top clients in about three years, not one), bolder rivals (Bystro promises the ask plus 3 to 8), pod and jet fees 20% lower, the small brief ₽25k more. An illegal cyclist or bobsled can no longer be delivered: the Deliver sheet says so and Shape lists what to change. The bot shapes for its worst day, ranks jobs by profit and scouts wider | **Done** (v0.15.3.0) |
| 13k | The velodrome is a Blender model (`art/velodrome/build.py`): pine boards in two tones with the black, red and blue lines, banking that rises outside the riders to 3.4 m at the middle of each bend, the pale blue band and the apron, a barrier and rail, sixteen rows of stands all round, the infield's warm-up lane, six team pens, the officials' desk, a podium and a photo-finish mast on the line. It is built on the replay's own lap, so the riders stay on the boards (a test checks it against `TRACK`); the code-drawn boards stay as the fallback, and the 400 m ice oval keeps them | **Done** (v0.15.4.0) |
| 13l | The ski-jump hill's buildings are a Blender model (`art/skijump/build.py`): a deck down the in-run and table with an ice track for each lane, side walls and the red lip, the start house with its bar, the judges' tower, the coaches' stand, floodlight masts, a grandstand at the outrun and the fence along the slope's far edge. The slope stays in code (the sim shapes it per hill); the jump scene places each piece on whichever hill is in use, and the hill is bare snow until they load | **Done** (v0.15.5.0) |
| 13m | The circuits' trackside is a kit of Blender pieces (`art/circuit/build.py`): the start gantry and its lights, the chequered line, 150 m of pit garages behind the pit wall, a 100 m grandstand, a footbridge, steel barriers both sides of the lap, red-and-white kerbs on the inside of every corner and marshals' posts. Each circuit's lap comes from its corners, so the race-lap replay stands the pieces along whichever lap is raced, copied by instancing (one draw per piece), with the numbers in `CIRCUIT_KIT` | **Done** (v0.15.6.0) |
| 13n | The salt flat's camp and course furniture are Blender pieces (`art/saltflat/build.py`): the team's transporter, awning, motorhomes and fuel bowser by the start, the timekeepers' trailer and the timing-light posts at each end of the timed kilometre, kilometre boards, orange posts along both edges of the course, a viewing area by the middle of the kilometre and the recovery truck where the cars stop. The record replay stands them along each run (both directions), with the numbers in `SALT_KIT` | **Done** (v0.15.7.0) |
| 13o | Belyanka airfield's buildings are Blender pieces (`art/airfield/build.py`): the apron and taxiway, three hangars, the flying club's clubhouse, the control tower, four parked light planes and a fuel truck, threshold bars at each end of the runway, edge lights down both sides and a windsock by the measured course. The kit-plane replay stands them round the runway, with the numbers in `AIRFIELD_KIT`; the field side is on the left, away from the check's side-on camera, so the passes' camera sees it as it looks back | **Done** (v0.15.8.0) |
| 13p | The Belogor sliding track's buildings are Blender pieces (`art/bobsled/build.py`): the covered start house the crew push out of, timing arches with their clocks at the end of the push and at each split, a sun roof over the long horseshoe, a spectator terrace with its crowd on the outside of every curve not under the roof, floodlight masts, the chequered finish arch, and past the line the outrun, the finish house, its scoreboard and a small stand. The channel stays in code; the sled scene stands the pieces along it, with the numbers in `SLED_KIT`, and a test checks the pieces are built round the same channel | **Done** (v0.15.9.0) |
| 13q | The people are smooth Blender parts that code still poses (Kelbo's pick): `art/body/build.py` makes a thigh, shin, upper arm, forearm, torso (waist, chest, shoulders), gloved hand, head with a jaw and nose, cycling shoe, skating boot, a vented road helmet and a full-face sliding helmet. `riderFigure` lays each part between the joints the pose gives (scaled to the joints and the old thickness, the front facing the knee's or the chest's side) for the cyclist, skater, ski jumper and bobsled crew. They load once at start-up (waiting at most 2.5 s); until then, or offline with an old cache, each part is the capsule it was. The tests never load them, so the sim and its checks are untouched | **Done** (v0.15.10.0) |
| 13r | The sound-effects pack (Kelbo said yes to the quote: about 496 credits, roughly CA$0.13): 18 effects from ElevenLabs' sound generator, two takes each, the better kept and levelled (`public/sfx/`, 860 KB, fetched after the first tap and cached for offline like the voices). The lab: the tunnel's air under the code-made hum, following the fan; the spin-up; the turntable's clunk and a model's snap (the code-made ones until loaded); the smoke; the model shop on an order or repair; a new brief; the fee as the debrief opens. The replays: the bike, the ski jumper's flight and landing, the sled's runners (looped to the finish), the cars, trucks, planes, drones, the streamliner and the jet car, and a crowd cheering the sports finishes. `src/data/sfx.ts` holds the list and which replay note plays what | **Done** (v0.15.11.0) |
| 13s | The music bed (Kelbo said yes to the quote; it came to about 4,660 credits, roughly CA$1.15): two instrumental loops from ElevenLabs Music, two takes each, the steadier kept (`public/music/`, 1.8 MB, fetched after the first tap and cached for offline). A calm 90-second lab loop plays on every screen; an upbeat 60-second one takes over while a replay runs, fading across. Each loop overlaps its passes by 3 s so there's no seam. A music chip beside the sound chip turns it off (remembered in `laminar.music`); muting the sound silences it too. At 360 px the Tunnel sheet's foot now wraps, so its hint is readable again | **Done** (v0.15.12.0) |
| 13t | More 3D detail: the open road gets its roadside (`art/road/build.py` → `public/models/road.glb`, 203 KB, fetched with the time-trial and truck replays). Three kinds of tree line both verges, set back and sized by a hash of their place; kilometre posts, route signs, farms, villages and wind turbines stand along the way, kept clear of the road where an out-and-back course passes again. A time trial gets a start ramp (left out where the course finishes at its start), a finish arch stretched to the road's width and a crowd behind barriers for the last 120 m; a fuel run starts at a truck stop and ends at a warehouse. Every number is in `ROAD_KIT` | **Done** (v0.15.13.0) |
| 13u | The sound, in step (Kelbo: "make sure it all meshes and syncs properly and in time"). Measured first: in a real browser, every replay's notes against every sound that started, on one clock. **Timing:** the client's "data's in" line moved from the replay's first second to the Deliver sheet, so it no longer pushes the commentator 3–4 s behind the picture; the commentator now goes first (he cuts in over other speech with a quick fade, waits only for his own call that's nearly done, and drops a call that would land late), and his lines are fetched when the Deliver sheet opens. Every call now starts within about 0.3 s of its moment (it was up to 3.9 s). Two moments in one frame both get their sound (the race car's engine and "Here we go" were being skipped). The music, the sled's runners and the fee's chime switch the instant a replay opens or closes, not on a half-second check. **Words:** a dead-level halfway is no longer called "behind", and the record's "Across the line!" is said as the car leaves the timed kilometre, not as it enters. **Mix:** the 60 voice lines are levelled to -20 LUFS (they ranged over 12 dB; the engineer was nearly as quiet as the effects); voice, effects and music each have a bus, the music and effects step back while anyone speaks, and a limiter guards the phone's speaker. The audio cache is now `laminar-voice-2`, so phones fetch the levelled lines | **Done** (v0.15.14.0) |
| 13v | More 3D detail: the Lugovoy meadow round the quads' gate course (`art/meadow/build.py` → `public/models/meadow.glb`, 118 KB, fetched with the quad replay). Launch pads at the start, the pilots' gazebo with its race screen and a timing tower beside the line, spectators under a parasol, the club hut with its limp windsock and members' cars, round bales on the outside of every turn, bunting along the long straights and a ring of trees round the field. The mown line and gates stay in code. The road's "keep it off the course" helpers are now shared (`courseTools`). Every number is in `MEADOW_KIT` | **Done** (v0.15.15.0) |
| 13w | More 3D detail: the Ozimka fields under the survey planes (`art/fields/build.py` → `public/models/fields.glb`, 159 KB, fetched with the survey replay). Hedges round the field with oaks standing in them, the farm track and a wooden power line beyond the west hedge, the co-operative's yard (big barn, machine shed and tractor, farmhouse, grain bins and the grain leg) straight ahead at the launch beyond the east hedge with a poplar shelterbelt, and in the next fields a combine at work, stacked bales or a hay shed every so often. The wheat and its rows stay in code. Every number is in `SURVEY_KIT`. Also drops a duplicate copy of the trees in `art/meadow/build.py` (the model is unchanged) | **Done** (v0.15.16.0) |
| 13x | More 3D detail: the Stavren Ice Oval for the 400 m skating races (`art/iceoval/build.py` → `public/models/iceoval.glb`, 300 KB, fetched with an ice-oval replay the way the velodrome is with a track race). Flat ice on the replay's own lap: the warm-up lane, the inner and outer racing lanes with the lane line (none on the crossing straight), rubber blocks through the bends, the finish line, blue crash pads, teal stands and the hall wall; in the infield a rink with its boards, team pens, the officials' desk and podium, the lap board, the photo-finish mast and an ice resurfacer. The replay's loader now serves either hall. The Lake Dolgo marathon loop is still drawn in code | **Done** (v0.15.17.0) |
| 13y | More 3D detail: Lake Dolgo round the ice marathon's ploughed loop (`art/lake/build.py` → `public/models/lake.glb`, 144 KB, fetched with an ice race that isn't on an oval). The plough's snowbanks along every side (stopping short of the corners) with spruce branches stuck in them, the finish banner on the outside of the corner where the loop starts and ends, the warming hut with its smoking stovepipe, the plough, people in winter coats near the finish, ice-fishing shacks out on the lake and a shore of snowy spruces all round. Fixes the lake borrowing the open road's farms and roadside trees. Every number is in `LAKE_KIT`. Every venue now has its Blender kit | **Done** (v0.15.18.0) |
| 13z | Copy fix: the Deliver sheet and the replay's verdict no longer say "the road" for the velodrome, the ice oval or Lake Dolgo. They now say what the CdA will read, and did read, "on the day". The spoken lines that mention the road are unchanged (re-recording them costs credits) | **Done** (v0.15.18.1) |
| 13aa | Phone pass at 360 px, light and dark, walking the guided first job from the bid to the debrief. Two fixes: during a job the money-and-days chip slid over the title card ("University tunnel · test section"), so the title card now measures the chips and keeps clear of them, and the chips are a little slimmer on narrow phones; and a spoken line's caption covered the open sheet's inputs (the bid results, the Deliver prediction box), so with a sheet open it now sits up top over the dimmed screen, as it does in a replay. | **Done** (v0.15.18.2) |
| 13ab | Four voice lines said "road" but play at every venue (the velodrome, the ski jump, the airfield…). Re-recorded on ElevenLabs with the same voices (Kelbo approved the quote: 398 credits, about CA$0.10), levelled to -20 LUFS like the rest: Zhelin's two debrief lines ("On the day, it read close to the tunnel. Good work." / "On the day, it didn't match the tunnel. Let's find out why."), Sorokova's ("It held up on the day! I knew it.") and the manager's race-day line ("You promised. Let's see if it holds up out there."). Take 2 of each; new file names (`_t4`) so phones that saved the old lines offline fetch the new ones. The commentator's truck line keeps its road: trucks run on one. | **Done** (v0.15.19.0) |
| 13ac | Phone pass on the late-career board (staff, workshop, your own tunnel, R&D, defence, records, rivals) and the Saves sheet, light and dark, at 360 px. One fix: a percentage or a ruble amount could wrap away from its number ("the desk estimate is 60" / "% narrower"), so every game text now keeps "60 %" and "₽ 600" together. Three more bits of shared text that said "road" at every venue now don't: the debrief's "Road CdA" reads "CdA on the day", Bystro Aero's blurb and the mesh screens upgrade. | **Done** (v0.15.19.1) |
| 13ad | Phone pass on a fresh career's screens (board, bid, Shape, Tunnel) and on the end of a job at each venue (Deliver, replay, debrief), light and dark, at 360 px. Fixes: the small grey line under a reading ("±0.039 · wind-averaged CdA", "Full size · 1:2 · uncorrected") was cut off with "…" and now wraps; your own tunnel's power cost keeps "no run fee" on one line. | **Done** (v0.15.19.2) |
| 13ae | The coloured stripe down the left edge of six boxes (race-day trouble, going broke, a new record, your row on the records board, the challenge card and result, the backup reminder) becomes a thin border all the way round with a faint tint, like the "Promise kept" box: the Isobar look has no left-stripe cards. The "Challenge a friend" box on the debrief was red like trouble; it's teal now. | **Done** (v0.15.19.3) |
| 13af | The money chip (top right) writes millions as "₽12.3M" rather than "₽12,345k", and the Tunnel title reads "Tunnel · university" or "Tunnel · your own" (was "University tunnel · test section"), like "Jobs · Stavren" and "Shape · …". With a rich (or deep in debt) firm the title card was squeezed to three lines on a 360 px phone; it's two at most now. | **Done** (v0.15.19.4) |
| 13ag | Two new commentator lines, so the finish fits what the job is judged on. Riders and skaters (judged on drag): "Across the line! Now, what did the drag really do?" Trucks (judged on fuel): "That's the run done. Let's see what it burned." Cars, sleds, drones and record cars, judged on time or speed, keep "Across the line! Let's see the time." Recorded on ElevenLabs with the same commentator voice (Kelbo approved the quote: 199 credits, about CA$0.05), take 2 of each, levelled to -20 LUFS like the rest. | **Done** (v0.15.20.0) |
| 13ah | Feels more like an app on a phone: a quick double tap no longer zooms the page, and taps no longer select text or open the long-press copy menu. Text boxes (save codes, names, the glossary search) still select and copy. Pinch zoom still works. | **Done** (v0.15.21.0) |
| 13ai | Quick tutorial: five swipe cards (Welcome, Jobs, Shape, Tunnel, Deliver) in a bottom sheet, shown once to a new player before the first job (`laminar.tourSeen`), then Irina's guided first job takes over. Swipe or use Back and Next; the dots carry a "2 / 5" number. "How to play" on the Shape sheet opens them again. Never shows in a preview or challenge link, or on a save that already has a job | **Done** (v0.15.22.0) |
| 13aj | Bidding retune from a playtest (7 bids lost in a row). The bid sheet starts at the posted fee and the client's ask, and against Bystro Aero's promise of 3–8 points over the ask that bid never won (0 %; +5 points won 44 %). Bystro now promises 0.9–4.5 over the ask (Kelbo: 1–5, then 10 % softer): the ask at the posted fee wins 8 %, +3 points 59 %, +5 points 91 %, the ask at the lowest price 36 %. The bid sheet now says rivals promise a little more than the ask: beat them on promise or on price | **Done** (v0.15.23.0) |
| 13ak | From the studio security cycle (Kelbo's picks, 18 November 2026): the cookieless Cloudflare Web Analytics beacon every Longlight game carries, as the last script in `index.html` (visits and load speed; no cookies, nothing about the player or the saves), with `CLAUDE.md`, the plan and `CREDITS.md` saying so; and `.github/dependabot.yml`, one grouped pull request a month for minor and patch updates (majors and three.js by hand). Nothing changes in play. | **Done** (v0.15.23.1) |
| 13al | Bidding at low reputation (Kelbo: "still hard with low rep"). Measured first: at reputation 20 or less, the bid the sheet opens with (the client's ask at the suggested fee) won 8 times in 100 against Bystro Aero, and it took 3 points over the ask to win 6 in 10. Two changes, both Kelbo's picks. Bystro now promises 0–3 points over the ask all career long (was 0.9–4.5). And every rival goes easy on a firm nobody knows: at reputation 20 or less its promise drops a point (Bystro: 1 under the ask to 2 over), fading in a straight line until it's gone at reputation 40 (`RIVAL_EASE` in `src/data/rivals.ts`). For a new firm on Bystro-only jobs the opening bid now wins 43 %, 1 point over 64 %, 2 over 83 %, and the ask at the lowest price 93 %; at reputation 40 the opening bid wins 31 %. The bid sheet tells a new firm that rivals don't try hard against a new name and will bid harder as its reputation grows. Vysota Aerolab's own numbers are unchanged, so the big jobs it bids for are still a contest | **Done** (v0.15.24.0) |
| 13am | Smoother scrolling (Kelbo: "weird scrolling and cutoff sections"). On Shape and Tunnel a small scrolling box sat inside the scrolling sheet (the sliders, the Runs and Calibrate lists), so a swipe often moved the wrong one or stopped dead at its end; now the sheet is the only thing that scrolls there, and its height doesn't change between tabs. Scrollers get soft edges (`src/ui/scrollFade.ts`): once you scroll, cards fade out at the sheet's top instead of being sliced by a hard line, the Jobs page fades out before it reaches the money and Saves chips, and both fade where the dock floats. Pop-up sheets fade their text under the title. Built and checked at 360 × 640 and 390 × 844 | **Done** (v0.15.25.0) |
| 13an | Blender pass, part 1 (Kelbo: "a big Blender pass", both the things you test and the venues, in a series, up to about 8 MiB): the bike's own parts are Blender models (`art/bike/build.py` → `public/models/bike.glb`, 520 KB). Two frames with their fork, seat post, dropouts, bottle bosses and bottom-bracket shell (round tubes, and Kamm-tail tubes as deep and thin as the old squashed ones); the tyre, shallow and deep rims, the lenticular disc, the hub, and spokes laced to the sim's counts (20 radial at the front, 24 crossed at the back); a time-trial saddle on its rails; a 54-tooth chainring and spider, crank arms, clipless pedals, an 11-speed cassette, the chain and both derailleurs; the headset, the stem, the aero base bar, arm pads, and drop bars with their hoods. `src/render/partKit.ts` loads a kit of parts at start-up alongside the body parts; until it's in, the bike is drawn in code as before. What follows the rider stays in code: the aero extensions run to the hands, the crank arms turn to the feet, and the drop bars sit where the hands rest on the hoods, as wide as the arms, with the stem reaching them. The frame's points go into the file and a test checks them against `FRAME` and `SKELETON` | **Done** (v0.15.26.0) |
| 13ao | Blender pass, part 2: the winter sports' fixed parts (`art/winter/build.py` → `public/models/winter.glb`, 86 KB). The speed skater stands on long-track clap skates (a 1.1 mm steel blade with a hair of rocker, the tube along its top, the heel cup, the front cup with its clap hinge and spring, and the plates under the boot). The ski jumper's skis have a shovel that turns up past the tip, the stripe down the top and a binding where the boot sits. The bobsled runs on proper runners (a rockered steel blade curling up at the front, on a carrier with its upright), an axle across each pair, fold-out push handles on the hull's sides (a second pair for a four-crew), the push bar across the open back, and the driver's steering rings in the driver's hands. The kits' shared building blocks moved to `art/kitlib.py` (the bike builds byte for byte the same). `?try=skater` opens a skater, to check the skates on a phone | **Done** (v0.15.27.0) |
| 13ap | Blender pass, part 3: the vehicles' fixed parts (`art/vehicles/build.py` → `public/models/vehicles.glb`, 345 KB). Racing cars roll on low-profile tyres with ten-spoke rims, centre-lock nuts and brake discs; the single-seater's driver wears a proper helmet and visor (now sitting on the tub, not sunk in it) under a halo, and both cars have wing mirrors. The touring car gets headlights and tail lights, set on its shell's real surface, and its shell is closed at the nose and tail. The truck has truck wheels (steel rims, ten nuts, hub caps), a grille, bumper, headlights, proper mirrors and fuel tanks behind the cab. The record cars run on solid aluminium wheels; the jet car's intakes are open mouths with the engine's fan inside (moved out to touch the body), its nozzle has petals, and the parachute canister has a lid. The sensor pod's window is a faceted pane in a frame | **Done** (v0.15.28.0) |
| 13aq | Blender pass, part 4: the aircraft's fixed parts (`art/aircraft/build.py` → `public/models/aircraft.glb`, 157 KB). Tunnel models get real props, twisted and tapered: three blades on the racing quad, two on the light aircraft. The quad stands on brushless motors (mount, bell, prop nut) and looks out through a camera lens; the survey drone has an outrunner pusher motor and a lens on its camera pod. The light aircraft rolls on balloon tyres with hubs, has a curved windscreen, and red and green wingtip lights | **Done** (v0.15.29.0) |
| Next | | The Blender pass goes on: polish for the venues and both tunnels. |

## Versions

- **0.10.26.0** (PR 10aa): the sensor pod in the tunnel, in the sim only.
- **0.10.27.0** (PR 10ab): the sensor pod on the Tunnel screen.
- **0.10.28.0** (PR 10ac): sensor-pod (defence) jobs in the sim.
- **0.10.29.0** (PR 10ad): sensor-pod jobs on the board (seen once clearance opens).
- **0.10.30.0** (PR 10ae): defence clearance opens.
- **0.10.31.0** (PR 10af): the sensor pod's range day from its sensor.
- **0.10.32.0** (PR 10ag): PIV's wake slices, speed loss and hint, in the sim only.
- **0.14.1.0** (PR 13b): the tunnel's test section is a Blender model.
- **0.14.2.0** (PR 13c): a Credits sheet; the voice pack is recorded, waiting for picks.
- **0.14.3.0** (PR 13d): your own tunnel has its own look.
- **0.14.4.0** (PR 13e): the Isobar look begins: new colours, fonts and a bottom dock.
- **0.14.5.0** (PR 13f): Isobar cards, pills, sliders and buttons.
- **0.14.6.0** (PR 13g): the fan and yaw dials.
- **0.14.7.0** (PR 13h): the 3D scenes take the Isobar look and follow dark mode.
- **0.14.8.0** (PR 13i): pressure colour on the model, the new Cp scale and legend.
- **0.14.9.0** (PR 13j): the new app icon, the slices retinted, the last screens; Isobar is done.
- **0.15.0.0** (PR 14a): the game works offline, and asks before updating.
- **0.15.1.0** (PR 14b): the voices: tunnel techs, analysts, clients and the commentator.
- **0.15.2.0** (PR 14c): the balance bot, for checking the economy (nothing changes in play).
- **0.15.29.0** (PR 13aq): the quad, survey drone and light aircraft get Blender props, motors, lenses, wheels, a curved windscreen and wingtip lights.
- **0.15.28.0** (PR 13ap): the cars, truck, record cars and sensor pod get Blender wheels, helmets, mirrors, lamps, cab parts and engine details.
- **0.15.27.0** (PR 13ao): clap skates, jumping skis and the bobsled's runners, handles and steering rings are Blender models.
- **0.15.26.0** (PR 13an): the bike is a Blender model: frames, wheels, saddle, chain and gears, stem and bars.
- **0.15.25.0** (PR 13am): smoother scrolling, with no boxes scrolling inside boxes and soft edges instead of cut-off cards.
- **0.15.24.0** (PR 13al): bids are easier to win while your reputation is low, and a little easier all career.
- **0.15.23.1** (PR 13ak): the studio's visit counter and monthly update PRs (nothing changes in play).
- **0.15.23.0** (PR 13aj): softer rival bids, and a bidding hint.
- **0.15.22.0** (PR 13ai): quick tutorial, five swipe cards for new players.
- **0.15.21.0** (PR 13ah): no double-tap zoom, no text selection on taps.
- **0.15.20.0** (PR 13ag): two new commentator finish lines, for drag-judged jobs (riders, skaters) and fuel-judged ones (trucks).
- **0.15.19.4** (PR 13af): the money chip shows millions as ₽…M; the Tunnel title is "Tunnel · university" / "Tunnel · your own", so the title card stays at two lines.
- **0.15.19.3** (PR 13ae): left-stripe boxes get a full thin border and tint; the challenge box is teal, not red.
- **0.15.19.2** (PR 13ad): phone pass: the small line under a reading wraps instead of being cut off; "no run fee" stays on one line.
- **0.15.19.1** (PR 13ac): phone pass: a percentage or ruble amount no longer wraps away from its number; three more "road"-only phrases fixed.
- **0.15.19.0** (PR 13ab): four voice lines re-recorded so they no longer say "road" at venues that aren't one.
- **0.15.18.2** (PR 13aa): phone pass: the title card keeps clear of the money chip, and a voice caption no longer covers an open sheet.
- **0.15.18.1** (PR 13z): the Deliver sheet and replay verdict say "on the day", not "the road", so they fit the track, the oval and the lake.
- **0.15.18.0** (PR 13y): Lake Dolgo: snowbanks, spruce markers, a warming hut, fishing shacks and a snowy shore round the ice marathon.
- **0.15.17.0** (PR 13x): the Stavren Ice Oval: lanes, lane blocks, crash pads, stands and an infield rink.
- **0.15.16.0** (PR 13w): the survey fields: hedges, oaks, a farm track, a power line, the co-operative's farmyard, poplars, and a combine at work next door.
- **0.15.15.0** (PR 13v): the drone club's meadow: pilots' tent, timing tower, spectators, hay bales, bunting and trees.
- **0.15.14.0** (PR 13u): the sound in step: the commentator on time, voices levelled, music and effects stepping back for speech.
- **0.15.13.0** (PR 13t): the open road gets trees, farms, villages, wind turbines, a start ramp and a finish arch.
- **0.15.12.0** (PR 13s): music: a calm loop in the lab, an upbeat one in the replays, with its own on/off chip.
- **0.15.11.0** (PR 13r): sound effects: the tunnel's air, the shop, the fee, and the crowd and engines in the replays.
- **0.15.10.0** (PR 13q): the people get smooth bodies, helmets, gloves and shoes.
- **0.15.9.0** (PR 13p): the bobsled run gets its start house, timing arches, crowds and finish.
- **0.15.8.0** (PR 13o): Belyanka airfield gets its hangars, tower and runway lights.
- **0.15.7.0** (PR 13n): the salt flat gets its camp and course furniture.
- **0.15.6.0** (PR 13m): the circuits get their trackside.
- **0.15.5.0** (PR 13l): the ski-jump hill gets its buildings.
- **0.15.4.0** (PR 13k): the velodrome is a Blender model.
- **0.15.3.0** (PR 14d): balance from the bot's report, and illegal designs can't race.
- **0.14.0.0** (PR 13a): lab sounds made in code, with a mute button.
- **0.13.2.0** (PR 12c): the CFD panel in the tunnel: run it, read its drag and see the flow.
- **0.13.1.0** (PR 12b): the CFD Cluster upgrade, and the model as cells for its grid.
- **0.13.0.0** (PR 12a): the CFD solver (CPU reference and WebGPU), not yet
  in the game.
- **0.12.8.0** (PR 11i): challenges on screen: share a link after a job, open
  one from a friend as a practice copy, and see whether you beat their CdA.
- **0.12.7.0** (PR 11h): challenge codes (`LAMD1:`) and the practice copy, in
  the sim only.
- **0.12.6.0** (PR 11g): export on screen: country tags and notes on briefs,
  the Abroad rivals, and each country's rulebook on the shaping screen.
- **0.12.5.0** (PR 11f): export countries in the sim (Gornova and Zelenia,
  their rulebooks, firms and four briefs). Nothing new on screen yet.
- **0.12.4.0** (PR 11e): the R&D card on the Jobs screen. Start a project
  with two taps; the card says what it changes and when it's done.

- **0.12.3.0** (PR 11d): the R&D tree in the sim. Eight projects, paid in
  money and days, one at a time; a finished one works like a staff trait
  and stacks with the staff's. Nothing on screen yet.

- **0.12.2.0** (PR 11c): record attempts. Elena Shubina wants the hour
  record; the Proryv Project wants the land-speed record. Break it on the
  day and the client adds a 40 % bonus.

- **0.12.1.0** (PR 11b): the Tarnovian records board on the Jobs screen, a
  "new record" box in the debrief when a job breaks one, and records held
  on the legacy card.

- **0.12.0.0** (PR 11a): Tarnovian records in the sim. Five standing national
  records with fictional holders. A job that beats one on the day (a fast
  40 km time trial, a long jump on the large hill, a jet car's two-way mean,
  a truck's fuel figure, or an hour attempt once those briefs come) puts the
  client's name on the board for the firm. Nothing on screen yet.

- **0.10.33.0** (PR 10ah): PIV on screen, bought as an own-tunnel upgrade.
- **0.10.25.0** (PR 10z): the sensor pod on the Shape screen.
- **0.10.24.0** (PR 10y): the patrol plane's sensor pod in the sim only.
- **0.10.23.0** (PR 10x): defence clearance and secrecy in the sim only.
  Nothing new to see on the phone yet.
- **0.10.22.0** (PR 10w): a wing-span slider for the survey drone.
- **0.10.21.0** (PR 10v): the light aircraft's test day plays in 3D: the
  inspector's stall check, then the timed passes over the measured kilometre.
- **0.10.20.0** (PR 10u): light aircraft jobs on the board once the firm is
  well known: bid, shape the kit plane, Deliver, and the test-day debrief.
- **0.10.19.0** (PR 10t): light aircraft jobs in the sim only. Nothing new to
  see on the phone yet.
- **0.10.18.0** (PR 10s): the light aircraft in the tunnel. Open
  `?try=aircraft`, tap Tunnel, run the fan and pitch the wing past the stall.
- **0.10.17.0** (PR 10r): the light aircraft in the tunnel, in the sim
  only. Nothing new to see on the phone yet.
- **0.10.16.0** (PR 10q): the light aircraft on Shape. Open
  `?try=aircraft`, tap Shape, and try the sliders.
- **0.10.15.0** (PR 10p): the light aircraft's flight model, in the sim
  only. Nothing new to see on the phone yet.
- **0.10.14.0** (PR 10o): the survey-day highlights. Deliver a survey job
  and watch: the launch, a cut to the big gust on a turn, then the planes
  gliding down at their reserve, about 20 seconds in all. Skip jumps
  straight to the debrief.
- **0.10.13.0** (PR 10n): survey jobs on the board. In a career with
  reputation 30 or more, look for Daria Kolos, Pashnya Mapping or Vekha
  Geodata on the Jobs tab. Bid, shape the plane, pitch a model through a few
  angles in the tunnel, then Deliver: the range fills in from the tunnel's
  forecast. Survey day shows both planes' flights, and a stall says what to
  change.
- **0.10.12.0** (PR 10m): survey jobs in the sim only. Nothing new to see on a
  phone yet; they come to the board in 10n.
- **0.10.11.0** (PR 10l): the survey drone in the tunnel. Open
  `laminar.longlight.games/?try=plane`, tap Tunnel, set the fan, then slide the
  wing angle up past 12°: lift climbs, then falls away at the stall. Open Angle
  sweep for the lift chart and Runs for the range and gust verdict. At 16 m/s
  the small model stalls early; try 40 m/s or trip strips from the model shop.
- **0.10.10.0** (PR 10k): the survey drone in the tunnel, in the sim only.
  Nothing new to see on a phone yet; the Tunnel screen shows it in 10l.
- **0.10.9.0** (PR 10j): the survey drone on Shape. Open
  `laminar.longlight.games/?try=plane`, tap Shape, and move the sliders: a
  longer nose and a finer tail cone fly further, but a smaller tail or a long
  nose loosens the pitch margin until a gust on a turn stalls it.
- **0.10.8.0** (PR 10i): survey drones in the sim only. Nothing new to see
  on a phone yet; Shape shows them in 10j.
- **0.10.7.0** (PR 10h): the quad race replay. Deliver a quad job and watch
  the five laps before the debrief: your quad leans into the straights and
  tips back to brake; a quad that tumbles spins down onto the grass. The
  debrief has a Replay button.
- **0.10.6.0** (PR 10g): quad jobs on the board. Win Yegor Shmel's, Inna
  Vertel's or Strizh Racing's job, shape the quad, read it in the tunnel,
  then Deliver: the race time is filled in for you. The club-race debrief
  says if it kept the promise, and if it tumbled or overheated, "Change
  this" takes you to the slider.
- **0.10.5.0** (PR 10f): quad jobs in the sim only. Nothing new to see on a
  phone; the board shows them in 10g.
- **0.10.4.0** (PR 10e): the powered quad model. In the model shop for a
  quad, pick Props: Spinning; in the tunnel its props turn, the Downwash
  readout fills in, and each run costs ₽ 2,000 more. Quad jobs (10f) are
  needed to order one in a real career.
- **0.10.3.0** (PR 10d): the racing quad on the Tunnel screen. Open the
  game with `?try=quad` and tap Tunnel: turn the fan up, then tip the quad
  with the Tilt slider and read the twist on its pod. The forecast race time
  shows under Readouts and in full under Runs.
- **0.10.2.0** (PR 10c): the racing quad in the tunnel, in the sim only.
  Nothing new to see on a phone; the Tunnel screen gets it in 10d.
- **0.10.1.0** (PR 10b): the racing quad on Shape. Open the game with
  `?try=quad` and tap Shape: rake the pod up until it points into the
  arrows of air, fair the arms, and watch the race time and the twist.
- **0.10.0.0** (PR 10a): the racing quad, in the sim only. Nothing to see
  on a phone yet; Shape gets it in 10b.
- **0.9.26.0** (PR 9z+): the sonic boom. Deliver a jet car that goes
  through the sound barrier and watch the replay: a Mach box counts up,
  the screen flashes white as it passes Mach 1, the commentator calls it,
  and a V of shock lines trails across the salt from the nose.
- **0.9.25.0** (PR 9z): jet car jobs. With a reputation of 75 or more,
  Ognivo turns up on the Jobs board; at 85, Proryv, which wants its car
  through the sound barrier. Miss short of it and speed week says the air
  squeezed round the car, with a "Pinch the waist" button. Also fixed:
  the Deliver sheet now takes speeds past 1,300 km/h, and a badly missed
  promise costs at most 24 reputation instead of wiping a career out.
- **0.9.24.0** (PR 9y): the jet car in the tunnel. Open
  `laminar.longlight.games/?try=jet`, go to Tunnel, run the fan: the
  record forecast turns amber with "Mach 1.05 · too fast". The tunnel
  can't run near the speed of sound, so it can't see the drag climb; the
  Runs tab explains, and warns about the shock under the nose.
- **0.9.23.0** (PR 9x): the jet car on Shape. Open
  `laminar.longlight.games/?try=jet` and tap Shape: a long jet car with a
  new Waist slider. Try a 4.5 m nose, 3.5° of droop, a 25 cm canopy, a
  60 % waist, and on Fin & wheels 3.5 m² of fin and the wheels covered:
  the desk says Mach 1.06. Drop the droop to 2° and the nose goes light at
  the barrier.
- **0.9.22.0** (PR 9w): the jet car in the sim, not yet in the game. A
  second land-speed class, pushed by a jet engine, that can go through the
  sound barrier if it's shaped for it: a long, fine, well-drooped nose and
  a pinched waist. Nothing new to see on a phone yet: Shape gets it in 9x.
- **0.9.21.0** (PR 9v): the record-run replay. Deliver a land-speed car
  and record day plays first: both runs on the salt, your car in front,
  the team's car see-through beside it, the chutes out at the end (or
  early, with the nose lifting or the car swinging first). Then speed
  week, with "Watch the replay" to see it again.
- **0.9.20.0** (PR 9u): land-speed jobs on the board. With a reputation of
  55 or more, Bogdan Lisovoy's Kalina can turn up (Zarya at 70). Bid in
  km/h, shape the car, read it in the tunnel (tare the posts and calibrate
  first), then Deliver: say the record speed and see speed week. A run
  that pulls its chutes earns nothing, and the debrief says why with a
  "Change this" button.
- **0.9.19.0** (PR 9t): land-speed record jobs in the sim, not yet on the
  board. Two teams at Sukhoye Speed Week: Bogdan Lisovoy's home-built
  Kalina and the Zarya Land Speed Project, whose driver can't see over the
  canopy. The promise is km/h gained on the two-way mean on a still day;
  pull the chutes and the run gains nothing. Nothing new to see on a phone
  yet: the board gets them in 9u.
- **0.9.18.0** (PR 9s): the streamliner on the Tunnel screen. Open
  `?try=record` and tap Tunnel. Turn the fan up: you get the nose's lift,
  the drag and a record-speed forecast at Lake Sukhoye. Then yaw the car
  a few degrees each way and the Yaw box says where the side force acts:
  behind the car's mass, it points itself into a crosswind. The Runs tab
  has the forecast in full, and it warns that the bare floor reads the
  nose's lift low. Do a tare run and a sphere calibration first, or the
  drag reads high.
- **0.9.17.0** (PR 9r): the streamliner in the tunnel, in the sim only
  (nothing new on screen yet). The tunnel reads a scale model of the car;
  a still floor reads the nose's lift about 15% low, so a nose that lifts
  at speed on the salt can look safe. Test it on the Tunnel screen in 9s.
- **0.9.16.0** (PR 9q): the streamliner on the Shape screen. Open
  `?try=record` and tap Shape: the nose cone (length and droop) and the
  canopy are on the Body tab, the tail fin and wheel fairings on Fin &
  wheels. The sheet reads the desk's record speed at Lake Sukhoye against
  the team's car, how much of the nose's weight stays on at top speed, and
  the crosswind the car holds straight in. Amber warnings say when the nose
  goes light, the car wanders, the canopy is too low to see over, or the
  air starts to squeeze.
- **0.9.15.0** (PR 9p): the land-speed streamliner, in the sim only. The
  firm shapes its nose cone (length and droop), canopy, tail fin and wheel
  fairings. A run starts from a standstill on the salt at Lake Sukhoye and
  is timed over a kilometre; a nose that goes light or a car that wanders
  in a crosswind means chutes out and a run that doesn't count. The record
  is the mean of a run each way, so the wind mostly cancels. Above about
  650 km/h the air squeezes and drag grows. Nothing new on screen yet.
- **0.9.14.0** (PR 9o): the lap replay. Delivering a car job now plays
  race day's lap before the race weekend sheet: your car from behind,
  their car as a see-through twin alongside, with the lap clock, your
  speed and the gap to their car. The commentator calls the slowest
  corner, the top speed and porpoising, and a porpoising car bounces
  where it does. "Watch again" is on the race weekend sheet.
- **0.9.13.0** (PR 9n): car jobs on the board. Belan Sport, Granit
  Motorsport and Iskra Racing come up as the firm's name grows. Bids are
  in tenths of a second off the lap. Delivering asks for the lap on the
  circuit's usual day, filled in from the tunnel's lap forecast (with a
  warning if it was read over the bare floor or the ground board, not low
  enough, or porpoises) or the desk estimate. The race weekend sheet shows
  the lap against their car, race day, the read on downforce, and each
  trim by the scrutineers, porpoise, balance or heat trouble with a
  "change this". The lap replay comes next.
- **0.9.12.0** (PR 9m): car jobs in the sim, not yet on the board. Three
  teams: Belan Sport (a touring car at Stavren Park), Granit Motorsport (a
  touring car that understeers at the Dolgo Ring) and Iskra Racing (a
  single-seater that porpoises at Stavren Park). The promise is tenths of
  a second off the team's lap on the circuit's usual day, after the
  scrutineers raise the ride height or trim the rear wing to the rules.
  Race day is seeded. The read is judged on downforce, and the debrief
  names the rules, porpoising, balance or heat when one of them cost the
  promise. Shape and Tunnel now forecast at the job's circuit against the
  team's own car.
- **0.9.11.0** (PR 9l): the racing car on the Tunnel screen. Try it with
  `?try=car` or `?try=car-open`, then the Tunnel tab. The car hangs from
  a strut through its roof, over the bare floor, the model shop's ground
  board (now offered for cars) or your own tunnel's rolling road (its belt
  runs with the air). The angle row is the ride drop: lower the car step
  by step with the fan steady to build its aero map. The readouts show
  the downforce area with the front share and the force on the model,
  the drag area, and the lap forecast on the Dolgo Ring; the Ride sweep
  chart plots downforce against the drop, so the floor's stall shows as
  the line falling away. The Runs tab has the forecast in full and says
  what the floor under the model does to it. The strut takes 1,500 N.
- **0.9.10.0** (PR 9k): the racing car in the tunnel, in the sim (on
  screen in PR 9l). A tunnel model is held still on its posts, so it
  can't squat at speed as the real car does: the mount lowers it in
  steps (the drop) and the readings make an aero map. The lap forecast
  squashes the car on its springs at each speed and reads the map there;
  a lower reading that lost downforce shows the floor's stall, and the
  car porpoises at the speed that squashes it there. Over the tunnel's
  still floor the car's floor pulls less and stalls too soon (it can even
  show porpoising that isn't there); the model shop's ground board takes
  part of that away, and the new rolling road upgrade for your own tunnel
  (₽900,000, 30 days) all of it, and spins the wheels so they stop
  reading draggy. Glossary: rolling road and aero map.
- **0.9.9.0** (PR 9j): the racing car on Shape. `?try=car` puts a touring
  car on the bench and `?try=car-open` a single-seater (nothing is saved).
  The Floor tab sets the ride heights, the diffuser and the floor's edge
  seal; the Wings tab the front wing (a splitter flap on a touring car),
  the rear wing's angle and chord, and the cooling inlets. The sheet reads
  the desk's lap-time gain against the class's stock car, the downforce
  and drag at 200 km/h, the balance, and the rule box. Breaking the rules
  is red; porpoising, an engine running hot and a balance outside the
  drivers' window are amber warnings, each with a "Change this". New
  glossary entries: lap-time gain, aero balance, ride height, diffuser and
  the Motor Racing Federation.
- **0.9.8.0** (PR 9i): racing cars in the sim (nothing on screen yet).
  Kelbo chose touring cars and open-wheel single-seaters together, a
  promise in lap time, a balance window that costs the driver time, a
  rolling road as an own-tunnel upgrade (coming with the car in the
  tunnel), and a rulebook. Each car has front and rear ride heights, a
  front wing (a splitter flap on a touring car), a rear wing's angle and
  chord, a diffuser, a floor-edge seal and a cooling inlet. The floor pulls
  harder the lower it sits, until it stalls and the car porpoises (the
  driver lifts there, capping the speed). Downforce squashes the springs,
  so the car sits lower the faster it goes. A balance outside the window
  costs grip in the corners, too small an inlet costs power, and the
  fictional Tarnovian Motor Racing Federation's rulebook sets a minimum
  ride height and a maximum rear-wing chord. The lap: corners at the speed
  the tyres hold, straights flat out, braking as late as grip allows, on
  the fast Dolgo Ring or the tight Stavren Park. A good setup is worth
  about a second on a touring car and nearly two on a single-seater.
- **0.9.7.0** (PR 9h): the fuel-run replay. Sending a truck to the fleet
  now plays the trial day first: both trucks down the client's route,
  yours in the right lane and theirs see-through on the left, fast-forwarded
  to about 26 seconds. The panel shows the distance, the wind's angle on
  your truck, your diesel so far and the saving against theirs over the
  same road. A commentator calls the yard (and cracked skirts, if any), the
  windiest stretch, a climb that slows the trucks and the arrival. At the
  end it puts your declared fuel figure next to the real one, then opens
  the fuel trial. Skip jumps straight there.
- **0.9.6.0** (PR 9g): the gravel yard. Prichal Logistics now works out
  of a shingle yard on the Kosa spit, and skirts that hang lower than
  0.45 m above the road crack there (the road code only asks for 0.25 m).
  The trucks then run without them, and the saving and the read are judged
  on the truck as it ran (Kelbo's call, 16 November 2026). On the windy
  coast that's about 10 points of saving gone. The brief card shows the
  yard, Shape lists it under the rules with a "change this" and tints the
  skirts amber, the Deliver sheet warns, and the fuel trial names the
  cracked skirts with a "Raise the skirts" jump.
- **0.9.5.0** (PR 9f): truck jobs are on the board. Kovyl Haulage calls
  once the firm has a small name (reputation 5), Volok Freight at 20,
  Prichal Logistics at 35. Bids promise per cent of fuel saved. Winning puts
  the fleet's own truck on the bench; Shape's desk figure and the tunnel's
  forecast both use the job's route and that truck. The Deliver sheet
  declares a fuel figure (litres per 100 km), filled in from the tunnel's
  forecast (with warnings for a bare floor or no yaw sweep) or the desk
  until the tunnel has read one, and warns when the road code will cut a
  part back. The fuel trial shows both trucks' figures, the trial day's air
  and wind, the read, and a jump to the boat-tail or skirts if the depot
  cut them. The replay of the run comes with PR 9g.
- **0.9.4.0** (PR 9e): truck jobs in the sim, not on the board yet (that's
  PR 9f). Three fleets: Kovyl Haulage and Volok Freight on the
  Stavren–Mostograd highway, Prichal Logistics on the new, windy Kosa coast
  road. The promise is the fuel saved against the fleet's own truck,
  wind-averaged; you declare your truck's fuel figure (litres per 100 km),
  and the read is judged on the drag that figure means. A part the road code
  forbids is cut back before the truck goes out, and the debrief can blame
  that. The tunnel screen now scales each truck reading's skin friction to
  full size (a 16 m truck's skin drags less for its size than a 2 m
  model's), so a ground-board sweep at full fan gives a good read.
- **0.9.3.0** (PR 9d): the truck on the tunnel screen (`?try=truck`, then
  Tunnel). It starts on a 1:8 model on a ground board. The Runs tab pools
  its runs angle by angle and runs the route on that curve for a fuel
  saving; it says when the curve is straight on only, or on the bare floor.
  The model shop offers 1:12, 1:10 and 1:8 for a truck, and the board. A
  truck is bolted to stouter struts (250 N): a big yaw at full fan still
  tears it off. Runs and the mount button say "truck".
- **0.9.2.0** (PR 9c): the truck in the tunnel, in the sim. Truck models
  come at 1:12, 1:10 or 1:8 so the rig fits the section. The parts a box
  can't show (gap, underside, boat-tail panels and so on) ride with the
  model as drag that grows in a crosswind. The still floor hides some of
  the wheels' and underside's drag; the ground board takes most of that
  away. Fairing, extenders, gap filler, skirts and boat-tail swap on a
  model like a helmet. The forecast runs the route on the drag curve the
  tunnel read: read only straight on and it over-promises. Nothing new on
  screen yet (PR 9d).
- **0.9.1.0** (PR 9b): the truck on the Shape screen, reached with
  `?try=truck` until truck jobs arrive (PR 9d). Sliders for the cab corners,
  roof fairing, side extenders, gap, gap filler, skirts and boat-tail; the
  desk's fuel saving against the fleet's truck; drag area straight on and at
  10° of crosswind; parts weight and price; road code breaks that jump to
  the slider. Five new glossary entries. Known gap: in the tunnel the truck
  is still drawn at a rider model's scale until PR 9c.
- **0.9.0.0** (PR 9a): trucks in the sim. PR 9 (Road & motorsport) begins,
  trucks first (Kelbo, 16 November 2026). Nothing changes on screen yet.
  - A fleet's tractor and box trailer, with eight things to shape: the cab's
    corner radius, a roof fairing, side extenders, the gap and a gap filler,
    side skirts, and a boat-tail's length and panel angle.
  - The fictional Tarnovian Road Code caps the boat-tail at 1.2 m and keeps
    the skirts at least 0.25 m off the road.
  - The drag: the rig's outside as one long box the drag model reads (its
    skin, and the wake behind the doors or the boat-tail), plus the cab
    corners, the roof step, the gap, the underside and the boat-tail's
    panels. The gap and the underside get much worse in a crosswind, which
    is where extenders and skirts pay off.
  - The fuel run: a loaded rig at 90 km/h along the Stavren–Mostograd
    highway, the wind meeting each leg at its own angle, slowing on climbs
    the engine can't hold. The promise will be the fuel saved, averaged over
    every wind direction.

- **0.8.16.0** (PR 8q): the bobsled run replay. PR 8 (the rest of Sport)
  is done.
  - Race day now plays the day's run from behind the sled before the
    debrief, fast-forwarded. The client's old sled races in the same ice
    channel as a see-through ghost.
  - The channel follows Belogor's stretches: curves turn right, then left.
    Each sled rides up the outside wall as far as its speed throws it,
    easing in and out of each curve.
  - Readouts: the clock, speed, the gap to the old sled at the same spot,
    and metres down the track. The commentator calls the push, the load,
    a driver who can't see over the cowling, the long horseshoe, the top
    speed and the finish.
  - At the finish it shows the declared reference run next to the real one.
    "Watch the replay" on the debrief plays it again. Reduced motion shows
    the finish still.

- **0.8.15.0** (PR 8p): bobsled jobs on screen.
  - The three sled briefs are on the board now (the four-man from
    reputation 45). Their cards show the track, the ice and the crew.
  - The bid's promise is in seconds off the run, stepping a hundredth.
  - Deliver declares the reference run time. It starts from the tunnel's
    run forecast for this sled, or the desk estimate until the tunnel has
    read one, and warns when the reading was taken on the bare floor.
  - Race day: both sleds' reference runs and the runs on the day, the
    conditions, the read, money and reputation, and a "Lower the cowling"
    jump when the driver steered late. The run replay comes in PR 8q.
  - The legacy card counts a sled's best job in seconds.

- **0.8.14.0** (PR 8o): bobsled jobs in the career (sim only).
  - Three clients: Danil Kostrov's club two-man on an old sled, Vera
    Kedrova's national two-man championship (reputation 30), and Matvei
    Gromov's four-man championship (reputation 45: the four-man comes later,
    as Kelbo chose).
  - The promise is time gained on the reference run down Belogor (the
    usual push, good ice, still air) over the client's old sled. One
    promised point is a tenth of a second, so a missed tenth costs what a
    missed point of cut does; bids move in hundredths. The rivals bid the
    same way.
  - The declared number is the reference run's time, as a ski jumper's is
    the reference jump's distance. The read is judged on drag like every
    other job: the declared time is turned back into the drag area that
    gives it. A forecast 0.4 s quick (a sled tested on the bare floor) is a
    poor read; a few hundredths is a good one.
  - Race day: the client's crew push, the day's ice, air and wind, with
    both sleds down the track in the same conditions. If the driver couldn't
    see over the cowling, the debrief names the time lost and sends you to
    the cowling; if that's what cost the promise, it says so.
  - The briefs stay off the board until PR 8p puts them on screen.
- **0.8.13.0** (PR 8n): the bobsled in the tunnel.
  - The sled sits on two short posts under its runners. The balance reads
    the hull as a body (so it meets the Reynolds trap and trip strips like
    a rider), plus its nose, runners and crew.
  - Kelbo chose (16 November 2026) the ground board. On the track the ice
    slides past under the sled; the tunnel floor stands still and its slow
    air hides some of the runners' drag. On the bare floor a two-man sled
    reads about 14 % too slippery, and its run about 0.4 s too quick.
  - The model shop offers a ground board for a sled (₽4,000 and a day): a
    raised plate with a sharp front edge, drawn under the model. It takes
    away most of the error (within about 0.05 s at 1:2, 0.02 s at 1:4).
    A rolling road, later with the cars, will take it all.
  - Readouts: the run forecast down Belogor on the live reading takes the
    yaw's place, and the Runs tab flies the pooled reading down the track,
    with a warning while the sled is on the bare floor. The model's
    Reynolds number is matched to the sled's speed (30 m/s), not a rider's.
  - New glossary entries: Still floor, Ground board.
  - Also fixed: the Runs tab's pedalling-average line stayed hidden after a
    ski jumper had been on the mount.
- **0.8.12.0** (PR 8m): the bobsled on the Shape screen.
  - The sled is drawn from the drag model's own cross-sections, open over
    the cockpit, on four runners, with the crew folded inside. Their helmets
    sit exactly where the sim puts them, so what shows over the cowling on
    screen is what meets the air.
  - Sliders: the crew's tuck on Position; nose, tail and cowling height on
    the Kit tab, which reads "Sled" for a bobsled.
  - The sheet: the desk's run time down Belogor (±0.2–0.3 s: a few per cent
    of drag is tenths of a second, so the tunnel matters), the drag area
    with the crew's share, the driver's view over the cowling, and the
    Sliding Federation's box with a "Change this" for each break. The hull
    glows red outside the box; the driver's helmet glows amber when they
    can't see.
  - New glossary entries: Cowling, Crew tuck, Sliding Federation.
  - Saves keep a sled (two- or four-man), and the run report names the sled
    sliders that changed. Any change to a sled needs a new model: the shell
    and its crew are one moulding.
  - Try it before the jobs arrive: `?try=bobsled` or `?try=bobsled4` on the
    address opens a throwaway career with a sled on the bench. The tunnel
    doesn't read a sled properly until PR 8n.
- **0.8.11.0** (PR 8l): the bobsled in the sim.
  - Kelbo chose (16 November 2026) to shape the sled and the crew's tuck,
    inside a rule box. The design: nose length, tail length, cowling height
    and the tuck (from a loose racing tuck to the deepest the crew can hold),
    for a two-man or four-man sled.
  - The fictional Tarnovian Sliding Federation's box caps the whole length
    (2.70 m two-man, 3.80 m four-man), so nose and tail share it, and the
    cowling's height (0.60 m).
  - Drag: the hull (the drag model reads it, so a longer tail closes its
    wake), the nose (short is blunt), the runners, and the crew: what of
    each shows over the cowling, the driver in clean air and the rest
    sheltered. About 0.19 m² for a good sled, 0.31 m² for an old club one.
  - The trades: the best split of length is in the middle (about 0.7 m of
    nose, 0.45 m of tail); a deeper tuck sheds drag but loads slower after
    the push; a taller cowling hides the crew but the driver must still see
    over it, or they steer late and lose time in every curve.
  - The run: the push, loading, then gravity against runner friction (more
    in each curve) and the air down Belogor's sliding track, 1 250 m and
    109 m of drop with ten curves: about 50 s at up to 130 km/h. Wind along
    the track, the ice's temperature and the crew's push all change it.
  - Not on screen yet: the Shape screen comes in PR 8m.
- **0.8.10.0** (PR 8k): the jumper's sting, and trip strips that fix its read.
  - A jumper's model hangs on a sting that takes its lift as well as its
    drag, up to 170 N. Past that it groans first (the warning, the shaking
    balance), then the jumper snaps off and flies down the section. A 1:2
    model sweeps 6–44° safely at 30 m/s; near 35 m/s at a steep pitch it
    gives. Repair as for a model torn off its posts, screens included.
  - The read: the open air on a hill trips the helmet and boots' boundary
    layer, the tunnel's quiet air doesn't, so untaped they read draggy and
    the forecast came out about 5 % short at any size or speed. Trip strips
    from the shop now go round the helmet and boots too, and a taped model
    reads the reference jump within half a metre. The forecast says so
    when the model is untaped.
- **0.8.9.0** (PR 8j): the jump replay on the hill.
  - Delivering a jumper now plays the day's jump side-on, in slow motion:
    the in-run, the table, the landing slope with the K line (cobalt) and
    the hill-size line (red), and fir trees on the far side. Your design
    flies beside the client's old setup, which is drawn see-through.
  - A live readout gives the time in the air, the distance, the speed and
    the stability margin; a commentator calls the take-off, settling into
    the V, any pitch-forward, wobble or bail-out at HS, and the landing
    against the old setup. A strip under it shows both jumpers with K and HS.
  - A jump measured shorter than its flight (a wobble, or the bail-out at
    HS) comes down over the last few metres to land on its mark. On the
    snow the jumper stands in a landing crouch with the skis down the slope,
    and each landing leaves a mark.
  - At the end it shows your declared distance next to what the reference
    jump counted, then "See the debrief". With reduced motion it shows the
    landing as a still. Jump day has a "Watch the replay" button.
- **0.8.8.0** (PR 8i): ski-jump jobs on the Jobs board.
  - Kirill Zorin (from reputation 15), Polina Vetrova (30) and Yaroslav
    Kuzmenko (45, the large hill) now turn up on the board. Their cards show
    the hill and its size and the jumper's weight; the bid's promise is in
    metres.
  - Deliver asks for the reference jump's distance, filled in from the
    tunnel's forecast for the design on the bench (or the desk estimate
    if the tunnel hasn't flown one). It says when the forecast would fly
    past the hill size, or when the sweep missed some of the flight's angles.
  - Jump day: the promise judged on the reference jump, your read, the jump
    on the day next to the old setup's in the same air, why a miss happened,
    and a "Tighten the suit" jump after a wobble or a pitch-forward. A safe
    landing at HS is noted, not blamed.
  - The tunnel and Shape forecast on the job's own hill and day (the practice
    jump between jobs).
  - The legacy's best job keeps metres apart from a cut in %.
  - No replay yet: the flight on the hill is PR 8j.
- **0.8.7.0** (PR 8h): ski-jump balance, sim side.
  - Kelbo chose (16 November 2026) to cap jumps at the hill size: metres past
    HS don't count, and a jumper heading past it bails out to a safe landing
    there (a "long" landing on the day, which the report doesn't blame on
    the suit). The tunnel's forecast says what would count and flags it.
  - Retune: a flat lean (under 20°) and a wide V now pull the lift back
    towards the hips and cost stability, and the body's vortex lift is lower.
    Only a near-perfect stable design reaches HS now: about 101 m best on the
    98 m normal hill (was 117 m), about 137 m on the 134 m large hill.
  - The default jumper's suit is a little tighter (bagginess 0.2) so it stays
    stable on the large hill, whose take-off speed is now 27.0 m/s.
  - A third job: Yaroslav Kuzmenko on the Belogor large hill (HS 134), from
    reputation 45, asking for 8 m. Still off the board until PR 8i.
- **0.8.6.0** (PR 8g): ski-jump jobs in the career, sim side.
  - Two normal-hill briefs at Belogor (HS 98): Kirill Zorin's junior cup
    (from reputation 15, asks for 6 m) and Polina Vetrova's winter cup (from
    30, asks for 4 m). They stay off the board until PR 8h can show them.
  - The promise is metres gained on the reference jump over the client's old
    setup (still air, the hill's own take-off speed), and it counts only if
    the stability margin holds the 2 % floor all the way. A promised metre
    is bid, weighed and missed like a point of cut.
  - The declared number is the reference jump's length; the read compares it
    with the truth, as a share, like a declared CdA.
  - The competition jump on the day, yours and the old setup's in the same
    air, is the show: a wobble or a pitch-forward names the suit as the
    thing to change.
- **0.8.5.0** (PR 8f): the ski jumper in the tunnel, on screen.
  - A jumper model flies on a sting from behind, pivoting at the hips. The
    angle row becomes **Pitch** (6–44°, "Flight angle" sets 34°); no cranks,
    no smoke or tufts yet.
  - Readouts: air speed (with how near the helmet and boots are to the
    hill's Reynolds number), pitch with the model's lift in newtons, L/D with
    the lift and drag areas, and the forecast: the reference jump in metres
    and its lowest margin, or the angles still to sweep.
  - Runs keep each reading's lift and pitch moment, so the forecast survives
    a save. The Pitch sweep tab plots lift area against pitch; the Runs tab
    gives the forecast in full. A sting tare and the sphere's blockage come
    off the readings once they're known.
  - The jump is the practice hill until the ski-jump briefs (PR 8g). A
    jumper model can't break yet: its weak points come with the briefs.
- **0.8.4.0** (PR 8e): the ski jumper in the tunnel, sim side.
  - The balance reads a jumper model on a pitching sting: lift, drag and the
    pitch moment about the hips, scaled to full size (`src/sim/jumpTunnel.ts`).
    Blockage, the sting's own drag, build errors and the balance's noise all
    reach the readings.
  - The plates lift from their edges, so they read the same at any scale.
    The helmet and boots don't: on a small, slow model they read draggier
    than on the hill, and the forecast lands a few metres short. A bigger
    model or a faster run gets closer.
  - The forecast flies the reference jump on the readings (straight lines
    between the angles read). Its distance is the number you'll declare; its
    lowest margin is the tunnel's word on stability; it says when the sweep
    doesn't cover the angles the flight passes through.
  - Nothing new on screen yet: the tunnel screen gets the pitch dial in PR 8f.
- **0.8.3.0** (PR 8d): the ski jumper on the Shape screen.
  - The jumper joins the game's designs, so saves, save codes, the run
    report and the model shop all know it (`src/sim/design.ts`). The suit is
    cut into the model's body: any change to a jumper is a new model.
  - A figure in flight (`src/sim/geom/jumperPose.ts`, `src/render/riderFigure.ts`):
    lying out over the skis at the flight angle, the body off the skis by the
    lean, the skis in a V, arms back. A roomier suit draws fatter.
  - Shape shows Position (body lean, ski V-angle) and Kit (suit cut). The
    sheet reads the flight: the desk's guess at the reference jump in metres,
    lift area and L/D, and stability (the lowest margin in the flight against
    the 2 % floor), with the body glowing orange under the floor and red
    below zero.
  - Kelbo chose (16 November 2026) that a jumper's declared number is the
    predicted distance; PR 8e builds it from the tunnel's readings.
  - Preview: `?try=skijump` opens a throwaway career with a jumper on the
    bench, saving nothing, until the ski-jump briefs arrive in PR 8g. Its
    tunnel still shows the last model (the pitch dial is PR 8f).
  - To revisit with the briefs (8g): a flat lean, a wide V and a roomy suit
    reach about 116 m on the 98 m normal hill in still air, past the hill size.
    (Done in PR 8h: capped at HS and retuned.)
- **0.8.2.0** (PR 8c): the ski jumper in the sim.
  - A jumper's design: body lean, ski V-angle and suit bagginess
    (`src/data/jumper.ts`). No suit rules: bagginess trades lift for stability.
  - In the air, skis and body are low plates that lift from their edges'
    vortices as well as like a wing; where that lift acts against the hips
    gives the pitch moment and the static margin (`src/sim/jumper.ts`).
  - Two hills, normal (K 90) and large (K 120), each drawn from a few numbers
    (`src/data/hills.ts`). A sound jumper lands near the K point in still air.
  - A margin below zero tips the jumper forward and the jump ends short; one
    between zero and the floor wobbles the landing. The promise's yardstick is
    the still-air flight, and it only counts above the floor.
  - Nothing on screen yet: the jumper's figure and controls came in PR 8d;
    the tunnel, the flight replay and the briefs follow.
- **0.8.1.0** (PR 8b): the skater on screen.
  - The skater has a figure in Shape, the tunnel and the race-day replay
    (`src/sim/geom/skaterPose.ts`, `src/render/riderFigure.ts`): crouch,
    arms folded or swinging, cap or hood, boots and blades. Smoke and tufts
    follow the skater's body too.
  - Shape shows the skater's own controls: Position (back angle, knee bend,
    head drop, arms) and Kit (head cover, suit fabric, shin trip strips). No
    Bike tab, no drag dots, and "Open" for rules, since skaters have none.
    A tired part (back, legs or head) glows orange like the cyclist's.
  - The tunnel hides the crank angle for skaters (no pedals).
  - Two skating briefs: Sonya Lenok's 10 000 m on the indoor 400 m Stavren
    Ice Oval, and Ilya Kosov's 40 km Lake Dolgo Ice Marathon outdoors in the
    wind (from reputation 10). The replay draws ice, with snow round the lake.
  - Race-day words say "skated" and "stood up" for skaters; the lap counter
    reads "Lap 11/25" so it fits a phone; a swinging arm's extra push shows
    as "+" power.
- **0.8.0.0** (PR 8a): sports in the sim.
  - A design can now be for a sport other than cycling (`src/data/sport.ts`,
    `src/sim/design.ts`). Old saves are cyclists, as before.
  - The speed skater: back angle, knee bend, head drop, arms (on the back
    or swinging), cap or hood, suit fabric and shin trip strips
    (`src/data/skater.ts`, `src/sim/geom/skater.ts`, `src/sim/skater.ts`).
    A racing crouch reads near 0.17 m²; standing tall near 0.22 m².
  - Skaters glide on ice (blade friction, no drivetrain) and have no kit rules.
  - Saves, model part swaps, run comparisons and tunnel weak points all
    understand skaters. Nothing changes on screen yet: PR 8b adds the
    skater's figure, controls and briefs.
- **0.7.9.0** (PR 7j): the legacy picture.
  - "Share as a picture" on the legacy card draws it as a 1080 × 1350 PNG in
    the game's look (light or dark, as the screen is): streamlines over a
    teardrop, the firm, its years, eight numbers and the best job, with the
    game's address and the studio credit.
  - Phones open the share sheet; where a browser can't share files, the
    picture saves to downloads instead.
- **0.7.8.0** (PR 7i): the ending.
  - A new career asks for the firm's name (a ready-made one is picked by the
    seed; type your own or keep it). Rename it any time from the firm strip.
  - Retire from the Jobs board (two taps, not while a job is in hand), or the
    career closes on its own once a job or wait reaches 1 January 2040.
  - Either way the board becomes a legacy card: years, jobs, promises kept,
    reputation, correlation score, fees earned, cash, own tunnel, times broke
    and the best job. Saves keep the name and the ending.
- **0.7.7.0** (PR 7h): backups.
  - The Saves sheet can save the career as a text file
    (`laminar-backup-YYYY-MM-DD.txt`, holding its save code) and restore one:
    "Pick a backup file" puts its code in the box, ready to load.
  - Two weeks after the last backup (or the first visit), the Saves chip
    turns amber and reads "Back up". Saving a file or copying the code
    resets it.
  - The game asks the browser to keep its storage (`navigator.storage.persist()`).
  - New localStorage keys: `laminar.backedUpAt` and `laminar.firstSeen`.
- **0.7.6.0** (PR 7g): going broke, the soft landing.
  - If a job leaves cash below zero, kit is sold for half what it cost,
    cheapest first, until cash is back above zero. Your own tunnel goes
    only once every machine and upgrade has, and then runs are back in the
    university's tunnel.
  - Staff stay. Reputation drops 5. There is no game over: small briefs
    are always on the board.
  - The race-day debrief shows a "Cash ran out" box with what was sold.
- **0.7.5.0** (PR 7f): staff.
  - A Staff card on the Jobs screen: one person per role (model maker,
    tunnel tech, analyst), two to choose from in each, three at most.
  - Each is paid their wage for every day that passes, job or not, and
    stays until you let them go (nobody gets poached). Wages show on the
    race-day debrief.
  - Model makers make models and repairs quicker (Daria Orlik) or cheaper
    (Bogdan Venko). Tunnel techs halve the balance's scatter (Timur Basov)
    or make the mount posts hold 40 % more (Lidiya Krasna). Analysts
    narrow the desk estimate (Artyom Zhelin a lot, Milena Sorokova a little).
- **0.7.4.0** (PR 7e): the workshop.
  - A Workshop card on the Jobs screen sells three machines for cash:
    - an FDM printer (₽120k): cheap, any scale, rough and a little bendy;
    - a resin printer (₽220k): quick and smooth, 1:4 and 1:3 only, brittle;
    - a CNC mill (₽900k): aluminium, twice as true to size and stiff.
  - The model shop gains a "Made by" row for the outside shop and any
    machine you own. Your own machines make models for a share of the
    shop's price and days; options a machine can't do are greyed out.
  - Material matters in the tunnel: resin parts flutter sooner, aluminium
    later.
- **0.7.3.0** (PR 7d): upgrades for your own tunnel.
  - Once your tunnel is open, its card lists four upgrades, each paid in
    cash and fitted over some days while you keep working:
    - turbulence screens (₽180k, 14 days): calmer air;
    - a bigger turntable (₽120k, 10 days): yaw out to ±30°;
    - a wheel-drive rig (₽350k, 21 days): the wheels spin, so no
      static-wheel correction is needed;
    - a bigger fan (₽600k, 30 days): top speed 55 m/s.
  - The tunnel screen's fan and yaw sliders, the yaw chart and the model
    shop's speed check follow whatever is fitted.
- **0.7.2.0** (PR 7c): your own tunnel.
  - The Jobs screen has a "Your own tunnel" card: ₽2,000,000, cash only.
    Pay (two taps) and it's built over 90 days while you keep working in
    the university's tunnel.
  - Once it opens, runs cost power only (₽500 a kWh, no run fee), its air
    is calmer and its mount cleaner, and upkeep (₽400 a day) is paid for
    every day that passes. The debrief shows the upkeep.
  - Its quirks are its own: the tunnel screen says "Your tunnel" and only
    runs made there count towards its tare and calibration.
- **0.7.1.0** (PR 7b): the named rivals.
  - Bystro Aero bids on every paid brief: cheap, and it promises big.
    Vysota Aerolab only bids on the big jobs (top fee ₽120k or more), at a
    high price, with a big name behind it.
  - The Jobs screen lists both under "Rival firms", with their reputation
    and correlation score (they move a little each week). Each brief says
    who else is bidding.
  - The bids sheet shows every firm's price, promise, reputation and value,
    and names the firm that won if it wasn't you.
- **0.7.0.0** (PR 7a): reputation and correlation score.
  - The Jobs screen shows your reputation (out of 100, starting at 20) and
    your correlation score: how close your predictions came to the road over
    the last five jobs (100 is spot on, 0 is 10 % off or worse).
  - Keeping a promise and a close read raise your name; a missed promise
    costs more the further you fell short.
  - The coast, pursuit and national championship clients only call once your
    name is big enough (25, 35 and 45).
  - In sealed bids, every 50 reputation counts as a point of promised cut,
    so a better-known firm wins close bids. The debrief shows the change.
- **0.6.3.0** (PR 6d): race-day trouble in the 3D replay.
  - On a stretch where the rider eased off in the gusts, they rock side to
    side every couple of seconds (more the harder they fought it). The old
    setup rocks too if it struggled, out of step with yours. With reduced
    motion, nobody rocks.
  - Once a rider can't hold the position, they're drawn sitting up for the
    rest of the race: back up, head up.

- **0.6.2.0** (PR 6c): trouble on race day.
  - **Crosswind steer** (Kelbo's call: loses time in gusts). In a gust, side
    force ahead of the rider's balance point turns the bike. Past what the
    rider can hold (more for a heavier rider), they ease off for the gust:
    never a stop. A deep front wheel is touchy on a windy day and a disc
    front is a real handful; a disc at the back steadies the bike. Indoors
    there's no wind, so no steer.
  - **Unholdable position** (Kelbo's call: fades in the last third). Past
    the comfort limit, the rider sits up for the last third and loses power,
    so the drag saved comes back as lost time. It's now slower than the
    best position the rider can hold.
  - The debrief says how much time each cost, with a "change this" jump
    to the front wheel or to the position slider that strains most. It
    also says when the client's old setup lost time in the gusts.
  - The replay commentator calls the gust and the moment the rider sits
    up. The promise is still checked on road CdA, so trouble costs time,
    not the fee.

- **0.6.1.0** (PR 6b): failures you can see in the tunnel.
  - Push a weak part too hard and a red warning flashes at the top ("The
    tail is fluttering!") while the model buzzes and the readings jitter.
    Ease the fan or the yaw and it calms down.
  - Hold it there and the part breaks: the tail, the disc cover or the
    helmet flies down the tunnel and lands by the end screen, or the whole
    model tears off its posts.
  - A sheet says what broke, why, and the repair price and days. Repair
    from the sheet or the red note at the top, or jump straight to the part
    on the Shape screen (or the model shop) to change it.
  - The fan is locked on a broken model; the run that broke it shows
    "broke" in the runs list.

- **0.6.0.0** (PR 6a): the tunnel's failure model, under the hood.
  - Kelbo's calls: a broken model is repaired for half its price and half its
    build days (plus the screens if it tore off the mount); the tunnel always
    warns before a break.
  - Weak points on a rider model: a long aero-helmet tail and a disc wheel's
    cover can flutter (bigger and printed models flutter sooner); the mount's
    posts take at most 60 N; a printed model's glued helmet lets go past
    36 m/s.
  - A part past its limit for a moment is forgiven; held there for a couple of
    seconds, it breaks.
  - Saves remember a broken model and which run broke it. Nothing shows on
    screen yet: that's PR 6b.

- **0.5.8.0** (PR 5i): the guided first job.
  - **Irina Talova**, your partner, has a card at the top of Jobs during the
    first job: one line on what to do next, and a seven-step checklist
    (bid, model her setup, run it, shape, model your design, run it,
    deliver).
  - Each step ticks when you really do it, and the button that does it
    glows (a still outline with reduced motion).
  - "Hide the guide" (two taps) hides it for that career; it goes on its
    own after the first delivery. Older saves that already delivered never
    see it.

- **0.5.7.0** (PR 5h): the velodrome.
  - A new brief: **Alina Vesnina**, a track pursuiter, riding the 4 km
    individual pursuit at the indoor **Stavren Velodrome**. Still air, so
    her promise is about drag straight on; she already rides deep and disc
    wheels and a sloping position, so the cut is harder to find (−5 %).
  - The track is a 250 m oval (two straights, two bends), 16 laps. Brief
    cards say "Indoors" for the wind.
  - The replay on the track uses a broadcast camera high over the end of the
    oval, so the whole lap fits a phone held upright. Rings under the riders
    (cobalt for yours, grey for the old setup) make them easy to spot.
  - The readout counts laps ("Lap 9 of 16") and says "Still air"; the
    commentator rings the bell for the last lap. The strip ticks each lap.

- **0.5.6.0** (PR 5g): race day plays out.
  - After "Lock it in and race", a short 3D replay (about 22 seconds) shows
    the time trial: your design on the road, the client's old setup as a
    see-through twin in the next lane, wind flags on the verge, a chase
    camera that swings round at the turn.
  - A live readout gives the race clock, distance, speed, the wind (head,
    cross or tail, with the yaw angle) and the gap to the old setup in
    seconds, plus a strip with both riders as dots.
  - The commentator speaks at the start, the turn, halfway, when you meet
    the old setup still heading out, and at the finish.
  - At the line it shows your prediction next to what the road read, then
    **See the debrief**. **Skip** goes straight there, and the debrief has
    **Watch the replay**.
  - Every number comes from the same field result as the debrief; nothing is
    re-run.

- **0.5.5.0** (PR 5f): sealed bids.
  - **Bid for this job…** opens a sheet: your price (inside the brief's fee
    range, ₽1,000 steps) and your promise (half-point steps). Brief cards
    show the fee range.
  - One unnamed rival firm bids too (the named rivals come in PR 7). The
    client counts each promised point as worth 8 % of the middle fee, the
    same share a missed point costs you, plus how far your price is under
    the top of the range. The higher value wins; a tie goes to you.
  - The bids are opened at once: both prices, both promises and both
    values, so you can see why you won or lost.
  - Win: the client's setup goes on the bench, at your price and promise.
    Lose: that brief goes and another comes in while any are left. If the
    rival takes them all, **Wait a week for new briefs** brings a new board.
  - Marta Selivan, the first job, asks for your firm by name: no rival.

- **0.5.4.0** (PR 5e): delivering a job is a real test now.
  - Each brief carries a **promise**: cut the client's drag by a set share
    against their old setup (10 % for Marta Selivan, 2 % for the national
    rider). Job cards show it.
  - **Deliver…** opens a sheet: you say what the road will read (the design's
    wind-averaged CdA, full size), prefilled from the desk estimate, with
    −/+ steppers. Then "Lock it in and race".
  - On race day both setups are ridden in that day's air and wind. Half a
    point short is forgiven; each point beyond costs 8 % of the fee, half the
    fee at most.
  - The **debrief** says kept or missed, the time against the old setup,
    your prediction against the road CdA, how close your read was
    (good within 2 %), the penalty and what you were paid, and why: the
    design itself, or just the day.
  - Every delivered job goes into the firm's history (for reputation later).

- **0.5.3.0** (PR 5d): the tunnel model is a real thing now (Kelbo's
  "parts swap, position re-orders").
  - The model on the mount keeps the design it was built of. Changing the
    design on Shape no longer changes the model for free.
  - **New parts** (helmet, skinsuit, bars, a wheel, the frame): the tunnel
    shows a slim bar, e.g. "Model: old rear wheel · Swap · ₽1,500". Swapping
    costs ₽ 1,500 a part and no days.
  - **New position:** the bar says "Model: old position" with a **New
    model** button that opens the shop. You can still swap the parts on the
    old model if you only want to test those.
  - Taking a job puts the client's setup on the bench, so the first thing a
    job needs is a model of it.
  - Run notes, the pooled crank-angle average and the flow pictures all
    follow the model's design, not the bench's.
  - The firm now starts with ₽ 150,000, enough for a model and a session
    before the first fee.
  - Fixed: the CdA readout named the old model's scale until the fan ran.

- **0.5.2.0** (PR 5c): jobs, money and the days clock.
  - **Jobs screen:** a new first tab (Jobs · Shape · Tunnel). It shows your
    firm's money (you start with ₽ 100,000 on Mar 1, 2010) and a board of
    three briefs: who the client is, what they want, the event, the fee,
    the days to the event and the rider's power. A new career always offers
    Marta Selivan's regional time trial first, and there's always one small
    job on the board.
  - **Take a job** (tap twice): the client's current position and kit go on
    the Shape bench, and the job card shows the days left, the fee, what
    you've spent and race day. Shape's subtitle names the client, and
    "Start over" goes back to their setup.
  - **Money chip:** beside Saves on every screen, e.g. "₽99.5k · 21 d".
    Tap it to open Jobs.
  - **Runs cost money:** every tunnel run (sphere, wheel and tare runs
    too) comes off the firm's money, with or without a job.
  - **Models need a job:** the shop charges the job and the model's days
    pass at once (Kelbo's call). It won't take an order with no job or
    with too few days left, and says why.
  - **Deliver and race** (tap twice): the calendar jumps to race day, the
    rider races your design on that day's wind and air, and you see the
    time, speed, conditions and the fee. The board then moves on.
  - The desk estimate and the shop's Reynolds note now use the job's event.
    Each new career gets its own tunnel quirks; a save from before careers
    keeps the old ones, so its calibrations still hold.
  - **For now:** the fee is paid in full whatever happens. Promises, the
    declared prediction and the debrief are PR 5e; bids are 5f. Money can go
    below zero (shown in red); the soft landing is PR 7.

- **0.5.1.0** (PR 5b): save slots and save codes.
  - **Saves button:** top right on every screen, under Shape / Tunnel. It
    opens a sheet with three slots, each its own career, showing how many
    runs it has and when it was last saved.
  - **Play** another slot, or **New career** to wipe a slot and start
    fresh (tap twice: the first tap turns the button red and asks again).
    Switching reloads the page into that career.
  - **Save code:** "Copy save code" puts the whole career on the clipboard
    as one line starting `LAM1:` (a short session is about 1 KB). Paste a
    code into the box and tap "Load into slot n" twice to bring a career
    over from another phone. A cut-short or mistyped code is caught by its
    checksum and nothing is loaded.
  - The model shop now uses the same slide-up sheet as Saves.
  - **Not yet:** backup files and the "you haven't backed up in a while"
    reminder (PR 7).

- **0.5.0.0** (PR 5a): your work now survives closing the page.
  - **Autosave:** a second after any change (a finished run, a new model,
    the crank, the design), and at once when you switch away from the tab
    or close it. Your design, every finished run, calibration, tare and
    wheel checks, the model on order and the crank angle come back next
    time. A run still in progress when you leave is lost.
  - **Where:** the browser's own storage on your phone (IndexedDB database
    `laminar`, or `laminar.slot.1` if that's blocked). Nothing leaves the
    phone. A save that's damaged or from a newer version is left alone
    and the game starts fresh.
  - The run line's total now reads "All runs", since runs carry over.
  - **Not yet:** more than one slot, a way to start over, or a save code
    to move your career between devices. Those come in 5b.
  - Kelbo's PR 5 calls are in plan section 2.

- **0.4.4.0** (PR 4e): pressure taps and the Cp map. This finishes PR 4.
  - **Taps at the shop:** a new "Pressure taps" choice (₽ 8,000, 2 more
    days) fits pinholes over the rider, piped to the tunnel's scanner. They
    don't change the drag.
  - **Cp chip:** with a tapped model on the mount, a "Cp" chip joins the
    flow instruments. Turn it on and fan up: each tap shows as a dot,
    orange where the air pushes (the fronts of the forearms and shins),
    grey near zero, blue where it pulls (round the back, the arms and the
    helmet's sides). The scale is blue to orange with grey at 0, so it
    reads for colour-blind players too.
  - **Numbers, not just colour:** a slim legend at the side gives the
    scale (−2 to +1) and the highest and lowest readings with the part
    they're on. Below reading speed it asks you to fan up.
  - **Known simplification:** the taps read the flow field's attached-flow
    estimate, which runs away in the tight gaps between the legs and arms.
    Past −1.2 a reading eases off and never goes below −2.5, so the
    lowest reading is usually in a gap between parts.

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
