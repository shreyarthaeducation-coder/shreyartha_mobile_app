/**
 * What Manage Questions does with a paper — the app side of the website's QuestionManager.js and
 * eitherOrGrouping.js. Items come from `paperItems()` (utils/marksSheetScan.js): `{ lead,
 * alternatives, parts }`, an either/or choice once and a passage with its lettered parts.
 *
 * Import-free on purpose: scripts/checkquestionpaper.mjs evaluates it.
 */

const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD'];
const OPTION_IMAGE_KEYS = ['optionAImageUrl', 'optionBImageUrl', 'optionCImageUrl', 'optionDImageUrl'];

/** "a", "b" … — papers number 1(a), never 1(1). */
export const partLabel = (index) => String.fromCharCode(97 + (index % 26));

export const hasParts = (item) => Boolean(item?.parts && item.parts.length);

/** A choice is a group with more than one alternative; a lone grouped question is not one. */
export const isChoice = (item) => Boolean(item?.lead?.eitherOrGroup) && (item.alternatives || []).length > 1;

/** What one item is worth: a passage the sum of its parts, a choice its marks once. */
export function itemMarks(item) {
  if (hasParts(item)) return item.parts.reduce((sum, part) => sum + (part.marks || 0), 0);
  return item?.lead?.marks || 0;
}

/** True when the item has no maximum of its own — a question made from a scanned answer book. */
export const itemHasNoMaximum = (item) => !hasParts(item) && item?.lead?.marks == null;

/**
 * What the paper on screen is out of: its items added up (a choice once, a passage through its
 * parts) — or, when any box has no maximum of its own, the exam's total marks.
 */
export function paperTotal(items, examMaxMarks) {
  const boxes = (items || []).flatMap((item) => (hasParts(item) ? item.parts : [item.lead]));
  if (boxes.some((q) => q.marks == null) && examMaxMarks != null) return examMaxMarks;
  return (items || []).reduce((sum, item) => sum + itemMarks(item), 0);
}

/** How many papers the exam has: the highest set any question is in, or a set just opened. */
export function setCount(questions, draftSet) {
  const saved = (questions || []).reduce((highest, q) => Math.max(highest, q.questionSet || 1), 1);
  return Math.max(saved, draftSet || 1);
}

/**
 * Why these questions cannot be joined into one either/or choice, or null when they can — the
 * website's groupingProblem, which mirrors the server's rule.
 */
export function groupingProblem(selected) {
  if (!selected || selected.length < 2) {
    return 'Select at least two questions to join into an either/or choice.';
  }
  if (selected.some((q) => q.parentQuestionId != null)) {
    return 'A sub-question cannot be part of an either/or choice. Join the questions they sit under instead.';
  }
  const marks = [...new Set(selected.map((q) => q.marks || 0))].sort((a, b) => a - b);
  if (marks.length > 1) {
    return (
      'An either/or choice has to be worth the same either way, but the questions you picked are ' +
      `worth ${marks.join(' and ')} marks. Make them equal first.`
    );
  }
  return null;
}

/**
 * The paper's question ids after moving item `index` one place (`direction` -1 or +1), or null when
 * it cannot move. A choice's alternatives stay together and a question's parts follow it, so the
 * whole paper is sent and every part travels with its parent.
 */
export function reorderIds(items, index, direction) {
  const target = index + direction;
  if (!items || target < 0 || target >= items.length || index < 0 || index >= items.length) return null;
  const reordered = [...items];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return reordered.flatMap((item) => [
    ...item.alternatives.map((alternative) => alternative.id),
    ...(item.parts || []).map((part) => part.id),
  ]);
}

/** Visible words of an editor's HTML — "<p></p>" is empty, a picture alone is not text. */
export const hasMeaningfulText = (value) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim() !== '' || /<img\b|data-math-rendered|class="katex/.test(String(value || ''));

/**
 * Why the question form cannot be saved, or []. An MCQ option counts when it has text OR a
 * picture — a maths paper's four options are often four diagrams; the server applies the same rule.
 */
