// services/teacher/gradeAreaService.js
// Mirrors: frontendmain/src/School/Teacher/pages/GradeAreas.js
// Backend: gradefield/controller/TeacherGradeFieldController.java (/api/teacher/grade-fields)
//
// Scholastics, Co-Scholastics and Additional Skills — the graded areas of a report card that no exam
// produces ("Life Skill: A", "Robotics: A"). One screen, three categories.

import { staffApi } from '../staffApi';

const BASE = '/api/teacher/grade-fields';

/** The three categories, with the website's titles, blurbs and example areas. */
export const GRADE_AREA_CATEGORIES = {
  SCHOLASTIC: {
    title: 'Scholastics',
    blurb:
      'Subjects graded without an exam behind them — General Knowledge, Computer, Art Education. Add the areas this section is graded on, then record a grade for each student.',
    example: 'General Knowledge',
  },
  CO_SCHOLASTIC: {
    title: 'Co-Scholastics',
    blurb: 'The Co-Scholastic Areas of the report card — Life Skill, SEWA Activity, Health & Physical Education, Discipline.',
    example: 'Life Skill',
  },
  ADDITIONAL_SKILL: {
    title: 'Additional Skills',
    blurb: 'Skill and Sports Based Areas — Robotics, Music, Art, Chess, Dance, Football, Cricket and the rest.',
    example: 'Robotics',
  },
};

/** The teacher's own class-sections: `[{ sectionId, className, sectionName }]`. */
export async function fetchGradeSections(signal) {
  const res = await staffApi.get(`${BASE}/my-sections`, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * One section's sheet for a category: `{ sectionId, className, sectionName, fields: [{ id,
 * fieldName, displayOrder }], students: [{ studentId, studentName, rollNumber, grades: { [fieldId]:
 * grade } }] }`.
 */
export function fetchGradeSheet(category, sectionId, signal) {
  return staffApi.get(`${BASE}/${category}/sheet`, { params: { sectionId }, signal });
}

/** Adds one area to a section. */
export function addGradeField(category, sectionId, fieldName) {
  return staffApi.post(`${BASE}/${category}/fields`, { sectionId, fieldName });
}

/** Adds areas to several sections at once — safe to repeat: an existing one is kept. */
export function addGradeFieldsBulk(category, fieldNames, sectionIds) {
  return staffApi.post(`${BASE}/${category}/fields/bulk`, { fieldNames, sectionIds });
}

/** Removes an area — and every grade recorded against it. */
export function removeGradeField(fieldId) {
  return staffApi.del(`${BASE}/fields/${fieldId}`);
}

/** Saves the changed grades only: `[{ fieldId, studentId, grade }]`. Returns `{ saved }`. */
export function saveGrades(sectionId, grades) {
  return staffApi.post(`${BASE}/grades`, { sectionId, grades });
}
