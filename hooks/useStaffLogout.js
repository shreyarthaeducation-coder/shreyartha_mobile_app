import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import usePortalLogout from './usePortalLogout';
import { endStaffAttendanceSession } from '../services/staffAttendanceService';
import { isShreyarthaRole } from '../constants/authPortals';

/**
 * Staff logout, mirroring the web dashboards' logout handler.
 *
 * A thin binding over {@link usePortalLogout} — this hook was the only logout in the app that
 * already did the right thing (confirm, end the attendance session, clear, then navigate), so it
 * became the template rather than being replaced. The staff-specific parts are the login route and
 * the attendance end-ping.
 *
 * Ordering still matters and is enforced by the generic hook: the attendance end-ping is
 * authenticated, so it MUST run before the auth keys are cleared. Getting this backwards silently
 * drops the staff member's checkout record.
 *
 * ── THE DOOR IS RESOLVED FROM THE ROLE ──────────────────────────────────────
 * This used to hard-code `/auth/school-login` for everyone, which dropped Shreyartha HQ staff and
 * sales reps at the partner-school door — the one whose wrong-door guard then refuses their
 * account. They had to spot the cross-link at the bottom of the form to get back in.
 *
 * That was a small annoyance while HQ accounts were verified the instant they were created. It is
 * not small any more: the pending screen is now where every newly registered HQ employee lands,
 * and the only control on it is Log Out.
 *
 * The route defaults to the school door until AsyncStorage answers, because the read is async and
 * {@link usePortalLogout} throws on a missing route. A logout tapped inside that first frame is the
 * rare case, and the cross-link still covers it.
 *
 * @returns {{ logoutNow: () => Promise<void>, confirmLogout: () => void, loggingOut: boolean }}
 */
export default function useStaffLogout() {
  const [loginRoute, setLoginRoute] = useState('/auth/sign-in');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('schoolUserType')
      .then((userType) => {
        // isShreyarthaRole covers the three SHREYARTHA_* roles AND sales, which is exactly the
        // cohort the employee door admits.
        if (active && isShreyarthaRole(userType)) setLoginRoute('/auth/employee-login');
      })
      .catch(() => {
        // Storage misbehaving must not strand anyone — the school door is the safe default.
      });
    return () => {
      active = false;
    };
  }, []);

  return usePortalLogout({
    loginRoute,
    beforeLogout: endStaffAttendanceSession,
  });
}
