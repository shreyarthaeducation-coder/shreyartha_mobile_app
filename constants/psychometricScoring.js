// constants/psychometricScoring.js
// Mirrors: frontendmain/src/student/platform/PsychometricAssessment/PsychometricAssessment.js
//          (`getTopicType`, `getSkillCategories`, `getStreamFromBloomTaxonomy`,
//           `processAssessmentResults`)
//
// THIS IS CONTENT, NOT LOGIC. 31 category keys, ~40 skill→category mappings and six default sets,
// all copied verbatim. The mappings are authored data — an admin types a skill name against a
// question on the website and this table decides which report category it credits. Paraphrasing a
// key, tidying a plural or "simplifying" the matching silently changes students' scores.
//
// Scoring is entirely client-side. `POST /api/psychometrics/submit` records the result but the
// report renders from what is computed here regardless of whether that call lands.

/** The three answers, in the web's order — NOT Subject & Career's order. */
export const PSYCHOMETRIC_OPTIONS = ['Yes', 'No', 'Maybe'];

/** Yes 2 · Maybe 1 · No 0, against a fixed max of 2 per question. */
export function answerScore(answer) {
  switch (answer) {
    case 'Yes':
      return 2;
    case 'Maybe':
      return 1;
    case 'No':
      return 0;
    default:
      return 0;
  }
}

export const MAX_PER_QUESTION = 2;

/* ── Which report a topic produces ─────────────────────────────────────────
   Inferred from the TOPIC NAME by substring. Fragile, and it is the contract: renaming a topic on
   the website changes which report its students see. Order matters — the checks are not mutually
   exclusive, and "aptitude" only means Stream Aptitude when it is not "emotional". */

export function getTopicType(topicName) {
  const name = String(topicName || '').toLowerCase();

  if (name.includes('learning') || name.includes('productivity') || name.includes('lpm')) {
    return 'lpm';
  }
  if ((name.includes('skill') && name.includes('proficiency')) || name.includes('compass')) {
    return 'skillCompass';
  }
  if (name.includes('interest') || (name.includes('advanced') && name.includes('mapping'))) {
    return 'interestMapping';
  }
  if (name.includes('stream') || (name.includes('aptitude') && !name.includes('emotional'))) {
    return 'streamAptitude';
  }
  if (name.includes('emotional') || name.includes('social') || name.includes('esdi')) {
    return 'esdi';
  }
  return '3c';
}

/* ── The 31 categories, grouped by report ──────────────────────────────── */

export const DEFAULT_CATEGORIES = {
  '3c': [
    'selfAwareness',
    'growthMindset',
    'adaptabilityResilience',
    'motivationDiscipline',
    'decisionMakingResponsibility',
    'futureReadiness',
  ],
  lpm: [
    'criticalThinking',
    'creativity',
    'learningStrategyAwareness',
    'adaptabilityHelpSeeking',
    'academicReadiness',
  ],
  skillCompass: [
    'criticalThinkingProblemSolving',
    'communicationSkills',
    'collaborationSocialWorking',
    'creativityInnovation',
    'digitalReadinessAdaptability',
  ],
  interestMapping: [
    'exploratoryCuriosity',
    'practicalAppliedInterest',
    'careerAwarenessVision',
    'peopleBusinessSocietyInterest',
    'analyticalResearchInterest',
    'creativeInnovationInterest',
  ],
  streamAptitude: [
    'scienceAptitude',
    'commerceAptitude',
    'humanitiesAptitude',
    'skillBasedAptitude',
  ],
  esdi: [
    'selfAwarenessRegulation',
    'empathySocialSkills',
    'esdiDecisionMaking',
    'emotionalBalance',
    'resilienceOptimism',
  ],
};

/** Every category key, in the order the web declares them. */
export const ALL_CATEGORIES = [
  ...DEFAULT_CATEGORIES['3c'],
  ...DEFAULT_CATEGORIES.lpm,
  ...DEFAULT_CATEGORIES.skillCompass,
  ...DEFAULT_CATEGORIES.interestMapping,
  ...DEFAULT_CATEGORIES.streamAptitude,
  ...DEFAULT_CATEGORIES.esdi,
];

/* ── skill → categories ────────────────────────────────────────────────────
   A skill may credit SEVERAL categories, and each receives the full score — so the category
   maxima deliberately do not sum to the total. That is not double counting to be fixed: the same
   answer is evidence for more than one construct, and each report reads only its own slice. */

