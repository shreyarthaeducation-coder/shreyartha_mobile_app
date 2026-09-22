import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_AUTH_KEYS } from '../constants/storageKeys';
import { resolveDashboardRoute, storeSchoolSession } from './schoolSession';

/**
 * Turns a sign-in response into a stored session and a destination.
 *
 * The single gate at `POST /api/auth/sign-in` answers `{ portal, data }`, where `data` is produced
 * by that role's own login service — the very same payload its dedicated screen has always
 * received. So all that is left is what that screen used to do next: clear the previous session,
 * write its keys, and name its route.
 *
 * <h2>The clear comes first, and it is not optional</h2>
 * Every panel's route guard admits on the mere PRESENCE of its own token, so a leftover
 * `schoolUserToken` from a force-closed session would open the previous teacher's panel without a
 * password. `ALL_AUTH_KEYS` is cleared after the token is in hand — never on submit, which would
 * end a working session just because somebody mistyped.
 *
 * <h2>On drift</h2>
 * The four per-role screens still carry the same writes, because they still work and are still how
 * people register. If you change what a portal stores, change it in both places.
 *
 * @returns {Promise<{route: string, userType: string}>}
 */
export async function applyPortalSession(portal, data) {
  switch (portal) {
    case 'STUDENT': {
      const token = data?.token;
      if (!token) throw new Error('Authentication failed. Please try again.');
      await AsyncStorage.multiRemove(ALL_AUTH_KEYS);
      await AsyncStorage.multiSet([
        ['studentToken', token],
        ['userToken', token],
        ['accessToken', token],
        ['token', token],
        ['studentLoggedIn', 'true'],
        ['studentRole', data.roles?.[0] || 'STUDENT'],
        ['userType', 'student'],
        ['userData', JSON.stringify({ id: data.id, email: data.email, roles: data.roles })],
      ]);
      return { route: '/student/', userType: 'student' };
    }

    case 'SCHOOL': {
      // A school account whose role this app has no panel for must be refused BEFORE anything is
      // stored — otherwise the person is left signed in to nothing. StaffAuthScreen makes the same
      // check for the same reason.
      const route = resolveDashboardRoute(data?.userType, data?.verified === true);
      if (!resolveDashboardRoute(data?.userType, true)) {
        return { route: null, userType: 'school', unsupported: true };
      }
      // storeSchoolSession owns the clear AND the ordering around the attendance key — do not
      // inline it here, the ordering is load-bearing (see its own note).
      await storeSchoolSession(data);
      return { route, userType: 'school' };
    }

    case 'PARENT': {
      if (!data?.token) throw new Error('Login failed. Please try again.');
      await AsyncStorage.multiRemove(ALL_AUTH_KEYS);
      await AsyncStorage.multiSet([
        ['parentUserToken', data.token],
        ['parentLoggedIn', 'true'],
        // FAIL CLOSED — `=== true`, not `!== false`. See app/auth/parent-login.js for why.
        ['parentUserVerified', data.verified === true ? 'true' : 'false'],
        ['parentUserName', data.fullName || ''],
        // The only source of the parent's email anywhere; there is no GET /api/parent/me.
        ['parentUserEmail', data.email || ''],
        ['linkedStudentName', data.studentName || ''],
        ['linkedStudentEmail', data.studentEmail || ''],
        ['userType', 'parent'],
        ['userData', JSON.stringify(data)],
      ]);
      return { route: '/parent', userType: 'parent' };
    }

    case 'PARTNER': {
      if (!data?.token) throw new Error('Login failed. Please try again.');
      await AsyncStorage.multiRemove(ALL_AUTH_KEYS);
      await AsyncStorage.multiSet([
        ['partnerUserToken', data.token],
        ['partnerLoggedIn', 'true'],
        ['partnerUserVerified', data.verified === false ? 'false' : 'true'],
        ['partnerUserType', data.partnerType || ''],
        ['partnerUserName', data.fullName || ''],
        ['partnerUserEmail', data.email || ''],
        ['partnerCode', data.partnerCode || ''],
        ['userType', 'partner'],
        ['userData', JSON.stringify(data)],
      ]);
      return { route: '/dashboard/partner', userType: 'partner' };
    }

    // INVESTOR, UNIVERSITY and ALUMNI authenticate fine — the server serves all seven — but this
    // app has no screens for them. Saying so is better than storing a session that opens nothing.
    default:
      return { route: null, userType: null, unsupported: true };
  }
}

/** A person-facing name for a portal the app cannot open. */
export function portalLabel(portal) {
  switch (portal) {
    case 'INVESTOR': return 'Investor';
    case 'UNIVERSITY': return 'University';
    case 'ALUMNI': return 'Alumni';
    default: return 'that';
  }
}
