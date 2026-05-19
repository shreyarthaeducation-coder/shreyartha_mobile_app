// services/studentService.js
// Student-specific API endpoints for the native student panel.
// All calls are routed through the shared apiFetch which attaches the
// studentToken Bearer header automatically.

import { api } from './apiService';

const FALLBACK_RETRY_STATUSES = new Set([404, 405, 500, 501, 502, 503, 504]);
const WRITE_FALLBACK_RETRY_STATUSES = new Set([400, 404, 405, 500, 501, 502, 503, 504]);

const withFallback = async (candidates, retryStatuses = FALLBACK_RETRY_STATUSES) => {
  const queue = candidates.filter((candidate) => typeof candidate === 'function');
  let lastError = null;

  if (!queue.length) {
    throw new Error('No API request candidates were provided.');
  }

  for (let index = 0; index < queue.length; index += 1) {
    try {
      return await queue[index]();
    } catch (error) {
      lastError = error;
      const status = error?.response?.status || error?.status || null;
      const shouldRetry = index < queue.length - 1 && (!status || retryStatuses.has(status));
      if (!shouldRetry) throw error;
    }
  }

  throw lastError;
};

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalizedValue = typeof value === 'string' ? value.trim() : value;
    if (normalizedValue === '') return;
    query.append(key, String(normalizedValue));
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

const buildLanguageProQueries = ({
  resourceType,
  focusArea,
  level,
  mode,
  classValue,
  activity,
} = {}) => {
  const variants = [
    { resourceType, focusArea, level, mode, class: classValue, activity },
    { type: resourceType, focus: focusArea, level, mode, class: classValue, activity },
    { resource: resourceType, focusArea, proficiency: level, mode, className: classValue, activityType: activity },
  ];
  return [...new Set(variants.map((variant) => buildQuery(variant)))];
};

const getFirst = (endpoints) => withFallback(endpoints.map((endpoint) => () => api.get(endpoint)));
const deleteFirst = (endpoints) => withFallback(endpoints.map((endpoint) => () => api.delete(endpoint)));
const writeFirst = (candidates, retryStatuses = WRITE_FALLBACK_RETRY_STATUSES) =>
  withFallback(candidates.map(({ endpoint, body, method = 'POST' }) => () => (
    method === 'PUT' ? api.put(endpoint, body) : api.post(endpoint, body)
  )), retryStatuses);
const postFirst = (candidates, retryStatuses = WRITE_FALLBACK_RETRY_STATUSES) =>
  writeFirst(candidates, retryStatuses);
const buildBasePaths = (prefixes, baseNames) => prefixes.flatMap((prefix) => baseNames.map((baseName) => `/api${prefix}/${baseName}`));
const buildPsychometricSubmitCandidates = (basePath, categoryId, data) => {
  const responsePayload = Array.isArray(data?.answers) && !Array.isArray(data?.responses)
    ? { ...data, responses: data.answers }
    : data;
  return [
    { endpoint: `${basePath}/categories/${encodeURIComponent(categoryId)}/submit`, body: data },
    { endpoint: `${basePath}/categories/${encodeURIComponent(categoryId)}/answers`, body: responsePayload },
  ];
};

const psychometricBasePaths = buildBasePaths(['', '/student', '/students'], ['psychometric', 'psychometric-assessment']);
const subjectCareerBasePaths = buildBasePaths(['', '/student', '/students'], ['subject-career', 'subjectcareer']);
const skillsEdgeBasePaths = buildBasePaths(['', '/student', '/students'], ['skillsedge', 'skills-edge']);
const languageProBasePaths = buildBasePaths(['', '/student', '/students'], ['languagepro', 'language-pro']);
const codingProBasePaths = buildBasePaths(['', '/student', '/students'], ['codingpro', 'coding-pro']);

const eventsBasePaths = ['/api/events', '/api/student/events', '/api/students/events'];

