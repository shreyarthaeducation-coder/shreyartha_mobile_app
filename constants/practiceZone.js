// constants/practiceZone.js
// Mirrors: frontendmain/src/student/platform/AcademicIQ/PracticeZone.js
//
// GENERATED FROM THE WEB SOURCE, then reviewed — 36 verbatim strings a student reads as their
// practice result.
//
// ⚠ THESE BLOOM'S REMARKS ARE **NOT** THE SKILLS EDGE ONES. 18 of the 24 are identical and 6 are
// not — Practice Zone's are shorter and it says "memorisation" where Skills Edge says
// "memorization". Sharing one set would look correct and silently reword six of them, so the two
// tables stay separate. (Checked, not assumed: see the extractor's own assertion.)
//
// Practice Zone also scores differently from the understanding test: answers are matched on
// `correctOptionIndex` (an INDEX) rather than `correctAnswer` (a LETTER), there is no negative
// marking, and Bloom's counts only correct/total. Do not reach for scoreUnderstanding here.

/** The three practice levels, in tab order. */
export const PRACTICE_LEVELS = [
  { key: 'basic', label: 'Basic' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
];

/** A level is passed at 80% — the same threshold that unlocks the next one. */
export const PASS_MARK = 80;

/**
 * The question's difficulty, normalised.
 *
 * ── THE FIELD IS `difficulty`, AND ONLY `difficulty` ─────────────────────────
 * `PracticeQuestionResponse` (backendmain .../practice/payload/) emits exactly:
 *   { id, questionText, options[], correctOptionIndex, difficulty, explanation, skillSet, bloomsLevel }
 *
 * This screen previously read `q.level || q.difficultyLevel`. **Neither field exists**, so every
 * question fell through to the `'basic'` default and the Intermediate and Advanced tabs were always
 * empty while Basic showed the entire bank. That is the bug the student saw.
 *
 * Tolerant of case and whitespace on purpose: the backing column `AcademicQuestion.testLevel` is a
 * free-text String with no enum and no DB constraint, so `"Basic"`, `"BASIC "` and `"basic"` all
 * occur. A null `testLevel` is already rendered as `"basic"` server-side; the `|| 'basic'` here
 * covers a field that is absent altogether.
 */
export function questionLevel(question) {
  return String(question?.difficulty || 'basic')
    .trim()
    .toLowerCase();
}

/**
 * Is this level still locked for the student?
 *
 * Verbatim from the web's `isTabLocked` (PracticeZone.js:288-302): Basic is always open,
 * Intermediate needs Basic ≥ 80, Advanced needs Intermediate ≥ 80. Note it reads `.score`, NOT
 * `.passed` — a student whose stored `passed` flag disagrees with their score still follows the
 * score.
 *
 * @param {string} level    'basic' | 'intermediate' | 'advanced'
 * @param {object} progress `/api/practice/topic/{id}/progress` → { basic: {score, passed}, … }
 */
export function isLevelLocked(level, progress) {
  const p = progress || {};
  if (level === 'intermediate') return !p.basic || p.basic.score < PASS_MARK;
  if (level === 'advanced') return !p.intermediate || p.intermediate.score < PASS_MARK;
  return false; // basic, and anything unrecognised
}

/**
 * Which two Bloom's levels each difficulty reports on.
 *
 * ── THE CHART IS FIXED PER LEVEL, NOT DERIVED FROM THE DATA ──────────────────
 * The web's `BloomsTaxonomyChart` on this screen renders **exactly these two levels** for the
 * active difficulty — no more, no fewer. Rendering "whichever levels the questions happened to
 * carry" is a different chart: a Basic set that happens to include one Applying question would
 * sprout a third bar the website never shows, and a level with no questions would silently vanish
 * rather than reading as 0%.
 *
 * That distinction is the whole of gap 5b, so it lives here as data rather than as a filter at the
 * call site.
 */
export const LEVEL_BLOOMS = {
  basic: ['Remembering', 'Understanding'],
  intermediate: ['Applying', 'Analyzing'],
  advanced: ['Evaluating', 'Creating'],
};

/** The web's unlock hints, verbatim — shown when a locked level is tapped. */
export const LEVEL_LOCK_HINTS = {
  intermediate: 'Score 80% or above in Basic to unlock',
  advanced: 'Score 80% or above in Intermediate to unlock',
};

/** Per level, a title + message for each of the four score bands. */
export const PERFORMANCE_REMARKS = {
  basic: {
    below50: {
      title: "Needs Immediate Concept Reinforcement",
      message: "Your understanding of this chapter is currently very limited. This indicates gaps in both remembering key concepts and understanding their meaning. It is strongly recommended that you revisit the chapter from the beginning, focus on core definitions, formulas, and explanations, and use guided examples to strengthen your conceptual clarity.",
    },
    between50and79: {
      title: "Partial Conceptual Clarity",
      message: "You are able to recall important concepts, but your conceptual understanding needs improvement. To progress further, you should re-read the key sections, revise important points, and practice explanation-based questions to deepen your understanding.",
    },
    between80and99: {
      title: "Conceptually Ready to Progress",
      message: "You have demonstrated a good understanding of the chapter and are able to remember the key concepts accurately. You are eligible to move to the next level. However, continue revising core concepts to ensure complete conceptual mastery.",
    },
    exact100: {
      title: "Concept Mastery Achieved",
      message: "Outstanding performance! You have shown excellent conceptual clarity and recall. You are fully ready to advance to the Application & Analysis level, where you will apply your learning to problem-solving and real-world scenarios.",
    },
  },
  intermediate: {
    below50: {
      title: "Application Skills Not Yet Developed",
      message: "You understand some concepts, but are currently unable to apply them effectively in problem-solving or analytical situations. Focus on worked examples, step-by-step problem solving, and understanding how concepts are used in different contexts.",
    },
    between50and79: {
      title: "Developing Application & Analysis Skills",
      message: "You are beginning to apply concepts correctly, but analytical consistency is still developing. Practice more application-based questions, case studies, and multi-step problems to strengthen your analytical thinking.",
    },
    between80and99: {
      title: "Application Proficiency Achieved",
      message: "You can confidently apply concepts and analyze situations effectively. You are ready to move to the Advanced level, where higher-order thinking and judgment-based skills will be assessed.",
    },
    exact100: {
      title: "Strong Analytical Thinker",
      message: "Excellent work! You have demonstrated strong application and analytical skills. You are fully prepared to progress to evaluation and creative thinking challenges.",
    },
  },
  advanced: {
    below50: {
      title: "Higher-Order Thinking Needs Development",
      message: "You are yet to demonstrate strong evaluative or creative thinking. Work on open-ended questions, reasoning-based answers, and reflective thinking to improve your judgment and originality.",
    },
    between50and79: {
      title: "Emerging Critical & Creative Thinking",
      message: "You show early signs of evaluation and creative thinking, but responses lack depth or justification. Focus on justifying answers, forming opinions with reasons, and creating structured solutions.",
    },
    between80and99: {
      title: "Advanced Thinking Proficiency",
      message: "You demonstrate strong critical judgment and creative problem-solving skills. This reflects advanced mastery of the chapter and readiness for real-world applications.",
    },
    exact100: {
      title: "Exemplary Higher-Order Thinker",
      message: "Exceptional performance! You have shown high-level evaluation, originality, and creativity. You have achieved complete mastery and are ready for enrichment, innovation tasks, and leadership challenges.",
    },
  },
};

/** Which band a percentage falls in. 100 is its own band, not merged into the top one. */
export function performanceBand(percentage) {
  if (percentage === 100) return 'exact100';
  if (percentage >= 80) return 'between80and99';
  if (percentage >= 50) return 'between50and79';
  return 'below50';
}

export function performanceRemark(level, percentage) {
  return PERFORMANCE_REMARKS[level]?.[performanceBand(percentage)] || null;
}

/** Practice Zone's OWN Bloom's remarks — see the warning at the top of this file. */
export const PRACTICE_BLOOMS_REMARKS = {
  Remembering: {
    critical:
      "You are facing difficulty in recalling key terms, definitions, and facts. Revisit the basic concepts and focus on memorisation of core ideas.",
    partial:
      "You can recall some important points, but consistency is missing. Regular revision and short recall-based practice will help strengthen your memory.",
    proficient:
      "You demonstrate strong recall of key concepts and facts. Your foundation is solid and supports higher-level learning.",
    mastery:
      "Excellent recall ability. You have complete command over the key facts and terminology.",
  },
  Understanding: {
    critical:
      "This indicates limited conceptual understanding. The meaning and relationships between concepts are unclear. Focus on explanations and 'why' based questions.",
    partial:
      "You understand concepts at a surface level, but deeper clarity is required. Focus on explanations, examples, and concept relationships.",
    proficient:
      "You have a good conceptual understanding and can explain ideas clearly. You are well prepared to apply these concepts.",
    mastery:
      "Outstanding conceptual clarity. You fully understand the material and its underlying principles.",
  },
  Applying: {
    critical:
      "You are currently unable to apply concepts correctly in problem-solving situations. More guided practice will bridge the gap.",
    partial:
      "You can apply concepts in familiar situations, but struggle with variation. More guided practice will improve accuracy.",
    proficient:
      "You can effectively apply concepts to solve problems. This shows growing confidence and competence.",
    mastery:
      "Excellent application skills. You can confidently use concepts across different contexts.",
  },
  Analyzing: {
    critical:
      "You find it difficult to break problems into parts or identify relationships. Analytical thinking needs focused development.",
    partial:
      "You are developing analytical skills, but conclusions are sometimes incomplete or inconsistent.",
    proficient:
      "You analyze information logically and identify patterns and relationships effectively.",
    mastery:
      "Exceptional analytical ability. You demonstrate strong logical reasoning and insight.",
  },
  Evaluating: {
    critical:
      "You struggle to justify answers or make informed judgments. Focus on reasoning and evidence-based thinking.",
    partial:
      "You can evaluate situations, but your justifications lack depth. Strengthen your arguments with clear reasoning.",
    proficient:
      "You evaluate concepts thoughtfully and justify decisions with sound logic.",
    mastery:
      "Outstanding evaluative thinking. You make well-reasoned judgments with confidence.",
  },
  Creating: {
    critical:
      "You are yet to demonstrate originality or solution-building skills. Practice open-ended and creative tasks.",
    partial:
      "You show emerging creativity, but ideas need better structure and clarity.",
    proficient:
      "You can create meaningful solutions and original responses based on your understanding.",
    mastery:
      "Exceptional creativity and innovation. You demonstrate complete mastery and original thinking.",
  },
};

export function practiceBloomsRemark(level, percentage) {
  const band =
    percentage === 100 ? 'mastery' : percentage >= 80 ? 'proficient' : percentage >= 50 ? 'partial' : 'critical';
  return PRACTICE_BLOOMS_REMARKS[level]?.[band] || '';
}
