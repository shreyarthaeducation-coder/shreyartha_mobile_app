// Student search on every staff list (10 Oct 2026).
//
// Runs the matcher for real (utils/studentSearch.js, evaluated with React's two hooks stubbed out)
// and reads the wiring of each list screen. Every assertion is mutation-tested before a pass counts.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/** Every staff screen that lists a section's students, and what it maps over once searched. */
const SCREENS = {
  manageStudents: 'components/staff/admin/ManageStudentsScreen.js',
  teacherStudents: 'components/teacher/TeacherStudentManagementScreen.js',
  wellness: 'components/staff/WellnessGroupsScreen.js',
  notes: 'components/staff/CounsellingNotesScreen.js',
  reportCardGrades: 'components/staff/admin/ReportCardGradesScreen.js',
  counsellorForm: 'components/staff/CounsellorReportFormScreen.js',
  counsellorReport: 'components/staff/CounsellorReportScreen.js',
  adaptive: 'components/staff/AdaptiveAssessmentScreen.js',
  gradeAreas: 'components/teacher/GradeAreasScreen.js',
  analytics: 'components/staff/StudentAnalyticsScreen.js',
  psychometric: 'components/teacher/StudentPsychometricScreen.js',
  basket: 'components/staff/f2f/StudentBasket.js',
  fees: 'components/staff/admin/FeeManagementScreen.js',
  liveTests: 'components/staff/LiveTestRoomsScreen.js',
  attendance: 'components/staff/MarkAttendanceScreen.js',
  groups: 'components/staff/StudentGroupsScreen.js',
  marks: 'components/staff/exams/MarksSheet.js',
};
const FILES = { ...SCREENS, helper: 'utils/studentSearch.js', bar: 'components/staff/shared/StudentSearchBar.js' };

function loadSources(mutate) {
  const out = {};
  for (const [k, rel] of Object.entries(FILES)) {
    const src = read(path.join(APP, rel));
    out[k] = mutate ? mutate(k, src) : src;
  }
  return out;
}

async function loadHelper(src) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stusearch-'));
  const file = path.join(dir, 'studentSearch.mjs');
  const body = src.replace(
    "import { useMemo, useState } from 'react';",
    // useState hands back whatever the check has "typed" (globalThis.__typed), else the initial value.
    'const useMemo = (f) => f(); const useState = (v) => [globalThis.__typed ?? v, () => {}];',
  );
  fs.writeFileSync(file, body);
  return import(pathToFileURL(file).href + `?t=${Math.random()}`);
}

const CLASS = [
  { studentId: 1, studentName: 'Ravi Kumar', rollNumber: '7', email: 'ravi@example.test', mobile: '9876500001' },
  { studentId: 2, studentName: 'Meera Sen', rollNumber: '12', admissionNumber: 'ADM-0042' },
  { studentId: 3, studentName: 'Anaïs Fernandes', rollNumber: '17' },
  { studentId: 4, fullName: 'Ravi Shankar', rollNumber: '21' },
  { studentId: 5, name: 'Asha Rao', phone: '9834500000' },
];
const ids = (list) => list.map((s) => s.studentId).join(',');

