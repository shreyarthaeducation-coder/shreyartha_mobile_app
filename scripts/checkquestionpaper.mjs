// scripts/checkquestionpaper.mjs
//
// Manage Questions in the app — the website's QuestionManager: sets, either/or choices, lettered
// sub-questions, reordering, pictures, rich text, import, copy, the printed paper.
//
// Two things here cost real data before and are invisible to a build:
//
//   * EDITING A QUESTION ERASED ITS PICTURES AND ITS CHAPTER. The server's update writes the chapter,
//     the topic and all six picture fields from the request (TeacherReportService.updateQuestion →
//     applyImages); the app's payload left them out, so every save nulled them. The payload must
//     carry every field the server writes — checked against the Java, not against a list typed here.
//   * A PAPER IS NOT A LIST OF ROWS. An either/or choice is one question; a passage is marked through
//     its parts. Numbering, totals, reordering and the printout all walk items, never rows.
//
// utils/questionPaper.js and utils/marksSheetScan.js are import-free and EVALUATED; the screens are
// asserted on their constructs. Every mutation must plant and must turn an assertion red.
//
// Usage: node scripts/checkquestionpaper.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(APP, '..');
const BE = path.join(ROOT, 'backendmain', 'src', 'main', 'java', 'com', 'shreyartha', 'backend');

const FILES = {
  util: path.join(APP, 'utils', 'questionPaper.js'),
  scan: path.join(APP, 'utils', 'marksSheetScan.js'),
  service: path.join(APP, 'services', 'teacher', 'examService.js'),
  sheet: path.join(APP, 'components', 'staff', 'exams', 'QuestionsSheet.js'),
  form: path.join(APP, 'components', 'staff', 'exams', 'questions', 'QuestionForm.js'),
  importer: path.join(APP, 'components', 'staff', 'exams', 'questions', 'ImportPanel.js'),
  copy: path.join(APP, 'components', 'staff', 'exams', 'questions', 'CopyPanel.js'),
  editor: path.join(APP, 'components', 'staff', 'exams', 'questions', 'RichTextEditorSheet.js'),
  html: path.join(APP, 'components', 'QuestionHtml.js'),
  screen: path.join(APP, 'components', 'staff', 'ExamsScreen.js'),
  analysis: path.join(APP, 'components', 'staff', 'exams', 'ExamAnalysisSheet.js'),
  beService: path.join(BE, 'report', 'service', 'TeacherReportService.java'),
  beSecurity: path.join(BE, 'common', 'config', 'SecurityConfig.java'),
  webApp: path.join(ROOT, 'frontendmain', 'src', 'App.js'),
  webEmbed: path.join(ROOT, 'frontendmain', 'src', 'School', 'embed', 'RichTextEmbed.js'),
  katexPkg: path.join(ROOT, 'frontendmain', 'node_modules', 'katex', 'package.json'),
};

const load = () =>
  Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, fs.readFileSync(f, 'utf8').split('\r\n').join('\n')]));

const evaluate = async (src) => {
  try {
    return await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
  } catch (e) {
    return { __error: e.message };
  }
};

const between = (src, from, to) => {
  const start = src.indexOf(from);
  if (start < 0) return '';
  const end = src.indexOf(to, start + from.length);
  return end < 0 ? '' : src.slice(start, end);
};
const callSites = (src, call) => {
  const out = [];
  for (let i = src.indexOf(call); i >= 0; i = src.indexOf(call, i + 1)) out.push(i);
  return out;
};

// ── A paper with everything in it ──────────────────────────────────────────────────────────────
const Q = (id, questionOrder, extra = {}) => ({ id, questionOrder, questionSet: 1, marks: 2, questionType: 'SHORT_ANSWER', questionStatement: `Question ${id}`, ...extra });
const PAPER = [
  Q(11, 1, { questionStatement: 'Plain <b>bold</b> & words' }),
  Q(12, 2, { eitherOrGroup: 'g', marks: 3 }),
  Q(13, 3, { eitherOrGroup: 'g', marks: 3 }),
  Q(14, 4, { marks: 5, questionType: 'PARAGRAPH' }),
  Q(15, 1, { parentQuestionId: 14 }),
  Q(16, 2, { parentQuestionId: 14, marks: 3 }),
  Q(17, 5, { marks: 4, questionType: 'MCQ', optionA: 'x', optionB: 'y', questionStatement: 'Is x < 5 and y > 2?' }),
  Q(21, 1, { questionSet: 2 }),
];

