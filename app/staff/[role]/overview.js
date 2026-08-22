import { useLocalSearchParams } from 'expo-router';
import { AdminOverviewScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/**
 * Dashboard Overview — the admin-flavoured shells' landing page.
 *
 * The web reaches this at the dashboard root (`path: ''` in the menu), which has no native
 * equivalent: `/staff/[role]` is already the menu grid. So it gets its own route and the menu
 * points at it like any other tile.
 */
export default function StaffOverview() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  // Guard on the KEY, not just the descriptor: SCHOOL_ADMIN_PORTALS now also holds a
  // vice_principal entry that carries HR only, so `portal` alone is truthy for a role that
  // has no classes base — and an undefined apiBase produces requests to "undefined/...".
  if (!portal?.classes) return null;

  return (
    <AdminOverviewScreen
      homeRoute={`/staff/${roleKey}`}
      apiBase={portal.classes}
      staffRoute={`/staff/${roleKey}/staff`}
      studentsRoute={`/staff/${roleKey}/students`}
    />
  );
}