async function assertions(s) {
  const problems = [];
  const check = (name, test) => {
    try {
      if (!test()) problems.push(name);
    } catch (e) {
      problems.push(`${name} (threw: ${e.message})`);
    }
  };

  let h;
  try {
    h = await loadHelper(s.helper);
  } catch (e) {
    return [`the matcher does not evaluate: ${e.message}`];
  }
  check('case and accents are ignored', () => ids(h.filterStudents(CLASS, 'ANAIS')) === '3');
  check('every word must match', () => ids(h.filterStudents(CLASS, 'ravi 7')) === '1' && ids(h.filterStudents(CLASS, 'ravi')) === '1,4');
  check('roll, admission number, email and phone are searched',
    () => ids(h.filterStudents(CLASS, '12')) === '2' && ids(h.filterStudents(CLASS, 'adm-0042')) === '2'
      && ids(h.filterStudents(CLASS, 'ravi@')) === '1' && ids(h.filterStudents(CLASS, '98345')) === '5');
  check('the three ways screens name a student are all searched',
    () => ids(h.filterStudents(CLASS, 'shankar')) === '4' && ids(h.filterStudents(CLASS, 'asha')) === '5');
  check('an empty search shows everyone; no list is an empty one',
    () => h.filterStudents(CLASS, '  ') === CLASS && h.filterStudents(undefined, 'x').length === 0);
  check('the hook reports results, total, shown and whether a search is on', () => {
    const r = h.useStudentSearch(CLASS);
    return r.results === CLASS && r.total === 5 && r.shown === 5 && r.active === false && typeof r.setQuery === 'function';
  });
  check('with "ravi" typed, the hook shows 2 of 5', () => {
    globalThis.__typed = 'ravi';
    try {
      const r = h.useStudentSearch(CLASS);
      return ids(r.results) === '1,4' && r.total === 5 && r.shown === 2 && r.active === true && r.query === 'ravi';
    } finally {
      delete globalThis.__typed;
    }
  });

  // The bar.
  check('the bar shows "x of y shown" and says when nobody matches',
    () => s.bar.includes('`${shown} of ${total} shown`') && s.bar.includes('No student matches'));
  check('the bar clears', () => s.bar.includes("onPress={() => setQuery('')}") && s.bar.includes('accessibilityLabel="Clear search"'));

  // Every screen.
  for (const key of Object.keys(SCREENS)) {
    check(`${key}: imports the bar and the hook`,
      () => /import StudentSearchBar from '[./]+components\/staff\/shared\/StudentSearchBar';|import StudentSearchBar from '\.\.?\/?(\.\.\/)*shared\/StudentSearchBar';/.test(s[key])
        || s[key].includes("shared/StudentSearchBar';"));
    check(`${key}: renders the bar`, () => s[key].includes('<StudentSearchBar search={studentSearch} />'));
    check(`${key}: lists what the search found`, () => /studentSearch\.results/.test(s[key]) && /useStudentSearch\(/.test(s[key]));
  }

  // Searching only hides rows.
  check('All present / All absent still mark the whole class and say how many',
    () => s.attendance.includes('{`All ${students.length} present`}') && s.attendance.includes('{`All ${students.length} absent`}')
      && s.attendance.includes('onPress={() => setAll(ATTENDANCE_STATUS.PRESENT)}'));
  check('the marks sheet saves everyone, whatever is shown', () => s.marks.includes('const entries = toSave.map((student) => {'));
  check('the marks sheet groups the students found by paper',
    () => s.marks.includes('const here = studentSearch.results.filter((s) => setOfStudent(s.studentId) === set);'));
  check('the attendance list is the students found', () => s.attendance.includes('data={studentSearch.results}'));
  check('the group builder lists the students found, with the bar in its header',
    () => s.groups.includes('data={studentSearch.results}') && s.groups.includes('<View style={styles.createHeader}>\n            <StudentSearchBar search={studentSearch} />'));

  return problems;
}

const swap = (key, from, to) => (k, src) => (k === key ? src.replace(from, to) : src);
const MUTATIONS = [
  { name: 'matching becomes case-sensitive', src: swap('helper', '    .toLowerCase();', ';') },
  { name: 'any word is enough', src: swap('helper', 'return words.every((word) => text.includes(word));', 'return words.some((word) => text.includes(word));') },
  { name: 'roll numbers not searched', src: swap('helper', "  'rollNumber',\n", '') },
  { name: 'phones not searched', src: swap('helper', "  'phone',\n", '') },
  { name: 'fullName rows not searched', src: swap('helper', "  'fullName',\n", '') },
  { name: 'accents kept', src: swap('helper', "    .replace(/[\\u0300-\\u036f]/g, '')\n", '') },
  { name: 'an empty search hides everyone', src: swap('helper', '  if (wordsOf(query).length === 0) return list;', '  if (wordsOf(query).length === 0) return [];') },
  { name: 'the hook miscounts', src: swap('helper', 'shown: results.length,', 'shown: total,') },
  { name: 'the bar never says nobody matches', src: swap('bar', 'No student matches', 'Nothing') },
  { name: 'the bar cannot clear', src: swap('bar', "onPress={() => setQuery('')}", 'onPress={() => {}}') },
  { name: 'manage students drops the bar', src: swap('manageStudents', '<StudentSearchBar search={studentSearch} />', '') },
  { name: 'wellness groups lists everyone', src: swap('wellness', 'studentSearch.results.map(', 'students.map(') },
  { name: 'counselling notes drops the bar', src: swap('notes', '<StudentSearchBar search={studentSearch} />', '') },
  { name: 'the fee picker lists everyone', src: swap('fees', 'studentSearch.results.map(', 'students.map(') },
  { name: 'live test rooms drops the bar', src: swap('liveTests', '<StudentSearchBar search={studentSearch} />', '') },
  { name: 'All present marks only the students found', src: swap('attendance', 'onPress={() => setAll(ATTENDANCE_STATUS.PRESENT)}', 'onPress={() => setAll(ATTENDANCE_STATUS.PRESENT, studentSearch.results)}') },
  { name: 'the attendance count is dropped', src: swap('attendance', '{`All ${students.length} present`}', 'All present') },
  { name: 'the attendance list ignores the search', src: swap('attendance', 'data={studentSearch.results}', 'data={listData}') },
  { name: 'the marks sheet saves only the students shown', src: swap('marks', 'const entries = toSave.map((student) => {', 'const entries = studentSearch.results.map((student) => {') },
  { name: 'the per-paper grid ignores the search', src: swap('marks', 'const here = studentSearch.results.filter(', 'const here = students.filter(') },
  { name: 'the group builder lists everyone', src: swap('groups', 'data={studentSearch.results}', 'data={roster}') },
  { name: 'the basket hook is gone', src: swap('basket', 'useStudentSearch(', 'useState(') },
];

console.log('Self-tests (each mutation must be caught):');
const pristine = loadSources();
for (const m of MUTATIONS) {
  const mutated = loadSources(m.src);
  const changed = Object.keys(mutated).some((k) => mutated[k] !== pristine[k]);
  if (!changed) {
    fail(`INERT: ${m.name} — its anchor no longer matches anything`);
    continue;
  }
  const problems = await assertions(mutated);
  if (problems.length > 0) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name}`);
}

console.log('\nStudent search on staff lists:');
const problems = await assertions(pristine);
if (problems.length === 0) ok(`${Object.keys(SCREENS).length} list screens search, and searching only hides rows`);
else problems.forEach(fail);

console.log(failures === 0 ? `\ncheckstudentsearch PASSED: ${MUTATIONS.length} mutations all caught.` : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
