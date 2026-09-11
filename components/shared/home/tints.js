import { TINTS, TINT_CYCLE } from '../../../constants/theme';

/**
 * Lookup helpers for the pastel dashboard tints.
 *
 * The VALUES live in `constants/theme.js` — see the note there for why they are fixed hues rather
 * than washes of the portal palette, and why they are not part of `PORTALS`. This module is only
 * the two accessors, kept beside the components that use them so a call site reads
 * `tint('violet')` rather than `TINTS.violet` with a fallback written out by hand each time.
 */

/** The tint for a key, falling back to blue so an unknown name renders rather than crashing. */
export function tint(key) {
  return TINTS[key] || TINTS.blue;
}

/** The tint for position `i` in a list, cycling. Keeps a five-card rail multi-hued for free. */
export function tintAt(i) {
  return tint(TINT_CYCLE[i % TINT_CYCLE.length]);
}

export { TINTS, TINT_CYCLE };
