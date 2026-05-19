// services/studentService.js
// Student-specific API endpoints for the native student panel.
// All calls are routed through the shared apiFetch which attaches the
// studentToken Bearer header automatically.

import { api } from './apiService';

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
  getCompetitiveExams: () => api.get('/api/competitiveexam/exams'),
  getAcademicIQTopicContent: (topicId) => api.get(`/api/academiciq/topic/${encodeURIComponent(topicId)}/content`),
  getPracticeZoneQuestions: (topicId, level) =>
    api.get(`/api/academiciq/topic/${encodeURIComponent(topicId)}/practice-zone?level=${encodeURIComponent(level)}`),
  getUnderstandingQuestions: (topicId) => api.get(`/api/student/understanding/${encodeURIComponent(topicId)}/questions`),
  getUnderstandingInfo: (topicId) => api.get(`/api/student/understanding/${encodeURIComponent(topicId)}/info`),
  startTopicReflection: (topicId, body = {}) => api.post(`/api/adaptive/topic/${encodeURIComponent(topicId)}/start`, body),
  answerTopicReflection: (topicId, body) => api.post(`/api/adaptive/topic/${encodeURIComponent(topicId)}/answer`, body),
  submitTopicReflectionTest: (topicId, body) => api.post(`/api/adaptive/topic/${encodeURIComponent(topicId)}/submit`, body),
  submitTopicReflectionLevel: (topicId, body) => api.post(`/api/adaptive/topic/${encodeURIComponent(topicId)}/reflection`, body),
  getTopicContent: (topicId, category) => api.get(`/api/students/study/topics/${encodeURIComponent(topicId)}/content${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  getTopicQuestions: (topicId, category) => api.get(`/api/students/study/topics/${encodeURIComponent(topicId)}/questions${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  getExamDetail: (examId) => api.get(`/api/competitiveexam/exams/${encodeURIComponent(examId)}`),
  getExamPracticeSubjects: (examId) => api.get(`/api/competitiveexam/exams/${encodeURIComponent(examId)}/practice-zone`),
  getExamSubjectQuestions: (examId, subjectId) => api.get(`/api/competitiveexam/exams/${encodeURIComponent(examId)}/subjects/${encodeURIComponent(subjectId)}/questions`),
  getExamTopicContent: (topicId) => api.get(`/api/competitiveexam/topic/${encodeURIComponent(topicId)}/content`),
  getExamTopicPracticeQuestions: (topicId, level) =>
    api.get(`/api/competitiveexam/topic/${encodeURIComponent(topicId)}/practice-zone?level=${encodeURIComponent(level)}`),
  getExamMockTests: (examId, { page = 1, size } = {}) => {
    const params = new URLSearchParams();
    // Spring Boot uses 0-indexed pages; UI passes 1-indexed pages, so convert
    const apiPage = Number.isFinite(page) ? Math.max(0, page - 1) : 0;
    params.append('page', String(apiPage));
    if (Number.isFinite(size) && size > 0) params.append('size', String(size));
    const qs = params.toString();
    return api.get(`/api/competitiveexam/exams/${encodeURIComponent(examId)}/mock-tests${qs ? `?${qs}` : ''}`);
  },
  getMockTestResult: (mockTestId) => api.get(`/api/competitiveexam/mock-tests/${encodeURIComponent(mockTestId)}/result`),
  getMockTestQuestions: (mockTestId) => api.get(`/api/competitiveexam/mock-tests/${encodeURIComponent(mockTestId)}/questions`),
  submitMockTest: (mockTestId, data) => api.post(`/api/competitiveexam/mock-tests/${encodeURIComponent(mockTestId)}/submit`, data),
  getAcademicProfile: () => api.get('/api/academic/profile'),
  createAcademicProfile: (data) => api.post('/api/academic/profile', data),
  updateAcademicProfile: (data) => api.put('/api/academic/profile', data),
  getStudentHiddenNodes: (type) => api.get(`/api/students/hidden-nodes?type=${encodeURIComponent(type)}`),
  getSkillsEdgeTree: () => api.get('/api/skillsedge/tree'),
  getSkillDetail: (skillId) => api.get(`/api/skillsedge/skills/${encodeURIComponent(skillId)}`),
  getSkillChapterDetail: (chapterId) => api.get(`/api/skillsedge/chapters/${encodeURIComponent(chapterId)}`),
  getSkillModuleDetail: (moduleId) => api.get(`/api/skillsedge/modules/${encodeURIComponent(moduleId)}`),
  getSkillChapterAssessment: (chapterId) => api.get(`/api/skillsedge/chapters/${encodeURIComponent(chapterId)}/assessment`),
  getSkillChapterProject: (chapterId) => api.get(`/api/skillsedge/chapters/${encodeURIComponent(chapterId)}/project`),
  getSkillsProfile: () => api.get('/api/skills/profile'),
  createSkillsProfile: (data) => api.post('/api/skills/profile', data),
  updateSkillsProfile: (data) => api.put('/api/skills/profile', data),
  getLanguageProTree: () => api.get('/api/languagepro/tree'),
  getLanguageProTopics: ({ resourceType, focusArea, level, mode }) =>
    api.get(
      `/api/languagepro/topics?resourceType=${encodeURIComponent(resourceType)}&focusArea=${encodeURIComponent(focusArea)}&level=${encodeURIComponent(level || '')}&mode=${encodeURIComponent(mode)}`,
    ),
  getLanguageProTopicContent: (topicId, { resourceType, focusArea, level, mode } = {}) =>
    api.get(
      `/api/languagepro/topics/${encodeURIComponent(topicId)}/content?resourceType=${encodeURIComponent(resourceType || '')}&focusArea=${encodeURIComponent(focusArea || '')}&level=${encodeURIComponent(level || '')}&mode=${encodeURIComponent(mode || '')}`,
    ),
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
  getPsychometricCategories: () => api.get('/api/psychometric/categories'),
  getPsychometricIntro: (categoryId) => api.get(`/api/psychometric/categories/${encodeURIComponent(categoryId)}`),
  getPsychometricQuestions: (categoryId) => api.get(`/api/psychometric/categories/${encodeURIComponent(categoryId)}/questions`),
  submitPsychometricAssessment: (categoryId, data) => api.post(`/api/psychometric/categories/${encodeURIComponent(categoryId)}/submit`, data),
  getPsychometricResult: (categoryId) => api.get(`/api/psychometric/categories/${encodeURIComponent(categoryId)}/result`),

  // ── Subject & Career ──────────────────────────────────────────────────────
  getSubjectCareerStreams: () => api.get('/api/subject-career/streams'),
  getSubjectCareerMajors: (streamId) => api.get(`/api/subject-career/streams/${encodeURIComponent(streamId)}/majors`),
  getSubjectCareerOptics: (streamId, majorId) => api.get(`/api/subject-career/streams/${encodeURIComponent(streamId)}/majors/${encodeURIComponent(majorId)}/careers`),
  getSubjectCareerContent: ({ streamId, majorId, careerId, section }) =>
    api.get(
      `/api/subject-career/content?streamId=${encodeURIComponent(streamId)}&majorId=${encodeURIComponent(majorId)}&careerId=${encodeURIComponent(careerId)}&section=${encodeURIComponent(section)}`,
    ),

  // ── Coding Pro ──────────────────────────────────────────────────────────────
  getCodingProLanding: () => api.get('/api/codingpro/landing'),
  getCodingProTree: () => api.get('/api/codingpro/tree'),
  getCodingProStreamTopics: (stream, classValue) =>
    api.get(
      `/api/codingpro/streams/${encodeURIComponent(stream)}/topics${classValue ? `?class=${encodeURIComponent(classValue)}` : ''}`,
    ),
  getCodingProTopicContent: ({ topicId, stream, classValue }) =>
    api.get(
      `/api/codingpro/topics/${encodeURIComponent(topicId)}/content${stream || classValue ? `?${[
        stream ? `stream=${encodeURIComponent(stream)}` : '',
        classValue ? `class=${encodeURIComponent(classValue)}` : '',
      ].filter(Boolean).join('&')}` : ''}`,
    ),
  getCodingProProjects: ({ stream, classValue }) =>
    api.get(
      `/api/codingpro/projects${stream || classValue ? `?${[
        stream ? `stream=${encodeURIComponent(stream)}` : '',
        classValue ? `class=${encodeURIComponent(classValue)}` : '',
      ].filter(Boolean).join('&')}` : ''}`,
    ),

  // ── Resources ──────────────────────────────────────────────────────────────
  getResources: () => api.get('/api/students/resources'),
  getResourceCategories: () => api.get('/api/students/resources/categories'),
  createCounselorQuery: (data) => api.post('/api/student/counselor-queries', data),

  // ── Events ─────────────────────────────────────────────────────────────────
  getEvents: ({ filter, search, category, page } = {}) => {
    const params = new URLSearchParams();
    if (filter) params.append('filter', filter);
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (page && page > 1) params.append('page', String(page));
    const qs = params.toString();
    return api.get(`/api/events${qs ? `?${qs}` : ''}`);
  },
  getEventDetail: (eventId) => api.get(`/api/events/${encodeURIComponent(eventId)}`),
  registerForEvent: (eventId) => api.post(`/api/events/${encodeURIComponent(eventId)}/register`, {}),
  cancelEventRegistration: (eventId) => api.delete(`/api/events/${encodeURIComponent(eventId)}/register`),
  getMyEvents: () => api.get('/api/students/my-events'),

  // ── Notifications ──────────────────────────────────────────────────────────
  getNotifications: () => api.get('/api/students/notifications'),
  markNotificationRead: (id) => api.put(`/api/students/notifications/${id}/read`),
  markAllNotificationsRead: () => api.put('/api/students/notifications/read-all'),

  // ── Account ────────────────────────────────────────────────────────────────
  changePassword: (data) => api.post('/api/auth/change-password', data),
};
