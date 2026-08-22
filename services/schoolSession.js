import AsyncStorage from '@react-native-async-storage/async-storage';
import { SCHOOL_SESSION_KEYS } from '../constants/storageKeys';
import { isShreyarthaRole, SHREYARTHA_SCHOOL_CODE } from '../constants/authPortals';
import { getStaffRoleConfig } from '../constants/staffRoles';

/**
 * School-staff session persistence and post-login routing.
 *
 * Kept out of the screen so the parent/student login ports have a template to copy, and so the
 * exact key set stays next to the WebView injection that depends on it.
 */

/**
 * Persist a successful school-staff login.
 *
 * Writes the same seven keys the web portal writes (frontendmain/src/School/SchoolAuth.js), which
 * is what app/teacher/feature.js later injects into the WebView so the web route guard accepts
 * the session — plus the two mobile-only keys AuthContext reads.
 *
 * @param {object} data the `data` object from POST /api/school/auth/login
 * @returns {Promise<{role:string, verified:boolean, schoolCode:string}>}
 */
export async function storeSchoolSession(data = {}) {
  const userType = data.userType || '';
  const resolvedSchoolCode = isShreyarthaRole(userType)
    ? SHREYARTHA_SCHOOL_CODE
    : (data.schoolCode ?? '');

  // Match the web exactly: an absent `verified` flag means NOT verified. The previous mobile
  // code defaulted the other way (`verified === false ? 'false' : 'true'`), which let an
  // unverified teacher slip past the pending-verification gate.
  const verified = data.verified ?? false;

  await AsyncStorage.multiSet([
    ['schoolUserToken', data.token],
    ['schoolLoggedIn', 'true'],
    ['schoolUserType', userType],
    ['schoolUserVerified', String(verified)],
    ['schoolUserName', data.fullName ?? 'User'],
    ['schoolUserEmail', data.email ?? ''],
    ['schoolCode', resolvedSchoolCode],
    // Mobile-only: AuthContext keys off these.
    ['userType', 'school'],
    ['userData', JSON.stringify(data)],
  ]);

  return {
    role: String(userType).toLowerCase(),
    verified: verified === true,
    schoolCode: resolvedSchoolCode,
  };
}

/** Read the session keys the WebView needs injected, as a plain object. */
export async function readSchoolSession() {
  const pairs = await AsyncStorage.multiGet(SCHOOL_SESSION_KEYS);
  return pairs.reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}

/**
 * Where a staff member lands after login.
 *
 * Teacher keeps its dedicated group; every other known role gets the config-driven native shell
 * at /staff/[role] (constants/staffRoles.js). Returns null for a role with no shell — the login
 * screen shows an error instead of navigating (ADMIN is already blocked before this point).
 */
export function resolveDashboardRoute(userType, verified) {
  const role = String(userType || '').toLowerCase();
  if (role === 'teacher') {
    return verified ? '/teacher' : '/teacher/pending-verification';
  }
  if (getStaffRoleConfig(role)) {
    return verified ? `/staff/${role}` : `/staff/${role}/pending-verification`;
  }
  return null;
}
