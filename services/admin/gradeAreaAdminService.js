// services/admin/gradeAreaAdminService.js
// Mirrors: frontendmain/src/School/Admin/pages/GradeAreaSetup.js ("Report Card Areas") and
//          GradeAreaGrades.js ("Report Card Grades") — on the School Admin and Principal sidebars.
// Backend: gradefield/controller/SchoolGradeFieldController.java —
//          @PreAuthorize("hasAnyRole('SCHOOL_ADMIN','PRINCIPAL','VICE_PRINCIPAL')")
//
// The report card's graded areas with no exam behind them (Scholastics, Co-Scholastics, Additional
// Skills), set up for the whole school at once — and, read-only, what teachers have graded.

import { staffApi } from '../staffApi';

const BASE = '/api/school-admin/grade-fields';

export const REPORT_CARD_TABS = [
  { key: 'SCHOLASTIC', label: 'Scholastics', example: 'General Knowledge' },
  { key: 'CO_SCHOLASTIC', label: 'Co-Scholastics', example: 'Life Skill' },
  { key: 'ADDITIONAL_SKILL', label: 'Additional Skills', example: 'Robotics' },
];

/** Every section of the year with how many areas it has: `[{ sectionId, sectionName, classId,
 *  className, fieldCount, studentCount }]`. */
export async function fetchCategorySections(category, academicYearId, signal) {
  const res = await staffApi.get(`${BASE}/${category}/sections`, { params: { academicYearId }, signal });
  return Array.isArray(res) ? res : [];
}

/** Area names already used somewhere in the school this year — offered to pick again. */
export async function fetchNamesInUse(category, academicYearId, signal) {
  const res = await staffApi.get(`${BASE}/${category}/names`, { params: { academicYearId }, signal });
  return Array.isArray(res) ? res : [];
}

/** Adds areas to the chosen sections — idempotent. Returns `{ created, alreadyPresent, sectionsTouched }`. */
export function addAreasToSections(category, academicYearId, fieldNames, sectionIds) {
  return staffApi.post(`${BASE}/${category}/fields/bulk`, { academicYearId, fieldNames, sectionIds });
}

/** One section's grid, read-only here: `{ className, sectionName, fields, students[{ grades }] }`. */
export function fetchCategorySheet(category, sectionId, signal) {
  return staffApi.get(`${BASE}/${category}/sheet`, { params: { sectionId }, signal });
}

/** How much of a section's grid is filled in — the question an admin asks before report cards. */
export function filledIn(sheet) {
  if (!sheet || !sheet.fields?.length || !sheet.students?.length) return null;
  const cells = sheet.fields.length * sheet.students.length;
  const done = sheet.students.reduce(
    (count, student) =>
      count +
      sheet.fields.filter((field) => {
        const grade = student.grades?.[field.id];
        return grade != null && String(grade).trim() !== '';
      }).length,
    0,
  );
  return { done, cells };
}
