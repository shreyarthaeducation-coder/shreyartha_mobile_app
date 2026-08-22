// constants/codingProBlooms.js
// Mirrors: frontendmain/src/student/platform/CodingPro/CodingProMyAssessment.js
//
// ⚠ THE THIRD BLOOM'S REMARK TABLE IN THIS CODEBASE, and the third that is *almost* one of the
// others. Of these 24 strings, **21 also appear in SkillsEdge.js and 18 in PracticeZone.js** — so
// three features have three overlapping-but-different tables:
//
//   services/student/understandingScoring.js   Skills Edge + Academic IQ resources
//   constants/practiceZone.js                  Practice Zone (18/24 shared with Skills Edge)
//   constants/codingProBlooms.js               Coding Pro   (21/24 shared with Skills Edge)
//
// Merging any two would look obviously right and silently reword the handful that differ. The
// extractor that generated this file asserts the table is not a duplicate before emitting, so a
// future attempt to consolidate them fails loudly instead of quietly.
//
// The SCORER is shared — Coding Pro's assessment uses the same marks/negativeMarks/floor-at-0
// algorithm as the others (see services/student/understandingScoring.js). Only the prose differs.

const CODING_PRO_BLOOMS_REMARKS = {
  Remembering: {
    critical:
      "You are facing difficulty in recalling key terms, definitions, and facts from this topic. Revisit the basic concepts and focus on memorization of core ideas.",
    partial:
      "You can recall some important points, but consistency is missing. Regular revision and short recall-based practice will help strengthen your memory.",
    proficient:
      "You demonstrate strong recall of key concepts and facts. Your foundation is solid and supports higher-level learning.",
    mastery:
      "Excellent recall ability. You have complete command over the key facts and terminology of this topic.",
  },
  Understanding: {
    critical:
      "This indicates limited conceptual understanding. You may remember some terms, but the meaning and relationships between concepts are unclear.",
    partial:
      "You understand the concepts at a surface level, but deeper clarity is required. Focus on explanations, examples, and 'why' based questions.",
    proficient:
      "You have a good conceptual understanding and can explain ideas clearly. You are well prepared to apply these concepts.",
    mastery:
      "Outstanding conceptual clarity. You fully understand the topic and its underlying principles.",
  },
  Applying: {
    critical:
      "You are currently unable to apply concepts correctly in problem-solving situations. This suggests a gap between understanding and execution.",
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

/** Same four bands as everywhere else: 100 mastery · >=80 proficient · >=50 partial · else critical. */
export function codingBloomsRemark(level, percentage) {
  const band =
    percentage === 100
      ? 'mastery'
      : percentage >= 80
        ? 'proficient'
        : percentage >= 50
          ? 'partial'
          : 'critical';
  return CODING_PRO_BLOOMS_REMARKS[level]?.[band] || '';
}
