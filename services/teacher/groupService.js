// services/teacher/groupService.js
// Mirrors: frontendmain/src/School/Teacher/pages/TeacherGroups.js
// Backend: teacher/controller/StudentGroupController.java (+ StudentGroupService.java)
//
// Ability grouping: a teacher sorts a class into four bands PER SUBJECT. The same vocabulary is
// reused platform-wide as `targetGroupLevel` on homework and resources — see GROUP_LEVELS in
// constants/theme.js, whose keys are the exact strings the backend validates against.
//
// LIKE THE REST OF THE TEACHER API, THIS IS NAME-KEYED. `/classes` hands back classId/sectionId/
// subjectId, but every read and write below takes className/sectionName/subjectName STRINGS. The
// ids exist for list keys and the picker only.

import { staffApi } from '../staffApi';
import { classesFromEndpoint } from './scopeService';

/**
 * ScopePicker loader for this feature. Unlike attendance's, this endpoint carries subjects — but
 * NOT `academicIqSubjectId`, so it can't drive anything that needs curriculum chapters.
 * Module scope keeps the identity stable for ScopePicker's fetcher effect.
 */
export const groupClassesLoader = classesFromEndpoint('/api/teacher/groups/classes');

/**
 * The literal the backend recognises as "every subject I teach in this class/section".
 *
 * It is a REAL server-side fan-out, but ONLY on POST /save, where it writes one identical row per
 * subject. `GET /api/teacher/groups` does a plain string comparison, so reading back with
 * subjectName="ALL" returns an empty list — never fetch groups for it. The web has the same guard
 * (TeacherGroups.js:91).
 */
export const ALL_SUBJECTS = 'ALL';

/**
 * The roster for a class-section.
 *
 * Note the id field is `id`, not `studentId` — this is `AttendanceStudentResponse`, and
 * `rollNumber` on it is never populated by the service, so don't render it.
 *
 * This endpoint has no try/catch server-side, so "You are not assigned to this class/section"
 * arrives as a 500 with a framework body rather than the usual `{success,message}`. staffApi still
 * turns it into a readable error, but `message` won't be the friendly one.
 *
 * @returns {Promise<Array<{ id: number, fullName: string, email: string, currentClass: string,
 *                           section: string }>>}
 */
export function fetchGroupStudents({ className, sectionName }, signal) {
  return staffApi.get('/api/teacher/groups/students', {
    params: { className, sectionName },
    signal,
  });
}

/**
 * Existing group assignments for one class-section-subject.
 *
 * `id` on each row is the **group-assignment** id — that is what updateGroupLevel and
 * removeGroupAssignment take, not the student id.
 *
 * @returns {Promise<Array<{ id: number, studentId: number, studentName: string,
 *   studentEmail: string, className: string, sectionName: string, subjectName: string,
 *   groupLevel: string, createdAt: string, updatedAt: string|null }>>}
 */
export function fetchGroups({ className, sectionName, subjectName }, signal) {
  return staffApi.get('/api/teacher/groups', {
    params: { className, sectionName, subjectName },
    signal,
  });
}

/**
 * Write group assignments.
 *
 * A PER-STUDENT UPSERT, NOT A REPLACE-ALL. Students omitted from `entries` keep whatever row they
 * already had — dropping someone here does not un-assign them. Removal is
 * `removeGroupAssignment`. (A DB unique constraint on
 * (teacher, student, class, section, subject) means re-sending is safe.)
 *
 * Pass `subjectName: ALL_SUBJECTS` to fan out across every subject the teacher teaches in that
 * class/section.
 *
 * @param {{ className: string, sectionName: string, subjectName: string,
 *           entries: Array<{ studentId: number, groupLevel: string }> }} payload
 */
export function saveGroups(payload) {
  return staffApi.post('/api/teacher/groups/save', payload);
}

/** Move one student to a different band. The body carries only the level; the path carries the id. */
export function updateGroupLevel(groupId, groupLevel) {
  return staffApi.put(`/api/teacher/groups/${groupId}`, { groupLevel });
}

/** The only way to un-assign a student — `saveGroups` can't do it. */
export function removeGroupAssignment(groupId) {
  return staffApi.del(`/api/teacher/groups/${groupId}`);
}

/* ── Shreyartha teacher (Portal B) ───────────────────────────────────────────────────────────
 *
 * `/api/shreya01/groups` is NOT the teacher endpoint with a prefix swap. Three differences, all
 * load-bearing:
 *
 *   1. **No subject tier.** Portal B classes carry `subjects: []`, so there is nothing to pick and
 *      the ALL fan-out has no meaning here. Scope is School → Class, full stop.
 *   2. **`/save` takes a BARE ARRAY** with the class in the query string —
 *      `POST /save?classId=N` with `[{studentId, groupLevel}]` — not Portal A's
 *      `{className, sectionName, subjectName, entries}` object. Posting the object shape sends the
 *      server an empty list and silently saves nothing.
 *   3. **There is no PUT.** Shreya01GroupController exposes GET /students, POST /save, GET and
 *      DELETE /{groupId} — no update-level route, so a student is re-levelled by saving again
 *      rather than by editing a row.
 *
 * DELETE does exist here even though the web page never calls it; without it a mis-assignment
 * would be permanent, so the View tab keeps its remove action.
 */

const SHREYA01_GROUPS_BASE = '/api/shreya01/groups';

export function fetchShreya01GroupStudents({ classId }, signal) {
  return staffApi.get(`${SHREYA01_GROUPS_BASE}/students`, { params: { classId }, signal });
}

export function fetchShreya01Groups({ classId }, signal) {
  return staffApi.get(SHREYA01_GROUPS_BASE, { params: { classId }, signal });
}

/** @param {{ classId: number, entries: Array<{studentId: number, groupLevel: string}> }} payload */
export function saveShreya01Groups({ classId, entries }) {
  // The bare array IS the body; classId rides in the query string.
  return staffApi.post(`${SHREYA01_GROUPS_BASE}/save?classId=${encodeURIComponent(classId)}`, entries);
}

export function removeShreya01GroupAssignment(groupId) {
  return staffApi.del(`${SHREYA01_GROUPS_BASE}/${groupId}`);
}
