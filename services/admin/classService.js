// services/admin/classService.js
// Mirrors: frontendmain/src/School/Admin/pages/ClassManagement.js — 1,282 lines, 20 API calls,
//          the largest single page in the port.
// Backend: school/controller/SchoolClassManagementController.java + AcademicYearController
//
// FOUR NAMESPACES, NOT ONE. Besides /api/school-admin/classes this page also reads
// /api/school/academic-years, /api/curriculum/my-school/classes and /api/coding/curriculums —
// the last two supply the CATALOGUE of classes and subjects a school is allowed to create, which
// is why the create forms are pick-lists rather than free text.
//
// THE ONE STRUCTURAL FACT: a school's tree is Academic Year → Class → Section → Subject, and every
// write is scoped to the level above it. Classes are created in BULK by name, sections in BULK by
// name, subjects in BULK with ids. There is no single-item create anywhere.

import { staffApi } from '../staffApi';
import { SHARED_ADMIN_API } from '../../constants/schoolAdminPortals';

/** The web offers exactly these six section names, hardcoded. Not fetched from anywhere. */
export const SECTION_NAMES = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Subject types the picker offers; the batch shares one type. */
export const SUBJECT_TYPES = [
  { value: 'THEORY', label: 'Theory' },
  { value: 'PRACTICAL', label: 'Practical' },
];

/** Responses are sometimes bare arrays, sometimes wrapped. The web tries all three keys. */
const asClassList = (res) =>
  Array.isArray(res) ? res : res?.data || res?.classes || [];

/**
 * The school's own class tree for one academic year.
 *
 * @returns {Promise<Array<{ id, className, sections: Array<{ id, sectionName,
 *   subjects: Array<{ id, subjectName, subjectCode, subjectType, academicIqSubjectId }> }> }>>}
 */
export async function fetchSchoolClasses(apiBase, academicYearId, signal) {
  if (!academicYearId) return [];
  const res = await staffApi.get(`${apiBase}?academicYearId=${academicYearId}`, { signal });
  return asClassList(res);
}

/**
 * The CATALOGUE of classes and subjects this school's board offers.
 *
 * The web tries `/api/curriculum/my-school/classes` first and falls back to
 * `/classes/academic-options`, which returns the same data under different keys — and it repeats
 * the fallback a second time inside its own catch. Both paths are kept because they genuinely
 * return different shapes (`board` vs `schoolBoard`), but the doubled catch is not reproduced.
 *
 * @returns {Promise<{ classes: Array<{ id, name, subjects: Array<{ id, name, subjectCode }> }>,
 *   board: string|null }>}
 */
export async function fetchAcademicCatalogue(apiBase, signal) {
  try {
    const res = await staffApi.get(SHARED_ADMIN_API.curriculumClasses, { signal });
    if (Array.isArray(res?.classes) && res.classes.length > 0) {
      return { classes: res.classes, board: res.board || null };
    }
  } catch {
    // Fall through to the school-admin twin below.
  }
  try {
    const fallback = await staffApi.get(`${apiBase}/academic-options`, { signal });
    return {
      classes: Array.isArray(fallback?.classes) ? fallback.classes : [],
      board: fallback?.schoolBoard || null,
    };
  } catch {
    return { classes: [], board: null };
  }
}

/** Coding curriculums are offered alongside academic subjects, as extra pickable subjects. */
export async function fetchCodingCurriculums(signal) {
  try {
    const res = await staffApi.get(SHARED_ADMIN_API.codingCurriculums, { signal });
    return Array.isArray(res) ? res : [];
  } catch {
    // A school without Coding Pro simply has none; the subject picker still works.
    return [];
  }
}

/* ── academic years ────────────────────────────────────────────────────────────────────────── */

/** Create a year. `setCurrent: false` matches the web — switching current is a separate action. */
export function createAcademicYear(writesBase, yearLabel) {
  return staffApi.post(writesBase, { yearLabel: String(yearLabel).trim(), setCurrent: false });
}

/**
 * Copy one year's whole tree into another.
 *
 * Returns `{ result: { classesCopied, sectionsCopied, subjectsCopied } }` — the counts are what
 * the confirmation message reports, and are the only feedback that it did anything.
 */
export async function importAcademicYear(writesBase, fromYearId, toYearId) {
  const res = await staffApi.post(`${writesBase}/${fromYearId}/import-to/${toYearId}`);
  return res?.result || {};
}

/* ── classes / sections / subjects ─────────────────────────────────────────────────────────── */

