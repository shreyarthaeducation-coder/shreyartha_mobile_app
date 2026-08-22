// services/student/projectService.js
// Mirrors: frontendmain/src/student/components/MyProject/MyProject.js
//
// ONE ENDPOINT FAMILY, THREE SHAPES — `/api/students/projects/…`:
//
//   SKILLS_EDGE   one project per LEARNING OBJECTIVE   GET/POST by learningObjectiveId
//   LANGUAGE_PRO  one project per TOPIC                GET/POST by topicId
//   CODING        a LIST, add / edit / delete          GET list, POST create, PUT/DELETE by id
//
// The first two POST to their own path and the server upserts, so there is no separate create and
// update. Coding is the only one that needs an id, and the only one that can hold more than one.
//
// EVERY PART IS A FLAT `@RequestParam`, not `@RequestPart` — checked against
// StudentProjectController. That matters: `@RequestPart` string parts are the 415-before-the-handler
// trap documented in services/studentApi.js, and this family sidesteps it entirely, so `fields` is
// correct here and `json` would be wrong.

import { studentApi } from '../studentApi';

export const SECTIONS = {
  SKILLS_EDGE: 'SKILLS_EDGE',
  LANGUAGE_PRO: 'LANGUAGE_PRO',
  CODING: 'CODING',
};

/** The web's limit, enforced on the client only — the server does not check it. */
export const MAX_WORDS = 200;

/**
 * ABSENCE IS `{"exists": false}` WITH A 200, NOT A 404.
 *
 * `GET /skillsedge/{id}` and `GET /languagepro/{id}` both answer a student who has not started yet
 * with `Map.of("exists", false)`. A caller that only checked for a rejection would treat that object
 * as a project and render a form bound to `undefined` everywhere.
 */
const asProject = (data) => (data && data.id ? data : null);

export function countWords(text) {
  const trimmed = String(text ?? '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

export async function fetchSkillsEdgeProject(learningObjectiveId, signal) {
  try {
    return asProject(
      await studentApi.get(`/api/students/projects/skillsedge/${learningObjectiveId}`, { signal }),
    );
  } catch {
    // A read failure and "not started yet" are the same thing to this screen: an empty form.
    return null;
  }
}

export async function fetchLanguageProProject(topicId, signal) {
  try {
    return asProject(
      await studentApi.get(`/api/students/projects/languagepro/${topicId}`, { signal }),
    );
  } catch {
    return null;
  }
}

/** Coding is the only section that returns a LIST. */
export async function fetchCodingProjects(signal) {
  const res = await studentApi.get('/api/students/projects/coding', { signal });
  return Array.isArray(res) ? res : [];
}

/* ── Writes ──────────────────────────────────────────────────────────────── */

/**
 * `files` is `{ videoFile?, pdfFile?, pptFile? }`, each `{ uri, name, type }` or absent.
 *
 * OMITTING A FILE KEEPS THE ONE ALREADY STORED. Every file part is `required = false` and the
 * server only overwrites what it receives, so re-saving a project to change its title does not
 * silently drop the video — which is exactly what sending an empty part would do.
 */
function projectBody({ title, description, files = {}, extra = {} }) {
  return {
    fields: {
      title: String(title ?? '').trim(),
      // Sent only when non-empty, matching the web: an empty string would overwrite a real
      // description with nothing.
      ...(String(description ?? '').trim()
        ? { description: String(description).trim() }
        : {}),
      ...extra,
    },
    files: {
      ...(files.videoFile ? { videoFile: files.videoFile } : {}),
      ...(files.pdfFile ? { pdfFile: files.pdfFile } : {}),
      ...(files.pptFile ? { pptFile: files.pptFile } : {}),
    },
  };
}

export function saveSkillsEdgeProject({
  learningObjectiveId,
  title,
  description,
  chapterName,
  topicName,
  files,
}) {
  return studentApi.multipart(
    '/api/students/projects/skillsedge',
    projectBody({
      title,
      description,
      files,
      extra: {
        learningObjectiveId,
        ...(chapterName ? { chapterName } : {}),
        ...(topicName ? { topicName } : {}),
      },
    }),
  );
}

export function saveLanguageProProject({
  topicId,
  title,
  description,
  chapterName,
  topicName,
  files,
}) {
  return studentApi.multipart(
    '/api/students/projects/languagepro',
    projectBody({
      title,
      description,
      files,
      extra: {
        topicId,
        ...(chapterName ? { chapterName } : {}),
        ...(topicName ? { topicName } : {}),
      },
    }),
  );
}

export function createCodingProject({ title, description, files }) {
  return studentApi.multipart(
    '/api/students/projects/coding',
    projectBody({ title, description, files }),
  );
}

/**
 * Update any project by id.
 *
 * PUT WITH MULTIPART, which `studentApi.multipart` only reaches through its `options.method`
 * override — its default is POST. The web hits the same `/api/students/projects/{id}` and only
 * Coding uses it, because Skills Edge and Language Pro upsert through their own POST.
 */
export function updateProject(projectId, { title, description, files }) {
  return studentApi.multipart(
    `/api/students/projects/${projectId}`,
    projectBody({ title, description, files }),
    { method: 'PUT' },
  );
}

export function deleteProject(projectId) {
  return studentApi.del(`/api/students/projects/${projectId}`);
}
