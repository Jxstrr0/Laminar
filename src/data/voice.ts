/**
 * The voice pack (PR 14b): 60 lines recorded on ElevenLabs (docs/voice/),
 * take 2 of each, picked by Kelbo on 17 November 2026. The files live in
 * public/voice/ and load the first time a line plays, never on the first load.
 *
 * Who speaks:
 * - The tunnel tech (Basov or Krasna) and the analyst (Zhelin or Sorokova),
 *   only once that person is on the staff.
 * - The client: the team-manager voice or the race-engineer voice, set per
 *   brief in CLIENT_VOICE.
 * - The commentator over every replay.
 *
 * The text here is the caption shown while a line plays (the recording's
 * performance tags, like [sighs], left out). Lines never carry numbers.
 */
import type { StaffId } from './staff'

export type Speaker = 'basov' | 'krasna' | 'zhelin' | 'sorokova' | 'boss' | 'engineer' | 'comm'

export interface VoiceLine {
  speaker: Speaker
  /** The file in public/voice/ (the script sheet's file_name). */
  file: string
  /** What's said, as the caption shows it. */
  text: string
}

export const VOICE_LINES: Record<string, VoiceLine> = {
  'LAM-BASOV-0001': { speaker: 'basov', file: 'lam_basov_lam-basov-0001.mp3', text: "Fan's coming up. Stand clear of the section." },
  'LAM-BASOV-0002': { speaker: 'basov', file: 'lam_basov_lam-basov-0002.mp3', text: "Speed's steady. Balance is reading." },
  'LAM-BASOV-0003': { speaker: 'basov', file: 'lam_basov_lam-basov-0003.mp3', text: "Sweep's done. The numbers are on your screen." },
  'LAM-BASOV-0004': { speaker: 'basov', file: 'lam_basov_lam-basov-0004.mp3', text: "Tare's in. The mount is out of the numbers now." },
  'LAM-BASOV-0005': { speaker: 'basov', file: 'lam_basov_lam-basov-0005.mp3', text: "Sphere's run. The tunnel is calibrated." },
  'LAM-BASOV-0006': { speaker: 'basov', file: 'lam_basov_lam-basov-0006.mp3', text: "The mount is working hard. I'd ease off the speed." },
  'LAM-BASOV-0007': { speaker: 'basov', file: 'lam_basov_lam-basov-0007.mp3', text: "Something's fluttering. Watch it." },
  'LAM-BASOV-0008': { speaker: 'basov', file: 'lam_basov_lam-basov-0008.mp3', text: "And it's gone. Model's off the mount. Fan's down." },
  'LAM-BASOV-0009': { speaker: 'basov', file: 'lam_basov_lam-basov-0009.mp3', text: "Smoke's on." },
  'LAM-BASOV-0010': { speaker: 'basov', file: 'lam_basov_lam-basov-0010.mp3', text: "Fan's down. Safe to go in." },
  'LAM-KRASNA-0001': { speaker: 'krasna', file: 'lam_krasna_lam-krasna-0001.mp3', text: "Spinning up. Doors shut, hands in." },
  'LAM-KRASNA-0002': { speaker: 'krasna', file: 'lam_krasna_lam-krasna-0002.mp3', text: "We're at speed. Reading clean." },
  'LAM-KRASNA-0003': { speaker: 'krasna', file: 'lam_krasna_lam-krasna-0003.mp3', text: "Sweep finished. Have a look." },
  'LAM-KRASNA-0004': { speaker: 'krasna', file: 'lam_krasna_lam-krasna-0004.mp3', text: "Tare done. That's the mount taken out." },
  'LAM-KRASNA-0005': { speaker: 'krasna', file: 'lam_krasna_lam-krasna-0005.mp3', text: "Calibration done. The sphere agrees with the book." },
  'LAM-KRASNA-0006': { speaker: 'krasna', file: 'lam_krasna_lam-krasna-0006.mp3', text: "That's a lot of load on the sting. Your call." },
  'LAM-KRASNA-0007': { speaker: 'krasna', file: 'lam_krasna_lam-krasna-0007.mp3', text: "It's buzzing. Not a good buzz." },
  'LAM-KRASNA-0008': { speaker: 'krasna', file: 'lam_krasna_lam-krasna-0008.mp3', text: "That's a break. I'll sweep up the bits." },
  'LAM-KRASNA-0009': { speaker: 'krasna', file: 'lam_krasna_lam-krasna-0009.mp3', text: "Smoke's running." },
  'LAM-KRASNA-0010': { speaker: 'krasna', file: 'lam_krasna_lam-krasna-0010.mp3', text: "Fan off. All quiet." },
  'LAM-ZHELIN-0001': { speaker: 'zhelin', file: 'lam_zhelin_lam-zhelin-0001.mp3', text: "The tunnel and your sketch agree. That's rare. Enjoy it." },
  'LAM-ZHELIN-0002': { speaker: 'zhelin', file: 'lam_zhelin_lam-zhelin-0002.mp3', text: "Separation's moved forward. The tail is doing nothing for you." },
  'LAM-ZHELIN-0003': { speaker: 'zhelin', file: 'lam_zhelin_lam-zhelin-0003.mp3', text: "That's inside the noise. Run it again before you believe it." },
  'LAM-ZHELIN-0004': { speaker: 'zhelin', file: 'lam_zhelin_lam-zhelin-0004.mp3', text: "Your promise is safe, if the wind behaves." },
  'LAM-ZHELIN-0005': { speaker: 'zhelin', file: 'lam_zhelin_lam-zhelin-0005.mp3', text: "That promise is too bold. The tunnel won't back it." },
  'LAM-ZHELIN-0006': { speaker: 'zhelin', file: 'lam_zhelin_lam-zhelin-0006.mp3', text: "The road read close to the tunnel. Good work." },
  'LAM-ZHELIN-0007': { speaker: 'zhelin', file: 'lam_zhelin_lam-zhelin-0007.mp3', text: "The road and the tunnel disagree. Let's find out why." },
  'LAM-SOROKOVA-0001': { speaker: 'sorokova', file: 'lam_sorokova_lam-sorokova-0001.mp3', text: "Oh, that's better! I think. Let me check the repeats." },
  'LAM-SOROKOVA-0002': { speaker: 'sorokova', file: 'lam_sorokova_lam-sorokova-0002.mp3', text: "The flow lets go early there. See the tufts?" },
  'LAM-SOROKOVA-0003': { speaker: 'sorokova', file: 'lam_sorokova_lam-sorokova-0003.mp3', text: "Small change. Maybe too small to trust yet." },
  'LAM-SOROKOVA-0004': { speaker: 'sorokova', file: 'lam_sorokova_lam-sorokova-0004.mp3', text: "That looks like a winner to me." },
  'LAM-SOROKOVA-0005': { speaker: 'sorokova', file: 'lam_sorokova_lam-sorokova-0005.mp3', text: "Um, that's worse. Sorry." },
  'LAM-SOROKOVA-0006': { speaker: 'sorokova', file: 'lam_sorokova_lam-sorokova-0006.mp3', text: "The road agreed with us! I knew it." },
  'LAM-SOROKOVA-0007': { speaker: 'sorokova', file: 'lam_sorokova_lam-sorokova-0007.mp3', text: "That's not what the tunnel said. I'll look at the quirks." },
  'LAM-CLIENT-0001': { speaker: 'boss', file: 'lam_boss_lam-client-0001.mp3', text: "We're losing seconds in the air. Find them for us." },
  'LAM-CLIENT-0002': { speaker: 'boss', file: 'lam_boss_lam-client-0002.mp3', text: "The budget is tight. Don't spend it all on the fan." },
  'LAM-CLIENT-0003': { speaker: 'boss', file: 'lam_boss_lam-client-0003.mp3', text: "You promised. Let's see the road agree." },
  'LAM-CLIENT-0004': { speaker: 'boss', file: 'lam_boss_lam-client-0004.mp3', text: "That's what you called. Good. We'll be back." },
  'LAM-CLIENT-0005': { speaker: 'boss', file: 'lam_boss_lam-client-0005.mp3', text: "That wasn't the number you gave us." },
  'LAM-CLIENT-0006': { speaker: 'engineer', file: 'lam_engineer_lam-client-0006.mp3', text: "Our numbers say there's drag to lose. Show me where." },
  'LAM-CLIENT-0007': { speaker: 'engineer', file: 'lam_engineer_lam-client-0007.mp3', text: "I need it by race day, not a day after." },
  'LAM-CLIENT-0008': { speaker: 'engineer', file: 'lam_engineer_lam-client-0008.mp3', text: "The data's in. Let's see if your tunnel told the truth." },
  'LAM-CLIENT-0009': { speaker: 'engineer', file: 'lam_engineer_lam-client-0009.mp3', text: "Better than promised. You've earned the next job." },
  'LAM-CLIENT-0010': { speaker: 'engineer', file: 'lam_engineer_lam-client-0010.mp3', text: "Close, but not what we paid for." },
  'LAM-COMM-0001': { speaker: 'comm', file: 'lam_comm_lam-comm-0001.mp3', text: "And they're off!" },
  'LAM-COMM-0002': { speaker: 'comm', file: 'lam_comm_lam-comm-0002.mp3', text: "A gust! That's a real test of the setup." },
  'LAM-COMM-0003': { speaker: 'comm', file: 'lam_comm_lam-comm-0003.mp3', text: "Halfway, and the new setup is ahead." },
  'LAM-COMM-0004': { speaker: 'comm', file: 'lam_comm_lam-comm-0004.mp3', text: "Halfway, and it's behind the old setup." },
  'LAM-COMM-0005': { speaker: 'comm', file: 'lam_comm_lam-comm-0005.mp3', text: "The bell! One lap to go!" },
  'LAM-COMM-0006': { speaker: 'comm', file: 'lam_comm_lam-comm-0006.mp3', text: "Across the line! Let's see the time." },
  'LAM-COMM-0007': { speaker: 'comm', file: 'lam_comm_lam-comm-0007.mp3', text: "Off the table and into the V." },
  'LAM-COMM-0008': { speaker: 'comm', file: 'lam_comm_lam-comm-0008.mp3', text: "The nose is dropping! Hold it, hold it…" },
  'LAM-COMM-0009': { speaker: 'comm', file: 'lam_comm_lam-comm-0009.mp3', text: "Down! And that's a long one." },
  'LAM-COMM-0010': { speaker: 'comm', file: 'lam_comm_lam-comm-0010.mp3', text: "They're pushing off… and in!" },
  'LAM-COMM-0011': { speaker: 'comm', file: 'lam_comm_lam-comm-0011.mp3', text: "Into the horseshoe now." },
  'LAM-COMM-0012': { speaker: 'comm', file: 'lam_comm_lam-comm-0012.mp3', text: "Two cars, one flying lap. Here we go." },
  'LAM-COMM-0013': { speaker: 'comm', file: 'lam_comm_lam-comm-0013.mp3', text: "Two trucks, one road, the same load. Let's see who drinks less." },
  'LAM-COMM-0014': { speaker: 'comm', file: 'lam_comm_lam-comm-0014.mp3', text: "Into the gates, and they're flying." },
  'LAM-COMM-0015': { speaker: 'comm', file: 'lam_comm_lam-comm-0015.mp3', text: "The wind's picking up. This changes things." },
  'LAM-COMM-0016': { speaker: 'comm', file: 'lam_comm_lam-comm-0016.mp3', text: "What a run!" },
}

