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

const getFirst = (endpoints) => withFallback(endpoints.map((endpoint) => () => api.get(endpoint)));
const deleteFirst = (endpoints) => withFallback(endpoints.map((endpoint) => () => api.delete(endpoint)));
const postFirst = (candidates, retryStatuses = WRITE_FALLBACK_RETRY_STATUSES) =>
  withFallback(candidates.map(({ endpoint, body }) => () => api.post(endpoint, body)), retryStatuses);
const buildPsychometricSubmitCandidates = (basePath, categoryId, data) => {
  const encodedCategoryId = encodeURIComponent(categoryId);
  const responsePayload = Array.isArray(data?.answers) ? { ...data, responses: data.answers } : data;
  return [
    { endpoint: `${basePath}/categories/${encodedCategoryId}/submit`, body: data },
    { endpoint: `${basePath}/categories/${encodedCategoryId}/submit`, body: responsePayload },
    { endpoint: `${basePath}/categories/${encodedCategoryId}/answers`, body: data },
  ];
};

const competitiveExamBasePaths = ['', '/student'].flatMap((prefix) => [
  `/api${prefix}/competitiveexam`,
  `/api${prefix}/competitive-exam`,
]);

const psychometricBasePaths = ['', '/student', '/students'].flatMap((prefix) => [
  `/api${prefix}/psychometric`,
  `/api${prefix}/psychometric-assessment`,
]);

const subjectCareerBasePaths = ['', '/student', '/students'].flatMap((prefix) => [
  `/api${prefix}/subject-career`,
  `/api${prefix}/subjectcareer`,
]);

const skillsEdgeBasePaths = ['', '/student', '/students'].flatMap((prefix) => [
  `/api${prefix}/skillsedge`,
  `/api${prefix}/skills-edge`,
]);

const languageProBasePaths = ['', '/student', '/students'].flatMap((prefix) => [
  `/api${prefix}/languagepro`,
  `/api${prefix}/language-pro`,
]);

const codingProBasePaths = ['', '/student', '/students'].flatMap((prefix) => [
  `/api${prefix}/codingpro`,
  `/api${prefix}/coding-pro`,
]);

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
  getDashboard: () => api.get('/api/students/dashboard'),

  // ── Profile ────────────────────────────────────────────────────────────────
  getProfile: () => api.get('/api/students/profile'),
  updateProfile: (data) => api.put('/api/students/profile', data),
  uploadAvatar: (formData) => api.put('/api/students/profile/avatar', formData),
  getStudentSurvey: () => api.get('/api/students/survey'),
  saveStudentSurvey: (data) => api.post('/api/students/survey', data),
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
    getFirst(languageProBasePaths.flatMap((basePath) => [
      `${basePath}/topics${buildQuery({ resourceType, focusArea, level, mode })}`,
      `${basePath}/resources${buildQuery({ resourceType, focusArea, level, mode })}`,
    ])),
  getLanguageProTopicContent: (topicId, { resourceType, focusArea, level, mode } = {}) =>
    getFirst(languageProBasePaths.flatMap((basePath) => [
      `${basePath}/topics/${encodeURIComponent(topicId)}/content${buildQuery({ resourceType, focusArea, level, mode })}`,
      `${basePath}/content/${encodeURIComponent(topicId)}${buildQuery({ resourceType, focusArea, level, mode })}`,
    ])),
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
    const qs = buildQuery({ filter, search, category, page: page && page > 1 ? page : '' });
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