const getExamSubjectTree = (subExamId) => getFirst([
  `/api/competitiveexam/subject/${encodeURIComponent(subExamId)}/tree`,
  `/api/competitive-exam/subject/${encodeURIComponent(subExamId)}/tree`,
  `/api/student/competitiveexam/subject/${encodeURIComponent(subExamId)}/tree`,
  `/api/student/competitive-exam/subject/${encodeURIComponent(subExamId)}/tree`,
  `/api/competitiveexam/subjects/${encodeURIComponent(subExamId)}/tree`,
  `/api/competitive-exam/subjects/${encodeURIComponent(subExamId)}/tree`,
]);
const getMockTestPaperQuestions = (paperId) => getFirst([
  `/api/admin/competitiveexam/mocktest-papers/student/${encodeURIComponent(paperId)}/questions`,
  `/api/admin/competitive-exam/mocktest-papers/student/${encodeURIComponent(paperId)}/questions`,
  `/api/student/competitiveexam/mocktest-papers/${encodeURIComponent(paperId)}/questions`,
]);

export const studentService = {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  getDashboard: () => getFirst([
    '/api/students/dashboard',
    '/api/student/dashboard',
    '/api/students/profile',
    '/api/student/profile',
  ]),
  getStudentAnalytics: () => getFirst([
    '/api/students/analytics',
    '/api/student/analytics',
  ]),
  getSyllabusCompletion: () => getFirst([
    '/api/students/syllabus-completion',
    '/api/student/syllabus-completion',
  ]),
  getMyProgressAnalytics: () => getFirst([
    '/api/student/my-progress',
    '/api/student/my-progress/',
    '/api/students/my-progress',
  ]),
  getCompetitiveExamAnalytics: () => getFirst([
    '/api/student/competitiveexam/analytics',
    '/api/student/competitive-exam/analytics',
    '/api/students/competitiveexam/analytics',
    '/api/students/competitive-exam/analytics',
  ]),
  getPsychometricAnalytics: () => getFirst(psychometricBasePaths.flatMap((basePath) => [
    `${basePath}/analytics`,
    `${basePath}/analysis`,
    `${basePath}/summary`,
    `${basePath}/results`,
  ])),
  getLearningGapsAnalytics: () => getFirst([
    '/api/student/learning-gaps',
    '/api/students/learning-gaps',
    '/api/student/learninggaps',
    '/api/students/learninggaps',
    '/api/student/learning-gap',
    '/api/students/learning-gap',
    '/api/student/learning-gaps/analytics',
    '/api/students/learning-gaps/analytics',
  ]),
  getCodingProAnalytics: () => getFirst(codingProBasePaths.flatMap((basePath) => [
    `${basePath}/analytics`,
    `${basePath}/analysis`,
    `${basePath}/summary`,
    `${basePath}/progress`,
  ])),
  getSkillsEdgeAnalytics: () => getFirst(skillsEdgeBasePaths.flatMap((basePath) => [
    `${basePath}/analytics`,
    `${basePath}/analysis`,
    `${basePath}/summary`,
    `${basePath}/progress`,
  ])),
  /**
   * Resolves student subscription/plan entitlements using backend fallbacks.
   * Different deployments expose this data under different endpoints, so this
   * helper retries the common variants and returns the first successful payload.
   */
  getStudentSubscription: () => getFirst([
    '/api/students/subscription',
    '/api/student/subscription',
    '/api/students/plan',
    '/api/students/entitlement',
    '/api/students/profile',
    '/api/students/dashboard',
  ]),

  // ── Profile ────────────────────────────────────────────────────────────────
  getProfile: () => getFirst([
    '/api/students/profile',
    '/api/student/profile',
  ]),
  updateProfile: (data) => writeFirst([
    { endpoint: '/api/students/profile', body: data, method: 'PUT' },
    { endpoint: '/api/student/profile', body: data, method: 'PUT' },
  ]),
  uploadAvatar: (formData) => api.put('/api/students/profile/avatar', formData),
  getStudentSurvey: () => getFirst([
    '/api/students/survey',
    '/api/student/survey',
    '/api/students/profile/survey',
    '/api/student/profile/survey',
    '/api/students/reflection',
    '/api/student/reflection',
    '/api/students/profile',
    '/api/student/profile',
  ]),
  saveStudentSurvey: (data) => writeFirst([
    { endpoint: '/api/students/survey', body: data, method: 'POST' },
    { endpoint: '/api/student/survey', body: data, method: 'POST' },
    { endpoint: '/api/students/survey', body: { answers: data }, method: 'POST' },
    { endpoint: '/api/student/survey', body: { answers: data }, method: 'POST' },
    { endpoint: '/api/students/reflection', body: data, method: 'PUT' },
    { endpoint: '/api/student/reflection', body: data, method: 'PUT' },
    { endpoint: '/api/students/reflection', body: { answers: data }, method: 'PUT' },
    { endpoint: '/api/student/reflection', body: { answers: data }, method: 'PUT' },
  ]),
  uploadProfilePicture: (formData) => api.post('/api/students/profile/picture', formData),
  deleteProfilePicture: () => api.delete('/api/students/profile/picture'),
  uploadProfileVideo: (formData) => api.post('/api/students/profile/video', formData),
  deleteProfileVideo: () => api.delete('/api/students/profile/video'),

  // ── Academic / IQ ──────────────────────────────────────────────────────────
  getAcademicData: () => api.get('/api/students/academic'),
  getGrades: () => api.get('/api/students/grades'),
  getAssessments: () => api.get('/api/students/assessments'),
  getAcademicIQTree: () => api.get('/api/academiciq/tree'),
  getCompetitiveExams: () => getFirst([
    '/api/competitiveexam/exams',
    '/api/competitive-exam/exams',
    '/api/student/competitiveexam/exams',
    '/api/student/competitive-exam/exams',
  ]),
  getAcademicIQTopicContent: (topicId) => api.get(`/api/academiciq/topic/${encodeURIComponent(topicId)}/content`),
  getPracticeZoneQuestions: (topicId) => api.get(`/api/practice/topic/${encodeURIComponent(topicId)}/questions`),
  getPracticeZoneQuestionsByDifficulty: (topicId, level) =>
    api.get(`/api/practice/topic/${encodeURIComponent(topicId)}/questions/filter?difficulty=${encodeURIComponent(level)}`),
  getUnderstandingQuestions: (topicId) => api.get(`/api/student/understanding/${encodeURIComponent(topicId)}/questions`),
  getUnderstandingInfo: (topicId) => api.get(`/api/student/understanding/${encodeURIComponent(topicId)}/info`),
  startTopicReflection: (topicId, body = {}) => api.post(`/api/adaptive/topic/${encodeURIComponent(topicId)}/start`, body),
  answerTopicReflection: (topicId, body) => api.post(`/api/adaptive/topic/${encodeURIComponent(topicId)}/answer`, body),
  submitTopicReflectionTest: (topicId, body) => api.post(`/api/adaptive/topic/${encodeURIComponent(topicId)}/submit`, body),
  submitTopicReflectionLevel: (topicId, body) => api.post(`/api/adaptive/topic/${encodeURIComponent(topicId)}/reflection`, body),
  getTopicContent: (topicId, category) => api.get(`/api/students/study/topics/${encodeURIComponent(topicId)}/content${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  getTopicQuestions: (topicId, category) => api.get(`/api/students/study/topics/${encodeURIComponent(topicId)}/questions${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  getExamSubjectTree,
  getExamDetail: getExamSubjectTree,
  getExamPracticeSubjects: getExamSubjectTree,
  getExamSubjectQuestions: (topicId) => getFirst([
    `/api/student/competitiveexam/practice/${encodeURIComponent(topicId)}/questions`,
    `/api/student/competitive-exam/practice/${encodeURIComponent(topicId)}/questions`,
    `/api/competitiveexam/practice/${encodeURIComponent(topicId)}/questions`,
    `/api/competitive-exam/practice/${encodeURIComponent(topicId)}/questions`,
    `/api/student/competitiveexam/topic/${encodeURIComponent(topicId)}/questions`,
    `/api/student/competitiveexam/topics/${encodeURIComponent(topicId)}/questions`,
  ]),
  getExamTopicContent: (topicId) => getFirst([
    `/api/competitiveexam/topic/${encodeURIComponent(topicId)}/content`,
    `/api/competitiveexam/topics/${encodeURIComponent(topicId)}/content`,
    `/api/competitive-exam/topic/${encodeURIComponent(topicId)}/content`,
    `/api/competitive-exam/topics/${encodeURIComponent(topicId)}/content`,
    `/api/student/competitiveexam/topic/${encodeURIComponent(topicId)}/content`,
    `/api/student/competitiveexam/topics/${encodeURIComponent(topicId)}/content`,
  ]),
  getExamTopicPracticeQuestions: (topicId) => getFirst([
    `/api/student/competitiveexam/practice/${encodeURIComponent(topicId)}/questions`,
    `/api/student/competitive-exam/practice/${encodeURIComponent(topicId)}/questions`,
    `/api/competitiveexam/practice/${encodeURIComponent(topicId)}/questions`,
    `/api/competitive-exam/practice/${encodeURIComponent(topicId)}/questions`,
    `/api/student/competitiveexam/topic/${encodeURIComponent(topicId)}/questions`,
    `/api/student/competitiveexam/topics/${encodeURIComponent(topicId)}/questions`,
    `/api/competitiveexam/topic/${encodeURIComponent(topicId)}/questions`,
    `/api/competitiveexam/topics/${encodeURIComponent(topicId)}/questions`,
  ]),
  getExamMockTests: (entranceExamId, { page } = {}) => {
    const params = new URLSearchParams();
    if (Number.isFinite(page) && page > 0) params.append('page', String(page));
    const qs = params.toString();
    return getFirst([
      `/api/student/competitiveexam/mocktest/entrance-exam/${encodeURIComponent(entranceExamId)}${qs ? `?${qs}` : ''}`,
      `/api/student/competitive-exam/mocktest/entrance-exam/${encodeURIComponent(entranceExamId)}${qs ? `?${qs}` : ''}`,
      `/api/competitiveexam/mocktest/entrance-exam/${encodeURIComponent(entranceExamId)}${qs ? `?${qs}` : ''}`,
    ]);
  },
  getMockTestPapersForSubject: (subExamId) => api.get(`/api/admin/competitiveexam/mocktest-papers/student/subject/${encodeURIComponent(subExamId)}`),
  getMockTestPaperQuestions,
  getMockTestResult: (mockTestId) => api.get(`/api/competitiveexam/mock-tests/${encodeURIComponent(mockTestId)}/result`),
  getMockTestQuestions: getMockTestPaperQuestions,
  submitMockTest: (mockTestId, data) => api.post(`/api/student/competitiveexam/mocktest/${encodeURIComponent(mockTestId)}/submit`, data),
  getAcademicProfile: () => api.get('/api/academic/profile'),
  createAcademicProfile: (data) => api.post('/api/academic/profile', data),
  updateAcademicProfile: (data) => api.put('/api/academic/profile', data),
  getStudentHiddenNodes: (type) => api.get(`/api/students/hidden-nodes?type=${encodeURIComponent(type)}`),
  getSkillsEdgeTree: () => getFirst(skillsEdgeBasePaths.map((basePath) => `${basePath}/tree`)),
  getSkillDetail: (skillId) => getFirst(skillsEdgeBasePaths.flatMap((basePath) => [
    `${basePath}/skills/${encodeURIComponent(skillId)}`,
    `${basePath}/skill/${encodeURIComponent(skillId)}`,
  ])),
  getSkillChapterDetail: (chapterId) => getFirst(skillsEdgeBasePaths.flatMap((basePath) => [
    `${basePath}/chapters/${encodeURIComponent(chapterId)}`,
    `${basePath}/chapter/${encodeURIComponent(chapterId)}`,
  ])),
  getSkillModuleDetail: (moduleId) => getFirst(skillsEdgeBasePaths.flatMap((basePath) => [
    `${basePath}/modules/${encodeURIComponent(moduleId)}`,
    `${basePath}/module/${encodeURIComponent(moduleId)}`,
  ])),
  getSkillChapterAssessment: (chapterId) => getFirst(skillsEdgeBasePaths.flatMap((basePath) => [
    `${basePath}/chapters/${encodeURIComponent(chapterId)}/assessment`,
    `${basePath}/chapter/${encodeURIComponent(chapterId)}/assessment`,
  ])),
  getSkillChapterProject: (chapterId) => getFirst(skillsEdgeBasePaths.flatMap((basePath) => [
    `${basePath}/chapters/${encodeURIComponent(chapterId)}/project`,
    `${basePath}/chapter/${encodeURIComponent(chapterId)}/project`,
  ])),
  getSkillsProfile: () => api.get('/api/skills/profile'),
  createSkillsProfile: (data) => api.post('/api/skills/profile', data),
  updateSkillsProfile: (data) => api.put('/api/skills/profile', data),
  getLanguageProTree: () => getFirst(languageProBasePaths.map((basePath) => `${basePath}/tree`)),
  getLanguageProTopics: ({ resourceType, focusArea, level, mode }) =>
    getFirst(languageProBasePaths.flatMap((basePath) => buildLanguageProQueries({
      resourceType,
      focusArea,
      level,
      mode,
    }).flatMap((query) => [
      `${basePath}/topics${query}`,
      `${basePath}/resources${query}`,
      `${basePath}/chapters${query}`,
      `${basePath}/modules${query}`,
    ]))),
  getLanguageProTopicContent: (topicId, { resourceType, focusArea, level, mode, classValue, activity } = {}) =>
    getFirst(languageProBasePaths.flatMap((basePath) => buildLanguageProQueries({
      resourceType,
      focusArea,
      level,
      mode,
      classValue,
      activity,
    }).flatMap((query) => [
      `${basePath}/topics/${encodeURIComponent(topicId)}/content${query}`,
      `${basePath}/topic/${encodeURIComponent(topicId)}/content${query}`,
      `${basePath}/chapters/${encodeURIComponent(topicId)}/content${query}`,
      `${basePath}/chapter/${encodeURIComponent(topicId)}/content${query}`,
      `${basePath}/activities/${encodeURIComponent(topicId)}${query}`,
      `${basePath}/activity/${encodeURIComponent(topicId)}${query}`,
      `${basePath}/content/${encodeURIComponent(topicId)}${query}`,
    ]))),
  getLanguageProQuestions: (topicId, { resourceType, focusArea, level, mode, classValue, activity } = {}) =>
    getFirst(languageProBasePaths.flatMap((basePath) => buildLanguageProQueries({
      resourceType,
      focusArea,
      level,
      mode,
      classValue,
      activity,
    }).flatMap((query) => [
      `${basePath}/topics/${encodeURIComponent(topicId)}/questions${query}`,
      `${basePath}/topic/${encodeURIComponent(topicId)}/questions${query}`,
      `${basePath}/chapters/${encodeURIComponent(topicId)}/questions${query}`,
      `${basePath}/chapter/${encodeURIComponent(topicId)}/questions${query}`,
      `${basePath}/quizzes/${encodeURIComponent(topicId)}${query}`,
      `${basePath}/quiz/${encodeURIComponent(topicId)}${query}`,
      `${basePath}/understanding/${encodeURIComponent(topicId)}/questions${query}`,
    ]))),
  submitLanguageProQuiz: (topicId, data, { resourceType, focusArea, level, mode, classValue, activity } = {}) =>
    postFirst(languageProBasePaths.flatMap((basePath) => buildLanguageProQueries({
      resourceType,
      focusArea,
      level,
      mode,
      classValue,
      activity,
    }).flatMap((query) => [
      { endpoint: `${basePath}/topics/${encodeURIComponent(topicId)}/submit${query}`, body: data },
      { endpoint: `${basePath}/topic/${encodeURIComponent(topicId)}/submit${query}`, body: data },
      { endpoint: `${basePath}/chapters/${encodeURIComponent(topicId)}/submit${query}`, body: data },
      { endpoint: `${basePath}/quiz/${encodeURIComponent(topicId)}/submit${query}`, body: data },
      { endpoint: `${basePath}/quizzes/${encodeURIComponent(topicId)}/submit${query}`, body: data },
      { endpoint: `${basePath}/understanding/${encodeURIComponent(topicId)}/submit${query}`, body: data },
      { endpoint: `${basePath}/topics/${encodeURIComponent(topicId)}/answers${query}`, body: data },
    ]))),
  uploadLanguageProRecording: (topicId, formData, { resourceType, focusArea, level, mode, classValue, activity } = {}) =>
    postFirst(languageProBasePaths.flatMap((basePath) => buildLanguageProQueries({
      resourceType,
      focusArea,
      level,
      mode,
      classValue,
      activity,
    }).flatMap((query) => [
      { endpoint: `${basePath}/topics/${encodeURIComponent(topicId)}/recordings${query}`, body: formData },
      { endpoint: `${basePath}/topic/${encodeURIComponent(topicId)}/recordings${query}`, body: formData },
      { endpoint: `${basePath}/topics/${encodeURIComponent(topicId)}/recording${query}`, body: formData },
      { endpoint: `${basePath}/topic/${encodeURIComponent(topicId)}/recording${query}`, body: formData },
      { endpoint: `${basePath}/voice-recordings${buildQuery({ topicId, resourceType, focusArea, level, mode, class: classValue, className: classValue, activity })}`, body: formData },
      { endpoint: `${basePath}/speaking/${encodeURIComponent(topicId)}/submit${query}`, body: formData },
    ]))),
  getUniversityProfile: () => api.get('/api/university/profile'),
  createUniversityProfile: (data) => api.post('/api/university/profile', data),
  updateUniversityProfile: (data) => api.put('/api/university/profile', data),
  getEducationProfile: () => api.get('/api/education/profile'),
  createEducationProfile: (data) => api.post('/api/education/profile', data),
  updateEducationProfile: (data) => api.put('/api/education/profile', data),
  getAdditionalProfile: () => api.get('/api/additional/profile'),
  createAdditionalProfile: (data) => api.post('/api/additional/profile', data),
  updateAdditionalProfile: (data) => api.put('/api/additional/profile', data),

  // ── Psychometric Assessment ───────────────────────────────────────────────
  getPsychometricCategories: () => getFirst(psychometricBasePaths.map((basePath) => `${basePath}/categories`)),
  getPsychometricIntro: (categoryId) => getFirst(psychometricBasePaths.map((basePath) => `${basePath}/categories/${encodeURIComponent(categoryId)}`)),
  getPsychometricQuestions: (categoryId) =>
    getFirst(psychometricBasePaths.flatMap((basePath) => [
      `${basePath}/categories/${encodeURIComponent(categoryId)}/questions`,
      `${basePath}/categories/${encodeURIComponent(categoryId)}/assessment`,
    ])),
  submitPsychometricAssessment: (categoryId, data) => postFirst(
    psychometricBasePaths.flatMap((basePath) => buildPsychometricSubmitCandidates(basePath, categoryId, data)),
  ),
  getPsychometricResult: (categoryId) =>
    getFirst(psychometricBasePaths.flatMap((basePath) => [
      `${basePath}/categories/${encodeURIComponent(categoryId)}/result`,
      `${basePath}/categories/${encodeURIComponent(categoryId)}/report`,
    ])),

  // ── Subject & Career ──────────────────────────────────────────────────────
  getSubjectCareerStreams: () => getFirst(subjectCareerBasePaths.map((basePath) => `${basePath}/streams`)),
  getSubjectCareerMajors: (streamId) =>
    getFirst(subjectCareerBasePaths.flatMap((basePath) => [
      `${basePath}/streams/${encodeURIComponent(streamId)}/majors`,
      `${basePath}/majors${buildQuery({ streamId })}`,
    ])),
  getSubjectCareerOptics: (streamId, majorId) =>
    getFirst(subjectCareerBasePaths.flatMap((basePath) => [
      `${basePath}/streams/${encodeURIComponent(streamId)}/majors/${encodeURIComponent(majorId)}/careers`,
      `${basePath}/careers${buildQuery({ streamId, majorId })}`,
      `${basePath}/optics${buildQuery({ streamId, majorId })}`,
    ])),
  getSubjectCareerContent: ({ streamId, majorId, careerId, section }) =>
    getFirst(subjectCareerBasePaths.flatMap((basePath) => [
      `${basePath}/content${buildQuery({ streamId, majorId, careerId, section })}`,
      `${basePath}/careers/${encodeURIComponent(careerId)}/content${buildQuery({ streamId, majorId, section })}`,
    ])),

  // ── Coding Pro ──────────────────────────────────────────────────────────────
  getCodingProLanding: () => getFirst(codingProBasePaths.map((basePath) => `${basePath}/landing`)),
  getCodingProTree: () => getFirst(codingProBasePaths.map((basePath) => `${basePath}/tree`)),
  getCodingProStreamTopics: (stream, classValue) =>
    getFirst(codingProBasePaths.flatMap((basePath) => [
      `${basePath}/streams/${encodeURIComponent(stream)}/topics${buildQuery({ class: classValue })}`,
      `${basePath}/topics${buildQuery({ stream, class: classValue })}`,
    ])),
  getCodingProTopicContent: ({ topicId, stream, classValue }) =>
    getFirst(codingProBasePaths.flatMap((basePath) => [
      `${basePath}/topics/${encodeURIComponent(topicId)}/content${buildQuery({ stream, class: classValue })}`,
      `${basePath}/content/${encodeURIComponent(topicId)}${buildQuery({ stream, class: classValue })}`,
    ])),
  getCodingProProjects: ({ stream, classValue }) =>
    getFirst(codingProBasePaths.flatMap((basePath) => [
      `${basePath}/projects${buildQuery({ stream, class: classValue })}`,
      `${basePath}/project-tools${buildQuery({ stream, class: classValue })}`,
    ])),

  // ── Resources ──────────────────────────────────────────────────────────────
  getResources: () => api.get('/api/students/resources'),
  getResourceCategories: () => api.get('/api/students/resources/categories'),
  createCounselorQuery: (data) => api.post('/api/student/counselor-queries', data),

  // ── Events ─────────────────────────────────────────────────────────────────
  getEvents: ({ filter, search, category, page } = {}) => {
    const pageParam = Number.isFinite(page) && page > 1 ? page : undefined;
    const qs = buildQuery({ filter, search, category, page: pageParam });
    return getFirst(eventsBasePaths.map((basePath) => `${basePath}${qs}`));
  },
  getEventDetail: (eventId) => getFirst(eventsBasePaths.flatMap((basePath) => [
    `${basePath}/${encodeURIComponent(eventId)}`,
    `${basePath}/${encodeURIComponent(eventId)}/detail`,
  ])),
  registerForEvent: (eventId) => postFirst(eventsBasePaths.flatMap((basePath) => ([
    { endpoint: `${basePath}/${encodeURIComponent(eventId)}/register`, body: {} },
    { endpoint: `${basePath}/${encodeURIComponent(eventId)}/registration`, body: {} },
  ]))),
  cancelEventRegistration: (eventId) => deleteFirst(eventsBasePaths.flatMap((basePath) => [
    `${basePath}/${encodeURIComponent(eventId)}/register`,
    `${basePath}/${encodeURIComponent(eventId)}/registration`,
  ])),
  getMyEvents: () => getFirst([
    '/api/students/my-events',
    '/api/student/events/my',
    '/api/students/events/my',
    '/api/events/my',
  ]),

  // ── Notifications ──────────────────────────────────────────────────────────
  getNotifications: () => api.get('/api/students/notifications'),
  markNotificationRead: (id) => api.put(`/api/students/notifications/${id}/read`),
  markAllNotificationsRead: () => api.put('/api/students/notifications/read-all'),

  // ── Account ────────────────────────────────────────────────────────────────
  changePassword: (data) => api.post('/api/auth/change-password', data),
};
