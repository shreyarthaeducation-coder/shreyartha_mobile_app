import { useLocalSearchParams } from 'expo-router';
import { StaffAttendanceScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/**
 * Staff Attendance — school-wide login sessions, READ-ONLY.
 *
 * The web's settings panel and override cells sit behind a flag comparing `schoolUserType` to
 * "ROLE_SCHOOL_ADMIN", a value that field never holds, so nobody reaches them there either.
 * See services/admin/adminAttendanceService.js.
 */
export default function StaffAttendance() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  // Guard on the KEY, not just the descriptor: SCHOOL_ADMIN_PORTALS now also holds a
  // vice_principal entry that carries HR only, so `portal` alone is truthy for a role that
  // has no staffAttendance base — and an undefined apiBase produces requests to "undefined/...".
  if (!portal?.staffAttendance) return null;

  return (
    <StaffAttendanceScreen homeRoute={`/staff/${roleKey}`} apiBase={portal.staffAttendance} />
  );
}