/** Bulk create by NAME. There is no single-class create endpoint. */
export function createClasses(apiBase, { classNames, academicYearId }) {
  return staffApi.post(`${apiBase}/bulk`, { classNames, academicYearId });
}

export function deleteClass(apiBase, classId) {
  return staffApi.del(`${apiBase}/${classId}`);
}

export function createSections(apiBase, { classId, sectionNames }) {
  return staffApi.post(`${apiBase}/sections/bulk`, { classId, sectionNames });
}

export function deleteSection(apiBase, sectionId) {
  return staffApi.del(`${apiBase}/sections/${sectionId}`);
}

/**
 * Bulk create subjects on one section.
 *
 * NOTE THE ENDPOINT NAME: `/subjects/bulk-with-ids`, not `/subjects/bulk`. The plain `/bulk` twin
 * exists and takes names only — using it would drop `academicIqSubjectId`, which is the link to
 * the curriculum that every downstream feature (chapters, topics, homework) depends on.
 */
export function createSubjects(apiBase, { sectionId, subjects }) {
  return staffApi.post(`${apiBase}/subjects/bulk-with-ids`, { sectionId, subjects });
}

export function updateSubject(apiBase, subjectId, { subjectName, subjectCode, subjectType }) {
  return staffApi.put(`${apiBase}/subjects/${subjectId}`, {
    subjectName: subjectName.trim(),
    subjectCode: subjectCode.trim(),
    subjectType,
  });
}

export function deleteSubject(apiBase, subjectId) {
  return staffApi.del(`${apiBase}/subjects/${subjectId}`);
}

/* ── what is still creatable, given what already exists ────────────────────────────────────── */

/** Catalogue classes the school hasn't created yet, matched by NAME. */
export function availableClasses(catalogueClasses, existingClasses) {
  return (catalogueClasses || []).filter(
    (candidate) => !(existingClasses || []).some((cls) => cls.className === candidate.name),
  );
}

/** Of the six fixed section names, those this class doesn't have. */
export function availableSections(schoolClass) {
  const taken = (schoolClass?.sections || []).map((s) => s.sectionName);
  return SECTION_NAMES.filter((name) => !taken.includes(name));
}

/**
 * Catalogue subjects for one class that the chosen section doesn't already have.
 *
 * MATCHED BY NAME AT BOTH ENDS — the catalogue class is found by `ac.name === cls.className`, and
 * existing subjects by `subjectName`. So a renamed class silently offers nothing.
 */
export function availableAcademicSubjects(catalogueClasses, schoolClass, section) {
  if (!schoolClass) return [];
  const match = (catalogueClasses || []).find((ac) => ac.name === schoolClass.className);
  if (!match?.subjects) return [];
  const taken = (section?.subjects || []).map((s) => s.subjectName);
  return match.subjects.filter((s) => !taken.includes(s.name));
}

export function availableCodingSubjects(codingCurriculums, section) {
  const taken = (section?.subjects || []).map((s) => s.subjectName);
  return (codingCurriculums || []).filter((c) => !taken.includes(c.name));
}

/**
 * Build the `subjects[]` payload from the three sources the form offers.
 *
 * Every subject needs a CODE — the web refuses the whole batch if one is missing, and so does
 * this. Academic subjects carry `academicIqSubjectId`, coding ones `codingCurriculumId`, and a
 * custom subject carries neither, which is exactly how the backend tells them apart.
 *
 * @throws {Error} naming the first subject without a code
 */
export function buildSubjectPayload({
  academicNames = [],
  codingNames = [],
  customName = '',
  codes = {},
  customCode = '',
  subjectType = 'THEORY',
  catalogueSubjects = [],
  codingCurriculums = [],
}) {
  const subjects = [];

  for (const name of academicNames) {
    subjects.push({
      subjectName: name,
      academicIqSubjectId: catalogueSubjects.find((s) => s.name === name)?.id || null,
      subjectType,
      subjectCode: (codes[name] || '').trim(),
    });
  }

  for (const name of codingNames) {
    subjects.push({
      subjectName: name,
      academicIqSubjectId: null,
      codingCurriculumId: codingCurriculums.find((c) => c.name === name)?.id || null,
      subjectType,
      subjectCode: (codes[name] || '').trim(),
    });
  }

  if (customName.trim()) {
    subjects.push({
      subjectName: customName.trim(),
      academicIqSubjectId: null,
      subjectType,
      subjectCode: customCode.trim(),
    });
  }

  const missing = subjects.find((s) => !s.subjectCode);
  if (missing) throw new Error(`Please enter a subject code for ${missing.subjectName}.`);
  return subjects;
}