/** Who each speaker is, for the caption. */
export const SPEAKER_NAMES: Record<Speaker, string> = {
  basov: 'Timur Basov',
  krasna: 'Lidiya Krasna',
  zhelin: 'Artyom Zhelin',
  sorokova: 'Milena Sorokova',
  boss: 'Client',
  engineer: 'Client',
  comm: 'Commentator',
}

/** What the tunnel tech calls out. */
export type TechCue = 'fanStart' | 'atSpeed' | 'sweepDone' | 'tareDone' | 'sphereDone' | 'strain' | 'flutter' | 'break' | 'smokeOn' | 'fanStop'
/** What the analyst says about the numbers. */
export type AnalystCue = 'match' | 'sepForward' | 'noise' | 'safe' | 'bad' | 'agreed' | 'disagreed'
/** What the client says. */
export type ClientCue = 'brief' | 'briefTight' | 'eventDay' | 'kept' | 'missed'
export type VoiceCue = TechCue | AnalystCue | ClientCue

const TECH_CUES: readonly TechCue[] = ['fanStart', 'atSpeed', 'sweepDone', 'tareDone', 'sphereDone', 'strain', 'flutter', 'break', 'smokeOn', 'fanStop']
const ANALYST_CUES: readonly AnalystCue[] = ['match', 'sepForward', 'noise', 'safe', 'bad', 'agreed', 'disagreed']
const CLIENT_CUES: readonly ClientCue[] = ['brief', 'briefTight', 'eventDay', 'kept', 'missed']

