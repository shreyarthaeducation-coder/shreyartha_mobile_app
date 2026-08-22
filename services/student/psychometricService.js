// services/student/psychometricService.js
// Mirrors: frontendmain/src/student/platform/PsychometricAssessment/PsychometricAssessment.js
//
// Tree shape: CLASS → chapters → topics. The student never picks a class — theirs is resolved
// against the tree, which is the fiddliest part of this feature and lives here rather than in the
// component (see `resolveClassNode`).
//
// SPELLINGS: the content is `/api/psychometrics/` (plural "psychometrics"), the counsellor gate is
// `/api/students/psychometric/enabled-topics` (plural "students", SINGULAR "psychometric"). Both
// are real. See the header of services/studentApi.js.

import { studentApi } from '../studentApi';
import { shuffleArray } from '../../utils/shuffle';
import { normalizeClassName } from '../../utils/classMatch';

export function fetchTree(signal) {
  return studentApi
    .get('/api/psychometrics/tree', { signal })
    .then((r) => (Array.isArray(r) ? r : []));
}

/** Shuffled on arrival, as the web does. The display order then drives the scoring fallback. */
export async function fetchQuestions(topicId, signal) {
  const res = await studentApi.get(`/api/psychometrics/topics/${topicId}/questions`, { signal });
  return shuffleArray(Array.isArray(res) ? res : []);
}

/**
 * Record an attempt.
 *
 * FIRE AND FORGET, by design: the web wraps this in a try/catch that only logs, and shows the
 * report from local state either way. A student who has just answered forty questions must see
 * their result even if the save fails, so callers must not gate the report on this resolving.
 */
export function submitAssessment(topicId, answers, results) {
  return studentApi.post('/api/psychometrics/submit', { topicId, answers, results });
}

/**
 * Topic ids this student has already answered at least one question in.
 *
 * Purely for ticking off finished topics in the list, so it FAILS SOFT: an older server without the
 * endpoint returns nothing here rather than breaking the screen, and the list simply shows no ticks.
 *
 * @returns {Promise<Set<string>>} empty when unavailable
 */
export async function fetchCompletedTopicIds(signal) {
  try {
    const res = await studentApi.get('/api/psychometrics/progress', { signal });
    const ids = Array.isArray(res?.completedTopicIds) ? res.completedTopicIds : [];
    return new Set(ids.map(String));
  } catch {
    return new Set();
  }
}

/**
 * The student's own saved answers for one topic, so a finished assessment can be REOPENED.
 *
 * ANSWERS, NOT A REPORT. The server stores what was picked, never a score; the caller feeds these
 * back through `processAssessmentResults` — the same function the live submit uses — so there is
 * one scoring implementation rather than a second one on the server drifting from it.
 *
 * Returns a map shaped exactly like the screen's `answers` state (`{[questionId]: 'Yes'}`), keyed by
 * NUMBER to match `q.id`. Stringified keys would silently miss every lookup.
 *
 * Empty is a normal answer, not an error: a topic the student has not taken has no rows.
 *
 * @returns {Promise<Object>} `{}` when nothing is stored or the endpoint is unavailable
 */
export async function fetchSavedAnswers(topicId, signal) {
  try {
    const res = await studentApi.get(`/api/psychometrics/results?topicId=${topicId}`, { signal });
    const list = Array.isArray(res?.answers) ? res.answers : [];
    const map = {};
    list.forEach((a) => {
      if (a?.questionId != null && a.answer != null) map[a.questionId] = a.answer;
    });
    return map;
  } catch {
    return {};
  }
}

/**
 * Topic ids a COUNSELLOR has switched on for this student.
 *
 * THE FAILURE MODE IS INVERTED from the other access gates, and deliberately so. `null` means
 * "no opinion — show everything": a school that has never used this feature has no records at all,
 * and treating that as "nothing enabled" would lock every student out of every assessment.
 * An empty ARRAY is different — it means the counsellor has enabled nothing yet.
 *
 * @returns {Promise<Set<string>|null>} null when the endpoint is unavailable
 */
