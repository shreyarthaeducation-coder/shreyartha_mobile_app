/**
 * Word by word, how much of a line the student has read (1 Nov 2026) — the Speaking Challenge's
 * live marking. `heard` is what speech recognition has caught so far (it grows as they speak);
 * the line's words are matched against it the way an edit distance matches two texts, with the
 * words not yet reached costing nothing, so a half-read line is not a line full of mistakes.
 *
 * Each word of the line comes back as:
 *   READ     — said
 *   WRONG    — something else was said in its place
 *   SKIPPED  — passed over
 *   CURRENT  — the next word to say
 *   PENDING  — not reached yet
 * and a mistake is `settled` only once a later word has been read: recognition revises its last
 * word or two as more audio arrives, and a child must not be told off for a word still being said.
 *
 * The website has the original (frontendmain .../LearnWithShreya/speaking/alignWords.js); change both together.
 */

export const READ = "READ";
export const WRONG = "WRONG";
export const SKIPPED = "SKIPPED";
export const CURRENT = "CURRENT";
export const PENDING = "PENDING";
export const MISPRONOUNCED = "MISPRONOUNCED";

const NUMBERS = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8",
  nine: "9", ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15",
  sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20", thirty: "30",
  forty: "40", fifty: "50", hundred: "100",
};

/** Words recognition writes either way: "to/too/two" heard for one another is not a mistake. */
const SOUND_ALIKE = [
  ["to", "too", "two", "2"], ["for", "four", "4"], ["there", "their", "theyre"], ["hi", "high"], ["know", "no"],
  ["right", "write"], ["new", "knew"], ["hear", "here"], ["see", "sea"], ["by", "buy", "bye"],
  ["one", "won", "1"], ["eight", "ate", "8"], ["its", "it's"], ["ok", "okay"], ["mr", "mister"], ["mrs", "missus"],
];
const ALIKE = new Map();
SOUND_ALIKE.forEach((group) => group.forEach((w) => ALIKE.set(w, group[0])));

/** A word as it is compared: lower case, no punctuation, numbers as digits, sound-alikes as one. */
export function normalise(word) {
  const w = String(word || "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9']/g, "")
    .replace(/^'+|'+$/g, "");
  // A sound-alike first ("two" heard for "to", "2" for "two"), then any other number as digits.
  return ALIKE.get(w) || ALIKE.get(NUMBERS[w]) || NUMBERS[w] || w;
}

/** The line's words as shown — punctuation kept on the word — and as compared. */
export function tokens(text) {
  return String(text || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((display) => ({ display, key: normalise(display) }))
    .filter((t) => t.key !== "");
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/** The same word, allowing recognition's spelling of a longer word to be one letter off. */
export function sameWord(expected, heard) {
  if (expected === heard) return true;
  if (expected.length >= 5 && heard.length >= 4) return editDistance(expected, heard) <= 1;
  return false;
}

/**
 * @param {string} line   what the student is to read
 * @param {string} heard  what recognition has caught so far
 * @param {boolean} finished the student has stopped: nothing is still being said, every word left
 *        unread is SKIPPED and every mistake is settled
 * @returns {{words: {display:string, state:string, settled:boolean}[], progress:number, done:boolean, extra:number}}
 */
export function alignWords(line, heard, finished = false) {
  const ref = tokens(line);
  const got = tokens(heard).map((t) => t.key);
  const n = ref.length;
  const m = got.length;
  // cost[i][j]: the first i words of the line against the first j words heard.
  const cost = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const step = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
  for (let i = 1; i <= n; i++) {
    cost[i][0] = i;
    step[i][0] = "skip";
  }
  for (let j = 1; j <= m; j++) {
    cost[0][j] = j;
    step[0][j] = "extra";
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const match = sameWord(ref[i - 1].key, got[j - 1]);
      const options = [
        [cost[i - 1][j - 1] + (match ? 0 : 1), match ? "match" : "wrong"],
        [cost[i - 1][j] + 1, "skip"],
        [cost[i][j - 1] + 1, "extra"],
      ];
      options.sort((a, b) => a[0] - b[0]);
      [cost[i][j], step[i][j]] = options[0];
    }
  }
  // How far into the line the student has got: the prefix that best explains what was heard.
  // Unread words cost nothing — unless they have finished, when the whole line counts.
  let end = n;
  if (!finished) {
    end = 0;
    for (let i = 1; i <= n; i++) if (cost[i][m] <= cost[end][m]) end = i;
    if (m === 0) end = 0;
  }
  const states = new Array(n).fill(PENDING);
  let extra = 0;
  let i = end;
  let j = m;
  while (i > 0 || j > 0) {
    const s = step[i][j];
    if (s === "match" || s === "wrong") {
      states[i - 1] = s === "match" ? READ : WRONG;
      i--;
      j--;
    } else if (s === "skip") {
      states[i - 1] = SKIPPED;
      i--;
    } else {
      extra++;
      j--;
    }
  }
  if (finished) {
    for (let k = end; k < n; k++) states[k] = SKIPPED;
  } else if (end < n) {
    states[end] = CURRENT;
  }
  // Settled: everything up to the last word read — a later READ proves the student moved on.
  let lastRead = -1;
  states.forEach((s, k) => {
    if (s === READ) lastRead = k;
  });
  const words = ref.map((t, k) => ({
    display: t.display,
    state: states[k],
    settled: finished || k < lastRead || (states[k] === READ && k <= lastRead),
  }));
  const read = states.filter((s) => s !== PENDING && s !== CURRENT).length;
  return { words, progress: n === 0 ? 1 : read / n, done: n > 0 && end === n && states[n - 1] === READ, extra };
}

/** The settled mistakes of a marked line — what the screen tells the student about. */
export function settledMistakes(words) {
  return words
    .map((w, index) => ({ ...w, index }))
    .filter((w) => w.settled && (w.state === WRONG || w.state === SKIPPED || w.state === MISPRONOUNCED));
}

/**
 * Azure's verdict on the finished line, laid over the live marking: a word Azure scored as
 * mispronounced (and the live marking had as read) becomes MISPRONOUNCED.
 */
export function withAzureVerdict(words, azureWords) {
  const scored = (azureWords || []).filter((w) => w && w.word);
  let cursor = 0;
  return words.map((w) => {
    const key = normalise(w.display);
    for (let k = cursor; k < scored.length; k++) {
      if (normalise(scored[k].word) === key) {
        cursor = k + 1;
        if (w.state === READ && scored[k].errorType === "Mispronunciation") {
          return { ...w, state: MISPRONOUNCED, settled: true, accuracy: scored[k].accuracy };
        }
        return { ...w, accuracy: scored[k].accuracy };
      }
    }
    return w;
  });
}