const BEHAVIOUR = [
  {
    name: 'an either/or choice needs 2+ questions, no sub-question, and equal marks',
    test: ({ u }) => /at least two/.test(u.groupingProblem([Q(1, 1)]))
      && /sub-question cannot/.test(u.groupingProblem([Q(1, 1), Q(2, 2, { parentQuestionId: 9 })]))
      && /worth 2 and 3 marks/.test(u.groupingProblem([Q(1, 1), Q(2, 2, { marks: 3 })]))
      && u.groupingProblem([Q(1, 1), Q(2, 2)]) === null,
  },
  {
    name: 'a move keeps a choice together and a passage with its parts; the ends do not move',
    test: ({ u, items }) => JSON.stringify(u.reorderIds(items, 1, 1)) === JSON.stringify([11, 14, 15, 16, 12, 13, 17])
      && JSON.stringify(u.reorderIds(items, 0, 1)) === JSON.stringify([12, 13, 11, 14, 15, 16, 17])
      && u.reorderIds(items, 0, -1) === null && u.reorderIds(items, 3, 1) === null,
  },
  {
    name: "the paper's total counts a choice once and a passage through its parts; open papers use the exam total",
    test: ({ u, items, scan }) => u.paperTotal(items, 100) === 2 + 3 + (2 + 3) + 4
      && u.paperTotal(scan.paperItems(PAPER.map((q) => (q.id === 17 ? { ...q, marks: null } : q)), 1), 60) === 60
      && u.itemMarks(items[2]) === 5 && u.isChoice(items[1]) && !u.isChoice(items[0]) && u.hasParts(items[2]),
  },
  {
    name: 'a question needs its words; an MCQ two options — a picture counts as one',
    test: ({ u }) => {
      const base = { questionType: 'MCQ', questionStatement: '<p>Which?</p>', marks: '1' };
      return u.formProblems({ ...base, questionStatement: '<p></p>', optionA: 'a', optionB: 'b' }).some((p) => /Write the question/.test(p))
        && u.formProblems({ ...base, optionA: 'a' }).some((p) => /at least 2 options/.test(p))
        && u.formProblems({ ...base, optionA: 'a', optionBImageUrl: 'https://x/y.png' }).length === 0
        && u.formProblems({ ...base, questionType: 'SHORT_ANSWER', marks: '' }).length === 0
        && u.formProblems({ ...base, questionType: 'SHORT_ANSWER', marks: '1.5' }).length === 1
        && u.hasMeaningfulText('<p><img src="a.png"></p>') && !u.hasMeaningfulText('<p> </p>');
    },
  },
  {
    name: 'an import skips what the server would refuse, matches the curriculum by name, and lands in the set on screen',
    test: ({ u }) => {
      const chapters = [{ id: 7, name: 'Algebra', topics: [{ id: 70, displayName: 'Linear equations' }] }];
      const good = u.importPayload({ questionType: 'SHORT_ANSWER', questionStatement: ' Solve x ', chapterName: 'algebra', topicName: 'linear equations', marks: 0 }, chapters, 2);
      return u.importPayload({ questionStatement: '  ' }, chapters, 1) === null
        && u.importPayload({ questionType: 'MCQ', questionStatement: 'Q', optionA: 'only' }, chapters, 1) === null
        && good.chapterId === 7 && good.topicId === 70 && good.chapterName === 'Algebra' && good.questionSet === 2
        && good.marks === 1 && good.questionStatement === 'Solve x'
        && u.importPayload({ questionType: 'ODD', questionStatement: 'Q', optionA: 'a', optionB: 'b' }, [], 1).questionType === 'MCQ'
        && u.importPayload({ questionType: 'LONG_ANSWER', questionStatement: 'Q', chapterName: 'New ch' }, [], 1).chapterName === 'New ch';
    },
  },
  {
    name: 'a copy says what was copied and what was skipped, and why',
    test: ({ u }) => u.describeCopyResult({ copiedQuestions: 12, targetsUpdated: 2, details: [{ label: '9C', skippedReason: 'already has a paper' }] })
      === 'Copied 12 questions into 2 sections — Skipped 9C (already has a paper).'
      && u.describeCopyResult({ copiedQuestions: 0, details: [] }) === 'Nothing was copied.',
  },
  {
    name: 'the printed paper numbers items, puts OR between alternatives, letters parts and escapes plain text',
    test: ({ u, items }) => {
      const html = u.paperHtml({ schoolName: 'St <X>', examName: 'MT1', setCount: 1, totalMarks: 16 }, items);
      return html.includes('<b>Q1.</b>') && html.includes('<b>Q4.</b>') && !html.includes('<b>Q5.</b>')
        && html.includes('<div class="or">OR</div>') && html.includes('<b>(a)</b>') && html.includes('<b>(b)</b>')
        && html.includes('St &lt;X&gt;') && html.includes('Plain <b>bold</b> & words')
        && html.includes('[2 marks]') && html.includes('(A) x')
        && html.includes('Is x &lt; 5 and y &gt; 2?') && !html.includes('Is x < 5');
    },
  },
];

