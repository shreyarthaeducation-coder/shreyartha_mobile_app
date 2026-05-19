// services/apiService.js
// Mirrors: frontendmain/src/services/apiService.js
// Adapted for React Native (AsyncStorage instead of localStorage)

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';

const resolveApiBaseUrl = () => {
  const fromExpoConfig =
    Constants?.expoConfig?.extra?.apiBaseUrl ||
    Constants?.manifest2?.extra?.expoClient?.extra?.apiBaseUrl ||
    Constants?.manifest?.extra?.apiBaseUrl;
  const fromEnv = process?.env?.EXPO_PUBLIC_API_BASE_URL;
  const rawBaseUrl = String(fromEnv || fromExpoConfig || 'https://shreyartha.com').trim();
  return rawBaseUrl.replace(/\/+$/, '');
};

const API_BASE_URL = resolveApiBaseUrl();

const REQUEST_TIMEOUT_MS = 10000; // 10 seconds
const MAX_RETRIES = 1;
const REDIRECT_COOLDOWN_MS = 500;
let redirectingAfterAuthError = false;
let clearAuthRedirectPromise = null;

const normalizeStoredToken = (rawToken) => {
  if (!rawToken) return null;
  const token = String(rawToken).trim().replace(/^["']|["']$/g, '');
  if (!token) return null;
  return token.replace(/^Bearer\s+/i, '').trim();
};

const clearAuthAndRedirect = async () => {
  if (clearAuthRedirectPromise) return clearAuthRedirectPromise;

  clearAuthRedirectPromise = (async () => {
    if (redirectingAfterAuthError) return;
    redirectingAfterAuthError = true;

    let userType = null;
    try {
      userType = await AsyncStorage.getItem('userType');
    } catch {
      userType = null;
    }

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
      // Ignore storage clear failures; we still want to force a login redirect.
    } finally {
      const authRouteByUserType = {
        admin: '/auth/admin-login',
        school: '/auth/school-login',
        parent: '/auth/parent-login',
      };
      const targetRoute = authRouteByUserType[userType] || '/auth/student-login';
      try {
        router.replace(targetRoute);
      } catch {
        // Ignore navigation errors if router is not ready yet.
      }
      setTimeout(() => {
        redirectingAfterAuthError = false;
      }, REDIRECT_COOLDOWN_MS);
    }
  })();

  try {
    await clearAuthRedirectPromise;
  } finally {
    clearAuthRedirectPromise = null;
  }
};

/**
 * Get stored token — checks all possible token storage locations.
 * Uses the endpoint to determine which token to prioritize.
 */
const getStoredToken = async (endpoint = '') => {
  try {
    if (endpoint.includes('/admin/')) {
      return normalizeStoredToken((await AsyncStorage.getItem('adminToken')) ||
             (await AsyncStorage.getItem('userToken')) || null;
    }

    if (
      endpoint.includes('/school/') ||
      endpoint.includes('/teacher/') ||
      endpoint.includes('/counselor/') ||
      endpoint.includes('/principal/') ||
      endpoint.includes('/vice-principal/')
    ) {
      return normalizeStoredToken((await AsyncStorage.getItem('schoolUserToken')) || null);
    }

    if (endpoint.includes('/parent/')) {
      return normalizeStoredToken((await AsyncStorage.getItem('parentUserToken')) || null);
    }

    if (endpoint.includes('/students/')) {
      return normalizeStoredToken((await AsyncStorage.getItem('studentToken')) ||
             (await AsyncStorage.getItem('userToken')) ||
             (await AsyncStorage.getItem('accessToken')) ||
             (await AsyncStorage.getItem('token')) || null);
    }

    return normalizeStoredToken((await AsyncStorage.getItem('studentToken')) ||
            (await AsyncStorage.getItem('userToken')) ||
            (await AsyncStorage.getItem('accessToken')) ||
            (await AsyncStorage.getItem('token')) ||
            (await AsyncStorage.getItem('adminToken')) ||
            (await AsyncStorage.getItem('schoolUserToken')) ||
            (await AsyncStorage.getItem('parentUserToken')) || null);
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
export { API_BASE_URL };
