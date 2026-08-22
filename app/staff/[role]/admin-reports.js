import { useLocalSearchParams } from 'expo-router';
import { AdminExamsScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/**
 * Test and Examination — the ADMIN screen, not the teacher's.
 *
 * NOTE the route name clash: `reports.js` already serves the VICE PRINCIPAL with the teacher's
 * ExamsScreen. The two roles need different screens on the same sidebar label, so the principal's
 * lives at `admin-reports`. Pointing the principal at `reports` would give it a screen scoped to
 * one teacher's own classes, with no create, edit or visibility control.
 */
export default function AdminReports() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  // Guard on the KEY, not just the descriptor: SCHOOL_ADMIN_PORTALS now also holds a
  // vice_principal entry that carries HR only, so `portal` alone is truthy for a role that
  // has no reports base — and an undefined apiBase produces requests to "undefined/...".
  if (!portal?.reports) return null;

  return (
    <AdminExamsScreen
      homeRoute={`/staff/${roleKey}`}
      apiBase={portal.reports}
      classesBase={portal.classes}
    />
  );
}
