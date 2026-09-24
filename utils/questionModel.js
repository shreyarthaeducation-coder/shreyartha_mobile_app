/**
 * One question shape for every test in the app.
 *
 * A copy of `frontendmain/src/student/testrunner/questionModel.js` — the two repos have separate
 * git roots, exactly like `utils/shuffle.js`. Keep them in step; the adapters are the contract
 * between the screens and the runner on both platforms.
 *
 * ── WHY IT EXISTS ───────────────────────────────────────────────────────────
 * Two incompatible shapes are in use and they look alike:
 *
 *   LETTERED — understanding and mock tests. `optionA`…`optionD`, and `correctAnswer` is the
 *              LETTER. The answer posted back is that letter.
 *   INDEXED  — the adaptive engines. An `options` array, graded by POSITION.
 *
 * `components/student/academiciq/AdaptiveRunner.js` documents what happens when they are mixed: a
 * question renders with no answers at all. So `ExamRunner` never sees a raw question.
 *
 * `option.key` is therefore the letter or the stringified index — precisely what each submit
 * payload already sends. Nothing about grading changes.
 */

const present = (value) => value != null && String(value).trim() !== '';

/** Understanding tests, mock tests: four lettered columns, graded by letter. */
export function fromLettered(q) {
  const options = ['A', 'B', 'C', 'D']
    .map((letter) => ({ key: letter, label: letter, html: q[`option${letter}`] }))
    .filter((option) => present(option.html));

  return {
    id: q.id,
    shape: 'LETTERED',
    html: q.questionText,
    hint: q.hint || '',
    solution: q.solution || '',
    marks: q.marks ?? 1,
    negativeMarks: q.negativeMarks ?? 0,
    bloomsLevel: q.bloomsLevel || '',
    skillSet: q.skillSet || '',
    options,
    correctKey: q.correctAnswer || null,
    raw: q,
  };
}

/** The adaptive engines and the competitive-exam practice sets: an array, graded by position. */
export function fromIndexed(q) {
  const list = Array.isArray(q.options) ? q.options : [];
  const options = list
    .map((text, index) => ({
      key: String(index),
      label: String.fromCharCode(65 + index),
      html: text,
    }))
    .filter((option) => present(option.html));

  return {
    id: q.id ?? q.questionId,
    shape: 'INDEXED',
    html: q.questionText ?? q.text,
    hint: q.hint || '',
    solution: q.solution || '',
    marks: q.marks ?? 1,
    negativeMarks: q.negativeMarks ?? 0,
    bloomsLevel: q.bloomsLevel || '',
    skillSet: q.skillSet || '',
    options,
    // Two names for one thing: `correctIndex` in the adaptive payloads, `correctOptionIndex` in the
    // competitive-exam ones.
    correctKey: firstIndex(q.correctIndex, q.correctOptionIndex),
    raw: q,
  };
}

function firstIndex(...candidates) {
  for (const value of candidates) {
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return null;
}

/** True when a question has been answered. `0` is a legal index, so truthiness will not do. */
export function isAnswered(answers, question) {
  const value = answers?.[question?.id];
  return value !== undefined && value !== null && value !== '';
}

/**
 * Answers keyed by question id and valued by a STRING key.
 *
 * Indexed hosts hold their answers as NUMBERS and compare with `===` when scoring. Rather than
 * touch that arithmetic, they pass answers through here on the way in and `Number(key)` on the way
 * out.
 */
export function asKeys(answers = {}) {
  const out = {};
  Object.entries(answers).forEach(([id, value]) => {
    if (value !== undefined && value !== null) out[id] = String(value);
  });
  return out;
}
