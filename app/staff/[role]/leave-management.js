import { useLocalSearchParams } from 'expo-router';
import { AdminLeaveScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';
import { HR_PORTAL } from '../../../services/admin/hrAdminService';

/**
 * Leave Management — the APPROVER queue, not the staff member's own leave.
 *
 * Named `leave-management` rather than `leave` because `leave.js` already exists in this folder and
 * is the SELF-SERVICE screen on `/api/staff/hr` for the two teacher panels. Two different
 * audiences, two namespaces; the route names keep them apart.
 *
 * Principal and Vice Principal both reach it — `SchoolAdminHrController` is
 * `hasAnyRole('SCHOOL_ADMIN','VICE_PRINCIPAL')` and PRINCIPAL implies SCHOOL_ADMIN.
 */
export default function AdminLeaveManagement() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  // HR (5 Nov 2026): the same screen on the HR portal's namespace, whose leave verbs are identical —
  // the website hands its leave page `hrPortalApi` for that reason. HR is not SCHOOL_ADMIN, so the
  // school-admin namespace would 403 for it.
  if (roleKey === 'hr') return <AdminLeaveScreen homeRoute="/staff/hr" apiBase={HR_PORTAL} />;
  const portal = getAdminPortal(roleKey);
  if (!portal?.hr) return null;

  return <AdminLeaveScreen homeRoute={`/staff/${roleKey}`} />;
}
