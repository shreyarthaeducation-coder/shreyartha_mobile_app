import usePortalLogout from './usePortalLogout';
import { endStaffAttendanceSession } from '../services/staffAttendanceService';

/**
 * Staff logout, mirroring the web dashboards' logout handler.
 *
 * Now a thin binding over {@link usePortalLogout} — this hook was the only logout in the app that
 * already did the right thing (confirm, end the attendance session, clear, then navigate), so it
 * became the template rather than being replaced. The staff-specific parts are the login route and
 * the attendance end-ping.
 *
 * Ordering still matters and is enforced by the generic hook: the attendance end-ping is
 * authenticated, so it MUST run before the auth keys are cleared. Getting this backwards silently
 * drops the staff member's checkout record.
 *
 * @returns {{ logoutNow: () => Promise<void>, confirmLogout: () => void, loggingOut: boolean }}
 */
export default function useStaffLogout() {
  return usePortalLogout({
    loginRoute: '/auth/school-login',
    beforeLogout: endStaffAttendanceSession,
  });
}
