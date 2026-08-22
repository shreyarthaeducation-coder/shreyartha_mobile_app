// constants/mouthShapes.js
// Copied verbatim from frontendmain/src/student/platform/LanguagePro/phonetics/mouthShapes.js.
// Pure data plus two pure helpers (lerpParams, resolveShapes) — no DOM, no imports, so it runs
// unchanged in React Native. The visemes are deliberate: /p/, /b/ and /m/ SHARE a posture
// because they are genuinely identical from the front, which is why lip-readers confuse them.

/**
 * Front-view mouth postures.
 *
 * A front view can only honestly show what a listener can actually SEE, which
 * is why several sounds share a posture: /p/, /b/ and /m/ look identical because
 * they *are* identical from the front — that is exactly why lip-readers confuse
 * them. Those groups are called visemes, and phonemeCatalog.test.js pins the
 * expected ones so an accidental merge (or split) is caught.
 *
 * Every value is 0..1 so any two postures can be tweened:
 *   jawOpen            how far the lips are apart
 *   lipRound           corners pulled in and forward (o/u/w)
 *   lipSpread          corners pulled back (ee smile)
 *   teethOnLip         top teeth resting on the bottom lip (f/v)
 *   tongueBetweenTeeth tongue tip showing between the teeth (th)
 *   tongueUp           tongue tip raised to the ridge behind the top teeth
 *   backClosure        the back of the tongue blocking the throat (k/g/ng)
 */

/** Spreading this into every preset means a newly added parameter can never
 *  arrive as `undefined` and turn a tween into NaN. */
const BASE = {
  jawOpen: 0,
  lipRound: 0,
  lipSpread: 0,
  teethOnLip: 0,
  tongueBetweenTeeth: 0,
  tongueUp: 0,
  backClosure: 0,
};

const shape = (overrides) => ({ ...BASE, ...overrides });

export const NEUTRAL = shape({ jawOpen: 0.25, lipSpread: 0.1 });

export const MOUTH_SHAPES = {
  // ---- Closures and their releases -------------------------------------
  // Lips sealed (p, b, m).
  closed: shape({ jawOpen: 0.02, lipSpread: 0.1 }),
  bilabialRelease: shape({ jawOpen: 0.24, lipSpread: 0.08 }),

  // Tongue tip sealed against the ridge behind the top teeth (t, d, n, l).
  // The jaw is nearly shut during the hold — it opens as the tongue drops.
  alveolarClosed: shape({ jawOpen: 0.18, lipSpread: 0.14, tongueUp: 1 }),
  alveolarRelease: shape({ jawOpen: 0.36, lipSpread: 0.12, tongueUp: 0.12 }),

  // Back of the tongue sealed against the soft palate (k, g, ŋ). Invisible from
  // the front on its own, so `backClosure` shades the back of the cavity.
  velarClosed: shape({ jawOpen: 0.24, lipSpread: 0.08, backClosure: 1 }),
  velarRelease: shape({ jawOpen: 0.5, lipSpread: 0.1, backClosure: 0.08 }),

  // ---- Continuant consonant postures ----------------------------------
  teethOnLip: shape({ jawOpen: 0.2, lipSpread: 0.2, teethOnLip: 1 }),
  tongueBetweenTeeth: shape({ jawOpen: 0.25, lipSpread: 0.2, tongueBetweenTeeth: 1 }),
  sibilant: shape({ jawOpen: 0.1, lipSpread: 0.45 }),
  roundedNarrow: shape({ jawOpen: 0.22, lipRound: 0.5 }),
  /** /h/ — an open, unobstructed breath; deliberately not the velar closure. */
  breathOpen: shape({ jawOpen: 0.42, lipSpread: 0.08 }),

  // ---- Vowel postures --------------------------------------------------
  slightOpen: shape({ jawOpen: 0.18, lipSpread: 0.05 }),
  spread: shape({ jawOpen: 0.2, lipSpread: 0.9 }),
  spreadRelaxed: shape({ jawOpen: 0.25, lipSpread: 0.55 }),
  /** /ɛ/ "bed" — mid FRONT, so the corners stay a little spread. */
  midFront: shape({ jawOpen: 0.38, lipSpread: 0.3 }),
  /** /ʌ/ "cup" — mid CENTRAL, lips completely relaxed. */
  midNeutral: shape({ jawOpen: 0.36, lipSpread: 0 }),
  midOpen: shape({ jawOpen: 0.4, lipSpread: 0.15 }),
  /** /æ/ "cat" — low FRONT: jaw down AND corners pulled back, teeth showing. */
  wideSpread: shape({ jawOpen: 0.72, lipSpread: 0.5 }),
  /** /ɑ/ "hot" — low BACK: the widest drop, lips neutral. */
  wideOpen: shape({ jawOpen: 0.85, lipSpread: 0.12 }),
  rounded: shape({ jawOpen: 0.3, lipRound: 0.95 }),
  roundedRelaxed: shape({ jawOpen: 0.3, lipRound: 0.55 }),
  roundedOpen: shape({ jawOpen: 0.6, lipRound: 0.6 }),
};

const PARAM_KEYS = Object.keys(BASE);

/**
 * Blend two postures. `t` is 0..1; callers clamp before calling.
 * The endpoints return the exact preset so a fully-reached posture is precisely
 * the target rather than a float approximation of it.
 */
export function lerpParams(from, to, t) {
  if (t >= 1) return { ...to };
  if (t <= 0) return { ...from };
  const out = {};
  PARAM_KEYS.forEach((k) => {
    const a = from[k] || 0;
    const b = to[k] || 0;
    out[k] = a + (b - a) * t;
  });
  return out;
}

/** Resolve a catalog `shape` value (a key, or a [from, to] pair) to presets. */
export function resolveShapes(shapeSpec) {
  const get = (k) => MOUTH_SHAPES[k] || NEUTRAL;
  if (Array.isArray(shapeSpec)) return shapeSpec.map(get);
  return [get(shapeSpec)];
}
