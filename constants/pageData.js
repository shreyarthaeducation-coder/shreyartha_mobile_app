// Static content for all 12 service pages
// Used as fallback when API is unavailable

export const PAGE_DATA = {
  'learning-assessment': {
    title: 'Learning & Assessment',
    subtitle: 'Personalised evaluations that identify strengths and growth areas',
    icon: '📚',
    description:
      'Our adaptive learning and assessment platform analyses each student\'s knowledge gaps and learning style, delivering a truly personalised education experience that accelerates growth.',
    features: [
      { icon: '🎯', title: 'Adaptive Tests', description: 'AI-powered questions that adjust to your level in real time' },
      { icon: '📊', title: 'Detailed Analytics', description: 'In-depth reports covering every subject and topic area' },
      { icon: '🏆', title: 'Skill Benchmarking', description: 'Compare performance against national and state averages' },
      { icon: '🔄', title: 'Continuous Feedback', description: 'Instant feedback after every assessment attempt' },
      { icon: '📝', title: 'Mock Exams', description: 'Full-length mock tests mirroring real exam conditions' },
      { icon: '🌟', title: 'Certificates', description: 'Earn certificates upon mastering each skill module' },
    ],
    sections: [
      {
        title: 'How It Works',
        icon: '⚙️',
        content:
          'Students begin with a diagnostic assessment that maps existing knowledge. The system then creates a personalised learning path, serving targeted content and follow-up assessments until mastery is achieved.',
      },
      {
        title: 'Subjects Covered',
        icon: '📖',
        content:
          'Mathematics, Science, English, Social Studies, Computer Science and more — all aligned with CBSE, ICSE and state board syllabi for Classes 1 through 12.',
      },
      {
        title: 'Parent & Teacher Insights',
        icon: '👨‍👩‍👧',
        content:
          'Real-time dashboards give parents and teachers a 360° view of progress, attendance patterns and areas needing additional attention.',
      },
    ],
    cta: {
      title: 'Start Your Assessment Today',
      subtitle: 'Join thousands of students who have already improved their scores',
      buttonText: 'Get Started Free',
    },
  },

  'skills-learning': {
    title: 'Skills Learning',
    subtitle: 'Future-ready skills for the modern workplace',
    icon: '🛠️',
    description:
      'Go beyond textbooks with hands-on skill courses in technology, creativity, leadership and life skills — preparing students for a rapidly changing world.',
    features: [
      { icon: '💻', title: 'Tech Skills', description: 'Python, web development, data literacy and more' },
      { icon: '🎨', title: 'Creative Arts', description: 'Design thinking, digital art and storytelling' },
      { icon: '🤝', title: 'Leadership', description: 'Communication, teamwork and problem-solving workshops' },
      { icon: '🌍', title: 'Life Skills', description: 'Financial literacy, mental wellness and critical thinking' },
      { icon: '📹', title: 'Video Lessons', description: 'Bite-sized video modules you can learn at your own pace' },
      { icon: '🏅', title: 'Industry Certs', description: 'Industry-recognised certificates upon completion' },
    ],
    sections: [
      {
        title: 'Why Skills Learning?',
        icon: '❓',
        content:
          'Academic grades alone no longer guarantee career success. Shreyartha bridges the gap between classroom learning and real-world requirements through practical, project-based skill courses.',
      },
      {
        title: 'Learning Pathways',
        icon: '🗺️',
        content:
          'Choose from beginner, intermediate and advanced pathways. Each pathway is curated by industry experts and updated regularly to reflect current trends and employer expectations.',
      },
      {
        title: 'Project Portfolio',
        icon: '🗂️',
        content:
          'Every learner builds a verifiable portfolio of completed projects — a powerful asset for college applications, internships and first jobs.',
      },
    ],
    cta: {
      title: 'Build Skills That Matter',
      subtitle: 'Start your first skill course free — no credit card required',
      buttonText: 'Explore Courses',
    },
  },

  'students-profile': {
    title: 'Students Profile',
    subtitle: 'A comprehensive digital record of every student\'s journey',
    icon: '👤',
    description:
      'The Shreyartha student profile is a living document that captures academic records, extracurricular achievements, skill badges and counsellor notes in one secure place.',
    features: [
      { icon: '📋', title: 'Academic Record', description: 'Grades, attendance and teacher comments in one view' },
      { icon: '🏅', title: 'Achievement Wall', description: 'Badges, certificates and competition wins' },
      { icon: '🔒', title: 'Privacy Controls', description: 'Student controls who sees what data' },
      { icon: '📤', title: 'Export & Share', description: 'Download PDF reports for applications' },
      { icon: '📆', title: 'Timeline View', description: 'Visualise your entire educational journey' },
      { icon: '🔗', title: 'Portfolio Links', description: 'Attach GitHub repos, Canva designs and more' },
    ],
    sections: [
      {
        title: 'What\'s Included',
        icon: '📄',
        content:
          'The profile auto-populates from Shreyartha\'s assessment, skills and counselling modules, so there\'s no manual data entry — everything is captured automatically as the student learns.',
      },
      {
        title: 'For College Applications',
        icon: '🎓',
        content:
          'Generate a one-page student report card that summarises academics, skills, extracurriculars and counsellor recommendations — formatted for Indian and international university requirements.',
      },
      {
        title: 'Data Security',
        icon: '🛡️',
        content:
          'All data is encrypted at rest and in transit. Shreyartha is fully compliant with Indian data protection guidelines and never sells student data to third parties.',
      },
    ],
    cta: {
      title: 'Create Your Profile Today',
      subtitle: 'Your achievements deserve to be showcased',
      buttonText: 'Set Up Profile',
    },
  },

  'counselling': {
    title: 'Counselling',
    subtitle: 'Guided mentorship from qualified education counsellors',
    icon: '🧭',
    description:
      'Connect with certified counsellors who help students navigate academic challenges, career choices, mental wellness and personal growth at every stage of their schooling.',
    features: [
      { icon: '🗣️', title: '1-on-1 Sessions', description: 'Private video or chat sessions with your counsellor' },
      { icon: '📅', title: 'Easy Scheduling', description: 'Book, reschedule or cancel sessions with one tap' },
      { icon: '🧠', title: 'Mental Wellness', description: 'Stress management, resilience and mindfulness support' },
      { icon: '🎯', title: 'Goal Setting', description: 'Structured goal-setting and accountability check-ins' },
      { icon: '👨‍👩‍👧', title: 'Parent Involvement', description: 'Optional parent-included sessions for family alignment' },
      { icon: '📊', title: 'Progress Notes', description: 'Counsellor notes visible to student and parent' },
    ],
    sections: [
      {
        title: 'Our Counsellors',
        icon: '👩‍💼',
        content:
          'All counsellors on the Shreyartha platform hold recognised certifications in school counselling, educational psychology or career guidance. They undergo ongoing professional development.',
      },
      {
        title: 'Topics We Cover',
        icon: '📌',
        content:
          'Academic stress, peer relationships, career planning, college selection, exam anxiety, learning differences, time management and personal identity — no topic is off limits.',
      },
      {
        title: 'Confidentiality',
        icon: '🔐',
        content:
          'All sessions are confidential. Information is only shared with parents or school with the student\'s consent, except in cases of immediate safety concern.',
      },
    ],
    cta: {
      title: 'Talk to a Counsellor',
      subtitle: 'Your first session is complimentary',
      buttonText: 'Book Free Session',
    },
  },

  'psychometric-assessment': {
    title: 'Psychometric Assessment',
    subtitle: 'Science-backed tests to unlock your true potential',
    icon: '🧠',
    description:
      'Validated psychometric tools measure personality, aptitude, interests and emotional intelligence — giving students, parents and counsellors a data-driven foundation for life decisions.',
    features: [
      { icon: '🔬', title: 'Aptitude Tests', description: 'Verbal, numerical, abstract and spatial reasoning' },
      { icon: '💡', title: 'Interest Profiling', description: 'Holland Code and RIASEC career interest analysis' },
      { icon: '🧩', title: 'Personality Types', description: 'MBTI-inspired personality profiling for self-awareness' },
      { icon: '❤️', title: 'EQ Assessment', description: 'Emotional intelligence measurement and coaching tips' },
      { icon: '📈', title: 'Growth Tracking', description: 'Re-take tests periodically to track personal development' },
      { icon: '📑', title: 'Detailed Reports', description: 'Comprehensive PDF reports with actionable insights' },
    ],
    sections: [
      {
        title: 'Why Psychometrics?',
        icon: '🤔',
        content:
          'Self-awareness is the foundation of good decision-making. Understanding your strengths, blind spots and natural inclinations helps you choose the right stream, college and career — and excel in it.',
      },
      {
        title: 'Scientific Validity',
        icon: '🔭',
        content:
          'Our assessments are adapted from internationally validated instruments and normed on Indian school-going populations, ensuring culturally relevant and accurate results.',
      },
      {
        title: 'How to Use Results',
        icon: '🗺️',
        content:
          'Results are interpreted by counsellors in a debrief session, ensuring students understand their profiles constructively and translate insights into concrete action plans.',
      },
    ],
    cta: {
      title: 'Discover Your Strengths',
      subtitle: 'Take the psychometric assessment and gain powerful self-knowledge',
      buttonText: 'Start Assessment',
    },
  },

  'subject-career': {
    title: 'Subject & Career',
    subtitle: 'Connect the right subjects to the right careers',
    icon: '🎓',
    description:
      'Our subject-career mapping engine helps students understand which subjects open which doors — eliminating guesswork at the critical Class 9 and 11 stream-selection juncture.',
    features: [
      { icon: '🗺️', title: 'Career Explorer', description: '500+ career profiles with real salary and growth data' },
      { icon: '📚', title: 'Subject Mapping', description: 'See exactly which subjects lead to which careers' },
      { icon: '🏫', title: 'College Finder', description: 'Discover colleges that offer your chosen programme' },
      { icon: '🔍', title: 'Role Models', description: 'Read stories of professionals in careers you love' },
      { icon: '📊', title: 'Market Trends', description: 'Real-time job market data powered by LinkedIn & NASSCOM' },
      { icon: '✅', title: 'Readiness Check', description: 'Check how ready you are for your chosen career' },
    ],
    sections: [
      {
        title: 'Stream Selection Made Easy',
        icon: '🔀',
        content:
          'Our guided wizard walks students and parents through stream options at Class 9 and 11 — science, commerce, humanities and vocational — with clear explanations of downstream opportunities.',
      },
      {
        title: 'Emerging Careers',
        icon: '🚀',
        content:
          'AI, sustainability, space technology, biotech and the creator economy are creating entirely new careers. We keep our database updated so students can plan for jobs that don\'t yet exist at scale.',
      },
      {
        title: 'Parent Guidance',
        icon: '👨‍👩‍👧',
        content:
          'A separate parent module presents the same career data from an investment perspective — expected salary ranges, demand forecasts and ROI on higher education choices.',
      },
    ],
    cta: {
      title: 'Find Your Career Path',
      subtitle: 'Explore 500+ careers and the subjects that lead there',
      buttonText: 'Explore Careers',
    },
  },

  'competitive-examination': {
    title: 'Competitive Examination',
    subtitle: 'Crack JEE, NEET, UPSC and more with targeted preparation',
    icon: '🏆',
    description:
      'A focused preparation module for India\'s most competitive exams — JEE Main & Advanced, NEET, CUET, UPSC, NDA, CLAT and state-level boards — with full syllabus coverage and mock tests.',
    features: [
      { icon: '📝', title: 'Full Syllabus Coverage', description: 'Every topic, every chapter — mapped to official syllabi' },
      { icon: '⏱️', title: 'Timed Mock Tests', description: 'Simulate real exam conditions with time-bound tests' },
      { icon: '📈', title: 'Rank Predictor', description: 'Estimate your national rank based on mock scores' },
      { icon: '🔥', title: 'Revision Capsules', description: 'Last-minute quick-revision notes for every topic' },
      { icon: '🤖', title: 'Doubt Engine', description: 'AI-powered instant doubt resolution 24/7' },
      { icon: '👨‍🏫', title: 'Expert Mentors', description: 'Weekly live sessions with top educators' },
    ],
    sections: [
      {
        title: 'Exams We Cover',
        icon: '📋',
        content:
          'JEE Main, JEE Advanced, NEET UG, CUET, UPSC CSE (Prelims & Mains), NDA, CLAT, GATE, CAT, SAT and more than 50 state-level engineering and medical entrance exams.',
      },
      {
        title: 'Study Plans',
        icon: '📅',
        content:
          'Choose from 6-month, 12-month or 24-month structured study plans. Each plan breaks the syllabus into manageable daily targets with built-in revision cycles.',
      },
      {
        title: 'Performance Analytics',
        icon: '📊',
        content:
          'Detailed chapter-wise, subject-wise and time-management analytics after every test — so you know exactly where to focus your next study session.',
      },
    ],
    cta: {
      title: 'Start Your Exam Prep',
      subtitle: 'Thousands of students have improved their ranks with Shreyartha',
      buttonText: 'Begin Preparation',
    },
  },

  'coding-ai-robotics': {
    title: 'AI/Robotics & Coding',
    subtitle: 'Build tomorrow\'s technology starting today',
    icon: '🤖',
    description:
      'Hands-on coding, AI and robotics programmes designed for curious minds from Class 3 onwards — turning screen time into creative, problem-solving expertise.',
    features: [
      { icon: '👾', title: 'Scratch & Python', description: 'Block-based and text-based coding for all ages' },
      { icon: '🤖', title: 'Robotics Kits', description: 'Build and programme physical robots with IoT kits' },
      { icon: '🧠', title: 'AI Projects', description: 'Create image classifiers, chatbots and prediction models' },
      { icon: '🌐', title: 'Web & App Dev', description: 'HTML, CSS, JavaScript and React Native basics' },
      { icon: '🏁', title: 'Hackathons', description: 'Participate in national and international hackathons' },
      { icon: '🎓', title: 'Certifications', description: 'Globally recognised certificates upon course completion' },
    ],
    sections: [
      {
        title: 'Age-Appropriate Tracks',
        icon: '📐',
        content:
          'Explorer Track (Classes 3–5): Scratch & block coding. Builder Track (Classes 6–8): Python, micro:bit robotics. Creator Track (Classes 9–12): AI/ML, full-stack web dev, advanced robotics.',
      },
      {
        title: 'Project-Based Learning',
        icon: '🛠️',
        content:
          'Every module culminates in a real project — a game, an app, a working robot or an AI model — that students can showcase in their Shreyartha portfolio.',
      },
      {
        title: 'School Partnerships',
        icon: '🏫',
        content:
          'Shreyartha partners with schools to integrate coding and AI into the timetable as an elective or enrichment activity, providing kits, curriculum and trained facilitators.',
      },
    ],
    cta: {
      title: 'Start Coding Today',
      subtitle: 'The best time to learn AI is now — start with a free trial lesson',
      buttonText: 'Try Free Lesson',
    },
  },

  'language-learning': {
    title: 'Language Learning',
    subtitle: 'Unlock new languages and open global doors',
    icon: '🌐',
    description:
      'Immersive, conversational language courses spanning Indian and international languages — helping students communicate confidently in an interconnected world.',
    features: [
      { icon: '🗣️', title: 'Conversational Focus', description: 'Real dialogue practice from day one' },
      { icon: '🎧', title: 'Native Speakers', description: 'Audio content recorded by native speakers' },
      { icon: '✍️', title: 'Script & Grammar', description: 'Structured grammar and script-writing modules' },
      { icon: '🎮', title: 'Gamified Practice', description: 'Earn points, streaks and badges as you learn' },
      { icon: '🤖', title: 'AI Pronunciation', description: 'Speech recognition rates your pronunciation' },
      { icon: '📜', title: 'Language Exams', description: 'Prep for IELTS, TOEFL, DELF and JLPT' },
    ],
    sections: [
      {
        title: 'Languages Available',
        icon: '🌍',
        content:
          'English, Hindi, Sanskrit, French, German, Spanish, Japanese, Mandarin, Tamil, Telugu, Kannada, Bengali — with more being added regularly.',
      },
      {
        title: 'Curriculum Alignment',
        icon: '📚',
        content:
          'Language courses are aligned with CBSE and ICSE board requirements as well as CEFR levels (A1 through C2), so students can prepare for both school exams and international certifications simultaneously.',
      },
      {
        title: 'For Global Opportunities',
        icon: '✈️',
        content:
          'Language proficiency is a prerequisite for study-abroad programmes and many scholarships. Our IELTS and TOEFL prep modules have helped hundreds of students achieve their target band scores.',
      },
    ],
    cta: {
      title: 'Start Speaking Today',
      subtitle: 'Your first week of language learning is free',
      buttonText: 'Start Learning',
    },
  },

  'global-opportunities': {
    title: 'Global Opportunities',
    subtitle: 'Study, intern and compete internationally',
    icon: '✈️',
    description:
      'Shreyartha curates scholarships, exchange programmes, internships and competitions from around the world and matches them to each student\'s profile and aspirations.',
    features: [
      { icon: '🎓', title: 'Scholarships', description: 'Database of 1,000+ scholarships updated weekly' },
      { icon: '🌏', title: 'Study Abroad', description: 'University exchange and full-degree programme guidance' },
      { icon: '💼', title: 'Internships', description: 'Virtual and in-country internships with global firms' },
      { icon: '🏆', title: 'Competitions', description: 'Olympiads, Model UN and STEM competitions worldwide' },
      { icon: '📄', title: 'SOP & Essays', description: 'AI-assisted statement of purpose writing support' },
      { icon: '🤝', title: 'Alumni Network', description: 'Connect with Shreyartha alumni studying abroad' },
    ],
    sections: [
      {
        title: 'Scholarship Matching',
        icon: '🎯',
        content:
          'Our AI engine matches your academic profile, financial background and interests to the scholarships you\'re most likely to win — saving hours of manual research.',
      },
      {
        title: 'Application Support',
        icon: '📝',
        content:
          'End-to-end support from shortlisting to submitting applications — including document checklists, SOP reviews, mock interviews and visa guidance.',
      },
      {
        title: 'Success Stories',
        icon: '⭐',
        content:
          'Shreyartha students have received scholarships to universities in the US, UK, Canada, Germany, Singapore and Australia. Read their stories in our success blog.',
      },
    ],
    cta: {
      title: 'Find Your Opportunity',
      subtitle: 'Discover scholarships and programmes matched to your profile',
      buttonText: 'Explore Opportunities',
    },
  },

  'progress-tracking': {
    title: 'Progress Tracking',
    subtitle: 'See every step of the learning journey at a glance',
    icon: '📈',
    description:
      'Comprehensive, real-time dashboards for students, parents, teachers and school administrators — making progress visible and actionable for everyone in the learning ecosystem.',
    features: [
      { icon: '📊', title: 'Live Dashboards', description: 'Real-time progress across all modules and subjects' },
      { icon: '📅', title: 'Weekly Reports', description: 'Automated weekly summary emails to parents' },
      { icon: '🎯', title: 'Goal Tracking', description: 'Set goals and track milestones towards them' },
      { icon: '🔔', title: 'Smart Alerts', description: 'Alerts when a student falls behind or excels' },
      { icon: '📉', title: 'Gap Analysis', description: 'Identify knowledge gaps before exams arrive' },
      { icon: '🏫', title: 'Class Overview', description: 'Teachers see the whole class\'s progress in one view' },
    ],
    sections: [
      {
        title: 'For Students',
        icon: '🧑‍🎓',
        content:
          'A personal progress hub showing completed lessons, assessment scores, skill badges earned and upcoming learning targets — keeping students motivated and on track.',
      },
      {
        title: 'For Parents',
        icon: '👨‍👩‍👧',
        content:
          'Weekly digest emails and an app dashboard give parents a clear picture of their child\'s engagement, performance trends and areas where extra support may help.',
      },
      {
        title: 'For Schools',
        icon: '🏫',
        content:
          'School admin panels aggregate data across classes and grade levels, helping principals and coordinators identify systemic gaps and celebrate school-wide achievements.',
      },
    ],
    cta: {
      title: 'Track Progress in Real Time',
      subtitle: 'Set up your dashboard in minutes — no training required',
      buttonText: 'Set Up Dashboard',
    },
  },

  'store': {
    title: 'Shreyartha Store',
    subtitle: 'Premium learning materials, kits and merchandise',
    icon: '🛒',
    description:
      'The Shreyartha Store brings together curated books, robotics kits, stationery, branded merchandise and digital resource bundles — all vetted by our education experts.',
    features: [
      { icon: '📚', title: 'Curated Books', description: 'Expert-picked titles for every grade and subject' },
      { icon: '🤖', title: 'Robotics Kits', description: 'Ready-to-use kits paired with Shreyartha courses' },
      { icon: '🎨', title: 'Art Supplies', description: 'Quality supplies for the visual and performing arts' },
      { icon: '💻', title: 'Digital Bundles', description: 'Discounted course packs and subscription upgrades' },
      { icon: '👕', title: 'Merchandise', description: 'Shreyartha branded apparel, bags and accessories' },
      { icon: '🚚', title: 'Fast Delivery', description: 'Pan-India delivery within 5–7 business days' },
    ],
    sections: [
      {
        title: 'How to Order',
        icon: '🛍️',
        content:
          'Browse the store, add items to your cart, apply coupon codes, and check out securely via UPI, net banking, debit/credit card or cash on delivery for eligible pin codes.',
      },
      {
        title: 'School Bulk Orders',
        icon: '🏫',
        content:
          'Schools can place bulk orders for kits and books at institutional pricing. A dedicated account manager will help you customise bundles and manage delivery logistics.',
      },
      {
        title: 'Returns & Warranty',
        icon: '🔄',
        content:
          'Physical products come with a 7-day no-questions-asked return policy. Robotics kits include a 6-month manufacturer warranty against defects.',
      },
    ],
    cta: {
      title: 'Shop the Shreyartha Store',
      subtitle: 'Free shipping on orders over ₹999',
      buttonText: 'Shop Now',
    },
  },
};

export default PAGE_DATA;
