// Batch 3 checker — psychometric, Skills Edge assessment, My Project, Coding Arena.
//
//   node scripts/checkbatch3.mjs
//
// WHY THIS EXISTS. Every defect this batch fixed was SILENT — none of them threw, none failed a
// build, and three of them produced output that looked entirely reasonable:
//
//   * POST /api/psychometrics/submit declared `List<AnswerEntry> answers` while both clients sent an
//     object map, so Jackson 400'd every submit before the method ran. Both clients swallow the
//     failure by design, so `psy_student_answers` was empty on every deployment and nobody knew.
//   * GET /topics/{id}/questions stripped `skillsMeasured` and `bloomTaxonomy` — the only two fields
//     the scoring engine reads — so every question fell through to a positional round robin and a
//     retake gave different categories.
//   * Three of five REPORT_CONFIG entries say `chart: 'bars'` and no bars branch existed, so those
//     reports rendered no chart at all. A no-op renders nothing and reports nothing.
//   * SkillsEdgeModule has no `title` column and four render sites read `m.title`, so module names
//     were blank everywhere including the AI context.
//   * CodingArenaService.listProblems returned every published problem regardless of class band.
//
// Assertions are on the CONSTRUCT, never on a name: `/<Foo/` is also true of `<FooGone` and
// `/radar/` is true of `noradar`. Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const BE = path.resolve(APP, '..', 'backendmain', 'src', 'main', 'java', 'com', 'shreyartha', 'backend');

const SRC = {
  // ── backend
  submitDto: path.join(BE, 'psychometric/payload/PsychometricSubmitRequest.java'),
  psyCtl: path.join(BE, 'psychometric/controller/PsychometricPublicController.java'),
  psyRepo: path.join(BE, 'psychometric/repository/PsychometricStudentAnswerRepository.java'),
  psyAnswer: path.join(BE, 'psychometric/model/PsychometricStudentAnswer.java'),
  psyQuestion: path.join(BE, 'psychometric/model/PsychometricQuestion.java'),
  seCtl: path.join(BE, 'skillsedge/controller/StudentSkillsEdgeUnderstandingController.java'),
  seSvc: path.join(BE, 'skillsedge/service/SkillsEdgeUnderstandingService.java'),
  seQRepo: path.join(BE, 'skillsedge/repository/SkillsEdgeUnderstandingQuestionRepository.java'),
  arena: path.join(BE, 'coding/arena/service/CodingArenaService.java'),
  projCtl: path.join(BE, 'common/controller/StudentProjectController.java'),
  // ── mobile
  report: path.join(APP, 'components/student/psychometric/PsychometricReport.js'),
  reportCfg: path.join(APP, 'constants/psychometricReports.js'),
  psyScreen: path.join(APP, 'components/student/PsychometricScreen.js'),
  psySvc: path.join(APP, 'services/student/psychometricService.js'),
  psyPdf: path.join(APP, 'utils/psychometricPdf.js'),
  seScreen: path.join(APP, 'components/student/SkillsEdgeScreen.js'),
  seSvcJs: path.join(APP, 'services/student/skillsEdgeService.js'),
  seConst: path.join(APP, 'constants/skillsEdge.js'),
  myProject: path.join(APP, 'components/student/MyProject.js'),
  projSvc: path.join(APP, 'services/student/projectService.js'),
};

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`  ✗ ${m}`);
};
const ok = (m) => console.log(`  ✓ ${m}`);

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/**
 * Code with comments removed.
 *
 * THE `/*` MUST BE PRECEDED BY WHITESPACE. The obvious `/\/\*[\s\S]*?\*\//g` is wrong here:
 * MyProject.js and filePicker.js contain the MIME filters `'video/*'` and `'image/*'`, each of which
 * opens a block comment as far as that regex is concerned and swallows everything to the next `*``/`.
 * That exact bug ate 5,000 characters of a source file in the Batch 2 checker.
 */
const codeOnly = (t) =>
  t.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');

function loadSources(mutate) {
  const out = {};
  for (const [k, abs] of Object.entries(SRC)) {
    let text = read(abs);
    if (mutate) text = mutate(k, text);
    out[k] = codeOnly(text);
  }
  return out;
}

/**
 * Evaluate a mobile module with its `studentApi` transport stubbed out.
 *
 * MUTATION MUST REACH THE EVALUATED COPY, not just the greps. Every checker in this programme has
 * shipped at least one vacuous mutation because the mutated text went to the string assertions while
 * the evaluated module was read fresh from disk — so `mutate` is threaded through here too.
 */
