/**
 * The glossary: every aero term in the game, in plain words.
 *
 * Any element with data-g="<id>" opens its entry (src/ui/glossary.ts), so a
 * term can be explained wherever it appears. Canadian spelling throughout.
 * Real aerodynamics, written for a curious teenager: short sentences, and
 * no jargon left unexplained. Game-only terms (desk estimate, comfort, rule
 * box, the TCF) say how they work in Laminar.
 */

export interface GlossaryEntry<Id extends string = string> {
  /** The name shown as the sheet's title and in the index. */
  term: string
  /** One line: what it is. */
  short: string
  /** Two to four sentences: why it matters. */
  long: string
  /** Other names that should find this entry (glossaryId). */
  aliases?: readonly string[]
  /** Related entries, shown as chips under the text. */
  seeAlso?: readonly Id[]
}

/**
 * Infers the ids from the keys, then checks every seeAlso against them, so a
 * typo in a seeAlso id is a type error.
 */
function defineGlossary<K extends string>(entries: Record<K, GlossaryEntry<NoInfer<K>>>): Record<K, GlossaryEntry<K>> {
  return entries
}

export const GLOSSARY = defineGlossary({
  // --- Air and speed -------------------------------------------------------
  airSpeed: {
    term: 'Air speed',
    short: 'How fast the air moves past the body.',
    long: 'In the tunnel the body sits still and the fan moves the air. Out on the road the rider moves and the air sits still. The air cannot tell the difference, so the forces come out the same.',
    aliases: ['speed', 'wind speed', 'flow speed'],
    seeAlso: ['dynamicPressure', 'apparentWind'],
  },
  airDensity: {
    term: 'Air density',
    short: 'How many kilograms of air fill one cubic metre.',
    long: 'At sea level on a mild day it is about 1.2 kg per cubic metre. Warm air and high places have thinner air, so every force gets a little smaller. That is why records are often chased at altitude.',
    aliases: ['density', 'rho', 'ρ'],
    seeAlso: ['dynamicPressure', 'reynolds'],
  },
  dynamicPressure: {
    term: 'Dynamic pressure',
    short: 'The push the moving air carries: ½ × density × speed².',
    long: 'Written q, and measured in pascals. Double the speed and q goes up four times, so drag does too. Every aero force is q times an area times a coefficient, which is why q shows on the tunnel readout.',
    aliases: ['q', '½ρv²', 'half rho v squared'],
    seeAlso: ['airSpeed', 'airDensity', 'cda'],
  },
  reynolds: {
    term: 'Reynolds number',
    short: 'Speed times size, compared with how sticky the air is.',
    long: 'Re = density × speed × length ÷ viscosity. A small number means the air behaves like syrup and flows smoothly; a big one means it slips past and churns into eddies. A rider at race speed is around half a million. Two shapes only behave alike if their Reynolds numbers match.',
    aliases: ['re', 'reynolds', 'reynolds no'],
    seeAlso: ['transition', 'dragCrisis', 'scaleModel'],
  },

  // --- Drag ------------------------------------------------------------------
  drag: {
    term: 'Drag',
    short: 'The force of the air pushing back against the body.',
    long: 'It is measured in newtons, and it is the force a rider spends most of their power fighting. Drag = dynamic pressure × CdA. Because it grows with speed squared, the power to beat it grows with speed cubed.',
    aliases: ['drag force', 'air resistance', 'sphere drag'],
    seeAlso: ['cda', 'skinFriction', 'pressureDrag'],
  },
  cda: {
    term: 'CdA',
    short: 'Drag area: drag coefficient times frontal area, in m².',
    long: 'The one number that says how much drag a body makes. Multiply it by dynamic pressure and you get the drag force. A rider sitting up is about 0.4 m²; a time trialist tucked low gets near 0.2 m². You can lower it by shrinking the area, by a smoother shape, or both.',
    aliases: ['drag area', 'c d a'],
    seeAlso: ['cd', 'frontalArea', 'windAveragedCda'],
  },
  cd: {
    term: 'Drag coefficient (Cd)',
    short: 'How slippery a shape is, whatever its size.',
    long: 'Cd has no units: it is drag divided by dynamic pressure and frontal area. A flat plate facing the wind is about 1.2, a smooth ball about 0.47 and a teardrop as low as 0.05. Two shapes the same size can make very different drag.',
    aliases: ['cd', 'drag coefficient', 'coefficient of drag'],
    seeAlso: ['cda', 'frontalArea', 'dragCrisis'],
  },
  frontalArea: {
    term: 'Frontal area',
    short: 'The size of the shadow a body casts if light shines from straight ahead.',
    long: 'It is the area the air sees coming at it, in square metres. Tucking lower and narrower shrinks it, which is the quickest way to cut drag. It is the A in CdA.',
    aliases: ['area', 'projected area'],
    seeAlso: ['cda', 'cd'],
  },
  skinFriction: {
    term: 'Skin friction',
    short: 'Drag from air rubbing along the surface.',
    long: 'Air sticks to the surface and drags on it as the rest flows past. More surface means more friction, and a turbulent boundary layer rubs several times harder than a laminar one. On slim, streamlined shapes it is most of the drag.',
    aliases: ['friction drag', 'viscous drag'],
    seeAlso: ['boundaryLayer', 'wettedArea', 'pressureDrag'],
  },
  pressureDrag: {
    term: 'Pressure (form) drag',
    short: 'Drag from high pressure on the front and low pressure in the wake.',
    long: 'Air piles up against the nose and pushes. Behind the body, the wake is low pressure and pulls back. On a bluff body like a rider this is most of the drag, so shrinking the wake matters more than polishing the surface.',
    aliases: ['form drag', 'pressure drag', 'profile drag'],
    seeAlso: ['wake', 'separation', 'skinFriction'],
  },
  wettedArea: {
    term: 'Wetted area',
    short: 'All the surface the air touches.',
    long: 'Imagine dipping the body in paint: the wetted area is everything that gets painted. Skin friction grows with it. A long tail cuts pressure drag but adds wetted area, so there is a sweet spot.',
    aliases: ['surface area'],
    seeAlso: ['skinFriction', 'kammTail'],
  },
  interferenceDrag: {
    term: 'Interference drag',
    short: 'Extra drag where two parts meet.',
    long: 'Where a wheel meets a frame, or a mirror meets a cab, the air around each part gets in the other part’s way. The pair makes more drag than the two parts would apart. Smooth fillets and fairings at the joint help.',
    aliases: ['junction drag'],
    seeAlso: ['pressureDrag', 'cavityDrag'],
  },
  cavityDrag: {
    term: 'Cavity drag',
    short: 'Drag from gaps, holes and open spaces.',
    long: 'Air swirls into a gap, churns around and leaves with less speed, and that costs energy. Truck trailer gaps, wheel wells and open spokes all do it. Covering or filling the cavity usually helps.',
    aliases: ['gap drag'],
    seeAlso: ['interferenceDrag', 'wake'],
  },

  // --- The boundary layer -------------------------------------------------
  boundaryLayer: {
    term: 'Boundary layer',
    short: 'The thin layer of air slowed down next to the surface.',
    long: 'Right at the surface the air sticks and does not move at all. A few millimetres out it is back to full speed. That thin layer decides almost everything: how much the surface rubs and where the flow lets go.',
    aliases: ['bl'],
    seeAlso: ['laminar', 'turbulent', 'separation'],
  },
  laminar: {
    term: 'Laminar flow',
    short: 'Smooth air, sliding along in neat layers.',
    long: 'Each layer slides over the next with little mixing, so it rubs the surface gently and makes low skin friction. The catch: it is fragile. It gives up quickly on the back of a curved body and lets go early, which makes a big wake.',
    aliases: ['laminar', 'laminar boundary layer'],
    seeAlso: ['turbulent', 'transition', 'boundaryLayer'],
  },
  turbulent: {
    term: 'Turbulent flow',
    short: 'Air churning in eddies as it moves.',
    long: 'The eddies mix fast air from outside down toward the surface. That rubs harder, so skin friction goes up. But the extra energy helps the flow hug a curved surface for longer, so it lets go later and leaves a smaller wake.',
    aliases: ['turbulent', 'turbulence', 'turbulent boundary layer'],
    seeAlso: ['laminar', 'transition', 'dragCrisis'],
  },
  transition: {
    term: 'Transition',
    short: 'The spot where laminar flow turns turbulent.',
    long: 'It moves forward when the Reynolds number rises, when the surface is rough, or when the oncoming air is already stirred up. A trip strip pins it in a chosen place. Where it sits on a curved body decides where the flow separates.',
    aliases: ['transition point', 'boundary layer transition'],
    seeAlso: ['laminar', 'turbulent', 'tripStrip'],
  },
  separation: {
    term: 'Flow separation',
    short: 'Where the air stops following the surface and peels away.',
    long: 'Toward the back of a curved body the pressure rises, and the slow air near the surface cannot keep pushing against it. It stops, turns back and the flow peels off. Behind that line is the wake. Earlier separation means a bigger wake and more drag.',
    aliases: ['separation', 'separation line', 'flow separation'],
    seeAlso: ['wake', 'boundaryLayer', 'stall'],
  },
  wake: {
    term: 'Wake',
    short: 'The slow, swirling air left behind a body.',
    long: 'The wake is low pressure, so it pulls back on the body: that is pressure drag. A wide wake means lots of drag; a narrow one means little. The smoke in the tunnel shows how wide it is.',
    aliases: ['wake region'],
    seeAlso: ['separation', 'pressureDrag'],
  },
  dragCrisis: {
    term: 'Drag crisis',
    short: 'The sudden drop in drag when the boundary layer turns turbulent before it separates.',
    long: 'Speed up a smooth ball and, past a certain Reynolds number, the flow turns turbulent just before it would have let go. It then clings on much further round the back, the wake shrinks, and Cd falls from about 0.47 to around 0.1. Golf ball dimples make it happen at lower speeds. It is the trick behind textured skinsuits.',
    aliases: ['drag crisis', 'critical reynolds number'],
    seeAlso: ['reynolds', 'turbulent', 'roughness'],
  },
  tripStrip: {
    term: 'Trip strip',
    short: 'A thin strip that forces the flow to turn turbulent at a chosen spot.',
    long: 'It can be tape, a fine wire, a band of grit or a textured patch of fabric. It sets where transition happens instead of leaving it to chance. On scale models it makes the small model behave more like the full-size one.',
    aliases: ['trip', 'trip wire', 'boundary layer trip'],
    seeAlso: ['transition', 'roughness', 'scaleModel'],
  },
  roughness: {
    term: 'Surface roughness',
    short: 'Bumps, seams and texture on the surface.',
    long: 'Roughness can trip the boundary layer into turbulence early. On a rounded part like an arm or a helmet that can delay separation and cut drag. On a smooth, slim part it usually just adds friction, so smooth wins there.',
    aliases: ['roughness', 'texture', 'surface finish'],
    seeAlso: ['tripStrip', 'dragCrisis', 'skinFriction'],
  },

  // --- Wind from the side -------------------------------------------------
  yaw: {
    term: 'Yaw angle',
    short: 'How far off straight ahead the air is coming from.',
    long: 'With no wind the air comes from dead ahead: 0°. A crosswind swings it round to one side. Riders spend most of their time under 10°, so a good design is tested across a range of angles, not just at zero.',
    aliases: ['yaw', 'yaw angle', 'crosswind angle'],
    seeAlso: ['apparentWind', 'sideForce', 'windAveragedCda'],
  },
  apparentWind: {
    term: 'Apparent wind',
    short: 'The wind you actually feel: your own speed plus the real wind.',
    long: 'Riding fast makes a headwind of its own. Add a crosswind and the two combine into one wind coming from a little to the side. The faster you go, the smaller the yaw angle a given crosswind makes.',
    aliases: ['relative wind', 'effective wind'],
    seeAlso: ['yaw', 'airSpeed'],
  },
  windAveragedCda: {
    term: 'Wind-averaged CdA',
    short: 'CdA averaged over the yaw angles a rider really meets.',
    long: 'Each yaw angle gets a weight for how often it happens at race speed on ordinary days. Some shapes are great at 0° and poor at 10°; others are steady across the range. This one number is a fairer test than the 0° reading alone.',
    aliases: ['wind averaged drag', 'yaw-averaged cda'],
    seeAlso: ['cda', 'yaw'],
  },
  sideForce: {
    term: 'Side force',
    short: 'The sideways push when the air comes at an angle.',
    long: 'Big flat side areas, like deep wheel rims or a disc, catch a crosswind like a sail. At some angles a deep wheel even makes less drag than at zero, the way a sail works. Too much side force, and a gust shoves the bike off its line.',
    aliases: ['side load', 'sideways force'],
    seeAlso: ['yaw', 'centreOfPressure'],
  },
  centreOfPressure: {
    term: 'Centre of pressure',
    short: 'The point where all the air’s push can be said to act.',
    long: 'If it sits behind the centre of mass, a gust turns the nose into the wind and the body settles, like a weathervane. If it sits ahead, the gust turns it further off line. Where it sits decides whether a gust is a nudge or a fright.',
    aliases: ['cop', 'cp location'],
    seeAlso: ['sideForce', 'yaw'],
  },

  // --- Lift and wings -------------------------------------------------------
  lift: {
    term: 'Lift',
    short: 'The air’s force at right angles to the oncoming flow.',
    long: 'A wing makes it by turning air downward, which leaves lower pressure on top than underneath. Lift is not always up: it can point sideways or down. It costs some drag every time.',
    aliases: ['lift force'],
    seeAlso: ['downforce', 'angleOfAttack', 'liftToDrag'],
  },
  downforce: {
    term: 'Downforce',
    short: 'Lift that points down, pressing a car onto the road.',
    long: 'Wings mounted upside down, and a shaped floor, push the tires harder into the track. More grip means faster corners. The price is extra drag on the straights.',
    aliases: ['negative lift'],
    seeAlso: ['lift', 'groundEffect'],
  },
  angleOfAttack: {
    term: 'Angle of attack',
    short: 'The angle between a wing and the oncoming air.',
    long: 'Tilt a wing up and it turns more air, so it makes more lift. Keep tilting and you reach stall. A ski jumper sets it with the lean of the whole body.',
    aliases: ['aoa', 'alpha', 'pitch angle'],
    seeAlso: ['lift', 'stall'],
  },
  stall: {
    term: 'Stall',
    short: 'When a wing tilts too far and the flow peels off its top.',
    long: 'Past a critical angle of attack, often 12 to 16°, the air on top separates. Lift drops suddenly and drag jumps. Some wings stall gently; others snap.',
    aliases: ['stalling'],
    seeAlso: ['angleOfAttack', 'separation', 'lift'],
  },
  inducedDrag: {
    term: 'Induced drag',
    short: 'The drag a wing pays for making lift.',
    long: 'Air spills round the wingtips from the high-pressure side to the low-pressure side and rolls up into tip vortices. That tilts the wing’s force backward a little. It is worst at low speed and high lift, and long, narrow wings make less of it.',
    aliases: ['drag due to lift', 'vortex drag'],
    seeAlso: ['aspectRatio', 'lift', 'groundEffect'],
  },
  aspectRatio: {
    term: 'Aspect ratio',
    short: 'How long and narrow a wing is: span squared ÷ wing area.',
    long: 'A glider’s long thin wings have a high aspect ratio, often over 20. A stubby wing is under 5. Higher aspect ratio means less induced drag, but the wing is heavier and bends more.',
    aliases: ['ar'],
    seeAlso: ['inducedDrag', 'lift'],
  },
  groundEffect: {
    term: 'Ground effect',
    short: 'Extra lift or downforce when a wing or floor runs close to the ground.',
    long: 'The ground blocks the tip vortices and the downwash, so a wing near it works better. Under a race car, air squeezed under the floor speeds up and sucks the car down, more the lower it rides. Too low, and the flow chokes and the downforce collapses all at once.',
    aliases: ['ground-effect'],
    seeAlso: ['downforce', 'inducedDrag', 'porpoising'],
  },
  porpoising: {
    term: 'Porpoising',
    short: 'A race car bouncing as its floor stalls and recovers, over and over.',
    long: 'Downforce pulls the car low, the floor stalls and lets go, the car springs up, the floor works again and pulls it down. It repeats several times a second down the straight. A slightly higher ride height or stiffer suspension calms it.',
    aliases: ['bouncing'],
    seeAlso: ['groundEffect', 'stall'],
  },
  liftToDrag: {
    term: 'L/D',
    short: 'Lift divided by drag: how efficiently something flies.',
    long: 'A glider can reach 50: it travels 50 metres forward for every metre it sinks. An airliner manages about 18. For a ski jumper or a drone, a higher L/D means a longer, cheaper flight.',
    aliases: ['l/d', 'lift to drag', 'lift-to-drag ratio', 'glide ratio'],
    seeAlso: ['lift', 'drag'],
  },

  // --- Shapes ---------------------------------------------------------------
  kammTail: {
    term: 'Kamm tail',
    short: 'A tail that tapers, then is chopped off flat.',
    long: 'A long pointed tail keeps the flow attached but adds length, weight and wetted area. Cut it off at the right place and the air leaves the sharp edge cleanly, behaving almost as if the tail were still there. Bike tubes and helmets use it to stay short.',
    aliases: ['kammback', 'k-tail', 'truncated airfoil'],
    seeAlso: ['wake', 'wettedArea', 'pressureDrag'],
  },

  // --- The tunnel -----------------------------------------------------------
  scaleModel: {
    term: 'Scale model',
    short: 'A smaller copy of the design, built to test in the tunnel.',
    long: 'A 1:4 model is a quarter of the length and a sixteenth of the area, so its forces are much smaller. It also runs at a lower Reynolds number unless the fan runs faster. That can move transition and separation, so a model can tell you something untrue about the full-size thing.',
    aliases: ['model', 'scale'],
    seeAlso: ['reynolds', 'tripStrip', 'blockage'],
  },
  forceBalance: {
    term: 'Force balance',
    short: 'The instrument that weighs the air’s push on the model.',
    long: 'It holds the model and measures tiny forces in several directions at once: drag, lift and side force, plus the twisting moments. Strain gauges inside feel the metal flex by a hair. Every number on the tunnel readout comes through it.',
    aliases: ['balance', 'load cell', 'tunnel balance'],
    seeAlso: ['sting', 'tare'],
  },
  sting: {
    term: 'Sting',
    short: 'The rod that holds the model in the air stream.',
    long: 'It joins the model to the balance, usually from behind or below. The sting makes some drag of its own and stirs up the wake. A tare run measures its share so it can be taken off.',
    aliases: ['mount', 'support strut', 'strut'],
    seeAlso: ['forceBalance', 'tare'],
  },
  tare: {
    term: 'Tare run',
    short: 'A run with the mount and no model, to measure the mount’s own drag.',
    long: 'Whatever the balance reads with nothing on it belongs to the mount. Take that off every real run and the number left is the model’s. It cannot remove every effect, because the mount also changes the air around the model.',
    aliases: ['tare', 'tare drag'],
    seeAlso: ['sting', 'forceBalance'],
  },
  calibration: {
    term: 'Calibration run',
    short: 'A run with a reference body whose drag is in the book, to find the tunnel’s faults.',
    long: 'A smooth sphere’s drag is known from countless tests in calm air. Run one in your tunnel and every gap to the book is the tunnel talking: a drag crisis that comes early means turbulent air, and readings that sit high before the crisis mean blockage. Tare the sting first, or its drag muddles the answer.',
    aliases: ['calibration', 'calibrate', 'reference body', 'the book'],
    seeAlso: ['dragCrisis', 'blockage', 'turbulenceIntensity', 'tare'],
  },
  legCycle: {
    term: 'Pedalling average',
    short: 'A model’s fixed legs read at one crank angle; real legs go round.',
    long: 'With one thigh up in the air the legs catch the most wind; with the cranks level, the least. A scale model’s legs are set at one angle, so a single run reads high or low. Run the same design at several crank angles spread over half a turn and average them to see what a pedalling rider gets.',
    aliases: ['crank angle', 'static legs', 'leg-cycle average', 'pedalling'],
    seeAlso: ['scaleModel', 'noiseBand'],
  },
  staticWheels: {
    term: 'Static wheels',
    short: 'A tunnel model’s wheels sit still; real ones spin.',
    long: 'A spinning wheel’s spokes slice the air, the top ones moving forward at up to twice the road speed, and that churns up drag. With no wheel drive the model’s wheels are held still, so spoked wheels read low and disc wheels look less of a gain than they are. Run the lab’s reference wheel still, hold it against the book’s figure for it spinning, and the gap tells you what to add back.',
    aliases: ['still wheels', 'reference wheel', 'wheel drive', 'spinning wheels'],
    seeAlso: ['calibration', 'legCycle'],
  },
  noiseBand: {
    term: 'Noise band',
    short: 'How far a reading could wander by chance: the error bar on a mean.',
    long: 'Every balance reading wobbles a little. Average many readings and the mean settles, and the band shows how sure that mean is: two standard errors either side, about 95 % sure. If two runs differ by less than their bands combined, the change may be nothing but noise. Holding a setting longer narrows the band.',
    aliases: ['error bar', 'standard error', 'repeatability', 'noise'],
    seeAlso: ['forceBalance', 'scaleModel'],
  },
  blockage: {
    term: 'Blockage',
    short: 'When the model fills too much of the test section.',
    long: 'The air has to squeeze past a big model, so it speeds up around it and the drag reads high. A smaller model or a bigger tunnel fixes it. Once you know how big the error is, you can correct for it.',
    aliases: ['tunnel blockage', 'blockage correction'],
    seeAlso: ['scaleModel', 'turbulenceIntensity'],
  },
  turbulenceIntensity: {
    term: 'Turbulence intensity',
    short: 'How stirred up the tunnel’s air is before it reaches the model.',
    long: 'Real tunnels never blow perfectly steady air. A little turbulence in the stream trips transition early, which can flatter round shapes. Screens and calibration runs with a reference body show how much.',
    aliases: ['freestream turbulence', 'tunnel turbulence'],
    seeAlso: ['transition', 'blockage'],
  },
  cp: {
    term: 'Pressure coefficient (Cp)',
    short: 'The pressure at one spot on the surface, compared with dynamic pressure.',
    long: 'Cp is 1 at the nose, where the air stops dead. It goes below zero where the air speeds up round a curve. A Cp map colours the whole surface so you can see where the push and the pull are.',
    aliases: ['cp', 'cp map', 'pressure map'],
    seeAlso: ['dynamicPressure', 'pressureDrag'],
  },

  // --- How Laminar works ----------------------------------------------------
  deskEstimate: {
    term: 'Desk estimate',
    short: 'A quick first guess at a design’s numbers, worked out from the shape alone.',
    long: 'It needs no model and no tunnel time, but it comes with wide error bars. A good analyst narrows them; they never vanish. The tunnel shows how close it really was.',
    aliases: ['estimate', 'error bars'],
    seeAlso: ['forceBalance', 'scaleModel'],
  },
  comfort: {
    term: 'Comfort / strain',
    short: 'How hard a position is for the athlete to hold.',
    long: 'A lower, narrower tuck saves drag but squeezes the body. Past the rider’s limit they lose power late in the event, which can cost more time than the tuck saved. The comfort meter shows how close you are.',
    aliases: ['comfort', 'strain', 'comfort meter', 'comfort / power'],
    seeAlso: ['frontalArea', 'cda'],
  },
  ruleBox: {
    term: 'Rule box',
    short: 'The limits an event’s rules put on a design.',
    long: 'Every brief draws its rule box as a see-through shape around the design. Any part that pokes outside turns red. You cannot deliver a design that breaks the rules.',
    aliases: ['rules', 'legality box', 'legal box'],
    seeAlso: ['tcf'],
  },
  tcf: {
    term: 'TCF',
    short: 'The Tarnovian Cycling Federation, which writes Tarnovia’s cycling rules.',
    long: 'The TCF sets what a racing bike, helmet and skinsuit may look like, and how a rider may sit. Its rulebook draws the rule box for every cycling brief. Like everything in Tarnovia, it is made up for Laminar.',
    aliases: ['tarnovian cycling federation', 'federation'],
    seeAlso: ['ruleBox'],
  },
})

