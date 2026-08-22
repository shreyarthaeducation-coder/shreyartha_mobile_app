// Batch 2 checker — My Analytics and the Student Profile.
//
//   node scripts/checkbatch2.mjs
//
// WHY THIS EXISTS. Batch 2 fixed three defects that all produced plausible output:
//
//   * The syllabus donut read `completionPercent` from a payload whose field is
//     `overallCompletionPercent`, so it silently fell back to a coarser number. Third wrong-field
//     bug in this programme.
//   * The two star ladders are DIFFERENT (90/70/50/30 vs 80/60/40/20) and both belong on the
//     client; mobile was rendering the server's ratings, one of which the website never reads.
//   * Skills Edge saved `{importantSkills}` alone against an endpoint that REPLACES the record,
//     wiping `selectedTopics`, `englishCommunication` and `isRelatedToJob` — including values set
//     on the website. Silent, every time.
//
// Plus the parent portal shares `AnalyticsBody`, so a regression there is invisible from the
// student panel. Exit code 0 = pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const WEB = path.resolve(APP, '..', 'frontendmain', 'src');

const SRC = {
  analyticsConst: 'constants/analytics.js',
  rules: 'constants/profileRules.js',
  body: 'components/student/analytics/AnalyticsBody.js',
  parent: 'components/parent/AcademicProgressScreen.js',
  studentScreen: 'components/student/AnalyticsScreen.js',
  studentSvc: 'services/student/analyticsService.js',
  profile: 'components/student/ProfileScreen.js',
  profileSvc: 'services/student/profileService.js',
  careerSvc: 'services/student/careerService.js',
  skills: 'components/student/profile/SkillsTab.js',
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
 * ── THE `/*` MUST BE PRECEDED BY WHITESPACE ─────────────────────────────────
 * The obvious `/\/\*[\s\S]*?\*\//g` is wrong on this codebase. `ProfileScreen.js` contains the MIME
 * filter `'video/*'` and `filePicker.js` contains `'image/*'` and `'*​/*'` — each of which opens a
 * block comment as far as that regex is concerned, swallowing everything up to the next `*` `/`.
 * It ate 5,000 characters of ProfileScreen and made three assertions here report missing code that
 * was plainly there.
 *
 * Requiring start-of-line or whitespace before the `/*` distinguishes a real comment from a MIME
 * type inside a string, which is always preceded by a letter or a quote.
 */
const codeOnly = (t) =>
  t.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');

function loadSources(mutate, mutateAnalytics, mutateRules) {
  const out = {};
  for (const [k, rel] of Object.entries(SRC)) {
    let text = read(path.join(APP, rel));
    if (mutate) text = mutate(k, text);
    if (mutateAnalytics && k === 'analyticsConst') text = mutateAnalytics(text);
    if (mutateRules && k === 'rules') text = mutateRules(text);
    out[k] = text;
  }
  return out;
}

/** `constants/analytics.js` imports REFLECTION_OPTIONS; stub the transport it hangs off. */
async function loadAnalytics(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2a-'));
  let src = read(path.join(APP, SRC.analyticsConst));
  if (mutate) src = mutate(src);
  src = src.replace(
    /from '\.\.\/services\/student\/academicIqService'/,
    "from './academicIqService.mjs'",
  );
  let svc = read(path.join(APP, 'services/student/academicIqService.js'));
  svc = svc.replace(/^import \{ studentApi \}.*$/m, 'const studentApi = { get: () => {}, post: () => {} };');
  fs.writeFileSync(path.join(dir, 'academicIqService.mjs'), svc);
  const file = path.join(dir, 'analytics.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

async function loadRules(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2r-'));
  let src = read(path.join(APP, SRC.rules));
  if (mutate) src = mutate(src);
  const file = path.join(dir, 'profileRules.mjs');
  fs.writeFileSync(file, src);
  return import(`${pathToFileURL(file).href}?t=${Math.random()}`);
}

/** The website's own remark bands, read from source so ours can be compared to them. */
function webRemarks() {
  const src = read(path.join(WEB, 'student', 'platform', 'MyAnalytics', 'MyAnalytics.js'));
  return [...src.matchAll(/return "((?:Exceptional|Excellent|Very Good|Good Progress|Keep Improving|Keep Practising)[^"]*)"/g)]
    .map((m) => m[1]);
}

function assertions(A, R, src) {
  const out = [];
  const bad = (m) => out.push(m);

  /* ── 1. THE WRONG FIELD NAME ─────────────────────────────────────────────── */

  if (A.syllabusPercent({ overallCompletionPercent: 42 }, { syllabusCompletionPercent: 7 }) !== 42) {
    bad('syllabusPercent does not read `overallCompletionPercent` — that payload has no `completionPercent`, so the live figure is discarded');
  }
  if (A.syllabusPercent(null, { syllabusCompletionPercent: 7 }) !== 7) {
    bad('syllabusPercent does not fall back to the spine when the enrichment failed');
  }
  // 0 is a real percentage and must survive the fallback.
  if (A.syllabusPercent({ overallCompletionPercent: 0 }, { syllabusCompletionPercent: 55 }) !== 0) {
    bad('a genuine 0% is treated as missing and replaced by the spine');
  }

  /* ── 2. TWO DIFFERENT STAR LADDERS ───────────────────────────────────────── */

  const sy = [[95, 5], [90, 5], [89, 4], [70, 4], [69, 3], [50, 3], [49, 2], [30, 2], [29, 1], [0.5, 1], [0, 0]];
  for (const [pct, stars] of sy) {
    if (A.syllabusStars(pct) !== stars) bad(`syllabusStars(${pct}) = ${A.syllabusStars(pct)}, expected ${stars}`);
  }
  const pr = [[85, 5], [80, 5], [79, 4], [60, 4], [59, 3], [40, 3], [39, 2], [20, 2], [19, 1], [0, 0]];
  for (const [pct, stars] of pr) {
    if (A.progressStars(pct) !== stars) bad(`progressStars(${pct}) = ${A.progressStars(pct)}, expected ${stars}`);
  }
  // They MUST differ — 85% is 5 stars on progress but only 4 on syllabus.
  if (A.syllabusStars(85) === A.progressStars(85)) {
    bad('the two star ladders agree at 85% — they are 90/70/50/30 and 80/60/40/20 and must not be unified');
  }

  const body = codeOnly(src.body);
  if (/academic\??\.(syllabusRating|progressRating)/.test(body)) {
    bad("the server's star ratings are being rendered again — the web computes both client-side and never reads progressRating");
  }

  /* ── 3. COMPETITIVE EXAM DERIVATIONS ─────────────────────────────────────── */

  // The full fallback chain, including the sum-of-tabs step that stops a half-finished student
  // being told they have done nothing.
  if (A.completedPercentOf({ completedPercent: 40 }, { completionPercent: 80 }) !== 80) {
    bad('a selected exam does not take precedence over the server overall');
  }
  if (A.completedPercentOf({ completedPercent: 40 }, null) !== 40) bad('the server overall is ignored');
  const tabsOnly = { examTabs: [{ totalTopics: 10, completedTopics: 5 }, { totalTopics: 10, completedTopics: 0 }] };
  if (A.completedPercentOf(tabsOnly, null) !== 25) {
    bad(`the sum-of-tabs fallback gave ${A.completedPercentOf(tabsOnly, null)}%, expected 25% — dropping straight to 0 tells a student their work is gone`);
  }
  if (A.completedPercentOf({}, null) !== 0) bad('an empty payload is not 0');

  // My Progress is RECOMPUTED for a selected exam, from attempted mocks only.
  //
  // The GREY entry deliberately CARRIES A SCORE. A `scorePercent: null` GREY is excluded by the
  // null check alone, so it cannot tell whether the status filter is still there — the first
  // version of this fixture made that mutation untestable. A scored GREY is only excluded if the
  // status check survives.
  const tab = {
    mockTestSubjects: [
      {
        mockTests: [
          { status: 'GREEN', scorePercent: 80 },
          { status: 'RED', scorePercent: 40 },
          { status: 'GREY', scorePercent: 0 },
        ],
      },
    ],
  };
  if (A.progressPercentOf({ myProgressPercent: 99 }, tab) !== 60) {
    bad(`selected-exam progress = ${A.progressPercentOf({ myProgressPercent: 99 }, tab)}, expected 60 (the mean of the two ATTEMPTED mocks)`);
  }
  if (A.progressPercentOf({ myProgressPercent: 99 }, null) !== 99) {
    bad('with no exam selected the server figure must stand');
  }
  // null is meaningful — the caller renders an em dash, not 0%.
  if (A.progressPercentOf({}, null) !== null) bad('a missing progress figure became 0 instead of null');

  const weak = A.weakMocksOf({ bottomThreeMockTests: [{ paperName: 'srv' }] }, tab);
  if (weak.length !== 2 || weak[0].scorePercent !== 40) {
    bad('weakMocksOf does not sort the selected exam\'s attempted mocks ascending');
  }
  if (A.weakMocksOf({ bottomThreeMockTests: [{ paperName: 'srv' }] }, null)[0]?.paperName !== 'srv') {
    bad("the server's precomputed bottom-three is ignored when no exam is selected");
  }

  // The remark bands, compared with the WEBSITE's own source.
  const web = webRemarks();
  if (web.length < 6) bad(`could not read the web's remark bands (found ${web.length}) — check this assertion`);
  else {
    const ours = [96, 92, 87, 82, 75, 10].map(A.getProgressRemark);
    ours.forEach((s, i) => {
      if (!web.includes(s)) bad(`remark band ${i} is not one of the website's strings: "${s}"`);
    });
  }
  // Compared against the LITERAL grey, not against mockStatusStyle('GREY') — an unknown status and
  // 'GREY' both fall to `default`, so comparing them to each other stays true however that branch
  // is coloured, and the first version of this check could not see the default turned green.
  if (A.mockStatusStyle('NONSENSE').border !== '#bdbdbd') {
    bad('an unrecognised mock status is not treated as GREY');
  }
  if (A.mockStatusStyle('GREY').border !== '#bdbdbd') bad('GREY is not grey');
  if (A.mockStatusStyle('GREEN').border !== '#4caf50') bad('GREEN is not green');
  if (A.mockStatusStyle('RED').border !== '#f44336') bad('RED is not red');

  /* ── 4. THE GAP TEMPLATES COME FROM ONE PLACE ────────────────────────────── */

  if (A.GAP_LEVELS.length !== 4) bad(`GAP_LEVELS has ${A.GAP_LEVELS.length} levels, expected 4`);
  for (const g of A.GAP_LEVELS) {
    if (!g.template || !g.color) bad(`gap level ${g.key} is missing a template or colour`);
  }
  const expect = { Beginner: '#dc2626', Developing: '#f59e0b', Progressing: '#eab308', Proficient: '#65a30d' };
  for (const [k, colour] of Object.entries(expect)) {
    const g = A.GAP_LEVELS.find((x) => x.key === k);
    if (!g) bad(`gap level ${k} is missing`);
    else if (g.color !== colour) bad(`gap level ${k} is ${g.color}, expected ${colour}`);
  }
  if (!/REFLECTION_OPTIONS/.test(codeOnly(src.analyticsConst))) {
    bad('the gap templates are no longer derived from REFLECTION_OPTIONS — two copies of four student-facing strings is how the Bloom\'s tables drifted');
  }

  /* ── 5. TOPIC vs STATUS ──────────────────────────────────────────────────── */

  if (A.progressTopicIcon({ reflectedByStudent: true, coveredByTeacher: true }) !== '✅') {
    bad('reflected must win over covered');
  }
  if (A.progressTopicIcon({ coveredByTeacher: true }) !== '📖') bad('covered-not-reflected is not 📖');
  if (A.progressTopicIcon({}) !== '⬜') bad('an untouched topic is not ⬜');
  // A syllabus TOPIC has no `status`; reading one would make every topic look "not started".
  if (!/t\.completed/.test(body)) bad('syllabus topics no longer use the plain `completed` boolean');

  /* ── 6. THE PARENT MUST NOT REGRESS ──────────────────────────────────────── */

  const parent = codeOnly(src.parent);
  for (const prop of ['analytics', 'parts', 'Card', 'CardTitle', 'showPsychometric', 'openExam', 'onToggleExam', 'mockTests']) {
    if (!new RegExp(`${prop}=`).test(parent)) bad(`the parent no longer passes \`${prop}\``);
  }
  // The trees are new; without a filter the parent would render admin-hidden nodes.
  if (!/filterNodes=/.test(parent)) {
    bad('the parent does not pass filterNodes — the new subject/chapter/topic trees would show it hidden content');
  }
  if (!/filterNodes\('SUBJECT'/.test(body) || !/filterNodes\('TOPIC'/.test(body)) {
    bad('AnalyticsBody does not apply filterNodes at every tier');
  }
  // Defaulting the cards would render the parent an unreadable screen.
  if (/Card = |CardTitle = /.test(body)) {
    bad('Card/CardTitle have acquired defaults — each portal must inject its own or the parent is unreadable');
  }
  // The focus pills need a key the parent has no endpoint for, so they must be guarded.
  if (!/skillsTree &&/.test(body)) {
    bad('the focus-topic pills are not guarded on `skillsTree` — the parent has no such endpoint');
  }
  if (!/skillsTree:/.test(codeOnly(src.studentSvc))) bad('the student service no longer fetches the skills tree');

  /* ── 7. THE PROFILE LOCK ─────────────────────────────────────────────────── */

  const saved = { fullName: 'A', gender: 'Female', dob: '2010-01-01', currentClass: '8' };
  if (R.isPersonalLocked(saved) !== true) bad('a saved profile does not lock');
  if (R.isPersonalLocked({ ...saved, gender: '' }) !== false) bad('an incomplete profile locks early');
  if (R.isPersonalLocked(null) !== false) bad('a missing profile locks');
  // Exactly email and mobile stay editable.
  for (const k of ['email', 'mobile']) {
    if (R.isFieldEditable(k, true) !== true) bad(`${k} must stay editable under the lock`);
  }
  for (const k of ['fullName', 'gender', 'dob', 'currentClass', 'strengths', 'hobbies']) {
    if (R.isFieldEditable(k, true) !== false) bad(`${k} is still editable under the lock`);
  }
  if (R.personalSubmitLabel(true, false) !== 'Selection saved') bad('the locked button label is wrong');

  /* ── 8. ACADEMIC IQ ──────────────────────────────────────────────────────── */

  if (R.PREPARING.YES !== 'YES' || R.PREPARING.NO !== 'NO') {
    bad("preparingCompetitiveExam must be UPPERCASE — the column stores YES/NO and 'Yes' never matches");
  }
  if (R.canAddEntranceExam(['a', 'b']) !== false) bad('a third entrance exam is allowed');
  if (R.canAddEntranceExam(['a']) !== true) bad('a second entrance exam is refused');
  if (R.validateEntranceExams([], 3) === null) bad('zero entrance exams is accepted when the exam has some');
  // ...but an exam with NO entrance exams must still be savable.
  if (R.validateEntranceExams([], 0) !== null) {
    bad('an exam with no entrance exams cannot be saved — the minimum is conditional');
  }
  if (R.validateEntranceExams(['a', 'b', 'c'], 3) === null) bad('three entrance exams pass validation');
  if (!/preparingCompetitiveExam/.test(codeOnly(src.profileSvc))) {
    bad("tabComplete('academic') no longer reads preparingCompetitiveExam — `competitiveExam` does not exist on that DTO");
  }

  /* ── 9. SKILLS EDGE: CAPS AND THE DATA LOSS ──────────────────────────────── */

  if (R.canAddSkill(['a', 'b']) !== false) bad('a third skill is allowed');
  if (R.maxTopicsPerSkill(2) !== 1) bad('with 2 skills a student may pick more than 1 topic each');
  if (R.maxTopicsPerSkill(1) !== 2) bad('with 1 skill a student may not pick 2 topics');
  if (R.canAddTopic({ Art: ['x'] }, 'Art', 2) === null) bad('a 2nd topic on a skill is allowed when 2 skills are chosen');
  if (R.canAddTopic({ Art: ['x'] }, 'Art', 1) !== null) bad('a 2nd topic is refused when only 1 skill is chosen');
  // The GLOBAL cap, reached only when the per-skill cap does NOT already block.
  //
  // With 2 skills the per-skill limit is 1, so a skill that already holds one is refused before the
  // total is ever consulted — the first version of this case could not see the total cap removed.
  // One skill allows 2 per skill, so holding one topic on each of two entries reaches the total.
  if (R.canAddTopic({ Art: ['x'], Chess: ['y'] }, 'Art', 1) === null) {
    bad('a 3rd topic is allowed across skills — the total is capped at 2 however it is distributed');
  }

  // THE DATA LOSS: the body must always carry all four fields.
  const b = R.skillsProfileBody({ importantSkills: ['Art'] });
  for (const k of ['importantSkills', 'selectedTopics', 'englishCommunication', 'isRelatedToJob']) {
    if (!(k in b)) bad(`skillsProfileBody omits \`${k}\` — this endpoint REPLACES the record, so an omitted field is destroyed`);
  }
  const career = codeOnly(src.careerSvc);
  if (/\{ importantSkills \}/.test(career)) {
    bad('saveSkillsProfile is sending `{ importantSkills }` again — that is the data-loss bug');
  }
  if (!/skillsProfileBody\(/.test(career)) bad('saveSkillsProfile does not build its body through skillsProfileBody');
  const skills = codeOnly(src.skills);
  if (!/englishCommunication/.test(skills) || !/selectedTopics/.test(skills)) {
    bad('SkillsTab does not round-trip selectedTopics and englishCommunication');
  }

  /* ── 10. THE PROFILE MEDIA ───────────────────────────────────────────────── */

  const profile = codeOnly(src.profile);
  const svc = codeOnly(src.profileSvc);
  if (!/uploadProfileVideo\(/.test(profile)) bad('the video upload is still never called');
  if (!/removeProfilePicture\(/.test(profile) || !/removeProfileVideo\(/.test(profile)) {
    bad('the Remove buttons are missing');
  }
  if (!/5 \* 1024 \* 1024/.test(profile)) bad('the 5 MB photo cap is not checked client-side');
  if (!/50 \* 1024 \* 1024/.test(profile)) bad('the 50 MB video cap is not checked client-side');
  // The two must not share an endpoint.
  if (!/upload\/profile-picture/.test(svc) || !/upload\/profile-video/.test(svc)) {
    bad('the picture and video endpoints are not both present');
  }
  const picBlock = svc.slice(svc.indexOf('uploadProfilePicture'), svc.indexOf('removeProfilePicture'));
  if (/profile-video/.test(picBlock)) bad('uploadProfilePicture points at the VIDEO endpoint');
  // DocumentPicker's octet-stream would be refused by the server.
  if (!/video\/mp4/.test(profile)) {
    bad("the video MIME has no fallback — DocumentPicker returns application/octet-stream and the server refuses it");
  }

  return out;
}

const MUTATIONS = [
  { name: 'THE BUG: the syllabus percent read from the wrong field', analytics: (s) => s.replace('syllabusPart?.overallCompletionPercent', 'syllabusPart?.completionPercent') },
  { name: 'a genuine 0% treated as missing', analytics: (s) => s.replace('return Number.isFinite(live) ? live : academicIQ?.syllabusCompletionPercent || 0;', 'return live || academicIQ?.syllabusCompletionPercent || 0;') },
  { name: 'the two star ladders unified', analytics: (s) => s.replace('  if (p >= 80) return 5;\n  if (p >= 60) return 4;\n  if (p >= 40) return 3;\n  if (p >= 20) return 2;', '  if (p >= 90) return 5;\n  if (p >= 70) return 4;\n  if (p >= 50) return 3;\n  if (p >= 30) return 2;') },
  { name: 'a star threshold shifted', analytics: (s) => s.replace('if (p >= 90) return 5;', 'if (p >= 85) return 5;') },
  { name: "the server's star ratings rendered again", src: (k, s) => (k === 'body' ? s.replace('syllabusStars(syllabusPct)', 'academic?.syllabusRating') : s) },
  { name: 'the sum-of-tabs fallback dropped', analytics: (s) => s.replace('  const tabs = ce?.examTabs || ce?.tabs || [];', '  return 0;\n  const tabs = ce?.examTabs || ce?.tabs || [];') },
  { name: 'GREY mocks counted as attempted', analytics: (s) => s.replace(".filter((m) => m.status !== 'GREY' && m.scorePercent != null)", '.filter((m) => m.scorePercent != null)') },
  { name: 'a null progress figure coerced to 0', analytics: (s) => s.replace('return ce?.myProgressPercent ?? null;', 'return ce?.myProgressPercent ?? 0;') },
  { name: 'the weak mocks sorted descending', analytics: (s) => s.replace('(a.scorePercent || 0) - (b.scorePercent || 0)', '(b.scorePercent || 0) - (a.scorePercent || 0)') },
  {
    // `replaceAll`, and targeting the sentence rather than the fragment. `Top 1,000` also appears
    // in the doc comment that warns about the comma, and `.replace` takes the FIRST occurrence —
    // so the first version of this mutation edited the comment and left the code untouched. Same
    // family as checkspeech's stale mutation: never pin to text that occurs elsewhere.
    name: 'a remark band reworded',
    analytics: (s) => s.replaceAll('towards a Top 1,000 rank', 'towards a Top 1000 rank'),
  },
  { name: 'an unknown mock status no longer GREY', analytics: (s) => s.replace("    default:\n      return { bg: '#f5f5f5', border: '#bdbdbd', fg: '#616161' };", "    default:\n      return { bg: '#e8f5e9', border: '#4caf50', fg: '#2e7d32' };") },
  { name: 'the gap templates retyped instead of derived', analytics: (s) => s.replace('export const GAP_LEVELS = REFLECTION_OPTIONS.map((o) => ({', 'export const GAP_LEVELS = [].map((o) => ({') },
  { name: 'covered winning over reflected', analytics: (s) => s.replace("  if (topic?.reflectedByStudent) return '✅';\n  if (topic?.coveredByTeacher) return '📖';", "  if (topic?.coveredByTeacher) return '📖';\n  if (topic?.reflectedByStudent) return '✅';") },
  { name: 'THE REGRESSION: the parent losing its hidden-node filter', src: (k, s) => (k === 'parent' ? s.replace('filterNodes=', 'noFilter=') : s) },
  { name: 'AnalyticsBody ignoring filterNodes on topics', src: (k, s) => (k === 'body' ? s.replace("filterNodes('TOPIC', c.topics || [])", '(c.topics || [])') : s) },
  { name: 'Card given a default (the parent becomes unreadable)', src: (k, s) => (k === 'body' ? s.replace('  Card,\n  CardTitle,', '  Card = View,\n  CardTitle,') : s) },
  { name: 'the focus pills left unguarded for the parent', src: (k, s) => (k === 'body' ? s.replace('skillsTree && skillsProfile?.selectedTopics', 'skillsProfile?.selectedTopics') : s) },
  { name: 'the student service dropping the skills tree again', src: (k, s) => (k === 'studentSvc' ? s.replace("skillsTree: studentApi.get('/api/skillsedge/tree'),", '') : s) },
  { name: 'the lock arming on the wrong fields', rules: (s) => s.replace("saved?.fullName && saved?.gender && saved?.dob && saved?.currentClass", 'saved?.fullName') },
  { name: 'THE LOCK: email frozen too', rules: (s) => s.replace("export const ALWAYS_EDITABLE = ['email', 'mobile'];", "export const ALWAYS_EDITABLE = ['mobile'];") },
  { name: 'a locked field made editable', rules: (s) => s.replace("export const ALWAYS_EDITABLE = ['email', 'mobile'];", "export const ALWAYS_EDITABLE = ['email', 'mobile', 'fullName'];") },
  { name: 'THE BUG: preparing sent in Title Case', rules: (s) => s.replace("export const PREPARING = { YES: 'YES', NO: 'NO' };", "export const PREPARING = { YES: 'Yes', NO: 'No' };") },
  { name: 'the entrance-exam minimum made unconditional', rules: (s) => s.replace('if (availableCount > 0 && n === 0)', 'if (n === 0)') },
  { name: 'a third entrance exam allowed', rules: (s) => s.replace('(selected?.length || 0) < MAX_ENTRANCE_EXAMS', 'true') },
  { name: 'a third skill allowed', rules: (s) => s.replace('(selected?.length || 0) < MAX_SKILLS', 'true') },
  { name: 'the per-skill topic cap inverted', rules: (s) => s.replace('(skillCount >= 2 ? 1 : 2)', '(skillCount >= 2 ? 2 : 1)') },
  { name: 'the 2-topic TOTAL cap removed', rules: (s) => s.replace('  if (total >= MAX_TOPICS_TOTAL) {', '  if (false) {') },
  { name: 'THE DATA LOSS: skillsProfileBody dropping englishCommunication', rules: (s) => s.replace('return { importantSkills, selectedTopics, englishCommunication, isRelatedToJob };', 'return { importantSkills, selectedTopics };') },
  { name: 'saveSkillsProfile sending only the skills again', src: (k, s) => (k === 'careerSvc' ? s.replace('const body = skillsProfileBody(profile);', 'const body = { importantSkills: profile };') : s) },
  { name: 'the video upload never called again', src: (k, s) => (k === 'profile' ? s.replaceAll('uploadProfileVideo(', 'noVideo(') : s) },
  { name: 'the Remove buttons dropped', src: (k, s) => (k === 'profile' ? s.replaceAll('removeProfileVideo(', 'noRemove(') : s) },
  { name: 'the video size check removed', src: (k, s) => (k === 'profile' ? s.replace('50 * 1024 * 1024', '500 * 1024 * 1024') : s) },
  { name: 'the video MIME fallback removed', src: (k, s) => (k === 'profile' ? s.replace("'video/mp4'", "picked.type") : s) },
  { name: 'the picture upload pointed at the video endpoint', src: (k, s) => (k === 'profileSvc' ? s.replace("multipart('/api/students/upload/profile-picture'", "multipart('/api/students/upload/profile-video'") : s) },
  { name: 'tabComplete reading the non-existent field again', src: (k, s) => (k === 'profileSvc' ? s.replace('data.preparingCompetitiveExam', 'data.competitiveExam') : s) },
];

console.log('Self-tests (each mutation must be caught):');
for (const m of MUTATIONS) {
  let caught;
  try {
    const [A, R] = await Promise.all([loadAnalytics(m.analytics), loadRules(m.rules)]);
    caught = assertions(A, R, loadSources(m.src, m.analytics, m.rules)).length > 0;
  } catch {
    caught = true;
  }
  if (caught) ok(m.name);
  else fail(`NOT CAUGHT: ${m.name} — the corresponding assertion is vacuous`);
}

console.log('\nBatch 2:');
{
  const [A, R] = await Promise.all([loadAnalytics(), loadRules()]);
  const problems = assertions(A, R, loadSources());
  if (problems.length === 0) {
    ok('the syllabus percent reads `overallCompletionPercent`; 0% survives the fallback');
    ok('both star ladders are computed client-side and differ');
    ok("competitive derivations match the web, remark bands byte-identical to the site's source");
    ok('the gap templates come from REFLECTION_OPTIONS, one copy only');
    ok('the parent keeps every prop AND gets a hidden-node filter for the new trees');
    ok('the lock spares exactly email and mobile; Academic IQ posts uppercase YES/NO');
    ok('Skills Edge caps hold and the profile body carries all four fields');
    ok('photo and video keep separate endpoints, caps and pickers');
  } else problems.forEach(fail);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL — ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
