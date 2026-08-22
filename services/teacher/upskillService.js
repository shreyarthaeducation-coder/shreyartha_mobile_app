// services/teacher/upskillService.js
// Mirrors: frontendmain/src/School/Teacher/pages/TeacherUpskill.js
// Backend: teacherskillsedge/controller/TeacherSkillsEdgeController.java
//
// A read-only content reader: chapters → sub-skills → learning objectives → modules. There is no
// progress tracking anywhere in this feature.
//
// NOTE the endpoint prefix is `/api/teacher-skillsedge/`, which does NOT contain `/teacher/` with
// both slashes — under the old `apiService` token rule that fell through to the student token.
// `staffApi` always sends `schoolUserToken`, so that trap is neutralised here.
//
// Every GET below is guarded ADMIN | TEACHER | VICE_PRINCIPAL | PRINCIPAL. COUNSELOR and
// SCHOOL_ADMIN get a hard 403 — which is exactly why this screen must never run through a client
// that force-logs-out on 403.

import { staffApi } from '../staffApi';

const BASE = '/api/teacher-skillsedge';

/** The enum the backend actually sends on a module. NOT a MIME type — see fetchModule. */
export const MODULE_TYPE = {
  PDF: 'PDF',
  VIDEO: 'VIDEO',
  IMAGE: 'IMAGE',
  TEXT: 'TEXT',
  LINK: 'LINK',
};

/**
 * Top-level chapters.
 *
 * The response probably carries the **entire tree** — `open-in-view` is on and the lazy
 * collections are `@JsonManagedReference`, so each chapter can drag its topics, their objectives
 * and every module's HTML with it. Ignore the nested arrays and use the per-level calls below;
 * that keeps the payload we actually parse small even if the wire payload isn't.
 */
export async function fetchUpskillChapters(signal) {
  const res = await staffApi.get(`${BASE}/chapters`, { signal });
  return Array.isArray(res)
    ? res.map((c) => ({ id: c.id, name: c.name, description: c.description }))
    : [];
}

/**
 * Sub-skills of a chapter.
 *
 * Uses the kebab-case alias, as the web does. `/topics?chapterId` is the same service method under
 * a different name; sticking to one keeps us aligned with the web client.
 */
export async function fetchSubSkills(chapterId, signal) {
  const res = await staffApi.get(`${BASE}/subskills`, { params: { chapterId }, signal });
  return Array.isArray(res) ? res.map((t) => ({ id: t.id, name: t.name })) : [];
}

/** Learning objectives of a sub-skill. Again the kebab alias, keyed by `subSkillId`. */
export async function fetchLearningObjectives(subSkillId, signal) {
  const res = await staffApi.get(`${BASE}/learning-objectives`, {
    params: { subSkillId },
    signal,
  });
  return Array.isArray(res) ? res.map((lo) => ({ id: lo.id, text: lo.text })) : [];
}

/**
 * Modules of a learning objective, ordered.
 *
 * @returns {Promise<Array<{ id, title, moduleOrder, contentType, s3Key, s3Url, textContent,
 *   linkUrl, learningObjectiveId }>>}
 */
export async function fetchModules(learningObjectiveId, signal) {
  const res = await staffApi.get(`${BASE}/modules`, {
    params: { learningObjectiveId },
    signal,
  });
  return Array.isArray(res) ? res : [];
}

/**
 * One module, with a **presigned** `s3Url` valid for one hour.
 *
 * The list endpoint returns the bare stored URL, which 403s on a private bucket — so always fetch
 * the detail before showing media, and re-fetch when a player errors or the screen resumes after a
 * long pause.
 */
export function fetchModule(moduleId, signal) {
  return staffApi.get(`${BASE}/modules/${moduleId}`, { signal });
}

/**
 * Content the school admin has hidden.
 *
 * Applies to chapters, sub-skills and learning objectives (not modules). Skipping it means
 * teachers see material that was deliberately taken down. Note it is a display filter, not access
 * control — a hidden objective is still reachable by id.
 *
 * @returns {Promise<{ CHAPTER: Set<number>, SUB_SKILL: Set<number>, LEARNING_OBJECTIVE: Set<number> }>}
 */
export async function fetchHiddenNodes(signal, tree = 'TEACHER_SKILLS_EDGE') {
  const empty = { CHAPTER: new Set(), SUB_SKILL: new Set(), LEARNING_OBJECTIVE: new Set() };
  try {
    // `tree` selects the content tree: TEACHER_SKILLS_EDGE here, PSYCHOMETRIC for the counsellor's
    // Wellness Groups. The response keys vary by tree, so callers read the ones they care about.
    const res = await staffApi.get(`/api/public/hidden-nodes/${tree}`, { signal });
    if (!res || typeof res !== 'object') return empty;
    const out = { ...empty };
    Object.entries(res).forEach(([key, ids]) => {
      out[key] = new Set((Array.isArray(ids) ? ids : []).map(Number));
    });
    return out;
  } catch {
    // Degrade to showing everything rather than blanking the screen, as the web hook does.
    return empty;
  }
}

export const visible = (hidden, entityType, list) =>
  (list || []).filter((item) => !hidden?.[entityType]?.has(Number(item.id)));

/**
 * What kind of content a module actually is.
 *
 * Switches on the `contentType` **enum** first. The web sniffs it as though it were a MIME type
 * (`startsWith("image/")` and friends), which can never match, so its detection silently runs off
 * the filename extension alone — kept here only as a fallback.
 */
export function moduleKind(module) {
  const declared = String(module?.contentType || '').toUpperCase();
  if (MODULE_TYPE[declared]) return declared;

  const key = String(module?.s3Key || module?.s3Url || '').toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(key)) return MODULE_TYPE.IMAGE;
  if (/\.(mp4|mov|m4v|webm)$/.test(key)) return MODULE_TYPE.VIDEO;
  if (/\.pdf$/.test(key)) return MODULE_TYPE.PDF;
  if (module?.linkUrl) return MODULE_TYPE.LINK;
  return MODULE_TYPE.TEXT;
}
