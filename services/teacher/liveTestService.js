// Live Test Rooms — the teacher hosts a test for a whole class with no student logins.
//
// The app is the TEACHER's side only. Students do not use the app for this at all: they open the
// room's web link in any browser, which is the point of the feature — they have no phones in class
// and have forgotten their logins. So everything here is `/api/teacher/live-tests`, through
// `staffApi`, and there is deliberately no client for the public room endpoints.
//
// The web twin is frontendmain/src/School/Teacher/pages/LiveTests/liveTestApi.js.

import { staffApi } from '../staffApi';

const BASE = '/api/teacher/live-tests';

/** Where the website lives — a room's link is a page on it, not an API path. */
const SITE = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://shreyartha.com').replace(/\/+$/, '');

/** The link a class opens in a browser. */
export const roomLink = (code) => `${SITE}/room/${code}`;

/** The address to say out loud: "go to shreyartha.com/room and type the code". */
export const roomEntryAddress = () => `${SITE.replace(/^https?:\/\//, '')}/room`;

// ── What to choose from ─────────────────────────────────────────────────────
export const fetchLiveTestClasses = (signal) => staffApi.get(`${BASE}/options/classes`, { signal });
export const fetchMockPapers = (signal) => staffApi.get(`${BASE}/options/mock-papers`, { signal });
export const fetchPsychometricTests = (signal) => staffApi.get(`${BASE}/options/psychometric-tests`, { signal });
export const fetchAcademicTree = (signal) => staffApi.get(`${BASE}/options/academic-tree`, { signal });

/** How many questions a choice gives. `sectionId` decides, for an adaptive room, whose questions. */
export function previewLiveTest({ testType, sourceId, level, sectionId }, signal) {
  const params = { testType, sourceId };
  if (level) params.level = level;
  if (sectionId) params.sectionId = sectionId;
  return staffApi.get(`${BASE}/options/preview`, { params, signal });
}

// ── Rooms ───────────────────────────────────────────────────────────────────
export const fetchLiveTestRooms = (signal) => staffApi.get(BASE, { signal });
export const createLiveTestRoom = (payload) => staffApi.post(BASE, payload);
export const fetchLiveTestRoom = (roomId, signal) => staffApi.get(`${BASE}/${roomId}`, { signal });
export const setRoomLocked = (roomId, locked) => staffApi.post(`${BASE}/${roomId}/lock`, { locked });
export const startLiveTest = (roomId) => staffApi.post(`${BASE}/${roomId}/start`, {});
export const stopLiveTest = (roomId) => staffApi.post(`${BASE}/${roomId}/stop`, {});
export const extendLiveTest = (roomId, minutes) => staffApi.post(`${BASE}/${roomId}/extend`, { minutes });
export const setParticipantRemoved = (roomId, participantId, removed) =>
  staffApi.post(`${BASE}/${roomId}/participants/${participantId}/removed`, { removed });
/** One child's paper in full — for a psychometric room, the answers their report is built from. */
export const fetchLiveTestParticipant = (roomId, participantId, signal) =>
  staffApi.get(`${BASE}/${roomId}/participants/${participantId}`, { signal });

/** Where the results file is served from; fetched with the teacher's token and shared as a file. */
export const liveTestCsvEndpoint = (roomId) => `${BASE}/${roomId}/results.csv`;

