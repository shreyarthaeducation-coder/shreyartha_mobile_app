/**
 * Mouth shapes for a line as it is spoken (4 Nov 2026), so a character's lips move with the words.
 * The website has the original (frontendmain .../LearnWithShreya/speaking/visemes.js); everything
 * below this header is byte-identical to it — change both together.
 *
 * Google tells us when each word STARTS (the backend's SSML marks); the shapes inside a word come
 * from its spelling, spread evenly over the word, with the lips closing in any pause. A face with no
 * timing flaps open and shut while the audio plays, so it never sits frozen.
 */

export const MOUTHS = ["closed", "small", "wide", "round", "ee", "fv"];

const PAIRS = { oo: "round", ou: "round", ow: "round", sh: "round", ch: "round", wh: "round", ph: "fv", ee: "ee", ea: "ee", th: "small" };
const LETTER = (c) => {
  if ("mbp".includes(c)) return "closed";
  if ("fv".includes(c)) return "fv";
  if ("owq".includes(c)) return "round";
  if (c === "a") return "wide";
  if ("eiy".includes(c)) return "ee";
  return "small";
};

/** The mouth shapes of one written word, repeats merged: "Mummy" → closed, small, closed, ee. */
export function wordShapes(word) {
  const w = String(word || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const out = [];
  for (let i = 0; i < w.length; i += 1) {
    let shape;
    const pair = PAIRS[w.slice(i, i + 2)];
    if (pair) {
      shape = pair;
      i += 1;
    } else if (/[0-9]/.test(w[i])) {
      shape = "wide";
    } else {
      shape = LETTER(w[i]);
    }
    if (out[out.length - 1] !== shape) out.push(shape);
  }
  return out;
}

/** About how long a word takes to say, so a pause after it closes the lips. */
const wordLength = (word) => 0.08 + 0.065 * String(word).replace(/[^A-Za-z0-9]/g, "").length;

/**
 * The line's mouth timeline, [{t, shape}] in seconds: each word's shapes spread over the time it
 * takes, lips closed in the gaps and at the end. `timing` is the backend's [{word, start}];
 * `duration`, when known, is the audio's length.
 */
export function timeline(timing, duration) {
  const out = [];
  const words = Array.isArray(timing) ? timing : [];
  words.forEach((w, i) => {
    const next = i + 1 < words.length ? words[i + 1].start : duration || w.start + wordLength(w.word) + 0.1;
    const end = Math.min(next, w.start + wordLength(w.word));
    const shapes = wordShapes(w.word);
    if (shapes.length === 0) return;
    const step = (end - w.start) / shapes.length;
    shapes.forEach((shape, k) => out.push({ t: w.start + k * step, shape }));
    out.push({ t: end, shape: "closed" });
  });
  return out;
}

/** The shape at time `t`: the last one begun. Before the first word, null (the portrait as drawn). */
export function shapeAt(line, t) {
  let lo = 0;
  let hi = line.length - 1;
  let found = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (line[mid].t <= t) {
      found = line[mid].shape;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** No timing: open and shut in a speech-like rhythm while the audio plays. */
export function flapAt(t) {
  const beat = ["small", "wide", "closed", "ee", "small", "round", "closed"];
  return beat[Math.floor(t / 0.11) % beat.length];
}