const SKILL_MAP = {
  // 3C Personality Blueprint
  'self-awareness & regulation': ['selfAwareness', 'selfAwarenessRegulation'],
  'self awareness & regulation': ['selfAwareness', 'selfAwarenessRegulation'],
  'self-awareness': ['selfAwareness', 'selfAwarenessRegulation'],
  'self awareness': ['selfAwareness', 'selfAwarenessRegulation'],
  'growth mindset': ['growthMindset'],
  adaptability: ['adaptabilityResilience', 'adaptabilityHelpSeeking', 'digitalReadinessAdaptability'],
  'resilience & optimism': ['adaptabilityResilience', 'resilienceOptimism'],
  'self-discipline': ['motivationDiscipline'],
  'self discipline': ['motivationDiscipline'],
  'focus & study discipline': ['motivationDiscipline', 'learningStrategyAwareness'],
  'decision-making': ['decisionMakingResponsibility', 'esdiDecisionMaking'],
  'decision making': ['decisionMakingResponsibility', 'esdiDecisionMaking'],
  'confidence & responsibility': ['decisionMakingResponsibility'],
  'future orientation': ['futureReadiness', 'careerAwarenessVision'],
  'stream confidence & openness': ['futureReadiness', 'careerAwarenessVision'],

  // Learning Productivity Matrix
  'critical thinking': ['criticalThinking', 'criticalThinkingProblemSolving', 'analyticalResearchInterest'],
  'problem solving': ['criticalThinking', 'criticalThinkingProblemSolving'],
  creativity: ['creativity', 'creativityInnovation', 'creativeInnovationInterest'],
  'creative & innovation interest': ['creativity', 'creativityInnovation', 'creativeInnovationInterest'],
  'learning strategy awareness': ['learningStrategyAwareness'],
  'adaptability & help-seeking': ['adaptabilityHelpSeeking'],
  'adaptability & help seeking': ['adaptabilityHelpSeeking'],
  'ownership & academic readiness': ['academicReadiness'],
  'academic rigor & depth': ['academicReadiness'],

  // Skill Proficiency Compass
  communication: ['communicationSkills'],
  collaboration: ['collaborationSocialWorking', 'peopleBusinessSocietyInterest'],
  leadership: ['collaborationSocialWorking', 'peopleBusinessSocietyInterest'],
  'digital literacy': ['digitalReadinessAdaptability'],
  'digital readiness': ['digitalReadinessAdaptability'],

  // Advanced Interest Mapping
  'exploratory curiosity': ['exploratoryCuriosity'],
  'practical & project interest': ['practicalAppliedInterest'],
  'business / social / people interest': ['peopleBusinessSocietyInterest'],
  'analytical & research interest': ['analyticalResearchInterest'],

  // ESDI
  empathy: ['empathySocialSkills'],
  'social skills': ['empathySocialSkills'],
  'emotional balance': ['emotionalBalance'],
  resilience: ['resilienceOptimism'],
  optimism: ['resilienceOptimism'],
};

/**
 * Categories for one authored skill string.
 *
 * EXACT MATCH FIRST, then substring **in both directions** (`skill.includes(key) ||
 * key.includes(skill)`), collecting every hit. The bidirectional test is why "Critical Thinking &
 * Problem Solving" reaches the `critical thinking` entry, and why a bare `adaptability` reaches
 * the longer `adaptability & help-seeking` one. Narrowing it to one direction quietly drops
 * categories.
 */
export function getSkillCategories(skill) {
  if (!skill || typeof skill !== 'string') return [];
  const skillLower = skill.toLowerCase().trim();

  if (SKILL_MAP[skillLower]) return SKILL_MAP[skillLower];

  const matched = [];
  for (const [key, categories] of Object.entries(SKILL_MAP)) {
    if (skillLower.includes(key) || key.includes(skillLower)) matched.push(...categories);
  }
  return [...new Set(matched)];
}

/** Stream Aptitude alone routes by `question.bloomTaxonomy`, not by `skillsMeasured`. */
export function getStreamFromBloomTaxonomy(bloomTaxonomy) {
  if (!bloomTaxonomy || typeof bloomTaxonomy !== 'string') return null;
  const b = bloomTaxonomy.toLowerCase().trim();

  if (b.includes('science')) return 'science';
  if (b.includes('commerce')) return 'commerce';
  if (b.includes('arts') || b.includes('humanities')) return 'humanities';
  if (b.includes('skill') || b.includes('applied')) return 'skillBased';
  return null;
}

/**
 * Score an attempt.
 *
 * @param {Array}  questions  in the order they were DISPLAYED (already shuffled) — see below
 * @param {object} answers    questionId -> "Yes" | "No" | "Maybe"
 * @param {string} topicName  drives the report type
 */