export function formProblems(form) {
  const problems = [];
  if (!hasMeaningfulText(form?.questionStatement)) problems.push('Write the question.');
  if (form?.questionType === 'MCQ') {
    const filled = OPTION_KEYS.filter((key, i) => hasMeaningfulText(form[key]) || form[OPTION_IMAGE_KEYS[i]]).length;
    if (filled < 2) problems.push('Add at least 2 options for an MCQ question — text or a picture.');
  }
  const marks = form?.marks;
  if (marks !== '' && marks != null && !(Number.isInteger(Number(marks)) && Number(marks) >= 0)) {
    problems.push('Marks must be a whole number, 0 or more — or blank for no maximum.');
  }
  return problems;
}

const norm = (s) => String(s || '').trim().toLowerCase();

/**
 * A PDF's chapter and topic names matched against the subject's curriculum, so an imported
 * question carries real ids where possible; unmatched names pass through as they are.
 */
export function matchCurriculum(chapters, chapterName, topicName) {
  const chapter = chapterName ? (chapters || []).find((c) => norm(c.name) === norm(chapterName)) : null;
  if (!chapter) {
    return { chapterId: null, chapterName: chapterName || null, topicId: null, topicName: topicName || null };
  }
  const topic = topicName
    ? (chapter.topics || []).find((t) => norm(t.displayName || t.name) === norm(topicName))
    : null;
  return {
    chapterId: chapter.id ?? null,
    chapterName: chapter.name,
    topicId: topic ? topic.id ?? null : null,
    topicName: topic ? topic.displayName || topic.name : topicName || null,
  };
}

const TYPES = ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'LONG_ANSWER', 'FILL_IN_THE_BLANK', 'PARAGRAPH'];

/**
 * One parsed question as the payload the website's import sends, or null when it must be skipped:
 * no text, or an MCQ with fewer than two options (the server would refuse it and fail the batch).
 */
export function importPayload(parsed, chapters, questionSet) {
  const type = TYPES.includes(parsed?.questionType) ? parsed.questionType : 'MCQ';
  const isMcq = type === 'MCQ';
  const statement = String(parsed?.questionStatement || '').trim();
  if (!statement) return null;
  const opt = (v) => (isMcq ? String(v || '').trim() || null : null);
  const payload = {
    ...matchCurriculum(chapters, parsed.chapterName, parsed.topicName),
    questionType: type,
    questionStatement: statement,
    optionA: opt(parsed.optionA),
    optionB: opt(parsed.optionB),
    optionC: opt(parsed.optionC),
    optionD: opt(parsed.optionD),
    // The parser pulls a diagram drawn under the question out of the PDF and stores it.
    questionImageUrl: parsed.questionImageUrl || null,
    optionAImageUrl: null,
    optionBImageUrl: null,
    optionCImageUrl: null,
    optionDImageUrl: null,
    sampleAnswerImageUrl: null,
    bloomsTaxonomy: String(parsed.bloomsTaxonomy || '').trim() || null,
    skillSet: String(parsed.skillSet || '').trim() || null,
    sampleAnswer: String(parsed.sampleAnswer || '').trim() || null,
    marks: Number(parsed.marks) > 0 ? Number(parsed.marks) : 1,
    // Into the paper on screen.
    questionSet: questionSet || 1,
    parentQuestionId: null,
  };
  if (isMcq && OPTION_KEYS.filter((k) => payload[k]).length < 2) return null;
  return payload;
}

/** "Copied 12 questions into 2 sections — Skipped 9C (already has a paper)." */
export function describeCopyResult(res) {
  const parts = [];
  if (res?.copiedQuestions > 0) {
    parts.push(
      `Copied ${res.copiedQuestions} question${res.copiedQuestions !== 1 ? 's' : ''} into ` +
        `${res.targetsUpdated} section${res.targetsUpdated !== 1 ? 's' : ''}`,
    );
  }
  const skipped = (res?.details || []).filter((d) => d.skippedReason);
  if (skipped.length) parts.push(`Skipped ${skipped.map((d) => `${d.label} (${d.skippedReason})`).join(', ')}`);
  return parts.length ? `${parts.join(' — ')}.` : 'Nothing was copied.';
}

// ── The printed paper ──────────────────────────────────────────────────────────────────────────

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Rich text as the website stored it; plain text escaped. */
const body = (value) => (/<[a-z][\s\S]*>/i.test(String(value || '')) ? String(value) : escapeHtml(value));

const imageTag = (url, cls) => (url ? `<img class="${cls}" src="${escapeHtml(url)}" />` : '');