const WIRING = [
  {
    name: "the payload carries every picture field the server's update writes (checked against the Java)",
    test: (s) => {
      const java = between(s.beService, 'private void applyImages(', '\n    }');
      const keys = [...java.matchAll(/request\.get(\w+ImageUrl)\(\)/g)].map((m) => m[1].charAt(0).toLowerCase() + m[1].slice(1));
      const payload = between(s.service, 'export function buildQuestionPayload(', '\n}\n');
      const form = between(s.service, 'export function questionToForm(', '\n}\n');
      const listed = between(s.service, 'export const QUESTION_IMAGE_KEYS = [', '];');
      return keys.length === 6 && keys.every((k) => payload.includes(`${k}:`) && listed.includes(`'${k}'`))
        && form.includes('QUESTION_IMAGE_KEYS.forEach((key) => {');
    },
  },
  {
    name: "the payload carries the chapter and topic from the form — names kept when the curriculum does not know them",
    test: (s) => {
      const payload = between(s.service, 'export function buildQuestionPayload(', '\n}\n');
      return payload.includes('chapterId: id(form.chapterId),') && payload.includes('chapterName: text(form.chapterName),')
        && payload.includes('topicId: id(form.topicId),') && payload.includes('topicName: text(form.topicName),')
        && s.sheet.includes('setForm(questionToForm(question));');
    },
  },
  {
    name: 'a new question goes into the set on screen, a sub-question under its question',
    test: (s) => s.sheet.includes('questionSet: activeSet,\n        parentQuestionId: subParent ? subParent.id : null,'),
  },
  {
    name: 'deleting a passage says it takes its sub-questions with it',
    test: (s) => s.sheet.includes('const partCount = questions.filter((q) => q.parentQuestionId === question.id).length;')
      && s.sheet.includes('sub-question${partCount !== 1 ?'),
  },
  {
    name: 'joining is refused before the call when the choice is not allowed',
    test: (s) => {
      const body = between(s.sheet, 'const join = () => {', 'const split = ');
      return body.indexOf('groupingProblem(selectedQuestions)') >= 0
        && body.indexOf('groupingProblem(selectedQuestions)') < body.indexOf('joinEitherOr(');
    },
  },
  {
    name: 'a move sends the whole paper as items, and is put back when the server refuses it',
    test: (s) => {
      const body = between(s.sheet, 'const move = async (index, direction) => {', 'const join = ');
      return body.includes('const ids = reorderIds(items, index, direction);') && body.includes('setQuestions(previous);');
    },
  },
  {
    name: 'imported questions are created only after the teacher has seen them',
    test: (s) => {
      const sites = callSites(s.importer, 'createExamQuestion(');
      const body = between(s.importer, 'const importPicked = async () => {', 'return (');
      return sites.length === 1 && body.includes('createExamQuestion(examId, payload)')
        && body.includes('if (!picked.has(i)) continue;') && !between(s.importer, 'const read = async', 'const choosePhoto').includes('createExamQuestion');
    },
  },
  {
    name: "copying out pre-ticks only sections without a paper",
    test: (s) => s.copy.includes('setTargetIds(new Set(list.filter((t) => t.questionCount === 0).map((t) => t.examId)));'),
  },
  {
    name: "the rich-text editor is the website's, opened at /school/embed/rich-text with the teacher's token",
    test: (s) => s.editor.includes("const EDITOR_PATH = '/school/embed/rich-text';")
      && s.editor.includes('source={{ uri: `${API_BASE_URL}${EDITOR_PATH}` }}')
      && s.editor.includes("localStorage.setItem('schoolUserToken'")
      && s.webApp.includes('<Route path="/school/embed/rich-text" element={<RichTextEmbed />} />')
      && s.webEmbed.includes('post({ type: "change", html });')
      && s.webEmbed.includes('window.__RTE_INIT__')
      && s.beSecurity.includes('"/school/**"'),
  },
  {
    name: "maths is drawn with the website's KaTeX version",
    test: (s) => {
      const version = JSON.parse(s.katexPkg).version;
      return s.html.includes(`https://cdn.jsdelivr.net/npm/katex@${version}/dist/katex.min.css`);
    },
  },
  {
    name: "chapters come from the subject's curriculum endpoint, keyed by the section-subject",
    test: (s) => s.screen.includes('sectionSubjectId={examScope.subjectId}')
      && s.service.includes('`/api/teacher/curriculum/subjects/${sectionSubjectId}/chapters`'),
  },
  {
    name: "the website's question types and skill sets are offered — Paragraph, and the seven added",
    test: (s) => s.service.includes("{ value: 'PARAGRAPH', label: 'Paragraph' },")
      && ['Recall', 'Comprehension', 'Conceptual Understanding', 'Reasoning', 'Identification', 'Application', 'Reflection', 'Innovation']
        .every((skill) => s.service.includes(`'${skill}'`))
      && s.form.includes("{ value: ADD_NEW, label: '+ Add a new skill set…' },"),
  },
  {
    name: 'the analysis shows words, not the editor\'s HTML, and keys rows by position',
    test: (s) => s.analysis.includes("{htmlToText(q.questionStatement || '')}") && s.analysis.includes('key={`${i}-${q.questionOrder}`}'),
  },
];

