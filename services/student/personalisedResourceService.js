// services/student/personalisedResourceService.js
// Mirrors: frontendmain/src/student/components/PersonalisedResources/PersonalisedResourcesModal.js
// Server:  backendmain/.../student/controller/StudentPersonalisedResourceController.java
//
// ══ READ THIS BEFORE TOUCHING THE SPELLING ═════════════════════════════════
// There are TWO endpoints one letter apart, they are DIFFERENT FEATURES, and both are real:
//
//   /api/students/personali**s**ed-resources   ← THIS FILE. British `s`.
//       StudentPersonalisedResourceController. A flat list of the resource RECORDS a teacher
//       assigned to this student individually — PDF / VIDEO / LINK / NOTE, each with an
//       `assignedDate`, a `learningGapLevel` and a completion flag. Backs the website's third
//       floating button and its calendar.
//
//   /api/students/personali**z**ed-resources   ← NOT this file. American `z`.
//       PersonalizedResourcesController (a different package entirely — `academic/`). Returns the
//       student's OWN Academic IQ profile selections as a subjects→chapters→topics TREE. No
//       teacher is involved anywhere in it. Lives in academicIqService.fetchPersonalizedSubjects.
//
// The mobile app implemented the `z` one and, for a long time, nothing else — which is why
// "personalised resources isn't fetching" was reported against a screen that was working
// correctly, for a feature that had never been built. studentApi.js's header warns about
// `/api/student/` vs `/api/students/`; this pair is the second trap and now has its own note there.
//
// ── ROLES ───────────────────────────────────────────────────────────────────
// FREE_STUDENT / SCHOOL_STUDENT / PREMIUM_STUDENT. College students get a 403 — render it, do not
// swallow it into an empty list.

import { studentApi } from '../studentApi';

const BASE = '/api/students/personalised-resources';

/**
 * Everything assigned to this student. No parameters — the server resolves them from the JWT.
 *
 * Each row is a `PersonalisedResourceResponse`:
 *   { id, teacherName, studentId, studentName, topicId, topicName, chapterName, subjectName,
 *     learningGapLevel, title, description, resourceType, fileUrl, linkUrl,
 *     createdAt, assignedDate, completedAt, completed }
 *
 * `completed` is DERIVED server-side from `completedAt != null`. The website reads `isCompleted`,
 * a property this DTO does not have, so its tick never lights up; the parent portal's
 * LearningActivitiesScreen already found and documented that. Read `completed`.
 */
export async function fetchPersonalisedResources(signal) {
  const res = await studentApi.get(BASE, { signal });
  return Array.isArray(res) ? res : [];
}

/** The same records narrowed to one topic. Used from a topic screen, not from the calendar. */
export async function fetchPersonalisedForTopic(topicId, signal) {
  const res = await studentApi.get(`${BASE}/topic/${topicId}`, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Tick or untick one resource.
 *
 * PUT with no body, and the response is the updated record — `{ completed, completedAt, ... }` —
 * so the caller should merge the server's answer rather than toggling its own copy. That matters
 * because `completedAt` is a real timestamp the card displays.
 */
export function setResourceCompleted(resourceId, completed) {
  return studentApi.put(`${BASE}/${resourceId}/${completed ? 'complete' : 'uncomplete'}`);
}

/**
 * The local calendar key for a resource: `YYYY-MM-DD`.
 *
 * ── WHY NOT `toISOString()` ─────────────────────────────────────────────────
 * `assignedDate` is a `LocalDate` ("2026-08-24") and `createdAt` is a `LocalDateTime`. Running
 * either through `toISOString()` converts to UTC first, so anywhere east of Greenwich an evening
 * timestamp lands on the previous day and the dot appears on the wrong square. The parent port hit
 * exactly this on a multi-day range. Read the local date parts instead.
 *
 * A bare `LocalDate` string is returned untouched — `new Date("2026-08-24")` parses as UTC
 * midnight, which is the same shift by another route.
 */
export function resourceDateKey(resource) {
  const raw = resource?.assignedDate || resource?.createdAt;
  if (!raw) return null;

  const text = String(raw);
  const bare = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (bare) return `${bare[1]}-${bare[2]}-${bare[3]}`;

  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  return dateKey(d);
}

/** `YYYY-MM-DD` from a Date, in the device's own timezone. */
export function dateKey(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `{ 'YYYY-MM-DD': [resource, …] }` — what the calendar puts a dot on. */
export function groupByDate(resources) {
  const map = {};
  (resources || []).forEach((r) => {
    const key = resourceDateKey(r);
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });
  return map;
}

/** Icon + label per `resourceType`, matching the web's `RESOURCE_TYPE_META`. */
export const RESOURCE_TYPE_META = {
  PDF: { icon: 'document-text-outline', label: 'PDF' },
  VIDEO: { icon: 'play-circle-outline', label: 'Video' },
  LINK: { icon: 'link-outline', label: 'Link' },
  NOTE: { icon: 'create-outline', label: 'Note' },
};

/** The meta for a row, with a sane fallback for a type the server adds later. */
export function typeMeta(resourceType) {
  return (
    RESOURCE_TYPE_META[resourceType] || {
      icon: 'attach-outline',
      label: resourceType || 'Resource',
    }
  );
}
