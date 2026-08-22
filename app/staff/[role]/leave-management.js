import { useLocalSearchParams } from 'expo-router';
import { AdminLeaveScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

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
  const portal = getAdminPortal(roleKey);
  if (!portal?.hr) return null;

  return <AdminLeaveScreen homeRoute={`/staff/${roleKey}`} />;
}