const MUTATIONS = [
  ['a moved choice splits its alternatives', 'util', '...item.alternatives.map((alternative) => alternative.id),', '...[item.lead.id],'],
  ['parts are left behind when a question moves', 'util', "    ...(item.parts || []).map((part) => part.id),\n", ''],
  ['a choice is charged twice', 'util', "  return item?.lead?.marks || 0;", "  return (item?.alternatives || []).reduce((s, q) => s + (q.marks || 0), 0);"],
  ['an open paper adds up its questions', 'util', "  if (boxes.some((q) => q.marks == null) && examMaxMarks != null) return examMaxMarks;", ''],
  ['a picture does not count as an option', 'util', "hasMeaningfulText(form[key]) || form[OPTION_IMAGE_KEYS[i]]", 'hasMeaningfulText(form[key])'],
  ['unequal marks may be joined', 'util', '  if (marks.length > 1) {', '  if (false) {'],
  ['an MCQ with one option is imported', 'util', '  if (isMcq && OPTION_KEYS.filter((k) => payload[k]).length < 2) return null;', ''],
  ['imports ignore the set on screen', 'util', '    questionSet: questionSet || 1,', '    questionSet: 1,'],
  ['plain text is printed unescaped', 'util', ": escapeHtml(value));", ': String(value ?? ""));'],
  ['the printout has no OR', 'util', `'<div class="or">OR</div>'`, "''"],
  ['the payload drops a picture again', 'service', '    optionCImageUrl: isMcq ? text(form.optionCImageUrl) : null,\n', ''],
  ['the payload drops the chapter again', 'service', '    chapterName: text(form.chapterName),\n', ''],
  ['editing starts from a partial form', 'sheet', 'setForm(questionToForm(question));', 'setForm({ ...questionToForm(null), questionStatement: question.questionStatement });'],
  ['new questions all go to Set 1', 'sheet', '        questionSet: activeSet,\n', '        questionSet: 1,\n'],
  ['deleting a passage warns of nothing', 'sheet', "sub-question${partCount !== 1 ? 's' : ''} will be deleted", "question will be deleted"],
  ['joining skips the check', 'sheet', "    const problem = groupingProblem(selectedQuestions);\n    if (problem) {\n      toastError(problem);\n      return;\n    }\n", ''],
  ['a refused move is not put back', 'sheet', '      setQuestions(previous);\n', ''],
  ['an import creates on reading', 'importer', '      setParsed(res.questions);', '      setParsed(res.questions);\n      await createExamQuestion(examId, res.questions[0]);'],
  ['every section is ticked to be overwritten', 'copy', 'list.filter((t) => t.questionCount === 0).map((t) => t.examId)', 'list.map((t) => t.examId)'],
  ['the editor opens the wrong page', 'editor', "const EDITOR_PATH = '/school/embed/rich-text';", "const EDITOR_PATH = '/embed/rich-text';"],
  ['the editor has no token for pictures', 'editor', "localStorage.setItem('schoolUserToken'", "localStorage.setItem('token'"],
  ['the website route is gone', 'webApp', '<Route path="/school/embed/rich-text" element={<RichTextEmbed />} />', ''],
  ['KaTeX version drifts', 'html', 'katex@0.16.47', 'katex@0.16.8'],
  ['chapters come from Academic IQ only', 'screen', 'sectionSubjectId={examScope.subjectId}', 'sectionSubjectId={examScope.academicIqSubjectId}'],
  ['Paragraph disappears', 'service', "  { value: 'PARAGRAPH', label: 'Paragraph' },\n", ''],
  ['the analysis shows raw HTML', 'analysis', "{htmlToText(q.questionStatement || '')}", '{q.questionStatement}'],
];

