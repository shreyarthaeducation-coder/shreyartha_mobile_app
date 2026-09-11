// scripts/checkattendance.mjs
//
// Self attendance records WHERE and WHEN, and a school check-in's day cannot be changed by hand.
// Neither is visible to a build: a mark that silently stops sending its location, a locked day
// that quietly offers its status buttons again, or a calendar that goes back to the bare
// date→status map all compile, render, and look fine until someone asks "where was I?".
//
// Asserts on the constructs themselves (the call, the guard, the JSX branch), never on a name that
// also appears elsewhere in the file. Every mutation must plant — change bytes — or it is reported
// as inert, and must then turn at least one assertion red.
//
// Usage: node scripts/checkattendance.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FILES = {
  service: 'services/teacher/selfAttendanceService.js',
  calendar: 'services/teacher/calendarService.js',
  screen: 'components/staff/SelfAttendanceScreen.js',
  myCalendar: 'components/staff/MyCalendarScreen.js',
  detail: 'components/staff/AttendanceDayDetail.js',
  session: 'services/staffAttendanceService.js',
};

const load = () =>
  Object.fromEntries(
    Object.entries(FILES).map(([key, rel]) => [
      key,
      fs.readFileSync(path.join(APP, rel), 'utf8').split('\r\n').join('\n'),
    ]),
  );

/** The `{ ... }` body that follows `marker`, by brace depth. Empty string when absent. */
function body(src, marker) {
  const at = src.indexOf(marker);
  if (at < 0) return '';
  const open = src.indexOf('{', at + marker.length);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return '';
}

const ASSERTIONS = [
  {
    name: 'a mark sends its location with the date and status',
    test: (s) =>
      /staffApi\.post\('\/api\/teacher\/self-attendance\/mark', \{ date, status, \.\.\.location \}\)/.test(
        // The full signature, not the name: `location = {}` is a brace too, and body() would stop
        // at that empty default instead of the function.
        body(s.service, 'export function markSelfAttendance(date, status, location = {})'),
      ),
  },
  {
    name: 'the app can send work from home',
    test: (s) => /WORK_FROM_HOME: 'WORK_FROM_HOME',/.test(body(s.service, 'export const ATTENDANCE_STATUS =')),
  },
  {
    name: 'the location is captured BEFORE the mark is saved, and passed to it',
    test: (s) => {
      const fn = body(s.screen, 'const markDay = async (date, status) =>');
      const capture = fn.indexOf('const location = await captureMarkLocation();');
      const save = fn.indexOf('await markSelfAttendance(date, status, location);');
      return capture >= 0 && save > capture;
    },
  },
  {
    name: 'markDay refuses a locked day',
    test: (s) =>
      body(s.screen, 'const markDay = async (date, status) =>').includes(
        'if (!date || !status || saving || isLocked(date)) return false;',
      ),
  },
  {
    name: 'a day is locked on a Sunday AND when a check-in marked it',
    test: (s) =>
      s.screen.includes(
        'const isLocked = (date) => !!date && (isSunday(date) || !!details[date]?.locked);',
      ),
  },
  {
    name: 'a locked day shows Close and no status buttons; an open day shows them',
    test: (s) => {
      const start = s.screen.indexOf('{selectedLocked ? (');
      if (start < 0) return false;
      const split = s.screen.indexOf(') : (', start);
      if (split < 0) return false;
      const locked = s.screen.slice(start, split);
      const open = s.screen.slice(split, split + 2500);
      return !locked.includes('OPTIONS.map') && locked.includes('>Close<') && open.includes('OPTIONS.map');
    },
  },
  {
    name: 'Self Attendance shows when and where the selected day was recorded',
    test: (s) => s.screen.includes('<AttendanceDayDetail date={selectedDate} detail={details[selectedDate]} />'),
  },
  {
    name: 'My Calendar reads the sheet (with details), not the bare date→status map',
    test: (s) => {
      const fn = body(s.calendar, 'export async function fetchAttendanceCalendar({ year, month }, signal)');
      return (
        fn.includes("staffApi.get('/api/teacher/self-attendance/sheet'") &&
        !fn.includes('/api/staff/attendance/calendar') &&
        /details: isMap\(res\?\.details\)/.test(fn)
      );
    },
  },
  {
    name: 'My Calendar shows the selected day’s detail',
    test: (s) =>
      s.myCalendar.includes('const attendanceDetails = attendance?.details || {};') &&
      s.myCalendar.includes(
        '<AttendanceDayDetail date={selectedDate} detail={attendanceDetails[selectedDate]} />',
      ),
  },
  {
    name: 'the day detail renders the sign-in, with its own location',
    test: (s) =>
      s.detail.includes('{signedIn ? (') &&
      /latitude: detail\.loginLatitude,\s*longitude: detail\.loginLongitude,/.test(s.detail),
  },
  {
    name: 'a missing place is explained, not left blank',
    test: (s) =>
      /return \{ found: false, text: noFixReason\(place\.locationStatus\), url: null \};/.test(s.detail) &&
      /denied: 'Location permission was refused'/.test(s.detail),
  },
  {
    name: 'sign-in asks for a high-accuracy fix',
    test: (s) =>
      body(s.session, 'export async function startStaffAttendanceSession(userData = {})').includes(
        'accuracy: Location.Accuracy.High,',
      ),
  },
  {
    name: 'sign-out keeps the fast default — the session-expiry path awaits it',
    test: (s) => {
      const fn = body(s.session, 'export async function endStaffAttendanceSession(');
      return fn.includes('const logoutLocation = await captureLocation();') && !fn.includes('Accuracy.High');
    },
  },
];

