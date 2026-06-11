import Constants from 'expo-constants';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  'https://shreyartha.com';

const postJson = async (endpoint, body) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Server error. Please try again.');
  }
  if (!res.ok) {
    const msg =
      data?.message || data?.error || data?.data?.message ||
      'Request failed. Please try again.';
    throw new Error(msg);
  }
  return data;
};

export const loginStudent = (email, password) =>
  postJson('/api/auth/login', { email, password });

export const loginSchool = (emailOrMobile, password) =>
  postJson('/api/school/auth/login', { emailOrMobile, password });

export const loginParent = (emailOrMobile, password) =>
  postJson('/api/parent/auth/login', { emailOrMobile, password });

export const loginPartner = (emailOrMobile, password) =>
  postJson('/api/partner/auth/login', { emailOrMobile, password });

const FORGOT_ENDPOINTS = {
  student: '/api/auth/forgot-password',
  school: '/api/school/auth/forgot-password',
  parent: '/api/parent/auth/forgot-password',
  partner: '/api/partner/auth/forgot-password',
};

export const forgotPassword = (type, emailOrPhone) =>
  postJson(FORGOT_ENDPOINTS[type] || FORGOT_ENDPOINTS.student, { emailOrPhone });

export const deleteStudentAccount = async (token) => {
  const res = await fetch(`${BASE_URL}/api/students/delete-account`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    let data;
    try { data = await res.json(); } catch { /* empty */ }
    throw new Error(data?.message || 'Failed to delete account.');
  }
  return true;
};
