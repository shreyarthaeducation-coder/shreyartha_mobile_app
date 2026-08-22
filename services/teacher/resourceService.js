// services/teacher/resourceService.js
// Mirrors: frontendmain/src/School/Teacher/pages/AssignHomework.js
// Backend: teacher/controller/TeacherController.java (resources, submissions, topic completion)
//          teacher/controller/TeacherAcademicController.java (curriculum chapters)
//
// One module behind FOUR screens: Assign Homework / Submitted Homeworks (resourceType HOMEWORK)
// and My Resources / Mark Completed (resourceType RESOURCE). The web serves them from a single
// component with a `group` prop; so do we.

import { staffApi } from '../staffApi';
import { classesFromProfile } from './scopeService';

/**
 * ScopePicker loader for this feature.
 *
 * Profile-backed, NOT one of the `…/classes` endpoints, because this screen needs
 * `academicIqSubjectId` to fetch curriculum chapters and `/api/teacher/profile` is the only
 * response that carries it alongside the academic year. Module scope keeps the identity stable.
 */
export const resourceClassesLoader = classesFromProfile();

/**
 * `resourceType` values. These are matched with exact JPA string equality on read AND stored
 * verbatim on write, so a lowercase value silently returns [] and a typo on upload orphans the row
 * from both filters permanently. Never build these strings by hand.
 */
export const RESOURCE_TYPE = {
  HOMEWORK: 'HOMEWORK',
  RESOURCE: 'RESOURCE',
};

/**
 * Chapters for a subject, each with its topics nested.
 *
 * Takes `academicIqSubjectId` — the curriculum id — NOT the `subjectId` used everywhere else.
 * They are different id spaces. Null means the school admin never linked the subject; the call
 * would 400, so callers must check first and show the "not linked to curriculum" state.
 *
 * **Render `topics[].displayName`**, which is the school-admin alias falling back to the real name.
 * There is a sibling endpoint `/academic/chapters/{id}/topics`, but it returns raw names with no
 * aliases — using both would show the same topic under two different names. This one nests topics
 * already, so the sibling is never needed.
 *
 * On failure the controller returns an OBJECT (`{success, message, chapters: []}`), not an array.
 *
 * @returns {Promise<Array<{ id: number, name: string, topicCount: number,
 *   topics: Array<{ id: number, name: string, aliasName: string|null, displayName: string }> }>>}
 */
export async function fetchChapters(academicIqSubjectId, signal) {
  const res = await staffApi.get(
    `/api/teacher/academic/subjects/${academicIqSubjectId}/chapters`,
    { signal },
  );
  return Array.isArray(res) ? res : [];
}

/**
 * Every homework or resource in a section for one subject, in a single call.
 *
 * The web fetches per topic, once per topic expansion; one section-wide call and a client-side
 * group by `topicId` is far better over mobile data and is what the accordion needs anyway.
 *
 * NOTE `TeacherResourceResponse.reviewed` / `reviewedAt` are always `false` / `null` — the server's
 * mapper never populates them regardless of DB state. Don't render them.
 * There is also no `assignedDate` field; the web's `hw.assignedDate || hw.createdAt` always falls
 * through to `createdAt`.
 *
 * @returns {Promise<Array<{ id: number, resourceType: string, title: string, description: string,
 *   fileUrl: string|null, fileType: 'IMAGE'|'PDF'|'VIDEO'|'OTHER'|null, fileName: string|null,
 *   chapterId: number|null, chapterName: string|null, topicId: number|null, topicName: string|null,
 *   classId: number|null, sectionId: number|null, subjectId: number|null,
 *   createdAt: string, dueDate: string|null, targetGroupLevel: string|null,
 *   teacherId: number, teacherName: string }>>}
 */
