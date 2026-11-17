/**
 * The sound-effects pack (PR 13r): 18 effects made with ElevenLabs' sound
 * generator after Kelbo said yes to the quote (17 November 2026), two takes
 * each, the better one kept. They sit in public/sfx/, levelled to about
 * -18 LUFS, and load after the first tap; until one has loaded (or if it
 * never does, offline with an old cache) the code-made sounds from PR 13a
 * play instead, or nothing for sounds that had no code-made twin.
 *
 * Volumes are gains (1 is full scale) on top of the master volume.
 */
export type SfxName =
  | 'tunnel'
  | 'spinup'
  | 'clunk'
  | 'snap'
  | 'smoke'
  | 'mill'
  | 'pay'
  | 'brief'
  | 'bike'
  | 'cheer'
  | 'skiFlight'
  | 'skiLand'
  | 'bob'
  | 'raceCar'
  | 'jet'
  | 'plane'
  | 'truck'
  | 'drone'

export interface SfxFile {
  /** The file in public/sfx/, named after its line on the script sheet. */
  file: string
  gain: number
  /** Plays round and round until stopped (the tunnel's air, the sled's runners). */
  loop?: true
}

export const SFX: Record<SfxName, SfxFile> = {
  // The lab.
  tunnel: { file: 'lam_sfx_0001_tunnel.mp3', gain: 0.55, loop: true },
  spinup: { file: 'lam_sfx_0002_spinup.mp3', gain: 0.45 },
  clunk: { file: 'lam_sfx_0003_clunk.mp3', gain: 0.6 },
  snap: { file: 'lam_sfx_0004_snap.mp3', gain: 1 },
  smoke: { file: 'lam_sfx_0005_smoke.mp3', gain: 0.35 },
  mill: { file: 'lam_sfx_0006_mill.mp3', gain: 0.35 },
  pay: { file: 'lam_sfx_0007_pay.mp3', gain: 0.4 },
  brief: { file: 'lam_sfx_0008_brief.mp3', gain: 0.7 },
  // The field, in the replays.
  bike: { file: 'lam_sfx_0009_bike.mp3', gain: 0.5 },
  cheer: { file: 'lam_sfx_0010_cheer.mp3', gain: 0.4 },
  skiFlight: { file: 'lam_sfx_0011_skiflight.mp3', gain: 0.5 },
  skiLand: { file: 'lam_sfx_0012_skiland.mp3', gain: 0.5 },
  bob: { file: 'lam_sfx_0013_bob.mp3', gain: 0.45, loop: true },
  raceCar: { file: 'lam_sfx_0014_racecar.mp3', gain: 0.45 },
  jet: { file: 'lam_sfx_0015_jet.mp3', gain: 0.45 },
  plane: { file: 'lam_sfx_0016_plane.mp3', gain: 0.45 },
  truck: { file: 'lam_sfx_0017_truck.mp3', gain: 0.45 },
  drone: { file: 'lam_sfx_0018_drone.mp3', gain: 0.4 },
}

export const SFX_TUNING = {
  /** The tunnel's air follows the fan: its level is the fan's share of top speed to this power, */
  tunnelPower: 1.5,
  /** and played a little slower at low speed, a little faster at the top. */
  tunnelRate: { low: 0.75, high: 1.15 },
  /** Trimmed off each end of a loop, s, past the gap an MP3 leaves there. */
  loopTrim: 0.05,
  /** A loop's fade in and out, s (a time constant). */
  fade: 0.25,
  /** How often a replay's sounds check that the replay is still open, ms. */
  watchMs: 400,
  /** How long the fee's chime waits for the event's replay to open before playing anyway, ms. */
  replayWaitMs: 4000,
} as const

/**
 * Which effect plays at a replay's note, by `${replay}:${note kind}`.
 * `recordJet` is the land-speed replay with a jet car; `record` is the
 * streamliner. A loop runs until the replay's finish or its close.
 */
export const REPLAY_SFX: Readonly<Record<string, SfxName>> = {
  'ride:start': 'bike',
  'ride:bell': 'bike',
  'ride:finish': 'cheer',
  'jump:off': 'skiFlight',
  'jump:land': 'skiLand',
  'jump:settled': 'cheer',
  'sled:push': 'bob',
  'sled:finish': 'cheer',
  'car:start': 'raceCar',
  'car:top': 'raceCar',
  'car:finish': 'cheer',
  'truck:start': 'truck',
  'truck:climb': 'truck',
  'drone:start': 'drone',
  'drone:top': 'drone',
  'drone:finish': 'cheer',
  'plane:launch': 'plane',
  'plane:end': 'plane',
  'aircraft:pass': 'plane',
  'pod:start': 'plane',
  'record:start': 'raceCar',
  'record:through': 'raceCar',
  'recordJet:start': 'jet',
  'recordJet:through': 'jet',
}

/** The effect for a replay note, or null for notes that pass quietly. */
export function replaySfxFor(replay: string, kind: string): SfxName | null {
  return REPLAY_SFX[`${replay}:${kind}`] ?? null
}