/** Line ids for each cue: line n of each speaker's set, in the order above. */
const nth = (prefix: string, n: number) => `LAM-${prefix}-${String(n).padStart(4, '0')}`
export const TECH_LINES: Record<'basov' | 'krasna', Record<TechCue, string>> = {
  basov: Object.fromEntries(TECH_CUES.map((c, i) => [c, nth('BASOV', i + 1)])) as Record<TechCue, string>,
  krasna: Object.fromEntries(TECH_CUES.map((c, i) => [c, nth('KRASNA', i + 1)])) as Record<TechCue, string>,
}
export const ANALYST_LINES: Record<'zhelin' | 'sorokova', Record<AnalystCue, string>> = {
  zhelin: Object.fromEntries(ANALYST_CUES.map((c, i) => [c, nth('ZHELIN', i + 1)])) as Record<AnalystCue, string>,
  sorokova: Object.fromEntries(ANALYST_CUES.map((c, i) => [c, nth('SOROKOVA', i + 1)])) as Record<AnalystCue, string>,
}
/** The manager's lines are CLIENT-0001 to 0005, the engineer's 0006 to 0010. */
export const CLIENT_LINES: Record<'boss' | 'engineer', Record<ClientCue, string>> = {
  boss: Object.fromEntries(CLIENT_CUES.map((c, i) => [c, nth('CLIENT', i + 1)])) as Record<ClientCue, string>,
  engineer: Object.fromEntries(CLIENT_CUES.map((c, i) => [c, nth('CLIENT', i + 6)])) as Record<ClientCue, string>,
}

