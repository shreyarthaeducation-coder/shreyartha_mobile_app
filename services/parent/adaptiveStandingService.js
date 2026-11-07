import { parentApi } from '../parentApi';

/**
 * Where my child stands (7 Nov 2026) — the linked child's adaptive Class Standing. The server picks
 * the child from the parent's own sign-in; no student id is sent.
 */
const BASE = '/api/parent/dashboard/adaptive-standing';

export const fetchChildStandingSubjects = (signal) => parentApi.get(`${BASE}/subjects`, { signal });

export const fetchChildStanding = (subjectId, topicId, signal) =>
  parentApi.get(`${BASE}?subjectId=${subjectId}${topicId ? `&topicId=${topicId}` : ''}`, { signal });