async function loadModule(key, rel, mutate, extra = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b3-'));
  let src = read(SRC[key]);
  if (mutate) src = mutate(key, src);

  for (const [fromRe, toName, fromPath, transform] of extra) {
    let dep = read(fromPath);
    if (transform) dep = transform(dep);
    fs.writeFileSync(path.join(dir, toName), dep);
    src = src.replace(fromRe, `from './${toName}'`);
  }

  src = src.replace(
    /^import \{ studentApi \}.*$/m,
    'export const __calls = []; const studentApi = new Proxy({}, { get: (_, verb) => (endpoint, arg) => { __calls.push({ verb, endpoint, arg }); return Promise.resolve(undefined); } });',
  );

  const file = path.join(dir, `${rel}.mjs`);
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/* ────────────────────────────────────────────────────────────────────────── */

async function assertions(mutate) {
  const s = loadSources(mutate);
  const out = [];
  const bad = (m) => out.push(m);

  /* ── 1. THE SUBMIT PAYLOAD ──────────────────────────────────────────────── */

  // The DTO must bind an OBJECT, not a list. Assert the declared type, not the word "answers".
  if (!/private\s+Map<\s*Long\s*,\s*String\s*>\s+answers\s*;/.test(s.submitDto)) {
    bad('PsychometricSubmitRequest.answers is not a Map<Long, String> — both clients send an object keyed by question id, and a List cannot bind it (400 before the handler)');
  }
  if (/private\s+List<[^>]*>\s+answers\s*;/.test(s.submitDto)) {
    bad('PsychometricSubmitRequest.answers is declared as a List again — that is the original bug');
  }
  // ...and the controller must consume it as one.
  if (!/for\s*\(\s*Map\.Entry<\s*Long\s*,\s*String\s*>\s+\w+\s*:\s*request\.getAnswers\(\)\.entrySet\(\)\s*\)/.test(s.psyCtl)) {
    bad('the submit loop does not iterate request.getAnswers().entrySet() — a Map DTO with a List-shaped loop does not compile, so these two must move together');
  }
  if (/AnswerEntry/.test(s.psyCtl) || /AnswerEntry/.test(s.submitDto)) {
    bad('AnswerEntry survives — the nested class only existed to model the List that was never sent');
  }

  /* ── 2. THE TWO FIELDS SCORING READS ────────────────────────────────────── */

  for (const field of ['skillsMeasured', 'bloomTaxonomy']) {
    // Assert the PUT into the response map, not a bare mention: the entity file also names both.
    const re = new RegExp(`questionMap\\.put\\(\\s*"${field}"\\s*,`);
    if (!re.test(s.psyCtl)) {
      bad(`GET /topics/{id}/questions does not emit "${field}" — processAssessmentResults reads it, and without it every question falls through to the positional round robin`);
    }
  }
  // The entity must actually have them, or the emit above is emitting nothing.
  for (const field of ['skillsMeasured', 'bloomTaxonomy']) {
    if (!new RegExp(`private\\s+String\\s+${field}\\s*;`).test(s.psyQuestion)) {
      bad(`PsychometricQuestion has no ${field} field — the controller emit cannot work`);
    }
  }
  // HashMap, not Map.of: these two columns are nullable and Map.of throws on a null value.
  if (/Map\.of\([^)]*"skillsMeasured"/.test(s.psyCtl)) {
    bad('skillsMeasured is put into a Map.of — both columns are nullable and Map.of NPEs on a null value');
  }

  /* ── 3. THE READ-BACK ENDPOINTS ─────────────────────────────────────────── */

  const STUDENT_ROLES = [
    'FREE_STUDENT',
    'SCHOOL_STUDENT',
    'PREMIUM_STUDENT',
    'COLLEGE_STUDENT',
    'FREE_COLLEGE_STUDENT',
  ];
  for (const [mapping, method] of [['"/progress"', 'getProgress'], ['"/results"', 'getResults']]) {
    if (!new RegExp(`@GetMapping\\(${mapping}\\)`).test(s.psyCtl)) {
      bad(`no @GetMapping(${mapping}) on PsychometricPublicController`);
      continue;
    }
    // The @PreAuthorize between the mapping and the method signature must carry every student role.
    const block = s.psyCtl.slice(
      s.psyCtl.indexOf(`@GetMapping(${mapping})`),
      s.psyCtl.indexOf(method) + method.length,
    );
    for (const role of STUDENT_ROLES) {
      if (!block.includes(`hasRole('${role}')`)) {
        bad(`${mapping} does not admit ${role} — it must match the questions endpoint's role list or the student who took the assessment cannot read it back`);
      }
    }
  }
  // Identity from the Principal, never from a parameter — a studentId param is an IDOR.
  if (/getResults\(\s*Principal\s+\w+\s*,\s*@RequestParam\s+Long\s+topicId\s*\)/.test(s.psyCtl) === false) {
    bad('getResults does not take (Principal, @RequestParam Long topicId) — scoping by anything but the principal would let a student read another student\'s answers');
  }
  if (/getResults\([^)]*@RequestParam[^)]*studentId/.test(s.psyCtl)) {
    bad('getResults accepts a studentId parameter — that is an IDOR; the counsellor endpoint is the guarded cross-student view');
  }
  // The projection must exist and be DISTINCT, or a student with 300 answers gets 300 rows back.
  if (!/SELECT\s+DISTINCT\s+a\.question\.topic\.id\s+FROM\s+PsychometricStudentAnswer\s+a/.test(s.psyRepo)) {
    bad('findAnsweredTopicIds is missing or is not a DISTINCT projection over a.question.topic.id');
  }
  // JPQL is not validated by the build here (no in-memory DB), so verify the path by hand.
  if (!/private\s+PsychometricQuestion\s+question\s*;/.test(s.psyAnswer)) {
    bad('PsychometricStudentAnswer has no `question` field — the JPQL path a.question.topic.id is broken and nothing in the build would catch it');
  }
  if (!/@ManyToOne[\s\S]{0,120}private\s+PsychometricTopic\s+topic\s*;/.test(s.psyQuestion)) {
    bad('PsychometricQuestion has no `topic` relation — the JPQL path a.question.topic.id is broken');
  }

  /* ── 4. THE MISSING BARS BRANCH ─────────────────────────────────────────── */

  // Assert the BRANCH exists, not that the string 'bars' appears — the whole bug was that the
  // config said 'bars' and nothing rendered it, so a `/bars/` grep passed against the broken code.
  if (!/<GroupedBars\b/.test(s.report)) {
    bad('PsychometricReport never renders <GroupedBars> — three of the five configs declare chart: "bars" and would show no chart at all');
  }
  if (!/import\s*\{[^}]*\bGroupedBars\b[^}]*\}\s*from\s*'\.\.\/\.\.\/ui\/charts'/.test(s.report)) {
    bad('GroupedBars is not imported from the shared chart kit');
  }
  // A radar with fewer than 3 axes is a line; it must fall through to bars, not to nothing.
  if (!/config\.chart === 'radar' && rows\.length >= 3[\s\S]{0,400}?\) : rows\.length \?/.test(s.report)) {
    bad('the radar branch does not fall through to a bars branch — a sub-3-category radar config would render no chart');
  }
  // GroupedBars draws a legend as soon as any row carries a class average; there is no class
  // average for a psychometric assessment.
  if (/<GroupedBars[\s\S]{0,300}classAveragePercentage/.test(s.report)) {
    bad('the psychometric bars pass classAveragePercentage — that draws a legend for a comparison series that does not exist here');
  }

  /* ── 5. REOPENING A FINISHED ASSESSMENT ─────────────────────────────────── */

  if (!/\/api\/psychometrics\/progress/.test(s.psySvc)) bad('fetchCompletedTopicIds does not call /api/psychometrics/progress');
  if (!/\/api\/psychometrics\/results\?topicId=/.test(s.psySvc)) bad('fetchSavedAnswers does not call /api/psychometrics/results with a topicId');
  // Rescored on the client, never read back as a stored report.
  if (!/processAssessmentResults\(\s*fetched\s*,\s*saved\s*,/.test(s.psyScreen)) {
    bad('the reopen path does not re-run processAssessmentResults over the saved answers — the server stores answers only, never a scored report');
  }
  // The tick means "there are saved answers"; setting it before the save lands promises a reopen
  // that returns nothing.
  if (/submitAssessment\([^)]*\)[\s\S]{0,80}setCompletedTopicIds/.test(s.psyScreen) &&
      !/\.then\(\(\) => \{[\s\S]{0,200}setCompletedTopicIds/.test(s.psyScreen)) {
    bad('the completed tick is set optimistically rather than in submitAssessment().then — a failed save would promise a reopen that returns nothing');
  }

  /* ── 6. THE PRINTABLE REPORT ────────────────────────────────────────────── */

  // %PDF- as five byte comparisons, and applied to what is about to be parsed.
  if (!/0x25,\s*0x50,\s*0x44,\s*0x46,\s*0x2d/.test(s.psyPdf)) {
    bad('the %PDF- magic bytes are not checked before the cover is handed to a parser');
  }
  if (!/isPdfBytes\(\s*coverBytes\s*\)|isPdfBytes\(bytes\)/.test(s.psyPdf)) {
    bad('loadFrameworkBytes does not gate its return on isPdfBytes');
  }
  // Cover FIRST — the merge order is the whole point of the front page.
  const coverIdx = s.psyPdf.indexOf('coverPages.forEach');
  const reportIdx = s.psyPdf.indexOf('reportPages.forEach');
  if (coverIdx < 0 || reportIdx < 0 || coverIdx > reportIdx) {
    bad('the framework cover is not added before the report pages — the cover is a FRONT page');
  }
  // A merge failure must cost the cover, not the report.
  if (!/catch\s*\{[\s\S]{0,300}return null;[\s\S]{0,120}\}/.test(s.psyPdf)) {
    bad('mergeWithFramework does not degrade to null on failure — a pdf-lib error would lose the student their whole report');
  }
  if (!/const\s*\{\s*uri:\s*reportUri\s*\}\s*=\s*await\s+Print\.printToFileAsync/.test(s.psyPdf)) {
    bad('the report PDF is not produced by expo-print');
  }

  /* ── 7. SKILLS EDGE: THE TOPIC-WIDE ASSESSMENT ──────────────────────────── */

  if (!/@GetMapping\("\/topic\/\{topicId\}\/assessment"\)/.test(s.seCtl)) {
    bad('no topic-level assessment endpoint on StudentSkillsEdgeUnderstandingController');
  }
  // The gate must be a DIRECT call with no fail-open. `canAccess` fails open when a module has no
  // topic; here the topic id IS the path parameter, so copying that branch would turn "unknown
  // topic" into "let them in".
  // BOUND THE SLICE TO THE METHOD. Slicing to end-of-file swept in `getTestInfo`, which legitimately
  // calls `canAccess` — so the "no canAccess here" assertion failed against correct code.
  const asmtStart = s.seCtl.indexOf('getTopicAssessment');
  const asmtEnd = s.seCtl.indexOf('@GetMapping', asmtStart);
  const asmt = s.seCtl.slice(asmtStart, asmtEnd > asmtStart ? asmtEnd : undefined);
  if (!/studentAccessGateway\.isAccessible\(\s*user\s*,\s*ContentComponent\.SKILLS_EDGE\s*,\s*"TOPIC"\s*,\s*topicId\s*\)/.test(asmt)) {
    bad('the assessment endpoint does not gate on SKILLS_EDGE::TOPIC for its own topicId');
  }
  if (/canAccess\(/.test(asmt)) {
    bad('the assessment endpoint calls canAccess — that helper fails open on a null topic id, which has no meaning when topicId is the path parameter');
  }
  if (/topicId == null\)\s*return true/.test(asmt)) {
    bad('the assessment endpoint carries a fail-open topicId == null branch');
  }
  // Repository reuse, defensive copy, cap.
  if (!/findByModule_IdIn\(/.test(s.seQRepo)) bad('SkillsEdgeUnderstandingQuestionRepository has no findByModule_IdIn');
  if (!/findModuleIdsByTopicIds\(\s*List\.of\(\s*topicId\s*\)\s*\)/.test(s.seSvc)) {
    bad('the assessment does not reuse the existing findModuleIdsByTopicIds traversal');
  }
  if (!/new ArrayList<>\(\s*questionRepository\.findByModule_IdIn\(/.test(s.seSvc)) {
    bad('the question list is shuffled without a defensive copy — repository results are not guaranteed mutable');
  }
  if (!/Collections\.shuffle\(/.test(s.seSvc)) bad('the assessment bank is not shuffled');
  if (!/MAX_ASSESSMENT_QUESTIONS/.test(s.seSvc)) bad('the assessment has no named cap');
  // An empty module list must short-circuit: `IN ()` is not valid on every dialect.
  if (!/moduleIds\.isEmpty\(\)\s*\)\s*\{[\s\S]{0,60}return List\.of\(\)/.test(s.seSvc)) {
    bad('an empty module list is passed to an IN query rather than short-circuiting');
  }
  // The response must keep correctAnswer — the client scorer compares the picked LETTER to it.
  if (/class\s+\w*AssessmentDto|record\s+\w*AssessmentDto/.test(s.seSvc)) {
    bad('the assessment introduces a DTO — the per-module endpoint returns raw entities and the client scorer needs correctAnswer, which a tidier DTO would drop');
  }

  /* ── 8. SKILLS EDGE: MODULE NAMES AND THE LOCK CHAIN ────────────────────── */

  if (/\bm\.title\b|\bmodule\.title\b/.test(s.seScreen)) {
    bad('SkillsEdgeScreen still reads a module `title` — SkillsEdgeModule has no such column, so it renders empty');
  }
  // FIVE sites, all through the helper. The first pass fixed three and missed two — the AI action
  // bar's `topicName` and the breadcrumb trail — which is exactly why this counts rather than
  // spot-checking: module card, test header, card title, AI context, breadcrumb.
  const labelUses = (s.seScreen.match(/moduleLabel\(|openModuleLabel\(\)/g) || []).length;
  if (labelUses < 5) {
    bad(`moduleLabel is used ${labelUses} times, expected at least 5 (module card, test header, card title, AI context, breadcrumb)`);
  }
  // The lock chain: strictest across ancestors, with absent ancestors DROPPED.
  if (!/gate\.levelOf\(/.test(s.seScreen)) {
    bad('SkillsEdgeScreen does not use gate.levelOf — checking each level in isolation lets a deep link open a module under a locked topic');
  }
  if (!/pairs\.filter\(\(\[,\s*id\]\)\s*=>\s*id\s*!=\s*null\)/.test(s.seScreen)) {
    bad('chainLevel does not drop absent ancestors — nodeAccess falls back to defaultLevel for an unknown id, and defaultLevel is LOCKED on monthly plans, so a null ancestor would lock the screen for paying students');
  }
  if (/gate\.level\(\s*'(CHAPTER|TOPIC|LEARNING_OBJECTIVE|MODULE)'/.test(s.seScreen)) {
    bad('an isolated gate.level() call survives on a tree level — every level must go through its chain helper');
  }

  /* ── 9. MY PROJECT ──────────────────────────────────────────────────────── */

  // Three modes, three keys. Swapping them must fail.
  if (!/\/api\/students\/projects\/skillsedge\/\$\{learningObjectiveId\}/.test(s.projSvc)) {
    bad('the Skills Edge project is not keyed on learningObjectiveId');
  }
  if (!/\/api\/students\/projects\/languagepro\/\$\{topicId\}/.test(s.projSvc)) {
    bad('the Language Pro project is not keyed on topicId');
  }
  if (!/get\('\/api\/students\/projects\/coding'/.test(s.projSvc)) {
    bad('the Coding projects read is not the unkeyed list endpoint');
  }
  // `{"exists": false}` is a 200, not a 404 — a truthiness check on the envelope would treat it as
  // a project and bind a form to undefined.
  if (!/data\s*&&\s*data\.id\s*\?\s*data\s*:\s*null/.test(s.projSvc)) {
    bad('absence is not narrowed on `data.id` — the server answers a student who has not started with {"exists": false} and a 200, which is truthy');
  }
  // Flat @RequestParam parts: `fields`, never `json`. `json` is the 415 trap.
  if (/multipart\([^)]*\{\s*json:/.test(s.projSvc) || /json:\s*\{/.test(s.projSvc)) {
    bad('the project upload sends a `json` part — StudentProjectController takes flat @RequestParams, and a json part is the 415-before-the-handler trap');
  }
  if (!/fields:\s*\{/.test(s.projSvc)) bad('the project upload does not send flat form fields');
  // Confirm that against the controller itself rather than trusting the comment.
  if (/@RequestPart/.test(s.projCtl)) {
    bad('StudentProjectController now uses @RequestPart — the client sends flat fields and would 415');
  }
  // Omitting a file must not blank a stored one.
  if (!/\.\.\.\(files\.videoFile\s*\?\s*\{\s*videoFile:\s*files\.videoFile\s*\}\s*:\s*\{\}\)/.test(s.projSvc)) {
    bad('absent files are not omitted from the upload — sending an empty part would wipe an already-uploaded file');
  }
  // PUT for the coding update; multipart defaults to POST.
  if (!/\{\s*method:\s*'PUT'\s*\}/.test(s.projSvc)) {
    bad('updateProject does not override the multipart method to PUT');
  }
  if (!/MAX_WORDS\s*=\s*200/.test(s.projSvc)) bad('the 200-word limit is missing');
  if (!/words\s*>\s*MAX_WORDS/.test(s.myProject)) bad('MyProject does not refuse an over-length description');

  /* ── 10. CODING ARENA CLASS FILTERING ───────────────────────────────────── */

  if (!/if\s*\(!bandMatches\(\s*p\.getClassBand\(\)\s*,\s*grade\s*\)\)\s*continue;/.test(s.arena)) {
    bad('listProblems does not filter by class band — a Class 6 student is served Class 9 problems');
  }
  if (!/int\s+grade\s*=\s*extractClassNumber\(\s*student\.getCurrentClass\(\)\s*\)/.test(s.arena)) {
    bad('the grade is not resolved from the Student already in hand');
  }
  // solvedCount must follow the filter, or it can exceed totalCount.
  if (!/"solvedCount",\s*solvedInBand/.test(s.arena)) {
    bad('solvedCount is still the unfiltered solved set — after filtering it can exceed totalCount ("12 of 8 solved")');
  }
  if (/"solvedCount",\s*solved\.size\(\)/.test(s.arena)) {
    bad('solvedCount is solved.size() — that is the unfiltered set');
  }
  // Every unreadable case SHOWS the problem. Assert the disjunction, not the word "true".
  if (!/if\s*\(grade\s*<\s*0\s*\|\|\s*classBand == null\s*\|\|\s*classBand\.isBlank\(\)\)\s*return true;/.test(s.arena)) {
    bad('bandMatches does not fail open on a missing grade or a null/blank band — hiding content on a bad string is worse than showing an extra problem');
  }
  if (!/catch\s*\(NumberFormatException\s+\w+\)\s*\{\s*return true;/.test(s.arena)) {
    bad('an unparseable classBand hides the problem instead of showing it');
  }
  if (!/return\s+grade\s*>=\s*lo\s*&&\s*grade\s*<=\s*hi;/.test(s.arena)) {
    bad('bandMatches does not test containment in the lo-hi range — bands are ranges like "6-8", not single classes');
  }

  return out;
}

/* ── Behavioural checks on the evaluated modules ─────────────────────────── */

async function behaviour(mutate) {
  const out = [];
  const bad = (m) => out.push(m);

  // moduleLabel: no title anywhere in the payload, so every label comes from position.
  const SE = await loadModule('seConst', 'skillsEdge', mutate);
  if (SE.moduleLabel({ id: 7, moduleOrder: 3 }, 0) !== 'Module 3') {
    bad(`moduleLabel prefers moduleOrder: got ${SE.moduleLabel({ id: 7, moduleOrder: 3 }, 0)}`);
  }
  if (SE.moduleLabel({ id: 7 }, 4) !== 'Module 5') {
    bad(`moduleLabel falls back to index+1: got ${SE.moduleLabel({ id: 7 }, 4)}`);
  }
  if (SE.moduleLabel({ title: '  ' }, 1) !== 'Module 2') {
    bad('a whitespace-only title is treated as a real name');
  }
  if (SE.moduleLabel({ title: 'Brush Basics' }, 0) !== 'Brush Basics') {
    bad('a real title is ignored');
  }

  // The project service: shapes, keys and what is omitted.
  const PS = await loadModule('projSvc', 'projectService', mutate);
  if (PS.countWords('') !== 0 || PS.countWords('  ') !== 0) bad('countWords does not treat blank as 0');
  if (PS.countWords('one  two \n three') !== 3) bad(`countWords miscounts: ${PS.countWords('one  two \n three')}`);
  if (PS.MAX_WORDS !== 200) bad('MAX_WORDS is not 200');

  PS.__calls.length = 0;
  PS.saveSkillsEdgeProject({
    learningObjectiveId: 12,
    title: '  Bridge  ',
    description: '   ',
    chapterName: 'Art',
    topicName: 'Origami',
    files: { pdfFile: { uri: 'file://a.pdf', name: 'a.pdf', type: 'application/pdf' } },
  });
  const se = PS.__calls.find((c) => c.endpoint === '/api/students/projects/skillsedge');
  if (!se) {
    bad('saveSkillsEdgeProject did not POST to the skillsedge path');
  } else {
    if (se.arg.fields.title !== 'Bridge') bad('the title is not trimmed before upload');
    if ('description' in se.arg.fields) {
      bad('a whitespace-only description is sent — it would overwrite a real one with nothing');
    }
    if (se.arg.fields.learningObjectiveId !== 12) bad('learningObjectiveId is not sent');
    if ('videoFile' in se.arg.files || 'pptFile' in se.arg.files) {
      bad('unpicked file slots are sent — an empty part wipes an already-uploaded file');
    }
    if (!('pdfFile' in se.arg.files)) bad('the picked pdf is not sent');
  }

  PS.__calls.length = 0;
  PS.updateProject(9, { title: 'x', description: 'y', files: {} });
  const put = PS.__calls.find((c) => c.endpoint === '/api/students/projects/9');
  if (!put) bad('updateProject did not target /api/students/projects/{id}');

  return out;
}

/* ── Mutations ───────────────────────────────────────────────────────────── */

const MUTATIONS = [
  ['submit DTO back to a List', (k, t) =>
    k === 'submitDto' ? t.replace(/private Map<Long, String> answers;/, 'private List<AnswerEntry> answers;') : t],
  ['submit loop back to a List iteration', (k, t) =>
    k === 'psyCtl' ? t.replace(/for \(Map\.Entry<Long, String> entry : request\.getAnswers\(\)\.entrySet\(\)\)/,
      'for (PsychometricSubmitRequest.AnswerEntry entry : request.getAnswers())') : t],
  ['skillsMeasured dropped from the questions response', (k, t) =>
    k === 'psyCtl' ? t.replace(/\s*questionMap\.put\("skillsMeasured", q\.getSkillsMeasured\(\)\);/, '') : t],
  ['bloomTaxonomy dropped from the questions response', (k, t) =>
    k === 'psyCtl' ? t.replace(/\s*questionMap\.put\("bloomTaxonomy", q\.getBloomTaxonomy\(\)\);/, '') : t],
  // The role list is a two-line string concatenation, so the target role sits on the SECOND line —
  // a single-line regex silently matched nothing and made this mutation vacuous.
  ['/results loses a student role', (k, t) =>
    k === 'psyCtl' ? t.replace(
      /(@GetMapping\("\/results"\)\n\s*@PreAuthorize\("[^"]*"\s*\+\n\s*")or hasRole\('COLLEGE_STUDENT'\) /,
      '$1') : t],
  ['/results scoped by a studentId parameter', (k, t) =>
    k === 'psyCtl' ? t.replace(/getResults\(Principal principal, @RequestParam Long topicId\)/,
      'getResults(Principal principal, @RequestParam Long studentId, @RequestParam Long topicId)') : t],
  ['findAnsweredTopicIds loses its DISTINCT', (k, t) =>
    k === 'psyRepo' ? t.replace(/SELECT DISTINCT a\.question\.topic\.id/, 'SELECT a.question.topic.id') : t],
  ['the bars branch removed', (k, t) =>
    k === 'report' ? t.replace(/\) : rows\.length \?[\s\S]*?<\/StudentCard>\n      \) : null\}/, ') : null}') : t],
  ['bars given a class-average series', (k, t) =>
    k === 'report' ? t.replace(/rows=\{rows\.map\(\(r\) => \(\{ tag: r\.label, percentage: r\.value \}\)\)\}/,
      'rows={rows.map((r) => ({ tag: r.label, percentage: r.value, classAveragePercentage: 50 }))}') : t],
  ['the reopen path stops rescoring', (k, t) =>
    k === 'psyScreen' ? t.replace(/setResults\(processAssessmentResults\(fetched, saved, t\.name\)\);/,
      'setResults(saved);') : t],
  ['the %PDF- magic check removed', (k, t) =>
    k === 'psyPdf' ? t.replace(/const PDF_MAGIC = \[0x25, 0x50, 0x44, 0x46, 0x2d\];/,
      'const PDF_MAGIC = [];') : t],
  ['the cover merged after the report', (k, t) =>
    k === 'psyPdf' ? t.replace(
      /(const coverPages[\s\S]*?coverPages\.forEach\(\(p\) => merged\.addPage\(p\)\);\n)(\s*const reportPages[\s\S]*?reportPages\.forEach\(\(p\) => merged\.addPage\(p\)\);\n)/,
      '$2$1') : t],
  ['the assessment gate copies the fail-open branch', (k, t) =>
    k === 'seCtl' ? t.replace(
      /if \(!studentAccessGateway\.isAccessible\(user, ContentComponent\.SKILLS_EDGE, "TOPIC", topicId\)\) \{/,
      'if (topicId == null) return true;\n        if (!canAccess(principal, topicId)) {') : t],
  ['the assessment shuffles without a defensive copy', (k, t) =>
    k === 'seSvc' ? t.replace(/new ArrayList<>\(questionRepository\.findByModule_IdIn\(moduleIds\)\)/,
      'questionRepository.findByModule_IdIn(moduleIds)') : t],
  ['the empty-module short-circuit removed', (k, t) =>
    k === 'seSvc' ? t.replace(/if \(moduleIds\.isEmpty\(\)\) \{\n\s*return List\.of\(\);\n\s*\}/, '') : t],
  ['a module title read returns', (k, t) =>
    k === 'seScreen' ? t.replace(/\{moduleLabel\(m, i\)\}/, '{m.title}') : t],
  ['chainLevel stops dropping absent ancestors', (k, t) =>
    k === 'seScreen' ? t.replace(/pairs\.filter\(\(\[, id\]\) => id != null\)/, 'pairs') : t],
  ['one tree level goes back to an isolated check', (k, t) =>
    k === 'seScreen' ? t.replace(/const locked = moduleLevel\(m\) === ACCESS\.LOCKED;/,
      "const locked = gate.level('MODULE', m.id) === ACCESS.LOCKED;") : t],
  ['project absence checked by truthiness', (k, t) =>
    k === 'projSvc' ? t.replace(/data && data\.id \? data : null/, 'data || null') : t],
  ['empty file slots sent anyway', (k, t) =>
    k === 'projSvc' ? t.replace(/\.\.\.\(files\.videoFile \? \{ videoFile: files\.videoFile \} : \{\}\)/,
      'videoFile: files.videoFile') : t],
  ['the coding update falls back to POST', (k, t) =>
    k === 'projSvc' ? t.replace(/\{ method: 'PUT' \}/, '{}') : t],
  ['a blank description is sent', (k, t) =>
    k === 'projSvc' ? t.replace(
      /\.\.\.\(String\(description \?\? ''\)\.trim\(\)\n\s*\? \{ description: String\(description\)\.trim\(\) \}\n\s*: \{\}\),/,
      'description: String(description ?? \'\').trim(),') : t],
  ['the title is sent untrimmed', (k, t) =>
    k === 'projSvc' ? t.replace(/title: String\(title \?\? ''\)\.trim\(\),/, 'title: String(title ?? \'\'),') : t],
  ['moduleLabel ignores moduleOrder', (k, t) =>
    k === 'seConst' ? t.replace(/return `Module \$\{module\?\.moduleOrder \|\| index \+ 1\}`;/,
      'return `Module ${index + 1}`;') : t],
  ['a whitespace title is accepted as a name', (k, t) =>
    k === 'seConst' ? t.replace(/if \(explicit && String\(explicit\)\.trim\(\)\) return String\(explicit\)\.trim\(\);/,
      'if (explicit) return String(explicit);') : t],
  ['the arena class filter removed', (k, t) =>
    k === 'arena' ? t.replace(/if \(!bandMatches\(p\.getClassBand\(\), grade\)\) continue;/, '') : t],
  ['solvedCount back to the unfiltered set', (k, t) =>
    k === 'arena' ? t.replace(/"solvedCount", solvedInBand,/, '"solvedCount", solved.size(),') : t],
  ['an unparseable band now hides the problem', (k, t) =>
    k === 'arena' ? t.replace(/catch \(NumberFormatException e\) \{\n\s*return true;/,
      'catch (NumberFormatException e) {\n            return false;') : t],
  ['a null band now hides the problem', (k, t) =>
    k === 'arena' ? t.replace(/if \(grade < 0 \|\| classBand == null \|\| classBand\.isBlank\(\)\) return true;/,
      'if (grade < 0) return true;') : t],
  ['the band becomes an equality compare', (k, t) =>
    k === 'arena' ? t.replace(/return grade >= lo && grade <= hi;/, 'return grade == lo;') : t],
];

/* ── Run ─────────────────────────────────────────────────────────────────── */

console.log('Batch 3 — psychometric, Skills Edge, My Project, Coding Arena\n');

const baseline = [...(await assertions(null)), ...(await behaviour(null))];
if (baseline.length) {
  console.log('BASELINE (current code):');
  baseline.forEach(fail);
} else {
  ok('baseline: every assertion passes against the current code');
}

console.log('\nMUTATIONS (each must be caught):');
let vacuous = 0;
for (const [name, mutate] of MUTATIONS) {
  const caught = [...(await assertions(mutate)), ...(await behaviour(mutate))];
  // Only failures the mutation INTRODUCED count — a mutation that merely reproduces a baseline
  // failure proves nothing.
  const introduced = caught.filter((m) => !baseline.includes(m));
  if (introduced.length) {
    ok(`${name} — caught (${introduced.length})`);
  } else {
    vacuous += 1;
    fail(`${name} — NOT CAUGHT. This assertion is vacuous.`);
  }
}

console.log('');
if (failures) {
  console.error(`FAILED: ${baseline.length} baseline, ${vacuous} vacuous mutation(s).`);
  process.exit(1);
}
console.log(`PASSED: ${MUTATIONS.length} mutations, all caught.`);