export const isTechCue = (c: VoiceCue): c is TechCue => (TECH_CUES as readonly string[]).includes(c)
export const isAnalystCue = (c: VoiceCue): c is AnalystCue => (ANALYST_CUES as readonly string[]).includes(c)

/** Staff who have voices (the model makers don't speak). */
export const VOICED_STAFF: readonly StaffId[] = ['basov', 'krasna', 'zhelin', 'sorokova']

/**
 * Which client voice reads each brief: the team manager ('boss') or the race
 * engineer ('engineer'). A brief left out gets the manager. Change any line here.
 */
export const CLIENT_VOICE: Record<string, 'boss' | 'engineer'> = {
  'selivan-regional': 'engineer',
  'stavren-club': 'boss',
  'brusnik-hill': 'boss',
  'korolets-coast': 'engineer',
  'tvardov-national': 'boss',
  'vesnina-pursuit': 'engineer',
  'shubina-hour': 'engineer',
  'lenok-oval': 'engineer',
  'kosov-marathon': 'boss',
  'zorin-junior': 'boss',
  'vetrova-cup': 'engineer',
  'kuzmenko-large': 'boss',
  'kostrov-club': 'boss',
  'kedrova-two': 'engineer',
  'gromov-four': 'boss',
  'kovyl-haulage': 'boss',
  'volok-freight': 'engineer',
  'prichal-coast': 'boss',
  'belan-sport': 'boss',
  'granit-touring': 'engineer',
  'iskra-open': 'boss',
  'kalina-streamliner': 'boss',
  'zarya-streamliner': 'engineer',
  'ognivo-jet': 'boss',
  'proryv-jet': 'engineer',
  'shmel-quad': 'boss',
  'vertel-quad': 'engineer',
  'strizh-quad': 'boss',
  'kolos-survey': 'engineer',
  'pashnya-survey': 'boss',
  'vekha-survey': 'engineer',
  'belyanka-club': 'engineer',
  'ozerov-tips': 'boss',
  'dalny-ferry': 'engineer',
  'stepnoy-pod': 'engineer',
  'stepnoy-tight': 'boss',
  'stepnoy-forward': 'engineer',
  'kostka-altitude': 'boss',
  'horakova-hill': 'engineer',
  'lisac-coast': 'boss',
  'marovic-crosswind': 'engineer',
}