export async function fetchEnabledTopicIds(signal) {
  try {
    const res = await studentApi.get('/api/students/psychometric/enabled-topics', { signal });
    return new Set(Array.isArray(res) ? res.map(String) : []);
  } catch {
    return null;
  }
}

/* ── Resolving the student's class against the tree ────────────────────── */

/**
 * Is this a college student?
 *
 * The web reads the JWT role (`ROLE_COLLEGE_STUDENT` / `ROLE_FREE_COLLEGE_STUDENT`) via
 * `services/authUtils.js`. There is no equivalent on mobile, and the app already derives this from
 * the profile record in `components/student/profile/CareerTab.js` — the same two fields, kept
 * consistent here rather than introducing a second, JWT-based source of truth for one screen.
 */
export function isCollegeStudent(studentProfile) {
  return !!(studentProfile?.isCollegeStudent || studentProfile?.collegeName);
}

/** "VIII" → 8. Non-numeral characters are stripped first, so "Class VIII" works. */
export function romanToInt(s) {
  if (!s) return null;
  const up = String(s).toUpperCase().replace(/[^IVXLCDM]/g, '');
  if (!up) return null;
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  let prev = 0;
  for (let i = up.length - 1; i >= 0; i -= 1) {
    const v = map[up[i]] || 0;
    if (v < prev) total -= v;
    else total += v;
    prev = v;
  }
  return total || null;
}

/** Digits win over numerals: "Class 8" → "8", "VIII" → "8", "Nursery" → "Nursery". */
function canonicalLabel(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;
  const digits = s.match(/\d+/);
  if (digits) return digits[0];
  const r = romanToInt(s);
  if (r) return String(r);
  return s;
}

function extractNumber(s) {
  const m = String(s || '').match(/\d+/);
  if (m) return m[0];
  const r = romanToInt(s);
  return r ? String(r) : null;
}

/* ── A recovery pass the web does not have ─────────────────────────────────
   `romanToInt` strips every character that is not a Roman numeral, so the surrounding word poisons
   the result: "Class VIII" keeps C, L, V, I, I, I → CLVIII → **158**, not 8. Both the tree side
   and the profile side are mangled identically, so "Class VIII" still matches "Class VIII" — the
   bug is self-cancelling while both sides are written the same way.

   It bites when they are NOT: a student whose profile says "8" against a tree class named
   "Class VIII" resolves to nothing, and the screen says "No psychometric content found for your
   class". Class names are free text typed by an admin (`AdminPsychometric.js` — a bare
   "+ Add class" input), so this is reachable in production.

   This pass runs ONLY after both faithful passes have failed. It can therefore never change a
   resolution the website gets right — it only recovers ones the website gets wrong. Fixing
   `romanToInt` itself would have changed the canonical value on BOTH sides and diverged from the
   web wherever the web currently succeeds.

   It delegates to `utils/classMatch`, which is the website's OWN correct implementation — Coding
   Pro matches the numeral as a word (`/\b(…|viii|…)\b/`) and gets "Class VIII" → 8. Phase 3 wrote
   a bespoke workaround here before noticing that a working version already existed a few folders
   away in the same codebase. */

const looseNumber = (s) => normalizeClassName(s) || null;

/** Depth-first search for a node that looks like a class — i.e. one that has `chapters`. */
function searchNested(node, matches) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = searchNested(item, matches);
      if (found) return found;
    }
    return null;
  }
  if (Array.isArray(node.chapters) && (node.name || node.id) && matches(node)) return node;
  for (const key of Object.keys(node)) {
    const found = searchNested(node[key], matches);
    if (found) return found;
  }
  return null;
}

/**
 * Find the student's class node in the psychometric tree.
 *
 * THE MATCH IS BY LABEL, NOT BY ID, because the two sides are authored independently: the tree's
 * classes are named by an admin ("Class VIII", "8", "Grade 8") and the student's class comes from
 * their profile in whatever form it was entered. Hence canonicalisation through digits and Roman
 * numerals, and two profile sources.
 *
 * COLLEGE STUDENTS SKIP ALL OF IT and take the first node. They have no class, and the product
 * decision is a single shared content set — the backend returns exactly one COLLEGE-scoped class.
 *
 * @param {Array}  tree            from fetchTree
 * @param {object} studentProfile  /api/students/profile
 * @param {object} academicProfile /api/academic/profile
 * @param {boolean} isCollege
 * @returns {{ node: object|null, reason: string|null }}
 */
