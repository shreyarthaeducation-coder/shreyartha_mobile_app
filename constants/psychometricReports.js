// constants/psychometricReports.js
// Mirrors: frontendmain/src/student/platform/PsychometricAssessment/Psychometric*Report.js
//
// GENERATED FROM THE WEB SOURCE, then reviewed. The six report components are ~2,700 lines that
// share one skeleton and differ only in their categories, their chart and their text, so they
// collapse into this config plus one renderer — the same collapse ProfileFormTab and HrTab made.
//
// The `low` / `high` strings were extracted programmatically rather than retyped: there are ~60
// of them, a student reads them as the result of their assessment, and a silent typo in one is
// not something a build or a checker would ever catch.
//
// `low` is shown below 50%, `high` at 50% and above. ONE threshold, deliberately — Skills Edge's
// four-band scale is a different feature and the two must not be unified.

/**
 * Five reports share this shape:
 *   { title, resultKey, chart, categories: [{ key, label, hint?, low, high, tips? }] }
 * `resultKey` selects the slice of processAssessmentResults' output; `key` indexes into it.
 *
 * Stream Aptitude is NOT one of them — it ranks four streams rather than scoring categories
 * against a threshold, so it has its own config below.
 */
export const REPORT_CONFIG = {
  '3c': {
    title: "3C Personality Blueprint",
    resultKey: "personalityBlueprint",
    chart: "bars",
    categories: [
      {
        key: "selfAwareness",
        label: "Self-Awareness",
        low: "You are in the early stages of understanding personal strengths and abilities, and may sometimes underestimate your potential. With guided reflection, encouragement, and positive reinforcement, confidence and self-awareness can steadily grow. Every learner develops at a different pace, and this is a strong foundation to begin that journey.",
        high: "You demonstrate a healthy awareness of personal strengths and show growing confidence in your abilities. This self-understanding supports better learning and decision-making. Continued reflection and self-belief will help you unlock even greater potential over time.",
      },
      {
        key: "growthMindset",
        label: "Growth Mindset",
        low: "You may currently feel hesitant about feedback or challenging tasks and may prefer familiar ways of learning. With encouragement to see mistakes as learning opportunities, confidence in effort and improvement can strengthen. Small successes and consistent support can help build a positive learning mindset.",
        high: "You show a positive attitude toward learning, effort, and improvement, reflecting a developing growth mindset. Openness to feedback and willingness to learn from experiences are strong indicators of long-term success. Maintaining this mindset will support continuous growth across academics and life skills.",
      },
      {
        key: "adaptabilityResilience",
        label: "Adaptability & Resilience",
        low: "You may find changes, uncertainty, or setbacks emotionally challenging at times. With reassurance, coping strategies, and gradual exposure to new situations, emotional resilience can improve. Learning how to manage stress and adapt step-by-step will build confidence in handling change.",
        high: "You generally adapt well to change and show emotional resilience when facing challenges or unfamiliar situations. This flexibility supports smoother transitions and personal growth. Strengthening these skills further will help you stay balanced and confident in dynamic environments.",
      },
      {
        key: "motivationDiscipline",
        label: "Motivation & Discipline",
        low: "You may depend more on external motivation and may find it difficult to stay consistent with goals or routines. With structured support, clear goal-setting, and positive habits, self-discipline can gradually develop. Consistency, even in small steps, can make a meaningful difference.",
        high: "You show a good level of self-motivation and the ability to manage goals and responsibilities with growing discipline. This inner drive supports academic consistency and personal achievement. Building structured routines will further strengthen this valuable strength.",
      },
      {
        key: "decisionMaking",
        label: "Decision-Making & Responsibility",
        low: "You may feel uncertain when making decisions or taking responsibility for outcomes. With guided decision-making practice and reassurance, confidence in choices can improve. Learning to express opinions and stand by values will help build independence over time.",
        high: "You demonstrate growing confidence in decision-making and take responsibility for actions and outcomes. This reflects maturity and independent thinking. Continued practice in evaluating choices will further enhance leadership and accountability skills.",
      },
      {
        key: "futureReadiness",
        label: "Future Readiness",
        low: "You may not yet feel fully prepared for future academic or life challenges and may need support in goal clarity and planning. Exposure to role models, career conversations, and short-term goal setting can help build confidence about the future. Readiness develops with guidance and time.",
        high: "You show readiness for future challenges and demonstrate awareness of long-term goals and aspirations. This forward-looking mindset supports smoother transitions and informed choices. Continued exploration and planning will help turn aspirations into achievable outcomes.",
      },
    ],
  },

  'lpm': {
    title: "Learning Productivity Matrix",
    resultKey: "learningProductivityMatrix",
    chart: "bars",
    categories: [
      {
        key: "criticalThinking",
        label: "Critical Thinking",
        hint: "Thinking clarity, reasoning, problem analysis",
        low: "You may sometimes approach problems quickly without fully breaking them down or exploring multiple solutions. This can affect productivity, especially during exams or complex tasks. Slowing down your thinking process, asking \"why\" and \"how,\" and practicing reasoning-based questions can significantly improve your accuracy and efficiency over time.",
        high: "You demonstrate the ability to analyze situations logically and think through problems before responding. This strength supports better academic decisions and efficient problem-solving. With continued practice, you can further sharpen your thinking speed without losing accuracy, improving both performance and productivity.",
        tips: ["Break problems into steps before answering", "Practice \"explain your answer\" thinking", "Review mistakes to understand the logic gap"],
      },
      {
        key: "creativity",
        label: "Creativity",
        hint: "Idea generation, flexibility, innovation",
        low: "You may prefer structured tasks and clear instructions, which can sometimes limit creative exploration. This may affect engagement and long-term motivation. Creativity grows with freedom, practice, and curiosity, and even small creative choices can increase learning enjoyment and productivity.",
        high: "You show flexibility in thinking and enjoy exploring new ideas or approaches. This creative mindset keeps learning engaging and supports innovation. Channeling creativity into structured learning plans can further boost productivity and academic performance.",
        tips: ["Try one open-ended task each week", "Explore visual notes or mind maps", "Ask \"Is there another way to do this?\""],
      },
      {
        key: "learningStrategyAwareness",
        label: "Learning Strategy Awareness",
        hint: "Study habits, planning, reflection",
        low: "You may study without a clear strategy or depend heavily on external instructions. This can reduce efficiency and increase stress during exams. Developing awareness of how you learn best will help you study smarter, not harder, and build consistent discipline.",
        high: "You understand how you learn and apply strategies that support retention and performance. This awareness helps you manage time better and stay disciplined. Refining these strategies will help you maintain productivity even during high-pressure academic phases.",
        tips: ["Identify one study method that works best", "Create a simple weekly study plan", "Reflect briefly after each study session"],
      },
      {
        key: "adaptabilityHelpSeeking",
        label: "Adaptability & Help-Seeking",
        hint: "Flexibility, coping, asking for support",
        low: "You may find it difficult to adjust when learning becomes challenging or when expectations change. Hesitation in seeking help can slow progress and affect motivation. Learning to adapt and ask for guidance early can significantly improve learning outcomes and reduce stress.",
        high: "You handle changes in learning demands with flexibility and are comfortable seeking help when needed. This adaptability supports consistent learning and emotional balance. Strengthening this further will help you manage increasing academic responsibilities with confidence.",
        tips: ["Ask questions without fear of judgment", "View challenges as part of growth", "Seek help before frustration builds"],
      },
      {
        key: "academicReadiness",
        label: "Academic Readiness",
        hint: "Preparedness, ownership, confidence",
        low: "You may feel unsure about future academic demands or your readiness to take ownership of learning. This is a natural stage of development. Building clarity, routine, and confidence step by step will help you feel more prepared and in control of your academic journey.",
        high: "You show readiness to handle academic challenges and take responsibility for your learning. This confidence supports smoother transitions and better decision-making. Maintaining structure and forward planning will help you stay productive and focused in higher academic stages.",
        tips: ["Set short-term achievable goals", "Practice independent learning tasks", "Build consistent daily routines"],
      },
    ],
  },

  'skillCompass': {
    title: "Skill Proficiency Compass",
    resultKey: "skillProficiency",
    chart: "radar",
    categories: [
      {
        key: "criticalThinking",
        label: "Critical Thinking & Problem Solving",
        low: "You may find it challenging to analyze situations deeply or handle open-ended problems without clear guidance. Complex questions or unfamiliar problems might feel overwhelming at times. This suggests that analytical confidence is still developing and can improve with structured thinking practice.",
        high: "You are comfortable analyzing situations, connecting ideas, and evaluating multiple solutions. This reflects readiness for higher-order thinking across academics and careers.",
        tips: ["Break problems into smaller steps", "Ask \"why\" and \"how\" while learning", "Practice scenario-based questions"],
      },
      {
        key: "communication",
        label: "Communication Skills",
        low: "You may hesitate to express ideas clearly in discussions, presentations, or group settings. Communicating thoughts confidently may still be a developing skill. This indicates that expression improves with practice and safe exposure.",
        high: "You express ideas clearly and confidently in conversations, discussions, and presentations. This supports leadership, teamwork, and people-facing roles.",
        tips: ["Practice speaking in small groups", "Write short reflections or summaries", "Participate gradually in discussions"],
      },
      {
        key: "collaboration",
        label: "Collaboration & Social Working",
        low: "You may prefer working independently or feel unsure about roles and coordination in group tasks. Team situations may sometimes feel uncomfortable or confusing. This suggests collaboration skills can be built gradually.",
        high: "You work well with others, respect different roles, and contribute positively in teams. This reflects strong collaboration and social adaptability.",
        tips: ["Take small roles in group activities", "Practice listening and responding", "Observe how teams function"],
      },
      {
        key: "creativity",
        label: "Creativity & Innovation",
        low: "You may rely more on structured approaches and feel unsure during open-ended or creative tasks. Original thinking may feel risky without clear direction. This indicates creative confidence can be nurtured.",
        high: "You enjoy generating ideas, exploring new approaches, and thinking beyond standard solutions. This supports innovation and creative problem-solving.",
        tips: ["Practice brainstorming without judgment", "Try creative or expressive activities", "Explore multiple approaches to tasks"],
      },
      {
        key: "digitalSkills",
        label: "Digital Readiness & Adaptability",
        low: "You may feel hesitant using new digital tools or adjusting to changing learning environments. Technology or change may feel manageable only with guidance. This suggests digital confidence and adaptability can grow step by step.",
        high: "You adapt well to new tools, technologies, and learning environments. This reflects strong readiness for future-focused academics and careers.",
        tips: ["Practice basic digital tools regularly", "Learn to verify online information", "Try new learning methods gradually"],
      },
    ],
  },

  'interestMapping': {
    title: "Advanced Interest Mapping",
    resultKey: "interestMapping",
    chart: "bars",
    categories: [
      {
        key: "exploratoryCuriosity",
        label: "Exploratory Curiosity",
        low: "You may currently prefer familiar subjects or structured learning and may explore new areas only when required. This does not limit your potential, but curiosity can be strengthened by asking more questions, connecting learning to real life, and allowing yourself to explore without fear of being \"wrong.\"",
        high: "You naturally enjoy discovering how things work and are open to exploring new ideas and fields. This curiosity keeps learning engaging and helps you discover interests that may turn into future career paths.",
        tips: ["Ask \"why does this matter?\" while studying", "Explore one new topic each month", "Learn without worrying about grades"],
      },
      {
        key: "practicalAppliedInterest",
        label: "Practical & Applied Interest",
        low: "You may prefer theory-based or exam-focused learning and may not always see the relevance of practical applications. Gradually connecting concepts to real-life situations can improve understanding, motivation, and long-term retention.",
        high: "You enjoy learning that connects directly to real-world situations and practical outcomes. This preference supports skill-based learning and career readiness, especially in applied and emerging fields.",
        tips: ["Relate lessons to daily life", "Use examples, projects, or case studies", "Ask how concepts are used in careers"],
      },
      {
        key: "careerAwarenessVision",
        label: "Career Awareness & Vision",
        low: "You may not yet think deeply about future careers or may feel unsure about long-term direction. This is a normal stage. Exposure to career conversations and role models can gradually build clarity and confidence.",
        high: "You often imagine yourself in future roles and show interest in understanding career pathways. This awareness helps you make informed academic and skill choices early.",
        tips: ["Explore different professions regularly", "Talk to seniors and professionals", "Attend career talks or webinars"],
      },
      {
        key: "peopleBusinessSocietyInterest",
        label: "People / Business / Society Interest",
        low: "You may currently prefer individual or subject-focused learning over people-centric or social topics. Exposure to discussions on society, leadership, and teamwork can broaden perspective and open new interest areas.",
        high: "You enjoy learning about people, organizations, and how society functions. This interest supports careers involving communication, leadership, management, and social impact.",
        tips: ["Participate in group activities", "Explore social or business case studies", "Observe real-world social dynamics"],
      },
      {
        key: "analyticalResearchInterest",
        label: "Analytical / Research Interest",
        low: "You may prefer straightforward learning tasks and may not always enjoy deep analysis or pattern recognition. Analytical thinking improves with practice and helps in decision-making across all fields.",
        high: "You enjoy identifying patterns, analyzing information, and understanding systems deeply. This interest aligns well with research, data-driven, and strategic careers.",
        tips: ["Practice comparing and questioning ideas", "Analyze trends or data visually", "Ask \"what does this imply?\""],
      },
      {
        key: "creativeInnovationInterest",
        label: "Creative & Innovation Interest",
        low: "You may prefer structured tasks over open-ended creative work. Creativity develops through expression and experimentation, and even small creative activities can enhance learning enjoyment.",
        high: "You enjoy creative expression, innovation, and generating new ideas. This interest supports careers in design, media, technology, entrepreneurship, and innovation-driven fields.",
        tips: ["Try creative expression without judgment", "Use visuals, storytelling, or design", "Explore innovation examples"],
      },
    ],
  },

  'esdi': {
    title: "Emotional & Social Development Index",
    resultKey: "esdiScores",
    chart: "radar",
    categories: [
      {
        key: "selfAwarenessRegulation",
        label: "Self-Awareness & Regulation",
        low: "You may sometimes find it difficult to recognize or manage your emotions, especially in stressful situations. Developing emotional awareness can help you stay calm, focused, and in control during challenges.",
        high: "You show good awareness of your emotions and are learning to manage them effectively. This helps you stay focused, balanced, and confident in both academic and social situations.",
        tips: ["Pause before reacting", "Reflect on emotions after situations", "Practice self-calming techniques"],
      },
      {
        key: "empathySocialSkills",
        label: "Empathy & Social Skills",
        low: "You may find it challenging to understand others' perspectives or navigate social situations comfortably. With practice, listening and observing others can improve relationships and collaboration.",
        high: "You are generally sensitive to others' feelings and communicate well in social settings. This supports teamwork, leadership, and healthy relationships.",
      },
      {
        key: "decisionMaking",
        label: "Decision-Making",
        low: "You may feel unsure while making decisions or handling consequences. Building confidence in decision-making helps you become more independent and responsible.",
        high: "You are comfortable making decisions and taking responsibility for outcomes. This reflects growing maturity and self-trust.",
      },
      {
        key: "emotionalBalance",
        label: "Emotional Balance",
        low: "You may experience emotional ups and downs that affect focus or motivation. Learning stress-management strategies can improve balance and consistency.",
        high: "You generally maintain emotional balance and can manage stress effectively, supporting steady academic and personal performance.",
      },
      {
        key: "resilienceOptimism",
        label: "Resilience & Optimism",
        low: "You may feel discouraged when facing setbacks. Building resilience helps you recover faster and stay positive during challenges.",
        high: "You show resilience and a positive outlook, allowing you to bounce back from difficulties and stay motivated.",
      },
    ],
  },
};