/** The replays, by the commentary they run. */
export type ReplayKind = 'ride' | 'jump' | 'sled' | 'car' | 'truck' | 'drone' | 'plane' | 'record' | 'aircraft' | 'pod'

/** The commentator's line for a replay note (replay:kind), when there is one. */
export const COMM_LINES: Record<string, string> = {
  'ride:start': 'LAM-COMM-0001',
  'ride:gust': 'LAM-COMM-0002',
  'ride:halfAhead': 'LAM-COMM-0003',
  'ride:halfBehind': 'LAM-COMM-0004',
  'ride:bell': 'LAM-COMM-0005',
  'ride:finish': 'LAM-COMM-0006',
  'ride:turn': 'LAM-COMM-0015',
  'jump:off': 'LAM-COMM-0007',
  'jump:pitch': 'LAM-COMM-0008',
  'jump:long': 'LAM-COMM-0009',
  'sled:push': 'LAM-COMM-0010',
  'sled:horseshoe': 'LAM-COMM-0011',
  'sled:finish': 'LAM-COMM-0006',
  'car:start': 'LAM-COMM-0012',
  'car:finish': 'LAM-COMM-0006',
  'truck:start': 'LAM-COMM-0013',
  'truck:finish': 'LAM-COMM-0006',
  'drone:start': 'LAM-COMM-0014',
  'drone:finish': 'LAM-COMM-0006',
  'plane:launch': 'LAM-COMM-0001',
  'plane:gust': 'LAM-COMM-0002',
  'record:start': 'LAM-COMM-0001',
  // "Across the line! Let's see the time.": as the car leaves the timed kilometre, where its time is taken (PR 13u; it was said on the way in).
  'record:through': 'LAM-COMM-0006',
}
/** "What a run!", in place of the plain finish line when the new design won big. */
export const COMM_BIG_WIN = 'LAM-COMM-0016'

export const VOICE = {
  /** Loudness against the rest of the game's sound (the master gain sits over it). */
  gain: 1.3,
  /** Quiet time after a line before the next, s. */
  gap: 0.35,
  /** A line waiting longer than this is stale and dropped, s (a tunnel call-out is no use late). */
  stale: 4,
  /** Lines that may wait in the queue behind the one playing. */
  queue: 2,
  /**
   * The commentator over a replay (PR 13u): his line is tied to a moment on
   * screen, so it goes first. It waits only for another of his calls with
   * this long or less to run, s; anything else speaking fades out over
   * `cutFade` s to let him in. A call that can't start within `commStale` s
   * of its moment is dropped, and the gap before it is `commGap` s.
   */
  commWait: 0.8,
  cutFade: 0.15,
  commStale: 1.5,
  commGap: 0.1,
  /** The same cue again within this long is skipped, s (no "Smoke's on" on every tap). */
  repeat: 20,
  /** A finish counts as a big win when the new design gains this share of the old time or more. */
  bigWin: 0.015,
  /** A job is tight when it gives this many days or fewer. */
  tightDays: 14,
  /** A promise past the client's ask by this share of it is bold (0.15: 15% more than asked). */
  boldBy: 0.15,
  /** The road agreed with the tunnel when the read was off by this share or less. */
  agreeWithin: 0.02,
  /** Separation moved forward: this much more of the tufts flailing than on the last model. */
  sepRise: 0.08,
} as const
