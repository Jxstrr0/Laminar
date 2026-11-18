/**
 * The quick tutorial (PR 13ai, Kelbo 18 November 2026): five swipe cards that
 * a new player sees once, before the first job. Each card's text lives in
 * strings.ts as `tour.<id>.head` and `tour.<id>.body`; the picture on it is
 * picked by id in src/ui/tour.ts. The guided first job takes over after.
 */
export const TOUR_CARDS = ['welcome', 'board', 'shape', 'tunnel', 'deliver'] as const
export type TourCard = (typeof TOUR_CARDS)[number]

/** Set once the cards have shown, so they never pop up again on their own. */
export const TOUR_SEEN_KEY = 'laminar.tourSeen'
