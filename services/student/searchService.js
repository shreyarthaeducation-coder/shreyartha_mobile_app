// services/student/searchService.js
//
// Platform search for the student panel.
//
// ── THERE IS NO SEARCH ENDPOINT. ANYWHERE. ─────────────────────────────────
// Not on the backend — zero search mappings across 191 controllers, no `LIKE` or `Containing` in
// any repository — and not on the website, whose one component called `SearchBar` is a marketing
// category navigator that queries nothing. So this index is built on the client, from the module
// trees that already exist, and the search bar on the dashboard is genuinely new behaviour rather
// than a port.
//
// ── WHY A CLIENT INDEX IS ACTUALLY FINE HERE ───────────────────────────────
// These trees are already whole-tree GETs that individual screens fetch in full today; the search
// index is six of them at once, cached, rather than a new class of load. A server-side search
// endpoint would be better at a larger catalogue, and the day the content outgrows a phone's memory
// this file becomes one call — the `SearchHit` shape below is deliberately what such an endpoint
// would return.
//
// ── THE INDEX IS PER USER AND CANNOT BE BUNDLED ────────────────────────────
// Every tree applies a **per-school topic-alias overlay** server-side (`aq_topic_aliases`,
// `cd_topic_aliases`, `lp_topic_aliases`), so two students at different schools get different names
// for the same topic id. Shipping a static index, or sharing one across accounts on a shared
// device, would show a student their classmate's vocabulary. The cache key carries the token
// fingerprint for that reason, and the cache is dropped on logout with every other auth key.
//
// ── ONE FAILURE COSTS ONE MODULE ───────────────────────────────────────────
// `settleAll`, never `Promise.all`. `/api/coding/tree` REQUIRES a student role while the others
// tolerate anonymous, and a free or college student can legitimately be refused one of these — that
// must cost its rows, not the whole feature.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { studentApi } from '../studentApi';
import { fingerprintOf, flattenTree } from '../shared/searchMatch';
import { STUDENT_SEARCH_INDEX_KEY } from '../../constants/storageKeys';

// Declared in storageKeys.js and listed in ALL_AUTH_KEYS, so a logout actually removes it. The
// fingerprint below guards against a stale read; that list is what makes the data go away.
const CACHE_KEY = STUDENT_SEARCH_INDEX_KEY;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * The six trees, and how to read each one.
 *
 * `childKeys` is the set of array properties that hold children at ANY depth. The trees genuinely
 * differ in shape — Academic IQ is curriculum→classes→subjects→chapters→topics, Skills Edge is
 * skills→topics→learningObjectives, Coding is curriculums→classes→chapters→topics — so the walker
 * is driven by these names rather than by a fixed depth. A tree that gains a level keeps working;
 * one that renames a level drops silently to its parent, which is why `SOURCES` is short enough to
 * re-read when a tree changes.
 *
 * `route` is where a hit opens. Several land on a module's landing screen rather than deep-linking
 * to the node: those screens drive their own drill state from their own tree fetch, and inventing a
 * deep-link parameter they do not read would be a link that silently does nothing.
 */
const SOURCES = [
  {
    key: 'academicIq',
    label: 'Academic IQ',
    endpoint: '/api/academiciq/tree',
    childKeys: ['classes', 'subjects', 'chapters', 'topics'],
    route: '/student/academic-iq-resources?source=school',
  },
  {
    key: 'skillsEdge',
    label: 'Skills Edge',
    endpoint: '/api/skillsedge/tree',
    childKeys: ['topics', 'learningObjectives'],
    route: '/student/skills-edge',
  },
  {
    key: 'codingPro',
    label: 'Coding Pro',
    endpoint: '/api/coding/tree',
    childKeys: ['classes', 'chapters', 'topics'],
    route: '/student/coding-pro',
  },
  {
    key: 'languagePro',
    label: 'Language Pro',
    endpoint: '/api/languagepro/tree',
    childKeys: ['classes', 'chapters', 'topics'],
    route: '/student/language-pro',
  },
  {
    key: 'psychometric',
    label: 'Psychometric',
    endpoint: '/api/psychometrics/tree',
    childKeys: ['topics', 'chapters'],
    route: '/student/psychometric',
  },
  {
    key: 'competitiveExam',
    label: 'Competitive Exam',
    endpoint: '/api/competitiveexam/exams',
    childKeys: [],
    route: '/student/competitive-exam',
  },
];

/**
 * The app's own destinations, indexed alongside the content.
 *
 * Without these, a student searching "homework" or "practice" gets nothing — the word they typed is
 * the name of a screen, not of a topic. These cost no request and are always correct.
 */
