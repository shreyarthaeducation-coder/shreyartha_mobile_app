import { api } from './apiService';

export const dashboardService = {
  getStudentDashboard: async () => api.get('/api/students/dashboard'),
  getSchoolDashboard: async () => api.get('/api/school/dashboard'),
  getParentDashboard: async () => api.get('/api/parent/dashboard'),
  getAdminDashboard: async () => api.get('/api/admin/dashboard'),
};
