import { useMemo, useState } from 'react';

/**
 * Finding one student in a list of 30–100 — the same rule on every staff screen (10 Oct 2026).
 * The twin of the website's `School/shared/StudentSearch/studentSearch.js`; keep the two in step.
 *
 * Case and accents are ignored, and every word typed must appear somewhere in the student's name,
 * roll number, admission number, email or phone, so "ravi 7" finds Ravi Kumar, roll 7. Searching
 * only hides rows: whatever a screen does to "all" students still does it to all of them.
 */

/** The fields a student row is searched by, under the names the staff screens use for them. */
export const STUDENT_FIELDS = [
  'fullName',
  'name',
  'studentName',
  'rollNumber',
  'roll',
  'rollNo',
  'admissionNumber',
  'admissionNo',
  'studentCode',
  'email',
  'studentEmail',
  'mobile',
  'phone',
  'studentMobile',
];

export const fold = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const wordsOf = (query) => fold(query).split(/\s+/).filter(Boolean);

export function searchableText(student, fields = STUDENT_FIELDS) {
  if (!student) return '';
  return fields
    .map((field) => student[field])
    .filter((value) => value != null && value !== '')
    .map(fold)
    .join(' ');
}

export function matchStudent(student, query, fields = STUDENT_FIELDS) {
  const words = wordsOf(query);
  if (words.length === 0) return true;
  const text = searchableText(student, fields);
  return words.every((word) => text.includes(word));
}

export function filterStudents(students, query, fields = STUDENT_FIELDS) {
  const list = Array.isArray(students) ? students : [];
  if (wordsOf(query).length === 0) return list;
  return list.filter((student) => matchStudent(student, query, fields));
}

/** @returns {{ query, setQuery, results, total, shown, active }} */
export function useStudentSearch(students, fields = STUDENT_FIELDS) {
  const [query, setQuery] = useState('');
  const key = fields.join(',');
  const results = useMemo(() => filterStudents(students, query, key.split(',')), [students, query, key]);
  const total = Array.isArray(students) ? students.length : 0;
  return { query, setQuery, results, total, shown: results.length, active: wordsOf(query).length > 0 };
}
