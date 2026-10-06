// scripts/checklivetests.mjs
//
// Live Test Rooms: the teacher hosts a test for a whole class from the app. Almost everything that
// can go wrong here still builds and still renders — a Start that no longer asks first, a "Merge
// all" that quietly sends a hand-built list, a room that keeps polling after it has ended, a result
// line that shows a psychometric child a mark. None of it fails `expo export`.
//
// Two kinds of check:
//   • on the constructs themselves (the call, the guard, the prop), never on a name that also
//     appears elsewhere in the file;
//   • the pure helpers are EVALUATED, not just read — a helper that throws on a null mark looks
//     identical in source to one that does not.
//
// Every mutation must plant — change bytes — or it is reported as inert, and must then turn at
// least one assertion red.
//
// Usage: node scripts/checklivetests.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FILES = {
  service: 'services/teacher/liveTestService.js',
  screen: 'components/staff/LiveTestRoomsScreen.js',
  route: 'app/teacher/live-tests.js',
  layout: 'app/teacher/_layout.js',
  menu: 'constants/teacherMenu.js',
  index: 'components/staff/index.js',
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

/**
 * The service's pure helpers, run for real. Everything below the "Pure helpers" rule has no imports,
 * so it can be evaluated on its own; `export` is stripped and the names handed back.
 */
function helpers(service) {
  const at = service.indexOf('// ── Pure helpers');
  if (at < 0) return null;
  const code = service.slice(at).replace(/^export /gm, '');
  try {
    // eslint-disable-next-line no-new-func
    return new Function(`${code}\nreturn { clock, levelName, resultLine, resultsAsText, cascadeFor, LIVE_TEST_TYPES, psychometricInput, roomPayload, joinLabel, psychometricTests, MAX_PAPERS };`)();
  } catch {
    return null;
  }
}

/** `liveTestCsvName`, run for real. It sits above the helpers block, so it is cut out by itself. */
function csvName(service) {
  const at = service.indexOf('export const liveTestCsvName = (room) =>');
  if (at < 0) return null;
  const end = service.indexOf(';\n', at);
  try {
    // eslint-disable-next-line no-new-func
    return new Function(`${service.slice(at, end + 1).replace('export ', '')}\nreturn liveTestCsvName;`)();
  } catch {
    return null;
  }
}

const GRADED = { title: 'Mock Test 1', classLabel: 'Class 8 A', testTypeLabel: 'Mock test', graded: true };

