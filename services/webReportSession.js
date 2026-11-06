// services/webReportSession.js
//
// The session a website report page needs (6 Nov 2026), per portal. The report pages draw what
// the app hands them, but some of the website's report components still call an endpoint of
// their own — so the page gets the signed-in portal's token, and ONLY that portal's: the website
// picks a token by endpoint and falls back across every key it knows, so a stale key from another
// portal could answer for this one. The page's storage is cleared before these are written.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { readSchoolSession } from './schoolSession';

const STUDENT_KEYS = ['studentToken', 'userToken', 'accessToken', 'token'];

/** `{ key: value }` for the web page's localStorage. Never throws: no session is `{}`. */
export async function webSessionFor(portal) {
  try {
    if (portal === 'student') {
      const values = Object.fromEntries(await AsyncStorage.multiGet(STUDENT_KEYS));
      const token = STUDENT_KEYS.map((k) => values[k]).find(Boolean) || '';
      return token ? { studentToken: token, userToken: token, studentLoggedIn: 'true' } : {};
    }
    if (portal === 'parent') {
      const values = Object.fromEntries(
        await AsyncStorage.multiGet(['parentUserToken', 'parentUserVerified', 'linkedStudentName']),
      );
      return values.parentUserToken
        ? {
            parentUserToken: values.parentUserToken,
            parentLoggedIn: 'true',
            parentUserVerified: values.parentUserVerified || 'false',
            linkedStudentName: values.linkedStudentName || '',
          }
        : {};
    }
    if (portal === 'staff') {
      const session = await readSchoolSession();
      return session?.schoolUserToken
        ? {
            schoolUserToken: session.schoolUserToken,
            schoolLoggedIn: 'true',
            schoolUserType: session.schoolUserType || '',
            schoolUserVerified: session.schoolUserVerified || 'false',
            schoolCode: session.schoolCode || '',
          }
        : {};
    }
  } catch {
    // No session simply means the page draws only what it was handed.
  }
  return {};
}