/** Every glossary id, checked by TypeScript wherever one is written. */
export type GlossaryId = keyof typeof GLOSSARY

/** All ids, in no particular order. */
export const GLOSSARY_IDS = Object.keys(GLOSSARY) as GlossaryId[]

/** Words the glossary sheet itself shows. */
export const GLOSSARY_UI = {
  title: 'Glossary',
  close: 'Close',
  seeAlso: 'See also',
  allTerms: 'All terms',
  search: 'Search terms',
  noMatch: 'No terms match.',
  count: '{n} terms',
} as const

/** Lower case, straight quotes, hyphens and runs of spaces as one space. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[-–—_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

let lookup: Map<string, GlossaryId> | null = null

function buildLookup(): Map<string, GlossaryId> {
  const map = new Map<string, GlossaryId>()
  const add = (key: string, id: GlossaryId) => {
    const k = norm(key)
    if (k && !map.has(k)) map.set(k, id)
  }
  // Ids and terms first, so they win over an alias that happens to match.
  for (const id of GLOSSARY_IDS) {
    add(id, id)
    const term = GLOSSARY[id].term
    add(term, id)
    // "Pressure (form) drag" is also found as "pressure drag".
    add(term.replace(/\s*\([^)]*\)/g, ' '), id)
  }
  for (const id of GLOSSARY_IDS) {
    for (const alias of GLOSSARY[id].aliases ?? []) add(alias, id)
  }
  return map
}

/** Find an entry's id from its id, term or an alias, ignoring case. */
export function glossaryId(term: string): GlossaryId | undefined {
  lookup ??= buildLookup()
  return lookup.get(norm(term))
}

/** Is this string a glossary id? */
export function isGlossaryId(id: string): id is GlossaryId {
  return Object.prototype.hasOwnProperty.call(GLOSSARY, id)
}
