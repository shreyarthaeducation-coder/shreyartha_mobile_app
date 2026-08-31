// services/shared/searchMatch.js
//
// The matcher and the grouper, shared by every portal's search.
//
// ── WHY THIS IS ITS OWN FILE ────────────────────────────────────────────────
// Two portals now build a client-side index — the student's over six content trees, the parent's
// over their child's academic tree — and there is no search endpoint anywhere in the backend to
// standardise them. The INDEXES differ and should; the ranking must not. A second copy of these
// rules is how "homework" starts putting a topic above the screen on one panel and not the other.
//
// A row is `{ module, name, trail, route, kind }` where `kind` is 'screen' or 'content'. That shape
// is deliberately what a server-side search endpoint would return, so the day the catalogue outgrows
// a phone this file survives and only the index builders are replaced.

/** More than a phone should render at once, and more than anyone scrolls. */
const MAX_RESULTS = 60;

/**
 * Match `query` against a set of indexed rows.
 *
 * Case-insensitive, and **every whitespace-separated word must appear** somewhere in the name or
 * the trail — so "class 9 trig" finds a topic whose class is in its breadcrumb. A single substring
 * test over the joined string would require the words in the right order, which is not how anyone
 * types a search.
 *
 * Ranking, in order: an exact name, then a name that starts with the query, then a name that
 * contains it, then a trail-only match. Within a tier a screen beats content — someone typing
 * "homework" or "fees" wants to GO there, not to read a topic that mentions it.
 *
 * That last half-point is load-bearing and easy to render inert: it only decides anything when a
 * screen and a piece of content tie, so an index that happens to list its destinations first would
 * mask its removal entirely. Index builders append destinations LAST for exactly that reason.
 */
export function searchIndex(rows, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];

  const words = q.split(/\s+/).filter(Boolean);

  const scored = [];
  for (const row of rows) {
    const name = String(row.name || '').toLowerCase();
    const trail = String(row.trail || '').toLowerCase();
    const hay = `${name} ${trail}`;

    if (!words.every((w) => hay.includes(w))) continue;

    let score;
    if (name === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (name.includes(q)) score = 2;
    else score = 3;
    if (row.kind === 'screen') score -= 0.5;

    scored.push({ row, score });
  }

  scored.sort((a, b) => a.score - b.score || a.row.name.length - b.row.name.length);
  return scored.slice(0, MAX_RESULTS).map((s) => s.row);
}

/** Results grouped by module, preserving the ranked order within each group. */
export function groupResults(results) {
  const groups = [];
  const byModule = new Map();
  results.forEach((row) => {
    if (!byModule.has(row.module)) {
      const group = { module: row.module, rows: [] };
      byModule.set(row.module, group);
      groups.push(group);
    }
    byModule.get(row.module).rows.push(row);
  });
  return groups;
}

/**
 * Flatten a `{ name, <childKey>: [...] }` tree into rows.
 *
 * The trees genuinely differ in shape between modules — Academic IQ is
 * curriculum→classes→subjects→chapters→topics, Skills Edge is skills→topics→learningObjectives — so
 * the walk is driven by a set of child-array NAMES rather than a fixed depth. A tree that gains a
 * level keeps working; one that renames a level drops quietly to its parent, which is why the key
 * lists are kept short enough to re-read.
 *
 * `trail` is the breadcrumb of ANCESTOR names only — it is both what the result row shows beneath
 * the title and part of what is matched. A node must never include itself, or every row reads
 * "Photosynthesis › Photosynthesis".
 */
export function flattenTree(node, source, trail, out) {
  if (Array.isArray(node)) {
    node.forEach((child) => flattenTree(child, source, trail, out));
    return;
  }
  if (!node || typeof node !== 'object') return;

  const name = typeof node.name === 'string' ? node.name.trim() : '';
  const nextTrail = name ? [...trail, name] : trail;

  if (name) {
    out.push({
      module: source.label,
      name,
      trail: trail.join(' › '),
      route: source.route,
      kind: 'content',
    });
  }

  source.childKeys.forEach((key) => {
    if (Array.isArray(node[key])) flattenTree(node[key], source, nextTrail, out);
  });
}

/**
 * A stable, non-reversible fingerprint of whatever token identifies the session.
 *
 * Every content tree carries a per-school alias overlay server-side, so one account's index must
 * never answer another's searches on a shared device. This is the guard against a stale READ; the
 * key's presence in `ALL_AUTH_KEYS` is what makes the data actually go away on logout. Both are
 * needed.
 */
export function fingerprintOf(token) {
  let hash = 0;
  const text = String(token || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return String(hash);
}