const ASSERTIONS = [
  {
    name: 'the service talks to the teacher endpoints, through staffApi',
    test: (s) =>
      s.service.includes("const BASE = '/api/teacher/live-tests';") &&
      s.service.includes('staffApi.post(`${BASE}/${roomId}/start`, {})') &&
      s.service.includes('staffApi.post(`${BASE}/${roomId}/stop`, {})') &&
      s.service.includes('staffApi.post(`${BASE}/${roomId}/extend`, { minutes })') &&
      s.service.includes('staffApi.post(`${BASE}/${roomId}/lock`, { locked })') &&
      s.service.includes('staffApi.post(`${BASE}/${roomId}/participants/${participantId}/removed`, { removed })') &&
      s.service.includes('staffApi.put(`${BASE}/${roomId}/participants/${participantId}/match`, { studentId })') &&
      s.service.includes('staffApi.post(`${BASE}/${roomId}/merge`, options)'),
  },
  {
    // Students join in a browser. A public-room client in the app would be a second student
    // surface to keep in step, for children who by definition are not holding the app.
    name: 'the app has no client for the public room endpoints',
    test: (s) => !s.service.includes('/api/public/live-test') && !s.screen.includes('/api/public/live-test'),
  },
  {
    name: 'a room link is a page on the website, not an API path',
    test: (s) => s.service.includes('export const roomLink = (code) => `${SITE}/room/${code}`;'),
  },
  {
    name: 'the preview is told the section, which decides whose adaptive questions are used',
    test: (s) => {
      // The marker ends after the parameter list, so the first brace is the function's own.
      const fn = body(s.service, 'export function previewLiveTest({ testType, sourceId, level, sectionId }, signal)');
      return fn.includes('if (sectionId) params.sectionId = sectionId;') &&
        s.screen.includes("previewLiveTest({ testType, sourceId, level: testType === 'PRACTICE' ? level : '', sectionId }");
    },
  },
  {
    name: 'Start asks first, and is off until a student has joined',
    test: (s) => {
      return s.screen.includes('onPress={confirmStart}') &&
        s.screen.includes('disabled={!!busy || present.length === 0}') &&
        s.screen.includes("Alert.alert('Start the test?'") &&
        !s.screen.includes("onPress={() => run('start'") &&
        s.screen.includes("{ text: 'Start the test', onPress: () => run('start', () => startLiveTest(roomId), 'The test has started.') },");
    },
  },
  {
    name: 'Stop asks first',
    test: (s) =>
      s.screen.includes('onPress={confirmStop}') &&
      s.screen.includes("Alert.alert('Stop the test now?'") &&
      !s.screen.includes("onPress={() => run('stop'"),
  },
  {
    name: 'the room is polled while open and left alone once it has ended',
    test: (s) =>
      s.screen.includes('if (ended) return () => controller.abort();') &&
      s.screen.includes('const timer = setInterval(() => load(), POLL_MS);') &&
      // The poll's own cleanup — the countdown effect below it clears a different timer.
      s.screen.includes('      controller.abort();\n      clearInterval(timer);\n    };\n  }, [load, ended]);') &&
      s.screen.includes('const POLL_MS = 3000;'),
  },
  {
    name: 'the countdown is the server\'s seconds, not this phone\'s clock',
    test: (s) => s.screen.includes('deadline.current = next.secondsLeft != null ? Date.now() + next.secondsLeft * 1000 : null;'),
  },
  {
    name: 'Remove toggles, and is not offered for a merged result',
    test: (s) =>
      s.screen.includes('setParticipantRemoved(roomId, p.id, !p.removed)') && s.screen.includes('{!p.merged ? ('),
  },
  {
    name: 'Merge all sends no list — the server merges everyone it is sure of — and asks first',
    test: (s) => {
      const panel = body(s.screen, 'function MergePanel({ roomId, graded, showToast, onMerged })');
      return panel.includes("onPress={() => merge({}, 'Merge the results?'") &&
        panel.includes('disabled={busy || ready.length === 0}') &&
        panel.includes('mergeLiveTestResults(roomId, { ...options, replaceExisting })') &&
        panel.includes('Alert.alert(title, message, [');
    },
  },
  {
    name: 'a doubtful child is merged one at a time, by id, only once a student is chosen',
    test: (s) =>
      s.screen.includes('merge({ participantIds: [r.id] },') &&
      s.screen.includes('{r.matchedStudentId && !r.attention ? (') &&
      s.screen.includes('onChange={(value) => choose(r.id, value)}'),
  },
  {
    name: 'merging is offered only after the test has ended',
    test: (s) => s.screen.includes('{ended ? <MergePanel roomId={roomId}'),
  },
  {
    name: 'the screen is reachable: route, stack entry, menu tile and export',
    test: (s) =>
      s.route.includes('<LiveTestRoomsScreen homeRoute="/teacher" />') &&
      s.layout.includes('<Stack.Screen name="live-tests" />') &&
      s.menu.includes("{ key: 'liveTests', label: 'Live Test Rooms', icon: 'easel-outline', native: '/teacher/live-tests' },") &&
      s.index.includes("export { default as LiveTestRoomsScreen } from './LiveTestRoomsScreen';"),
  },

  {
    name: 'the results file is fetched with the teacher\'s login as a CSV and handed to the share sheet',
    test: (s) =>
      s.screen.includes("await downloadAndShare(liveTestCsvEndpoint(roomId), liveTestCsvName(room), 'text/csv');") &&
      s.service.includes('export const liveTestCsvEndpoint = (roomId) => `${BASE}/${roomId}/results.csv`;') &&
      s.screen.includes('onPress={shareFile}'),
  },
  {
    name: 'a room cannot be opened without a section or a paper, and the kind of test fixes the level',
    test: (s) => {
      const fn = body(s.screen, 'const submit = async () =>');
      return fn.includes("if (!sectionId) return setError('Choose the class and section.');") &&
        fn.includes("return setError('Choose the test.');") &&
        fn.includes("if (preview && preview.questionCount === 0) return setError('That test has no questions yet.');") &&
        s.screen.includes("const pickLevel = testType === 'PRACTICE' ? level : null;");
    },
  },
  {
    name: 'several papers: a picked paper is added to a list, not twice, and the list restarts with the kind of test',
    test: (s) =>
      s.screen.includes('const pickIsListed = papers.some((p) => p.sourceId === sourceId && p.level === pickLevel);') &&
      s.screen.includes('const canAdd = !!sourceId && !!preview && !preview.error && preview.questionCount > 0 && !pickIsListed;') &&
      s.screen.includes('if (papers.length >= MAX_PAPERS) {') &&
      s.screen.includes('onPress={addPaper} disabled={!canAdd}') &&
      s.screen.includes("    setMinutes('');\n    // A session is one kind of test: changing the kind starts the list again.\n    setPapers([]);") &&
      // An adaptive session is one topic: nothing to add to.
      s.screen.includes("{testType !== 'ADAPTIVE' ? (\n          <>\n            <Button label=\"Add this to the session\""),
  },
  {
    name: 'what is sent is the list plus a paper picked but not yet added, with the teacher\'s late-entry choice',
    test: (s) =>
      s.screen.includes('const chosen = canAdd ? [...papers, { sourceId, level: pickLevel }] : papers;') &&
      s.screen.includes('await createLiveTestRoom(roomPayload({ sectionId, testType, papers: chosen, durationMinutes: limit, lateEntry })),') &&
      s.screen.includes('onValueChange={setLateEntry}'),
  },
  {
    name: 'every student shows how they came in, and whether their result is already on their profile',
    test: (s) =>
      s.screen.includes('<Text style={styles.badgeText}>{joinLabel(p)}</Text>') &&
      s.screen.includes('{p.savedToProfile ? (') &&
      s.screen.includes('{p.autoSaveError ? <Text style={styles.hint}>Not saved yet: {p.autoSaveError}</Text> : null}'),
  },
  {
    name: 'a report is offered for every kind of test, once it has ended, for a paper with answers',
    test: (s) =>
      s.screen.includes('{ended && !p.removed && p.answeredCount > 0 ? (') &&
      s.screen.includes('const detail = await fetchLiveTestParticipant(roomId, participant.id);') &&
      s.screen.includes('if (room.graded === false) {') &&
      s.screen.includes('setReport({ student, marked: detail });') &&
      s.screen.includes('{report.marked ? <MarkedReport room={room} detail={report.marked} /> : null}') &&
      s.service.includes('staffApi.get(`${BASE}/${roomId}/participants/${participantId}`, { signal })'),
  },
  {
    name: 'a psychometric session is one report: each answered test scored on its own, under its own name',
    test: (s) =>
      s.screen.includes('const tests = psychometricTests(detail?.parts, detail?.answers, room.title).map((test) => {') &&
      s.screen.includes('const { questions, answers } = psychometricInput(test.rows);') &&
      s.screen.includes('return { ...test, results: processAssessmentResults(questions, answers, test.title) };') &&
      s.screen.includes('topicType={getTopicType(test.title)}') &&
      s.screen.includes('{report.tests.length > 1 ? <Text style={styles.section}>{test.title}</Text> : null}'),
  },
  {
    name: 'students who signed in are left out of merging; a child on nobody\'s list can be added, with an email',
    test: (s) => {
      const panel = body(s.screen, 'function MergePanel({ roomId, graded, showToast, onMerged })');
      return panel.includes('const rows = (data.participants || []).filter((r) => !(r.signedIn && r.merged));') &&
        panel.includes('{!r.matchedStudentId && !r.signedIn && enrolling !== r.id ? (') &&
        panel.includes('if (!form.email.trim()) {') &&
        panel.includes('const result = await enrolParticipant(roomId, enrolling, form);') &&
        panel.includes('setCreated(result.created);') &&
        panel.includes('<Text selectable style={styles.password}>{created.password}</Text>') &&
        s.service.includes('staffApi.post(`${BASE}/${roomId}/participants/${participantId}/enrol`, details);');
    },
  },

  // ── Evaluated ──────────────────────────────────────────────────────────────
  {
    name: 'one paper is sent as it always was; several go as a list, in order',
    test: (s) => {
      const h = helpers(s.service);
      if (!h) return false;
      const one = h.roomPayload({ sectionId: 31, testType: 'PRACTICE', papers: [{ sourceId: 55, level: 'ADVANCED' }], durationMinutes: 20, lateEntry: true });
      const two = h.roomPayload({ sectionId: 31, testType: 'MOCK', papers: [{ sourceId: 100, level: null, title: 'x' }, { sourceId: 101 }], durationMinutes: null, lateEntry: undefined });
      return JSON.stringify(one) === '{"sectionId":31,"testType":"PRACTICE","sourceId":55,"level":"ADVANCED","durationMinutes":20,"lateEntry":true}' &&
        JSON.stringify(two) === '{"sectionId":31,"testType":"MOCK","sources":[{"sourceId":100,"level":null},{"sourceId":101,"level":null}],"durationMinutes":null,"lateEntry":false}' &&
        h.MAX_PAPERS === 6;
    },
  },
  {
    name: 'how a student came in reads three ways',
    test: (s) => {
      const h = helpers(s.service);
      return !!h && h.joinLabel({ signedIn: true, inClass: true }) === 'Logged in' &&
        h.joinLabel({ signedIn: true, inClass: false }) === 'Logged in · not in this class' &&
        // A signed-in student whose class is not known yet is not accused of being from another one.
        h.joinLabel({ signedIn: true }) === 'Logged in' &&
        h.joinLabel({ signedIn: false }) === 'Without login' && h.joinLabel(null) === 'Without login';
    },
  },
  {
    name: 'a session is split into its tests, keeping each name and dropping the ones nobody answered',
    test: (s) => {
      const h = helpers(s.service);
      if (!h) return false;
      const parts = [{ partNo: 1, title: 'Blueprint' }, { partNo: 2, title: 'Stream' }, { partNo: 3, title: 'LPM' }];
      const rows = [{ id: 1, partNo: 1, answer: 'Yes' }, { id: 2, partNo: 1, answer: null }, { id: 3, partNo: 2, answer: 'No' }, { id: 4, partNo: 3, answer: null }];
      const tests = h.psychometricTests(parts, rows, 'Session');
      return tests.map((t) => t.title).join() === 'Blueprint,Stream' && tests[0].rows.length === 2 && tests[1].rows[0].id === 3 &&
        // A room from before sessions had parts is the one test it was.
        h.psychometricTests(undefined, [{ id: 9, answer: 'Yes' }], 'Old room')[0].title === 'Old room' &&
        h.psychometricTests(parts, [], 'x').length === 0;
    },
  },
  {
    name: 'saved answers become what the scoring engine reads: questions with their two scored fields, answers by id',
    test: (s) => {
      const h = helpers(s.service);
      if (!h) return false;
      const out = h.psychometricInput([
        { id: 7, questionText: 'I plan my time.', questionOrder: 1, skillsMeasured: 'Self-management', bloomTaxonomy: 'Reflect', answer: 'Yes' },
        { id: 8, questionText: 'I like groups.', questionOrder: 2, skillsMeasured: 'Collaboration', bloomTaxonomy: 'Apply', answer: null },
      ]);
      return out.questions.length === 2 &&
        out.questions[0].skillsMeasured === 'Self-management' && out.questions[1].bloomTaxonomy === 'Apply' &&
        JSON.stringify(out.answers) === '{"7":"Yes"}' &&
        // Nothing saved at all is an empty report, not a crash.
        h.psychometricInput(undefined).questions.length === 0;
    },
  },
  {
    name: 'the results file gets a name a phone accepts',
    test: (s) => {
      const name = csvName(s.service);
      return !!name &&
        name({ title: 'Mock Test 1', classLabel: 'Class 8 A' }) === 'Mock Test 1 - Class 8 A.csv' &&
        name({ title: 'Fractions: 1/2 "quiz"?', classLabel: 'Class 8 A' }) === 'Fractions 1 2 quiz - Class 8 A.csv' &&
        name(null) === 'Live test - results.csv';
    },
  },
  {
    name: 'the countdown reads as minutes and seconds',
    test: (s) => {
      const h = helpers(s.service);
      return !!h && h.clock(754) === '12:34' && h.clock(59) === '0:59' && h.clock(3754) === '1:02:34' && h.clock(-3) === '0:00' && h.clock(null) === '0:00';
    },
  },
  {
    name: 'a result line shows marks for a marked test, none for psychometric, and the level reached for adaptive',
    test: (s) => {
      const h = helpers(s.service);
      if (!h) return false;
      const p = { scoredMarks: 3, totalMarks: 8, scorePercent: 37.5, remark: 'Needs support' };
      return h.resultLine(GRADED, p) === '3 / 8 · 37.5% · Needs support' &&
        h.resultLine({ graded: false }, { remark: 'Completed', scoredMarks: null }) === 'Completed' &&
        h.resultLine(GRADED, { ...p, finalLevel: 'ADVANCED' }) === '3 / 8 · 37.5% · Needs support · reached Advanced' &&
        h.resultLine(GRADED, { removed: true, scoredMarks: 3 }) === 'Removed' &&
        // A child who never answered has no marks yet: a dash, not "undefined" and not a crash.
        h.resultLine(GRADED, { remark: 'Did not attempt' }) === '— / — · Did not attempt';
    },
  },
  {
    name: 'shared results list every child except the removed ones',
    test: (s) => {
      const h = helpers(s.service);
      if (!h) return false;
      const text = h.resultsAsText({
        ...GRADED,
        participants: [
          { name: 'Ravi', rollNumber: '7', scoredMarks: 3, totalMarks: 8, scorePercent: 37.5, remark: 'Needs support' },
          { name: 'Gone', rollNumber: '9', removed: true },
          { name: 'Meera', rollNumber: null, scoredMarks: 8, totalMarks: 8, scorePercent: 100, remark: 'Excellent' },
        ],
      });
      return text.startsWith('Mock Test 1 — Class 8 A\nMock test\n') &&
        text.includes('1. Ravi (Roll 7) — 3 / 8 · 37.5% · Needs support') &&
        text.includes('2. Meera (Roll —) — 8 / 8 · 100% · Excellent') &&
        !text.includes('Gone');
    },
  },
  {
    name: 'each kind of test gets its own chain of dropdowns, and all five kinds are offered',
    test: (s) => {
      const h = helpers(s.service);
      if (!h) return false;
      const labels = (type) => h.cascadeFor(type).map((l) => l.label).join('>');
      return labels('MOCK') === 'Exam>Subject>Paper' &&
        labels('PSYCHOMETRIC') === 'Class>Area>Test' &&
        labels('PRACTICE') === 'Curriculum>Class>Subject>Chapter>Topic' &&
        labels('ADAPTIVE') === labels('TOPIC_QUIZ') &&
        h.LIVE_TEST_TYPES.map((t) => t.value).join() === 'MOCK,PRACTICE,TOPIC_QUIZ,PSYCHOMETRIC,ADAPTIVE';
    },
  },
];