export function resolveClassNode(tree, studentProfile, academicProfile, isCollege) {
  const fullTree = Array.isArray(tree) ? tree : [];

  if (isCollege) {
    return { node: fullTree[0] || null, reason: fullTree[0] ? null : 'NO_CONTENT' };
  }

  const labelCandidates = [];
  const idCandidates = [];

  if (studentProfile) {
    const cand =
      studentProfile.currentClass ??
      studentProfile.current_class ??
      studentProfile.class ??
      studentProfile.className ??
      studentProfile.current_class_name ??
      studentProfile.currentClassName;
    const label = canonicalLabel(cand);
    if (label) labelCandidates.push(label);
  }

  if (academicProfile) {
    if (academicProfile.classId != null) idCandidates.push(String(academicProfile.classId));
    const label = canonicalLabel(academicProfile.className ?? academicProfile.currentClass ?? null);
    if (label) labelCandidates.push(label);
  }

  if (labelCandidates.length === 0) {
    const fallback =
      studentProfile?.currentClass || studentProfile?.class || studentProfile?.classId || null;
    const label = canonicalLabel(fallback);
    if (label) labelCandidates.push(label);
  }

  const labels = [...new Set(labelCandidates.map((v) => String(v).trim()).filter(Boolean))];
  const ids = [...new Set(idCandidates.map((v) => String(v).trim()).filter(Boolean))];

  if (labels.length === 0 && ids.length === 0) return { node: null, reason: 'NO_CLASS' };

  // Pass 1 — top-level classes by name, then the same test applied depth-first.
  if (labels.length > 0) {
    for (const cls of fullTree) {
      const name = cls?.name != null ? String(cls.name).trim() : '';
      if (!name) continue;
      if (labels.includes(name)) return { node: cls, reason: null };
      const num = extractNumber(name);
      if (num && labels.includes(num)) return { node: cls, reason: null };
    }
    const nested = searchNested(fullTree, (node) => {
      const name = node.name ? String(node.name).trim() : '';
      if (!name) return false;
      if (labels.includes(name)) return true;
      const num = extractNumber(name);
      return !!(num && labels.includes(num));
    });
    if (nested) return { node: nested, reason: null };
  }

  // Pass 2 — by id, same two sweeps.
  if (ids.length > 0) {
    for (const cls of fullTree) {
      const idStr = cls?.id != null ? String(cls.id) : null;
      if (idStr && ids.includes(idStr)) return { node: cls, reason: null };
    }
    const nested = searchNested(fullTree, (node) => {
      const idStr = node.id != null ? String(node.id) : null;
      return !!(idStr && ids.includes(idStr));
    });
    if (nested) return { node: nested, reason: null };
  }

  // Pass 3 — the recovery pass described above. Only reached when the web would already have
  // given up, so it cannot change a resolution the website gets right.
  const loose = [
    ...new Set(
      [
        ...labels,
        studentProfile?.currentClass,
        studentProfile?.current_class,
        studentProfile?.class,
        studentProfile?.className,
        academicProfile?.className,
        academicProfile?.currentClass,
      ]
        .map(looseNumber)
        .filter(Boolean),
    ),
  ];
  if (loose.length > 0) {
    const found = searchNested(fullTree, (node) => {
      const n = looseNumber(node.name);
      return !!(n && loose.includes(n));
    });
    if (found) return { node: found, reason: null };
  }

  return { node: null, reason: 'NO_CONTENT' };
}

/** The two messages the web shows for the two ways resolution can fail. */
export const CLASS_ERRORS = {
  NO_CLASS:
    'Could not determine your class from profiles. Please set your class in Personal Details or Academic IQ.',
  NO_CONTENT: 'No psychometric content found for your class. Please check your profile settings.',
};