function questionTail(q) {
  let html = imageTag(q.questionImageUrl, 'qimg');
  if (q.questionType === 'MCQ' && OPTION_KEYS.some((key, i) => q[key] || q[OPTION_IMAGE_KEYS[i]])) {
    html += '<div class="opts">';
    OPTION_KEYS.forEach((key, i) => {
      if (q[key] || q[OPTION_IMAGE_KEYS[i]]) {
        html += `<div class="opt">(${String.fromCharCode(65 + i)}) ${body(q[key])}${imageTag(q[OPTION_IMAGE_KEYS[i]], 'oimg')}</div>`;
      }
    });
    html += '</div>';
  }
  return html;
}

/**
 * The question paper as a printable HTML page — the website's printable paper: the school's name
 * and logo, the exam, the class, the paper's total, and every item numbered as the student meets
 * it, a choice with OR between its alternatives, a passage with its lettered parts.
 *
 * @param {object} info  { schoolName, schoolLogo, examName, examCode, className, sectionName,
 *                         subjectName, set, setCount, totalMarks, katexCss }
 */
export function paperHtml(info, items) {
  const head = [
    info.schoolLogo ? `<img class="logo" src="${escapeHtml(info.schoolLogo)}" />` : '',
    info.schoolName ? `<h1>${escapeHtml(info.schoolName)}</h1>` : '',
    `<h2>${escapeHtml(info.examName || '')}${info.examCode ? ` (${escapeHtml(info.examCode)})` : ''}</h2>`,
    `<div class="meta">${escapeHtml([
      info.className && info.sectionName ? `Class ${info.className}-${info.sectionName}` : info.className,
      info.subjectName,
      info.setCount > 1 ? `Set ${info.set}` : null,
      info.totalMarks != null ? `Total marks: ${info.totalMarks}` : null,
    ].filter(Boolean).join(' · '))}</div>`,
  ].join('');

  const rows = (items || []).map((item, idx) => {
    const marks = itemHasNoMaximum(item) ? '' : `<span class="marks">[${itemMarks(item)} marks]</span>`;
    if (isChoice(item)) {
      const alts = item.alternatives
        .map((alt, i) => `${i > 0 ? '<div class="or">OR</div>' : ''}<div class="alt">${body(alt.questionStatement)}${questionTail(alt)}</div>`)
        .join('');
      return `<div class="q"><div class="qhead"><b>Q${idx + 1}.</b>${marks}</div>${alts}</div>`;
    }
    const parts = hasParts(item)
      ? `<div class="parts">${item.parts
          .map((part, p) => `<div class="part"><b>(${partLabel(p)})</b> ${body(part.questionStatement)}${questionTail(part)}${part.marks != null ? ` <span class="marks">[${part.marks}]</span>` : ''}</div>`)
          .join('')}</div>`
      : '';
    return `<div class="q"><div class="qhead"><b>Q${idx + 1}.</b>${marks}</div><div>${body(item.lead.questionStatement)}</div>${questionTail(item.lead)}${parts}</div>`;
  });

  return `<!doctype html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${info.katexCss ? `<link rel="stylesheet" href="${escapeHtml(info.katexCss)}" />` : ''}
<style>
body{font-family:-apple-system,Roboto,Arial,sans-serif;color:#111;margin:28px;font-size:13px;line-height:1.5}
.logo{height:56px;display:block;margin:0 auto 6px}
h1{text-align:center;font-size:18px;margin:0}
h2{text-align:center;font-size:15px;margin:4px 0}
.meta{text-align:center;color:#444;margin-bottom:14px;border-bottom:1px solid #999;padding-bottom:8px}
.q{margin:12px 0;page-break-inside:avoid}
.qhead{display:flex;justify-content:space-between}
.marks{color:#444;font-size:12px;margin-left:8px}
.or{text-align:center;font-weight:bold;margin:6px 0}
.opts{margin:6px 0 0 18px}.opt{margin:2px 0}
.parts{margin:6px 0 0 18px}.part{margin:4px 0}
.qimg{max-width:100%;max-height:260px;display:block;margin:6px 0}
.oimg{max-width:160px;max-height:120px;vertical-align:middle;margin-left:6px}
table{border-collapse:collapse}td,th{border:1px solid #999;padding:3px 6px}
p{margin:2px 0}
</style></head><body>${head}${rows.join('')}</body></html>`;
}
