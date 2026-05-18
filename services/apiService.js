// services/apiService.js
// Mirrors: frontendmain/src/services/apiService.js
// Adapted for React Native (AsyncStorage instead of localStorage)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

// IMPORTANT: Replace with your actual backend URL
// In production, use your deployed backend URL (e.g., https://api.shreyartha.com)
const API_BASE_URL = 'https://shreyartha.com';

const REQUEST_TIMEOUT_MS = 10000; // 10 seconds
const MAX_RETRIES = 1;
let redirectingAfterAuthError = false;

const clearAuthAndRedirect = async () => {
  if (redirectingAfterAuthError) return;
  redirectingAfterAuthError = true;
  try {
    await AsyncStorage.multiRemove([
      'studentToken',
      'userToken',
      'accessToken',
      'token',
      'adminToken',
      'schoolUserToken',
      'parentUserToken',
      'studentLoggedIn',
      'schoolLoggedIn',
      'parentLoggedIn',
      'adminLoggedIn',
      'userType',
      'userData',
      'studentRole',
      'cachedStudentRole',
    ]);
  } catch {
    // no-op
  } finally {
    try {
      router.replace('/auth/student-login');
    } catch {
      // Ignore navigation errors during startup.
    }
    setTimeout(() => {
      redirectingAfterAuthError = false;
    }, 500);
  }
};

/**
 * Get stored token — checks all possible token storage locations.
 * Uses the endpoint to determine which token to prioritize.
 */
const getStoredToken = async (endpoint = '') => {
  try {
    if (endpoint.includes('/admin/')) {
      return (await AsyncStorage.getItem('adminToken')) ||
             (await AsyncStorage.getItem('userToken')) || null;
    }

    if (
      endpoint.includes('/school/') ||
      endpoint.includes('/teacher/') ||
      endpoint.includes('/counselor/') ||
      endpoint.includes('/principal/') ||
      endpoint.includes('/vice-principal/')
    ) {
      return (await AsyncStorage.getItem('schoolUserToken')) || null;
    }

    if (endpoint.includes('/parent/')) {
      return (await AsyncStorage.getItem('parentUserToken')) || null;
    }

    if (endpoint.includes('/students/')) {
      return (await AsyncStorage.getItem('studentToken')) ||
             (await AsyncStorage.getItem('userToken')) ||
             (await AsyncStorage.getItem('accessToken')) ||
             (await AsyncStorage.getItem('token')) || null;
    }

    return (await AsyncStorage.getItem('studentToken')) ||
           (await AsyncStorage.getItem('userToken')) ||
           (await AsyncStorage.getItem('accessToken')) ||
           (await AsyncStorage.getItem('token')) ||
           (await AsyncStorage.getItem('adminToken')) ||
           (await AsyncStorage.getItem('schoolUserToken')) ||
           (await AsyncStorage.getItem('parentUserToken')) || null;
  } catch {
    return null;
  }
};

/**
 * Fetch with a timeout. Rejects if the request takes longer than timeoutMs.
 */
const fetchWithTimeout = (url, options, timeoutMs) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Request timed out. Please check your connection and try again.'));
    }, timeoutMs);

    fetch(url, options)
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
};

const apiFetch = async (endpoint, options = {}, attempt = 0) => {
  const token = await getStoredToken(endpoint);

  const headers = { ...(options.headers || {}) };

  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const isAuthEndpoint =
    endpoint.includes('/auth/login') ||
    endpoint.includes('/auth/signup') ||
    endpoint.includes('/auth/forgot-password');

  if (token && !isAuthEndpoint) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  let response;
  try {
    response = await fetchWithTimeout(url, { ...options, headers }, REQUEST_TIMEOUT_MS);
  } catch (networkErr) {
    // Retry once on network errors (timeout or connection failure)
    if (attempt < MAX_RETRIES) {
      return apiFetch(endpoint, options, attempt + 1);
    }
    throw networkErr;
  }

  if (response.status === 401 || response.status === 403) {
    const contentType = response.headers.get('content-type') || '';
    const errMsg = contentType.includes('application/json')
      ? (await response.json()).message || 'Unauthorized'
      : 'Unauthorized';
    if (!isAuthEndpoint) {
      await clearAuthAndRedirect();
    }
    const err = new Error(errMsg);
    err.status = response.status;
    throw err;
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const errMsg = contentType.includes('application/json')
      ? (await response.json()).message || response.statusText
      : response.statusText;
    const err = new Error(errMsg || 'An API error occurred');
    err.status = response.status;
    throw err;
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
};

export const api = {
  get: (endpoint) => apiFetch(endpoint),

  post: (endpoint, body) => {
    if (body instanceof FormData) {
      return apiFetch(endpoint, { method: 'POST', body, headers: {} });
    }
    return apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  put: (endpoint, body) => {
    if (body instanceof FormData) {
      return apiFetch(endpoint, { method: 'PUT', body, headers: {} });
    }
    return apiFetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  delete: (endpoint) => apiFetch(endpoint, { method: 'DELETE' }),
};

export default api;