const MUTATIONS = [
  ['the mark stops sending its location', 'service', '{ date, status, ...location }', '{ date, status }'],
  ['work from home dropped', 'service', "  WORK_FROM_HOME: 'WORK_FROM_HOME',\n", ''],
  ['the location is never asked for', 'screen', 'const location = await captureMarkLocation();', 'const location = {};'],
  ['markDay forgets the lock', 'screen', 'saving || isLocked(date)) return false;', 'saving) return false;'],
  ['a check-in no longer locks the day', 'screen', ' || !!details[date]?.locked', ''],
  ['a locked day offers its buttons again', 'screen', '{selectedLocked ? (', '{selectedLocked && false ? ('],
  ['Self Attendance hides the day detail', 'screen', 'detail={details[selectedDate]}', 'detail={undefined}'],
  ['My Calendar back on the bare map', 'calendar', "'/api/teacher/self-attendance/sheet'", "'/api/staff/attendance/calendar'"],
  ['My Calendar hides the day detail', 'myCalendar', 'detail={attendanceDetails[selectedDate]}', 'detail={undefined}'],
  ['the sign-in line removed', 'detail', '{signedIn ? (', '{false ? ('],
  ['a missing place renders blank', 'detail', 'text: noFixReason(place.locationStatus)', "text: ''"],
  ['sign-in back to a coarse fix', 'session', 'accuracy: Location.Accuracy.High,', 'accuracy: Location.Accuracy.Balanced,'],
  [
    'sign-out made slow',
    'session',
    'const logoutLocation = await captureLocation();',
    'const logoutLocation = await captureLocation({ accuracy: Location.Accuracy.High });',
  ],
];

const run = (sources) => ASSERTIONS.filter((a) => !a.test(sources)).map((a) => a.name);

const sources = load();
const failing = run(sources);
if (failing.length) {
  console.error('checkattendance FAILED:');
  failing.forEach((name) => console.error(`  ✗ ${name}`));
  process.exit(1);
}

let problems = 0;
for (const [name, key, from, to] of MUTATIONS) {
  if (!sources[key].includes(from)) {
    console.error(`  ✗ could not plant "${name}" — that mutation is inert and proves nothing`);
    problems += 1;
    continue;
  }
  const mutated = { ...sources, [key]: sources[key].replace(from, to) };
  if (mutated[key] === sources[key]) {
    console.error(`  ✗ "${name}" changed nothing — inert`);
    problems += 1;
    continue;
  }
  const caught = run(mutated);
  if (!caught.length) {
    console.error(`  ✗ NOT CAUGHT: ${name}`);
    problems += 1;
  }
}

if (problems) {
  console.error(`checkattendance: ${problems} mutation problem(s).`);
  process.exit(1);
}
console.log(`checkattendance PASSED: ${ASSERTIONS.length} assertions, ${MUTATIONS.length} mutations all caught.`);
