// services/apiService.js
// Mirrors: frontendmain/src/services/apiService.js
// Adapted for React Native (AsyncStorage instead of localStorage)

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { router } from "expo-router";
import { ALL_AUTH_KEYS } from "../constants/storageKeys";

const resolveApiBaseUrl = () => {
  const fromExpoConfig =
    Constants?.expoConfig?.extra?.apiBaseUrl ||
    Constants?.manifest2?.extra?.expoClient?.extra?.apiBaseUrl ||
    Constants?.manifest?.extra?.apiBaseUrl;
  const fromEnv = process?.env?.EXPO_PUBLIC_API_BASE_URL;
  const rawBaseUrl = String(
    fromEnv || fromExpoConfig || "https://shreyartha.com",
  ).trim();
  return rawBaseUrl.replace(/\/+$/, "");
};

const API_BASE_URL = resolveApiBaseUrl();

const REQUEST_TIMEOUT_MS = 10000; // 10 seconds
const MAX_RETRIES = 1;
const REDIRECT_COOLDOWN_MS = 500;
let redirectingAfterAuthError = false;
let clearAuthRedirectPromise = null;

const normalizeStoredToken = (rawToken) => {
  if (!rawToken) return null;
  const token = String(rawToken)
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!token) return null;
  return token.replace(/^Bearer\s+/i, "").trim();
};

const clearAuthAndRedirect = async () => {
  if (clearAuthRedirectPromise) return clearAuthRedirectPromise;

  clearAuthRedirectPromise = (async () => {
    if (redirectingAfterAuthError) return;
    redirectingAfterAuthError = true;

    let userType = null;
    let hadToken = false;
    try {
      userType = await AsyncStorage.getItem("userType");
      // A 401 with no stored token means the user is already logged out — almost certainly
      // sitting on a login screen (a background fetch fired without credentials). Redirecting
      // "to login" would replace the login screen they are typing on, dropping the keyboard.
      const tokenKeys = [
        "schoolUserToken",
        "studentToken",
        "userToken",
        "accessToken",
        "parentUserToken",
        "partnerUserToken",
      ];
      const stored = await AsyncStorage.multiGet(tokenKeys);
      hadToken = stored.some(([, value]) => !!value);
    } catch {
      userType = null;
    }

    try {
      // Shared with AuthContext.logout — see constants/storageKeys.js. Previously this list and
      // AuthContext's were maintained separately and both were incomplete, so profile keys
      // (schoolUserName, schoolCode, schoolUserVerified…) survived into the next session.
      await AsyncStorage.multiRemove(ALL_AUTH_KEYS);
    } catch {
      // Ignore storage clear failures; we still want to force a login redirect.
    } finally {
      const authRouteByUserType = {
        school: "/auth/school-login",
        parent: "/auth/parent-login",
        partner: "/auth/partner-login",
      };
      const targetRoute =
        authRouteByUserType[userType] || "/auth/student-login";
      if (hadToken) {
        try {
          router.replace(targetRoute);
        } catch {
          // Ignore navigation errors if router is not ready yet.
        }
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
const getStoredToken = async (endpoint = "") => {
  try {
    if (
      endpoint.includes("/school/") ||
      endpoint.includes("/school-admin/") ||
      endpoint.includes("/shreyartha/") ||
      endpoint.includes("/shreya01/") ||
      endpoint.includes("/staff/") ||
      endpoint.includes("/teacher/") ||
      endpoint.includes("/counselor/") ||
      endpoint.includes("/principal/") ||
      endpoint.includes("/vice-principal/")
    ) {
      return normalizeStoredToken(
        (await AsyncStorage.getItem("schoolUserToken")) || null,
      );
    }

    if (endpoint.includes("/parent/")) {
      return normalizeStoredToken(
        (await AsyncStorage.getItem("parentUserToken")) || null,
      );
    }

    if (endpoint.includes("/partner/")) {
      return normalizeStoredToken(
        (await AsyncStorage.getItem("partnerUserToken")) || null,
      );
    }

    if (endpoint.includes("/students/")) {
      return normalizeStoredToken(
        (await AsyncStorage.getItem("studentToken")) ||
          (await AsyncStorage.getItem("userToken")) ||
          (await AsyncStorage.getItem("accessToken")) ||
          (await AsyncStorage.getItem("token")) ||
          null,
      );
    }

    return normalizeStoredToken(
      (await AsyncStorage.getItem("studentToken")) ||
        (await AsyncStorage.getItem("userToken")) ||
        (await AsyncStorage.getItem("accessToken")) ||
        (await AsyncStorage.getItem("token")) ||
        (await AsyncStorage.getItem("schoolUserToken")) ||
        (await AsyncStorage.getItem("parentUserToken")) ||
        (await AsyncStorage.getItem("partnerUserToken")) ||
        null,
    );
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
      reject(
        new Error(
          "Request timed out. Please check your connection and try again.",
        ),
      );
    }, timeoutMs);

    fetch(url, options)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

const buildApiError = (message, status) => {
  const resolvedMessage = message || "An API error occurred";
  const err = new Error(resolvedMessage);
  err.status = status;
  err.response = { status, data: { message: resolvedMessage } };
  return err;
};

const apiFetch = async (endpoint, options = {}, attempt = 0) => {
  const token = await getStoredToken(endpoint);

  const headers = { ...(options.headers || {}) };

  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const isAuthEndpoint =
    endpoint.includes("/auth/login") ||
    endpoint.includes("/auth/signup") ||
    endpoint.includes("/auth/forgot-password");

  if (token && !isAuthEndpoint) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  let response;
  try {
    response = await fetchWithTimeout(
      url,
      { ...options, headers },
      REQUEST_TIMEOUT_MS,
    );
  } catch (networkErr) {
    // Retry once on network errors (timeout or connection failure)
    if (attempt < MAX_RETRIES) {
      return apiFetch(endpoint, options, attempt + 1);
    }
    throw networkErr;
  }

  if (response.status === 401 || response.status === 403) {
    const contentType = response.headers.get("content-type") || "";
    const errMsg = contentType.includes("application/json")
      ? (await response.json()).message || "Unauthorized"
      : "Unauthorized";
    if (!isAuthEndpoint) {
      await clearAuthAndRedirect();
    }
    throw buildApiError(errMsg, response.status);
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const errMsg = contentType.includes("application/json")
      ? (await response.json()).message || response.statusText
      : response.statusText;
    throw buildApiError(errMsg, response.status);
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json")
    ? response.json()
    : response.text();
};

export const api = {
  get: (endpoint) => apiFetch(endpoint),

  post: (endpoint, body) => {
    if (body instanceof FormData) {
      return apiFetch(endpoint, { method: "POST", body, headers: {} });
    }
    return apiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  put: (endpoint, body) => {
    if (body instanceof FormData) {
      return apiFetch(endpoint, { method: "PUT", body, headers: {} });
    }
    return apiFetch(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  delete: (endpoint) => apiFetch(endpoint, { method: "DELETE" }),
};

export default api;
export { API_BASE_URL };