/** A file name the phone will accept: the room's title without the characters a file cannot have. */
export const liveTestCsvName = (room) =>
  `${`${room?.title || 'Live test'} - ${room?.classLabel || 'results'}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()}.csv`;

// ── Merging into profiles ───────────────────────────────────────────────────
export const fetchLiveTestMatches = (roomId, signal) => staffApi.get(`${BASE}/${roomId}/matches`, { signal });
/**
 * Adds a child who is not on the class list as a student with a login. The response's
 * `created.password` is the only time that password is ever sent.
 */
export const enrolParticipant = (roomId, participantId, details) =>
  staffApi.post(`${BASE}/${roomId}/participants/${participantId}/enrol`, details);
export const setParticipantMatch = (roomId, participantId, studentId) =>
  staffApi.put(`${BASE}/${roomId}/participants/${participantId}/match`, { studentId });
/** No `participantIds` = everyone the server is sure of, in one request. */
export const mergeLiveTestResults = (roomId, options = {}) => staffApi.post(`${BASE}/${roomId}/merge`, options);

// ── Pure helpers (shared by the screen and its checker) ─────────────────────

export const LIVE_TEST_TYPES = [
  { value: 'MOCK', label: 'Mock test' },
  { value: 'PRACTICE', label: 'Practice Zone' },
  { value: 'TOPIC_QUIZ', label: 'Test Your Understanding' },
  { value: 'PSYCHOMETRIC', label: 'Psychometric assessment' },
  { value: 'ADAPTIVE', label: 'Adaptive assessment' },
];

export const LIVE_TEST_LEVELS = [
  { value: 'BASIC', label: 'Basic' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
];

/** The dropdown chain for each kind of test: each level narrows the next; the last is the choice. */
export const LIVE_TEST_CASCADES = {
  MOCK: [
    { label: 'Exam', children: 'subjects' },
    { label: 'Subject', children: 'papers' },
    { label: 'Paper' },
  ],
  PSYCHOMETRIC: [
    { label: 'Class', children: 'areas' },
    { label: 'Area', children: 'tests' },
    { label: 'Test' },
  ],
  TOPIC: [
    { label: 'Curriculum', children: 'classes' },
    { label: 'Class', children: 'subjects' },
    { label: 'Subject', children: 'chapters' },
    { label: 'Chapter', children: 'topics' },
    { label: 'Topic' },
  ],
};

/** The server's own ceiling on papers in one sitting. */
export const MAX_PAPERS = 6;

/**
 * What opening a room sends. One paper goes as it always did; several go as a list, in the order
 * they will be sat.
 */
export function roomPayload({ sectionId, testType, papers, durationMinutes, lateEntry }) {
  const list = papers || [];
  return {
    sectionId,
    testType,
    ...(list.length === 1
      ? { sourceId: list[0].sourceId, level: list[0].level ?? null }
      : { sources: list.map((p) => ({ sourceId: p.sourceId, level: p.level ?? null })) }),
    durationMinutes,
    lateEntry: !!lateEntry,
  };
}

/** How a student came in, in the words the teacher's list uses. */
export function joinLabel(participant) {
  if (!participant?.signedIn) return 'Without login';
  return participant.inClass === false ? 'Logged in · not in this class' : 'Logged in';
}

/**
 * A psychometric session split into its tests — each with its own name, which is what picks its
 * report — keeping only the tests the child answered.
 */
export function psychometricTests(parts, rows, fallbackTitle) {
  const list = parts && parts.length > 0 ? parts : [{ partNo: 1, title: fallbackTitle }];
  return list
    .map((part) => ({
      partNo: part.partNo,
      title: part.title || fallbackTitle,
      rows: (rows || []).filter((row) => (row.partNo ?? 1) === part.partNo),
    }))
    .filter((test) => test.rows.some((row) => row.answer));
}

export const cascadeFor = (testType) =>
  testType === 'MOCK' ? LIVE_TEST_CASCADES.MOCK : testType === 'PSYCHOMETRIC' ? LIVE_TEST_CASCADES.PSYCHOMETRIC : LIVE_TEST_CASCADES.TOPIC;

/** 754 → "12:34"; an hour or more → "1:02:34". */
export function clock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const pad = (n) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** "ADVANCED" → "Advanced". */
export const levelName = (level) => (level ? level.charAt(0) + level.slice(1).toLowerCase() : '');

/** One participant's result as the results list shows it. */
export function resultLine(room, p) {
  if (p.removed) return 'Removed';
  if (room.graded === false) return p.remark || '';
  const marks = `${p.scoredMarks ?? '—'} / ${p.totalMarks ?? '—'}`;
  const percent = p.scorePercent != null ? ` · ${p.scorePercent}%` : '';
  const level = p.finalLevel ? ` · reached ${levelName(p.finalLevel)}` : '';
  return `${marks}${percent} · ${p.remark || ''}${level}`;
}

/**
 * What the psychometric scoring engine wants, from a participant's saved answers: the questions
 * (with the two fields it scores on) and an answers map keyed by question id.
 */
export function psychometricInput(rows) {
  const questions = [];
  const answers = {};
  (rows || []).forEach((row) => {
    questions.push({
      id: row.id,
      questionText: row.questionText,
      questionOrder: row.questionOrder,
      skillsMeasured: row.skillsMeasured,
      bloomTaxonomy: row.bloomTaxonomy,
    });
    if (row.answer) answers[row.id] = row.answer;
  });
  return { questions, answers };
}

/** The whole results table as plain text, for the phone's share sheet. */
export function resultsAsText(room) {
  const lines = [`${room.title} — ${room.classLabel}`, room.testTypeLabel, ''];
  (room.participants || [])
    .filter((p) => !p.removed)
    .forEach((p, i) => {
      lines.push(`${i + 1}. ${p.name} (Roll ${p.rollNumber || '—'}) — ${resultLine(room, p)}`);
    });
  return lines.join('\n');
}
