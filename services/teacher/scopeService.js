// services/teacher/scopeService.js
// Shared lookups behind the Academic Year → Class → Section scope picker.
// Mirrors: frontendmain/src/School/shared/AcademicYearPicker.js

import { staffApi } from '../staffApi';

/**
 * Academic years for the signed-in staff member's school.
 *
 * Returned **current year first**, then startDate descending. Choose the default by
 * `current === true` rather than by index 0 — `startDate` is nullable, so the ordering of the tail
 * is DB-dependent.
 *
 * The controller answers a failure with `{ success:false, message }` — an OBJECT, not an array —
 * so the guard below matters; mapping over it directly would throw.
 *
 * @returns {Promise<Array<{ id: number, yearLabel: string, startDate: string|null,
 *                           endDate: string|null, current: boolean, active: boolean,
 *                           classCount: number }>>}
 */
export async function fetchAcademicYears(signal) {
  const res = await staffApi.get('/api/school/academic-years', { signal });
  return Array.isArray(res) ? res : [];
}

/** The year the picker should land on: the school's current one, else the first available. */
export function defaultAcademicYear(years = []) {
  return years.find((year) => year.current === true) || years[0] || null;
}

const byName = (a, b) =>
  String(a ?? '').localeCompare(String(b ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });

/**
 * Sort a class tree by name at every level. The backend sorts none of it — every service path just
 * iterates repository order — so without this the picker's order drifts between sessions.
 */
function sortTree(classes) {
  return classes
    .map((cls) => ({
      ...cls,
      sections: [...(cls.sections || [])]
        .map((section) => ({
          ...section,
          subjects: [...(section.subjects || [])].sort((a, b) =>
            byName(a.subjectName, b.subjectName),
          ),
        }))
        .sort((a, b) => byName(a.sectionName, b.sectionName)),
    }))
    .sort((a, b) => byName(a.className, b.className));
}

/**
 * ScopePicker loader backed by a `…/classes` endpoint.
 *
 * The shape is VERIFIED for `/api/teacher/attendance/classes` (no subjects) and
 * `/api/teacher/groups/classes` (subjects, but **no `academicIqSubjectId`**) — the same builder,
 * one key apart. Other features' `…/classes` endpoints must be checked before reuse;
 * `/api/teacher/available-classes` returns `SchoolClassResponse`, a different shape whose
 * `academicYearId` the mapper never populates.
 *
 * `academicYearId` is optional server-side and resolves to the school's current year when omitted;
 * a school with no academic years yields `200 []`, not an error.
 *
 * Call this at module scope so the returned function keeps a stable identity — ScopePicker's
 * fetcher effect keys on it.
 */
export function classesFromEndpoint(endpoint) {
  return async (academicYearId, signal) => {
    const res = await staffApi.get(endpoint, { params: { academicYearId }, signal });
    return Array.isArray(res) ? sortTree(res) : [];
  };
}

/**
 * ScopePicker loader for endpoints returning `SchoolClassResponse[]` — notably
 * `GET /api/teacher/reports/my-classes`, which backs both Test and Examination and
 * My Adaptive Assessment.
 *
 * **The key names differ from the `…/classes` endpoints.** This DTO family uses a plain `id` at
 * every level (`cls.id`, `section.id`, `subject.id`) where the attendance/groups maps use
 * `classId`/`sectionId`/`subjectId`. Feeding it to ScopePicker unmapped produces a picker with
 * every option keyed `undefined` — it renders, and nothing is ever selectable. Hence this adapter.
 *
 * `subjects[].academicIqSubjectId` IS populated here (unlike `/api/teacher/groups/classes`), so
 * this loader also serves screens that need curriculum chapters.
 */
export function classesFromSchoolClasses(endpoint) {
  return async (academicYearId, signal) => {
    const res = await staffApi.get(endpoint, { params: { academicYearId }, signal });
    if (!Array.isArray(res)) return [];

    return sortTree(
      res.map((cls) => ({
        classId: cls.id,
        className: cls.className,
        sections: (cls.sections || []).map((section) => ({
          sectionId: section.id,
          sectionName: section.sectionName,
          subjects: (section.subjects || []).map((subject) => ({
            subjectId: subject.id,
            subjectName: subject.subjectName,
            academicIqSubjectId: subject.academicIqSubjectId ?? null,
          })),
        })),
      })),
    );
  };
}

/**
 * ScopePicker loader backed by `GET /api/teacher/profile` → `assignedClasses[]`.
 *
 * Use this whenever the screen needs **`academicIqSubjectId`** (the link to curriculum content, and
 * the path param for `/api/teacher/academic/subjects/{id}/chapters`). The profile response is the
 * only one that carries it *and* the academic year on the same row —
 * `/api/teacher/groups/classes` omits it entirely, and `/api/teacher/available-classes` has it but
 * leaves `academicYearId` null.
 *
 * `assignedClasses` is a flat list covering **every** academic year, so the year filter is applied
 * here rather than server-side. Subjects are de-duplicated: a teacher assigned the same subject
 * twice in one section appears once (the web's equivalent reduce does not do this and can emit
 * duplicate rows).
 */
export function classesFromProfile() {
  return async (academicYearId, signal) => {
    const profile = await staffApi.get('/api/teacher/profile', { signal });
    const assignments = Array.isArray(profile?.assignedClasses) ? profile.assignedClasses : [];

    const classes = new Map();

    assignments
      .filter((row) => !academicYearId || row.academicYearId === academicYearId)
      .forEach((row) => {
        if (!classes.has(row.classId)) {
          classes.set(row.classId, {
            classId: row.classId,
            className: row.className,
            sections: new Map(),
          });
        }
        const sections = classes.get(row.classId).sections;

        if (!sections.has(row.sectionId)) {
          sections.set(row.sectionId, {
            sectionId: row.sectionId,
            sectionName: row.sectionName,
            subjects: new Map(),
          });
        }
        const subjects = sections.get(row.sectionId).subjects;

        if (!subjects.has(row.subjectId)) {
          subjects.set(row.subjectId, {
            subjectId: row.subjectId,
            subjectName: row.subjectName,
            // Null when the school admin never linked this subject to curriculum content; the
            // chapters call will 400 for it, so consumers must show the "not linked" state.
            academicIqSubjectId: row.academicIqSubjectId ?? null,
          });
        }
      });

    return sortTree(
      [...classes.values()].map((cls) => ({
        ...cls,
        sections: [...cls.sections.values()].map((section) => ({
          ...section,
          subjects: [...section.subjects.values()],
        })),
      })),
    );
  };
}