const runWiring = (sources) => WIRING.filter((a) => {
  try {
    return !a.test(sources);
  } catch {
    return true;
  }
}).map((a) => a.name);

const runBehaviour = async (sources) => {
  const u = await evaluate(sources.util);
  const scan = await evaluate(sources.scan);
  if (u.__error) return [`utils/questionPaper.js does not evaluate: ${u.__error}`];
  if (scan.__error) return [`utils/marksSheetScan.js does not evaluate: ${scan.__error}`];
  const items = scan.paperItems(PAPER, 1);
  return BEHAVIOUR.filter((b) => {
    try {
      return !b.test({ u, scan, items });
    } catch {
      return true;
    }
  }).map((b) => b.name);
};

const sources = load();
const failing = [...(await runBehaviour(sources)), ...runWiring(sources)];
if (failing.length) {
  console.error('checkquestionpaper FAILED:');
  failing.forEach((n) => console.error(`  ✗ ${n}`));
  process.exit(1);
}

let problems = 0;
for (const [name, key, from, to] of MUTATIONS) {
  if (!sources[key].includes(from)) {
    console.error(`  ✗ could not plant "${name}" — inert`);
    problems += 1;
    continue;
  }
  const mutated = { ...sources, [key]: sources[key].replace(from, to) };
  if (mutated[key] === sources[key]) {
    console.error(`  ✗ "${name}" changed nothing — inert`);
    problems += 1;
    continue;
  }
  const caught = ['util', 'scan'].includes(key) ? (await runBehaviour(mutated)).length > 0 : runWiring(mutated).length > 0;
  if (!caught) {
    console.error(`  ✗ NOT CAUGHT: ${name}`);
    problems += 1;
  }
}
if (problems) {
  console.error(`checkquestionpaper: ${problems} mutation problem(s).`);
  process.exit(1);
}
console.log(`checkquestionpaper PASSED: ${BEHAVIOUR.length} behaviours, ${WIRING.length} wiring assertions, ${MUTATIONS.length} mutations all caught.`);