// [what breaks, which file, from, to]
const MUTATIONS = [
  ['Start posts to the stop path', 'service', 'staffApi.post(`${BASE}/${roomId}/start`, {})', 'staffApi.post(`${BASE}/${roomId}/stop`, {})'],
  ['merge posts to the matches path', 'service', 'staffApi.post(`${BASE}/${roomId}/merge`, options)', 'staffApi.post(`${BASE}/${roomId}/matches`, options)'],
  ['a public room client appears in the app', 'service', "const BASE = '/api/teacher/live-tests';", "const BASE = '/api/teacher/live-tests';\nconst PUBLIC = '/api/public/live-test';"],
  ['the room link points at the API', 'service', '`${SITE}/room/${code}`', '`${SITE}/api/room/${code}`'],
  ['the preview forgets the section', 'service', 'if (sectionId) params.sectionId = sectionId;', ''],
  ['Start stops asking', 'screen', 'onPress={confirmStart}', "onPress={() => run('start', () => startLiveTest(roomId), 'The test has started.')}"],
  ['Start is on with an empty room', 'screen', 'disabled={!!busy || present.length === 0}', 'disabled={!!busy}'],
  ['Stop stops asking', 'screen', 'onPress={confirmStop}', "onPress={() => run('stop', () => stopLiveTest(roomId), 'The test has ended.')}"],
  ['an ended room keeps polling', 'screen', 'if (ended) return () => controller.abort();', ''],
  ['the poll timer is never cleared', 'screen', '      clearInterval(timer);\n    };\n  }, [load, ended]);', '    };\n  }, [load, ended]);'],
  ['the countdown trusts the phone', 'screen', 'Date.now() + next.secondsLeft * 1000', 'Date.now() + 60 * 1000'],
  ['Remove always removes', 'screen', 'setParticipantRemoved(roomId, p.id, !p.removed)', 'setParticipantRemoved(roomId, p.id, true)'],
  ['Merge all sends a hand-built list', 'screen', "onPress={() => merge({}, 'Merge the results?'", "onPress={() => merge({ participantIds: ready.map((r) => r.id) }, 'Merge the results?'"],
  ['Merge all is on with nothing ready', 'screen', 'disabled={busy || ready.length === 0}', 'disabled={busy}'],
  ['merging stops asking', 'screen', 'Alert.alert(title, message, [', 'Promise.resolve(title, message, ['],
  ['the replace choice is dropped', 'screen', 'mergeLiveTestResults(roomId, { ...options, replaceExisting })', 'mergeLiveTestResults(roomId, options)'],
  ['a single merge sends no id', 'screen', 'merge({ participantIds: [r.id] },', 'merge({},'],
  ['a child with a problem can still be merged', 'screen', '{r.matchedStudentId && !r.attention ? (', '{r.matchedStudentId ? ('],
  ['merging offered while the test runs', 'screen', '{ended ? <MergePanel roomId={roomId}', '{<MergePanel roomId={roomId}'],
  ['the menu tile is gone', 'menu', "native: '/teacher/live-tests' },", "native: '/teacher/reports' },"],
  ['the stack entry is gone', 'layout', '        <Stack.Screen name="live-tests" />\n', ''],
  ['the countdown drops its minutes', 'service', "return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;", "return `${pad(s % 60)}`;"],
  ['a psychometric child is shown a mark', 'service', "if (room.graded === false) return p.remark || '';", ''],
  ['a missing mark prints "undefined"', 'service', "`${p.scoredMarks ?? '—'} / ${p.totalMarks ?? '—'}`", '`${p.scoredMarks} / ${p.totalMarks}`'],
  ['the level reached is dropped', 'service', "const level = p.finalLevel ? ` · reached ${levelName(p.finalLevel)}` : '';", "const level = '';"],
  ['removed children are shared', 'service', '    .filter((p) => !p.removed)\n', ''],
  ['adaptive is not offered', 'service', "  { value: 'ADAPTIVE', label: 'Adaptive assessment' },\n", ''],
  ['the results file is fetched as a PDF', 'screen', "liveTestCsvName(room), 'text/csv');", 'liveTestCsvName(room));'],
  ['the file button does nothing', 'screen', 'onPress={shareFile}', 'onPress={() => {}}'],
  ['blank answers are scored', 'service', '    if (row.answer) answers[row.id] = row.answer;', '    answers[row.id] = row.answer;'],
  ['the scored fields are dropped', 'service', '      skillsMeasured: row.skillsMeasured,\n', ''],
  ['the file name keeps a slash', 'service', '.replace(/[\\\\/:*?"<>|]+/g, \' \')', ''],
  ['a room opens with no section chosen', 'screen', "    if (!sectionId) return setError('Choose the class and section.');\n    // What is on the list", "    // What is on the list"],
  ['a room opens with no paper chosen', 'screen', "return setError('Choose the test.');", 'return undefined;'],
  ['a level is sent for every kind of test', 'screen', "const pickLevel = testType === 'PRACTICE' ? level : null;", 'const pickLevel = level;'],
  ['the same paper can be added twice', 'screen', '&& preview.questionCount > 0 && !pickIsListed;', '&& preview.questionCount > 0;'],
  ['an empty paper can be added', 'screen', '&& !preview.error && preview.questionCount > 0 && !pickIsListed;', '&& !preview.error && !pickIsListed;'],
  ['more than six papers', 'screen', 'if (papers.length >= MAX_PAPERS) {', 'if (false) {'],
  ['the list survives a change of kind', 'screen', "    setMinutes('');\n    // A session is one kind of test: changing the kind starts the list again.\n    setPapers([]);", "    setMinutes('');"],
  ['a picked paper is forgotten unless added', 'screen', 'const chosen = canAdd ? [...papers, { sourceId, level: pickLevel }] : papers;', 'const chosen = papers;'],
  ['late entry is always off', 'screen', 'papers: chosen, durationMinutes: limit, lateEntry })', 'papers: chosen, durationMinutes: limit, lateEntry: false })'],
  ['how a student came in is not shown', 'screen', '<Text style={styles.badgeText}>{joinLabel(p)}</Text>', '<Text style={styles.badgeText}>Student</Text>'],
  ['a failed save is hidden', 'screen', '{p.autoSaveError ? <Text style={styles.hint}>Not saved yet: {p.autoSaveError}</Text> : null}', ''],
  ['a report is offered while the test runs', 'screen', '{ended && !p.removed && p.answeredCount > 0 ? (', '{!p.removed && p.answeredCount > 0 ? ('],
  ['a report is offered for an empty paper', 'screen', '{ended && !p.removed && p.answeredCount > 0 ? (', '{ended && !p.removed ? ('],
  ['a marked test opens a psychometric report', 'screen', 'if (room.graded === false) {\n        // One report for the session', 'if (true) {\n        // One report for the session'],
  ['the marked report is never drawn', 'screen', '{report.marked ? <MarkedReport room={room} detail={report.marked} /> : null}', ''],
  ['every test is scored as the first one', 'screen', 'processAssessmentResults(questions, answers, test.title) };', 'processAssessmentResults(questions, answers, room.title) };'],
  ['every test is drawn as the first kind of report', 'screen', 'topicType={getTopicType(test.title)}', 'topicType={getTopicType(room.title)}'],
  ['each test is scored on the whole session', 'screen', 'psychometricInput(test.rows);', 'psychometricInput(detail?.answers);'],
  ['signed-in students are offered for merging again', 'screen', '.filter((r) => !(r.signedIn && r.merged));\n  const savedBySignIn', ';\n  const savedBySignIn'],
  ['a student is added without an email', 'screen', 'if (!form.email.trim()) {', 'if (false) {'],
  ['a signed-in student can be "added"', 'screen', '{!r.matchedStudentId && !r.signedIn && enrolling !== r.id ? (', '{!r.matchedStudentId && enrolling !== r.id ? ('],
  ['the new password is never shown', 'screen', '<Text selectable style={styles.password}>{created.password}</Text>', ''],
  ['add-to-class-list posts to the match path', 'service', 'staffApi.post(`${BASE}/${roomId}/participants/${participantId}/enrol`, details);', 'staffApi.post(`${BASE}/${roomId}/participants/${participantId}/match`, details);'],
  ['one paper is sent as a list', 'service', '    ...(list.length === 1\n', '    ...(list.length === 0\n'],
  ['the order of papers is lost', 'service', 'sources: list.map((p) => ({ sourceId: p.sourceId, level: p.level ?? null })) }),', 'sources: [...list].reverse().map((p) => ({ sourceId: p.sourceId, level: p.level ?? null })) }),'],
  ['a student of unknown class is flagged', 'service', "return participant.inClass === false ? 'Logged in · not in this class' : 'Logged in';", "return participant.inClass ? 'Logged in' : 'Logged in · not in this class';"],
  ['unanswered tests get an empty report', 'service', '    .filter((test) => test.rows.some((row) => row.answer));', ''],
  ['a helper stops evaluating', 'service', 'export function clock(seconds) {', 'export function clock(seconds) {\n  return undefinedName;'],
];

/** An assertion that throws has failed: a helper that no longer evaluates is exactly what this is for. */
const holds = (assertion, sources) => {
  try {
    return !!assertion.test(sources);
  } catch {
    return false;
  }
};

const run = (sources) => ASSERTIONS.filter((a) => !holds(a, sources)).map((a) => a.name);

const sources = load();
const failing = run(sources);
if (failing.length) {
  console.error('checklivetests FAILED:');
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
  console.error(`checklivetests: ${problems} mutation problem(s).`);
  process.exit(1);
}
console.log(`checklivetests PASSED: ${ASSERTIONS.length} assertions, ${MUTATIONS.length} mutations all caught.`);
