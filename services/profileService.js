import { api } from './apiService';

export const profileService = {
  getStudentProfile: async () => api.get('/api/students/profile'),
  updateStudentProfile: async (data) => api.put('/api/students/profile', data),
  getSchoolProfile: async () => api.get('/api/school/profile'),
  getParentProfile: async () => api.get('/api/parent/profile'),
  getAdminProfile: async () => api.get('/api/admin/profile'),
  changePassword: async (data) => api.post('/api/auth/change-password', data),
};
