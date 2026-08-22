// services/student/understandingScoring.js
// Mirrors: the "Test Your Understanding" scorer, which the web has copied into FOUR components.
//
// Verified identical across all four: SkillsEdge.js and AcademicIQ/SchoolResources.js are
// byte-identical; AcademicIQ/PersonalizedResources.js differs only in whitespace; and
// AcademicIQ/CompetitiveExam.js is inlined but computes exactly the same thing. One algorithm,
// four copies — so it lives here rather than under any one feature's service.
//
// It was originally written inside skillsEdgeService.js, which still re-exports it so existing
// callers are unchanged. Moved when Academic IQ became the second caller: a scorer named after one
// feature is how the second caller ends up writing a second copy.

export const BLOOMS_LEVELS = [
  'Remembering',
  'Understanding',
  'Applying',
  'Analyzing',
  'Evaluating',
  'Creating',
];

/**
 * The backend sends Bloom's levels in whatever spelling the authoring admin typed — verb or
 * gerund, and both the American and British spellings of "analyse". Copied verbatim from the web;
 * anything unrecognised falls back to Remembering rather than being dropped, so a mislabelled
 * question still counts somewhere.
 */
export function normalizeBloomsLevel(level) {
  if (!level) return 'Remembering';
  const map = {
    remember: 'Remembering',
    remembering: 'Remembering',
    understand: 'Understanding',
    understanding: 'Understanding',
    apply: 'Applying',
    applying: 'Applying',
    analyze: 'Analyzing',
    analyzing: 'Analyzing',
    analyse: 'Analyzing',
    analysing: 'Analyzing',
    evaluate: 'Evaluating',
    evaluating: 'Evaluating',
    create: 'Creating',
    creating: 'Creating',
  };
  return map[String(level).toLowerCase().trim()] || 'Remembering';
}

/**
 * Score an attempt.
 *
 * NEGATIVE MARKING: a question answered WRONGLY subtracts its `negativeMarks`; one left unanswered
 * subtracts nothing. The running total floors at 0 before the percentage is taken, so a heavily
 * penalised attempt reads 0%, never a negative.
 *
 * The Bloom's percentages are **correct/total by question count**, not by marks — deliberately a
 * different measure from the headline percentage, and the web is consistent about it.
 */
export function scoreUnderstanding(questions, answers) {
  const levels = {};
  BLOOMS_LEVELS.forEach((l) => {
    levels[l] = { correct: 0, total: 0, marks: 0, maxMarks: 0 };
  });

  let correctCount = 0;
  let totalMarks = 0;
  let maxMarks = 0;

  (questions || []).forEach((q) => {
    const marks = q.marks || 1;
    const negativeMarks = q.negativeMarks || 0;
    maxMarks += marks;

    const level = normalizeBloomsLevel(q.bloomsLevel);
    levels[level].total += 1;
    levels[level].maxMarks += marks;

    if (answers[q.id] === q.correctAnswer) {
      correctCount += 1;
      totalMarks += marks;
      levels[level].correct += 1;
      levels[level].marks += marks;
    } else if (answers[q.id]) {
      totalMarks -= negativeMarks;
    }
  });

  const percentages = {};
  BLOOMS_LEVELS.forEach((l) => {
    percentages[l] = levels[l].total > 0 ? Math.round((levels[l].correct / levels[l].total) * 100) : 0;
  });

  const finalMarks = Math.max(0, totalMarks);
  return {
    score: {
      correct: correctCount,
      total: (questions || []).length,
      marks: finalMarks,
      maxMarks,
      percentage: maxMarks > 0 ? Math.round((finalMarks / maxMarks) * 100) : 0,
    },
    blooms: { levels, percentages },
  };
}

/** 100 = mastery, ≥80 proficient, ≥50 partial, else critical. */
export function masteryBand(percentage) {
  if (percentage === 100) return 'mastery';
  if (percentage >= 80) return 'proficient';
  if (percentage >= 50) return 'partial';
  return 'critical';
}

export function masteryStatus(percentage) {
  return {
    mastery: 'Mastery',
    proficient: 'Proficient',
    partial: 'Partial Readiness',
    critical: 'Critical Gap',
  }[masteryBand(percentage)];
}

/**
 * Per-level feedback: 6 Bloom's levels × 4 bands, all 24 copied verbatim from the web.
 *
 * These are the whole point of the Bloom's breakdown — a bar chart alone tells a student their
 * "Analyzing" is 40% without telling them what to do about it. Paraphrasing would quietly change
 * the advice the platform gives, so treat this table as content, not as code.
 */
const BLOOMS_REMARKS = {
  Remembering: {
    critical:
      'You are facing difficulty in recalling key terms, definitions, and facts from this module. Revisit the basic concepts and focus on memorization of core ideas.',
    partial:
      'You can recall some important points, but consistency is missing. Regular revision and short recall-based practice will help strengthen your memory.',
    proficient:
      'You demonstrate strong recall of key concepts and facts. Your foundation is solid and supports higher-level learning.',
    mastery:
      'Excellent recall ability. You have complete command over the key facts and terminology of this module.',
  },
  Understanding: {
    critical:
      'This indicates limited conceptual understanding. You may remember some terms, but the meaning and relationships between concepts are unclear.',
    // Double-quoted so the inner 'why' stays the straight quotes the web uses.
    partial:
      "You understand the concepts at a surface level, but deeper clarity is required. Focus on explanations, examples, and 'why' based questions.",
    proficient:
      'You have a good conceptual understanding and can explain ideas clearly. You are well prepared to apply these concepts.',
    mastery:
      'Outstanding conceptual clarity. You fully understand the module and its underlying principles.',
  },
  Applying: {
    critical:
      'You are currently unable to apply concepts correctly in problem-solving situations. This suggests a gap between understanding and execution.',
    partial:
      'You can apply concepts in familiar situations, but struggle with variation. More guided practice will improve accuracy.',
    proficient:
      'You can effectively apply concepts to solve problems. This shows growing confidence and competence.',
    mastery:
      'Excellent application skills. You can confidently use concepts across different contexts.',
  },
  Analyzing: {
    critical:
      'You find it difficult to break problems into parts or identify relationships. Analytical thinking needs focused development.',
    partial:
      'You are developing analytical skills, but conclusions are sometimes incomplete or inconsistent.',
    proficient:
      'You analyze information logically and identify patterns and relationships effectively.',
    mastery:
      'Exceptional analytical ability. You demonstrate strong logical reasoning and insight.',
  },
  Evaluating: {
    critical:
      'You struggle to justify answers or make informed judgments. Focus on reasoning and evidence-based thinking.',
    partial:
      'You can evaluate situations, but your justifications lack depth. Strengthen your arguments with clear reasoning.',
    proficient:
      'You evaluate concepts thoughtfully and justify decisions with sound logic.',
    mastery:
      'Outstanding evaluative thinking. You make well-reasoned judgments with confidence.',
  },
  Creating: {
    critical:
      'You are yet to demonstrate originality or solution-building skills. Practice open-ended and creative tasks.',
    partial: 'You show emerging creativity, but ideas need better structure and clarity.',
    proficient:
      'You can create meaningful solutions and original responses based on your understanding.',
    mastery:
      'Exceptional creativity and innovation. You demonstrate complete mastery and original thinking.',
  },
};

export function bloomsRemark(level, percentage) {
  return BLOOMS_REMARKS[level]?.[masteryBand(percentage)] || 'No remark available for this level.';
}
