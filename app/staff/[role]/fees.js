import { useLocalSearchParams } from 'expo-router';
import { FeeManagementScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/**
 * Fee Management.
 *
 * ── THE GUARD IS LOAD-BEARING, NOT DEFENSIVE ─────────────────────────────────
 * `SchoolAdminFeeController` is `hasRole('SCHOOL_ADMIN')` on every method. A Principal passes via
 * the role hierarchy; a Vice Principal does NOT (VICE_PRINCIPAL implies only TEACHER), so the VP
 * descriptor deliberately carries no `fees` key and a VP deep-linking here gets nothing rather than
 * a screen that 403s on every call.
 *
 * `apiBase` is the CLASSES base, not a fee base: the assign-students picker reads the roster from
 * /api/school-admin/classes/students.
 */
export default function FeeManagement() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  if (!portal?.fees) return null;

  return (
    <FeeManagementScreen
      homeRoute={`/staff/${roleKey}`}
      apiBase={portal.classes}
      initialTab={typeof view === 'string' ? view : undefined}
    />
  );
}