export async function fetchSectionResources({ sectionId, subjectId, type }, signal) {
  const res = await staffApi.get(`/api/teacher/resources/section/${sectionId}`, {
    params: { subjectId, type },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

/**
 * Who has turned in one homework.
 *
 * Read-only: there is no review, grade or mark-reviewed endpoint anywhere in this feature, and the
 * web page has no such action either. Don't invent one.
 *
 * @returns {Promise<Array<{ id: number, homeworkId: number, studentId: number, studentName: string,
 *   fileUrl: string|null, fileType: string|null, fileName: string|null,
 *   submittedAt: string|null, turnedIn: boolean, late: boolean }>>}
 */
export async function fetchSubmissions(homeworkId, signal) {
  const res = await staffApi.get(`/api/teacher/homework/${homeworkId}/submissions`, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Create a homework or resource.
 *
 * THE MULTIPART SHAPE IS THE WHOLE POINT. The backend takes `@RequestPart("data")` — a JSON *part*,
 * resolved through Jackson, which accepts only `application/json`. React Native labels plain-string
 * parts `text/plain`, which Spring rejects with a **415 before the handler even runs**.
 * `staffApi.multipart({ json })` emits `{ string, type: 'application/json' }` for exactly this; it
 * is the equivalent of the web's `new Blob([json], { type: 'application/json' })`.
 *
 * The `file` part is optional. Its `type` must be set correctly or the server derives
 * `fileType: 'OTHER'` for everything — see utils/filePicker.js.
 *
 * There is NO assignment check server-side: `classId`/`sectionId`/`subjectId` resolve with
 * `.orElse(null)`, so a wrong id yields a cheerful 201 with `sectionId: null` and a resource that
 * never appears in any section-filtered list again. Always pass ids straight from the picker.
 *
 * @param {object} data  TeacherResourceRequest — see buildResourcePayload
 * @param {{uri: string, name: string, type: string}} [file]
 */
export function createResource(data, file) {
  return staffApi.multipart('/api/teacher/resources/upload', {
    json: { data },
    files: file ? { file } : undefined,
  });
}

/**
 * Update a homework or resource. Same two parts as create.
 *
 * PARTIALLY DESTRUCTIVE — the service overwrites `title`, `description`, `chapterId` and `topicId`
 * unconditionally, so anything omitted is nulled; always send the full payload. Conversely
 * `dueDate` and `targetGroupLevel` are written only when non-null, so they **cannot be cleared**
 * through this API, and `resourceType` is ignored entirely. Don't offer a "clear due date" the
 * backend can't honour.
 */
export function updateResource(id, data, file) {
  return staffApi.multipart(
    `/api/teacher/resources/${id}`,
    { json: { data }, files: file ? { file } : undefined },
    { method: 'PUT' }, // multipart(endpoint, parts, options) — method belongs in options
  );
}

/** Delete a resource. Also removes the S3 object, unlike a file swap on update. */
export function deleteResource(id) {
  return staffApi.del(`/api/teacher/resources/${id}`);
}

/**
 * Which topics this teacher has marked complete for a section+subject.
 *
 * Raw entity, not a DTO: `teacherId`/`sectionId`/`subjectId` on each row are `@Transient` and
 * always serialize as null, so correlate by `topicId` against what you asked for.
 *
 * @returns {Promise<Array<{ id: number, chapterId: number, topicId: number,
 *   completed: boolean, completedAt: string|null, notes: string|null }>>}
 */
export async function fetchTopicCompletions({ sectionId, subjectId }, signal) {
  const res = await staffApi.get('/api/teacher/topic-completions', {
    params: { sectionId, subjectId },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

/**
 * Flip a topic's completion state.
 *
 * **THIS IS A TOGGLE, NOT AN IDEMPOTENT SET.** The service method is literally
 * `toggleTopicCompletion`: the first call marks complete, the second marks incomplete. So it must
 * never be retried on a timeout, never fired from an effect, and the control must be disabled while
 * the request is in flight — a double-tap silently undoes itself.
 *
 * `chapterId` is recorded only on the first call; later calls with a different chapter won't move it.
 */
export function toggleTopicCompletion({ sectionId, subjectId, chapterId, topicId }) {
  return staffApi.post('/api/teacher/topic-completion', {
    sectionId,
    subjectId,
    chapterId,
    topicId,
  });
}

/**
 * Student ids per ability band, used to show live counts on the target-group picker.
 * Keyed by class/section/subject **name strings**, like the rest of the groups API.
 *
 * @returns {Promise<Record<string, number[]>>} e.g. { PROFICIENT: [3, 9], GOOD: [], … }
 */
export async function fetchGroupedStudentIds({ className, sectionName, subjectName }, signal) {
  const res = await staffApi.get('/api/teacher/groups/grouped-ids', {
    params: { className, sectionName, subjectName },
    signal,
  });
  return res && typeof res === 'object' && !Array.isArray(res) ? res : {};
}

/**
 * Assemble a `TeacherResourceRequest`.
 *
 * Centralised so every caller sends the complete set — see the note on updateResource about
 * omitted fields being nulled.
 */
export function buildResourcePayload({
  resourceType,
  title,
  description,
  scope,
  chapterId,
  topicId,
  dueDate,
  targetGroupLevel,
}) {
  return {
    resourceType,
    title: (title || '').trim(),
    description: (description || '').trim(),
    classId: scope.classId,
    sectionId: scope.sectionId,
    subjectId: scope.subjectId,
    chapterId: chapterId ?? null,
    topicId: topicId ?? null,
    // Already in the backend's LocalDateTime shape (utils/dates.toLocalDateTimeString).
    dueDate: dueDate || null,
    // Empty string means "all students"; the server stores null for that.
    targetGroupLevel: targetGroupLevel || null,
  };
}

/* ── Shreyartha teacher (Portal B) ───────────────────────────────────────────────────────────
 *
 * `/api/shreya01/homework/**` is not the teacher namespace with a prefix swap. Four differences:
 *
 *   1. **Listed per TYPE, not per section.** `GET /homework/class/{classId}?type=HOMEWORK|RESOURCE`
 *      replaces `GET /resources/section/{sectionId}?subjectId=&type=`. Two calls, one per tab,
 *      keyed by class.
 *   2. **Upload is FLAT `@RequestParam`s** — `title`, `description`, `resourceType`, `dueDate`,
 *      `sectionId`, `subjectId`, `file` as ordinary form fields. It does NOT take the
 *      `@RequestPart("data")` JSON part Portal A needs, so it sidesteps the 415 trap entirely:
 *      `staffApi.multipart({ fields })`, never `{ json }`.
 *   3. **There is no update route.** Portal A can PUT a resource; here an item is deleted and
 *      re-uploaded, so no edit affordance may be offered.
 *   4. Curriculum and topic completion stay on `/api/teacher/academic/*` and
 *      `/api/teacher/topic-completion(s)` for BOTH portals — those are already exported above and
 *      must not be duplicated here.
 *
 * `sectionId` is the SHREYA01 *virtual* section carried on the subject row. Nobody picks it; it
 * rides along with the subject chip (see SchoolClassPicker's includeSubject).
 */

const SHREYA01_HOMEWORK_BASE = '/api/shreya01/homework';

/** One tab's worth of items. `type` must come from RESOURCE_TYPE — exact string match, as ever. */
export async function fetchShreya01Resources({ classId, type }, signal) {
  const res = await staffApi.get(`${SHREYA01_HOMEWORK_BASE}/class/${classId}`, {
    params: { type },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

export async function fetchShreya01Submissions(homeworkId, signal) {
  const res = await staffApi.get(`${SHREYA01_HOMEWORK_BASE}/${homeworkId}/submissions`, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Create a homework or resource in Portal B.
 *
 * @param {{classId: number, title: string, description?: string, resourceType: string,
 *          dueDate?: string|null, sectionId?: number|null, subjectId?: number|null}} data
 * @param {{uri: string, name: string, type: string}} [file]
 */
export function createShreya01Resource(data, file) {
  const { classId, ...rest } = data;
  // Only send what has a value — the server treats a blank string as a real value for `dueDate`
  // and fails to parse it.
  const fields = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== null && v !== undefined && v !== '') fields[k] = String(v);
  }
  return staffApi.multipart(`${SHREYA01_HOMEWORK_BASE}/class/${classId}/upload`, {
    fields,
    files: file ? { file } : undefined,
  });
}

export function deleteShreya01Resource(id) {
  return staffApi.del(`${SHREYA01_HOMEWORK_BASE}/${id}`);
}