/**
 * Stream Aptitude — the odd one out.
 *
 * It does not score categories against a threshold. It RANKS the four streams and names the
 * strongest as the student's fit, so its content is one statement per stream plus the rank labels.
 * Scores come from `results.streamAptitude`, derived from each question's `bloomTaxonomy` rather
 * than its `skillsMeasured` — see constants/psychometricScoring.js.
 */
export const STREAM_CONFIG = {
  title: 'Stream Aptitude',
  resultKey: 'streamAptitude',
  streams: [
    {
      key: 'science',
      title: 'Science',
      icon: '🔬',
      color: '#2196F3',
      statement:
        'You show a strong aptitude for logical reasoning, analytical thinking, and understanding scientific concepts. Subjects that require experimentation, problem-solving, and deep understanding of theories will likely feel natural and engaging for you. You enjoy exploring how things work, analyzing patterns, and applying concepts to real-life scenarios. This makes Science your ideal stream for academic growth and future career opportunities.',
    },
    {
      key: 'commerce',
      title: 'Commerce',
      icon: '💼',
      color: '#FF9800',
      statement:
        'You demonstrate a natural affinity for numbers, systems, and business-oriented thinking. You are comfortable understanding financial concepts, analyzing trends, and exploring organizational structures. Commerce-related subjects like accounting, economics, and business studies will likely match your way of thinking and help you develop strong analytical and decision-making skills for future professional pathways.',
    },
    {
      key: 'humanities',
      title: 'Humanities',
      icon: '📚',
      color: '#4CAF50',
      statement:
        'You have a strong inclination toward reading, expression, and understanding people and society. You enjoy exploring ideas, analyzing social phenomena, and communicating effectively. Humanities-based subjects like history, political science, sociology, or psychology will align with your interests and strengths, helping you think critically, express clearly, and engage deeply with the world around you.',
    },
    {
      key: 'skillBased',
      title: 'Skill-Based',
      icon: '🛠️',
      color: '#F44336',
      statement:
        'You excel at practical, hands-on learning and enjoy applying concepts in real-world contexts. Learning through projects, experiments, and skill development activities comes naturally to you. This makes skill-based or applied learning an excellent fit, supporting careers that require creativity, problem-solving, and practical expertise in technology, design, entrepreneurship, or media-related fields.',
    },
  ],
};

/** Rank 1 is the student's primary fit; the web labels the rest by position. */
export function fitLevel(rank) {
  if (rank === 1) return 'Primary Fit';
  if (rank === 2) return 'Secondary Fit';
  if (rank === 3) return 'Tertiary Fit';
  return 'Emerging Interest';
}

/** The config for a topic type. Stream Aptitude returns null and renders through its own branch. */
export function reportFor(topicType) {
  return topicType === 'streamAptitude' ? null : REPORT_CONFIG[topicType] || REPORT_CONFIG['3c'];
}