export function processAssessmentResults(questions, answers, topicName) {
  const topicType = getTopicType(topicName);

  const categoryScores = {};
  ALL_CATEGORIES.forEach((key) => {
    categoryScores[key] = { score: 0, maxScore: 0, questions: [] };
  });

  const credit = (category, score, question) => {
    const cell = categoryScores[category];
    if (!cell) return;
    cell.score += score;
    cell.maxScore += MAX_PER_QUESTION;
    cell.questions.push(question);
  };

  let totalScore = 0;
  let totalMaxScore = 0;

  (questions || []).forEach((question, index) => {
    const score = answerScore(answers[question.id]);
    totalScore += score;
    totalMaxScore += MAX_PER_QUESTION;

    // THE ROUND-ROBIN FALLBACK IS ORDER-DEPENDENT, AND THE QUESTIONS WERE SHUFFLED.
    // When nothing maps, the web assigns `defaults[index % defaults.length]` — so an unmapped
    // question lands in a different category on every attempt. That is the website's behaviour and
    // it is reproduced deliberately; do not "fix" it into a divergence. The real fix is authoring
    // `skillsMeasured` on the question, which makes the fallback unreachable.
    if (topicType === 'streamAptitude') {
      const stream = getStreamFromBloomTaxonomy(question.bloomTaxonomy);
      const defaults = DEFAULT_CATEGORIES.streamAptitude;
      const category = stream
        ? `${stream}Aptitude`
        : defaults[index % defaults.length];
      credit(category, score, question);
      return;
    }

    if (topicType === 'esdi') {
      const defaults = DEFAULT_CATEGORIES.esdi;
      // ESDI narrows the mapping to its own five categories before falling back.
      let categories = getSkillCategories(question.skillsMeasured).filter((c) =>
        defaults.includes(c),
      );
      if (categories.length === 0) categories = [defaults[index % defaults.length]];
      categories.forEach((c) => credit(c, score, question));
      return;
    }

    let categories = [...new Set(getSkillCategories(question.skillsMeasured))];
    if (categories.length === 0) {
      const defaults = DEFAULT_CATEGORIES[topicType] || DEFAULT_CATEGORIES['3c'];
      categories = [defaults[index % defaults.length]];
    }
    categories.forEach((c) => credit(c, score, question));
  });

  const overallPercentage =
    totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

  Object.values(categoryScores).forEach((cell) => {
    cell.percentage = cell.maxScore > 0 ? Math.round((cell.score / cell.maxScore) * 100) : 0;
    // One threshold, deliberately — NOT the four-band scale Skills Edge uses.
    cell.isStrength = cell.percentage >= 50;
  });

  const pct = (key) => categoryScores[key].percentage;

  // Overall readiness averages only the categories THIS report uses, not all 31.
  // Stream Aptitude additionally drops zero-scoring streams, so a student who answered nothing
  // for Commerce is not averaged down by it.
  let relevant = (DEFAULT_CATEGORIES[topicType] || DEFAULT_CATEGORIES['3c']).map(pct);
  if (topicType === 'streamAptitude') relevant = relevant.filter((p) => p > 0);

  const overallReadiness =
    relevant.length > 0
      ? Math.round(relevant.reduce((a, b) => a + b, 0) / relevant.length)
      : overallPercentage;

  return {
    categoryScores,
    // The six per-report views. Key names differ from the category keys in places
    // (`decisionMakingResponsibility` → `decisionMaking`), which is why they are spelled out.
    personalityBlueprint: {
      selfAwareness: pct('selfAwareness'),
      growthMindset: pct('growthMindset'),
      adaptabilityResilience: pct('adaptabilityResilience'),
      motivationDiscipline: pct('motivationDiscipline'),
      decisionMaking: pct('decisionMakingResponsibility'),
      futureReadiness: pct('futureReadiness'),
    },
    learningProductivityMatrix: {
      criticalThinking: pct('criticalThinking'),
      creativity: pct('creativity'),
      learningStrategyAwareness: pct('learningStrategyAwareness'),
      adaptabilityHelpSeeking: pct('adaptabilityHelpSeeking'),
      academicReadiness: pct('academicReadiness'),
    },
    skillProficiency: {
      criticalThinking: pct('criticalThinkingProblemSolving'),
      communication: pct('communicationSkills'),
      collaboration: pct('collaborationSocialWorking'),
      creativity: pct('creativityInnovation'),
      digitalSkills: pct('digitalReadinessAdaptability'),
    },
    interestMapping: {
      exploratoryCuriosity: pct('exploratoryCuriosity'),
      practicalAppliedInterest: pct('practicalAppliedInterest'),
      careerAwarenessVision: pct('careerAwarenessVision'),
      peopleBusinessSocietyInterest: pct('peopleBusinessSocietyInterest'),
      analyticalResearchInterest: pct('analyticalResearchInterest'),
      creativeInnovationInterest: pct('creativeInnovationInterest'),
    },
    streamAptitude: {
      science: pct('scienceAptitude'),
      commerce: pct('commerceAptitude'),
      humanities: pct('humanitiesAptitude'),
      skillBased: pct('skillBasedAptitude'),
    },
    esdiScores: {
      selfAwarenessRegulation: pct('selfAwarenessRegulation'),
      empathySocialSkills: pct('empathySocialSkills'),
      decisionMaking: pct('esdiDecisionMaking'),
      emotionalBalance: pct('emotionalBalance'),
      resilienceOptimism: pct('resilienceOptimism'),
    },
    overallReadiness,
    totalQuestions: (questions || []).length,
    answeredQuestions: Object.keys(answers || {}).length,
    totalScore,
    totalMaxScore,
    assessmentDate: new Date().toLocaleDateString(),
  };
}
