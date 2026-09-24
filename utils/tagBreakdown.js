/**
 * Turns a finished attempt into the Bloom's and skill breakdowns the report charts draw.
 *
 * A copy of `frontendmain/src/student/testrunner/tagBreakdown.js` — separate git roots, same rule
 * as `utils/shuffle.js`. Keep them in step: a student comparing the app with the website must not
 * see two different percentages for the same paper.
 *
 * ── WHY IT IS COMPUTED ON THE CLIENT ────────────────────────────────────────
 * The mock-test attempt row stores marks and nothing else — no per-question answers — so no
 * breakdown could be built server-side for any attempt ever taken. Both the questions and the
 * answers are in hand at submission, so it is built here and works for every paper already in the
 * bank, with no migration.
 *
 * Output shape is deliberately Universal Adaptive's `TagBreakdown{tag, correct, total, percentage,
 * classAveragePercentage}`, so `components/ui/charts/GroupedBars` renders it unchanged.
 *
 * `classAveragePercentage` is null: a class average needs everyone else's answers. GroupedBars
 * already drops that series when every row is null.
 *
 * NOTE: percentages, NOT remarks. This must not reach for the three Bloom's remark tables
 * (`services/student/understandingScoring.js`, `constants/practiceZone.js`,
 * `constants/codingProBlooms.js`), which are deliberately unmerged and belong to other features.
 */

/** The six canonical levels, in teaching order. */
const CANONICAL = ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'];

/**
 * `blooms_level` is free text in nine tables, with no enum: "Analyze", "analyse", "Analyzing" and
 * "ANALYSIS" all occur, and to a student they are one thing.
 */
export function canonicalBloom(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;
  if (text.startsWith('remember')) return 'Remembering';
  if (text.startsWith('understand') || text.startsWith('comprehen')) return 'Understanding';
  if (text.startsWith('apply') || text.startsWith('applic')) return 'Applying';
  if (text.startsWith('analy')) return 'Analyzing';
  if (text.startsWith('evaluat') || text.startsWith('assess')) return 'Evaluating';
  if (text.startsWith('creat') || text.startsWith('synthes')) return 'Creating';
  return null;
}

function rows(map) {
  return [...map.entries()].map(([tag, { correct, total }]) => ({
    tag,
    correct,
    total,
    percentage: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
    classAveragePercentage: null,
  }));
}

/**
 * @param {Array}    questions normalized questions (they carry `bloomsLevel` and `skillSet`)
 * @param {object}   answers   { [questionId]: optionKey }
 * @param {Function} [isCorrect] (question, chosenKey) => boolean
 */
export function buildTagBreakdown(questions = [], answers = {}, isCorrect) {
  const blooms = new Map();
  // Every level is listed even when the paper never tested it, so a gap is visible, not absent.
  CANONICAL.forEach((level) => blooms.set(level, { correct: 0, total: 0 }));
  const skills = new Map();

  questions.forEach((question) => {
    const chosen = answers[question.id];
    // An unanswered question is not evidence either way.
    if (chosen === undefined || chosen === null || chosen === '') return;
    const right = isCorrect ? !!isCorrect(question, chosen) : chosen === question.correctKey;

    const level = canonicalBloom(question.bloomsLevel);
    if (level) {
      const entry = blooms.get(level);
      entry.total += 1;
      if (right) entry.correct += 1;
    }

    const skill = String(question.skillSet || '').trim();
    if (skill) {
      if (!skills.has(skill)) skills.set(skill, { correct: 0, total: 0 });
      const entry = skills.get(skill);
      entry.total += 1;
      if (right) entry.correct += 1;
    }
  });

  return { bloomsBreakdown: rows(blooms), skillBreakdown: rows(skills) };
}

export { CANONICAL };
