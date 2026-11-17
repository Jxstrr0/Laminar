/**
 * The music bed (PR 13s): two instrumental loops made with ElevenLabs Music
 * after Kelbo said yes to the quote (17 November 2026), two takes each, the
 * better one kept. A calm one plays in the lab (every screen but a replay);
 * an upbeat one plays while a replay runs. Music has its own on/off chip,
 * remembered in `laminar.music`, and the sound chip mutes it too.
 *
 * Volumes are gains (1 is full scale) on top of the master volume; times in
 * seconds.
 */
export type TrackName = 'lab' | 'replay'

export interface Track {
  /** The file in public/music/, named after its line on the music sheet. */
  file: string
  gain: number
}

export const MUSIC: Record<TrackName, Track> = {
  lab: { file: 'lam_mus_0001_lab.mp3', gain: 0.16 },
  replay: { file: 'lam_mus_0002_replay.mp3', gain: 0.2 },
}

export const MUSIC_TUNING = {
  /**
   * Each pass of a track overlaps the next by this much, fading one out as
   * the other comes in, so the loop has no seam (and an MP3's padding at
   * either end doesn't matter).
   */
  overlap: 3,
  /** Switching between the lab and a replay: the old track fades out and the new one in, over this. */
  switchFade: 1.2,
  /** How often the music queues its next pass, ms (a replay opening or closing switches it at once). */
  watchMs: 500,
  /** The next pass is queued this long before it's due, s. */
  lookAhead: 1,
} as const