const DESTINATIONS = [
  { module: 'Your workspace', name: 'Homework', route: '/student/teacher-resources?tab=homework' },
  { module: 'Your workspace', name: "Teacher's Resources", route: '/student/teacher-resources?tab=resources' },
  // The two near-identical names are BOTH indexed on purpose. A student who types "personalised"
  // means one of them and cannot be expected to know which, so both must be reachable — and the
  // module + name together are what tells them apart in the result list.
  { module: 'Your workspace', name: 'Teacher-Assigned Resources', route: '/student/personalised-resources' },
  { module: 'Academic IQ', name: 'Personalised Resources', route: '/student/academic-iq-resources?source=personalized' },
  { module: 'Your workspace', name: 'Practice Zone', route: '/student/practice-zone' },
  { module: 'Your workspace', name: 'Academic IQ', route: '/student/academic-iq' },
  { module: 'Your workspace', name: 'Skills Edge', route: '/student/skills-edge' },
  { module: 'Your workspace', name: 'Coding', route: '/student/coding-pro' },
  { module: 'Your workspace', name: 'Language Pro', route: '/student/language-pro' },
  { module: 'Your workspace', name: 'Sound Studio', route: '/student/sound-studio' },
  { module: 'Your workspace', name: 'Psychometric Assessment', route: '/student/psychometric' },
  { module: 'Your workspace', name: 'Subject & Career', route: '/student/subject-career' },
  { module: 'Your workspace', name: 'Competitive Exam', route: '/student/competitive-exam' },
  { module: 'Your workspace', name: 'Events & Info', route: '/student/events' },
  { module: 'Your account', name: 'My Analytics', route: '/student/analytics' },
  { module: 'Your account', name: 'My Profile', route: '/student/profile' },
  { module: 'Your account', name: 'Career Preferences', route: '/student/profile?tab=career' },
  { module: 'Your account', name: 'Student Reflection', route: '/student/profile?tab=survey' },
  { module: 'Your account', name: 'Speak to Counselor', route: '/student/counselor' },
  { module: 'Your account', name: 'Change Password', route: '/student/change-password' },
].map((d) => ({ ...d, trail: '', kind: 'screen' }));

/**
 * Build the index, or return the cached one.
 *
 * @param {boolean} force skip the cache — used by pull-to-refresh
 * @returns {Promise<{ rows: Array, partial: string[] }>} `partial` names the modules that failed,
 *          so the screen can say "Coding Pro could not be included" rather than silently omitting it
 */
export async function loadSearchIndex(force = false) {
  // The student login mirrors one JWT across four keys; any of them identifies the session.
  const entries = await AsyncStorage.multiGet([
    'studentToken',
    'userToken',
    'accessToken',
    'token',
  ]);
  const fingerprint = fingerprintOf(entries.map(([, v]) => v).find((v) => v && String(v).trim()));

  if (!force) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (
          cached?.fingerprint === fingerprint &&
          cached.expiresAt > Date.now() &&
          Array.isArray(cached.rows)
        ) {
          return { rows: cached.rows, partial: cached.partial || [] };
        }
      }
    } catch {
      // A corrupt cache is a cache miss, never an error the student sees.
    }
  }

  const tasks = {};
  SOURCES.forEach((s) => {
    tasks[s.key] = studentApi.get(s.endpoint);
  });
  const settled = await studentApi.settleAll(tasks);

  const rows = [];
  const partial = [];

  SOURCES.forEach((source) => {
    const part = settled[source.key];
    if (!part || part.error || !part.data) {
      partial.push(source.label);
      return;
    }
    flattenTree(part.data, source, [], rows);
  });

  // DESTINATIONS go LAST, not first, and that is deliberate. Prepending them made screens win ties
  // by array order alone, which meant the ranking rule below ("a screen beats content at the same
  // tier") was never actually doing anything — it looked correct and was unobservable. Appending
  // them forces the ranking to be the thing that decides, so it can be tested and can't silently
  // stop working.
  rows.push(...DESTINATIONS);

  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fingerprint, expiresAt: Date.now() + CACHE_TTL_MS, rows, partial }),
    );
  } catch {
    // Storage full or unavailable — the index still works for this session.
  }

  return { rows, partial };
}

/** Drop the cached index. Called on logout with the rest of the session. */
export function clearSearchIndex() {
  return AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}

/**
 * Matching and grouping live in services/shared/searchMatch.js.
 *
 * The parent panel now builds its own index too, and while the INDEXES differ and should, the
 * ranking must not — a second copy is how "homework" starts putting a topic above the screen on one
 * panel and not the other. Re-exported here so every existing caller and checker keeps importing
 * from one place.
 */
export { searchIndex, groupResults } from '../shared/searchMatch';
