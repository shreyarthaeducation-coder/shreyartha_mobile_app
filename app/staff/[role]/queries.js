import { useLocalSearchParams } from 'expo-router';
import { QueriesScreen } from '../../../components/staff';
import { getCounsellorPortal } from '../../../constants/counsellorPortals';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';
import { ShreyarthaQueriesScreen } from '../../../components/staff/shreyartha/ShreyarthaAdminScreens';

/**
 * Queries — Shreyartha counsellor only.
 *
 * The route lives in the dynamic [role] group, so it is technically addressable by any staff role.
 * `hasQueries` gates it: another role that deep-links here gets nothing rather than a screen whose
 * every request would 403.
 */
export default function StaffQueries() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  // The Shreyartha Admin's Queries are every query, to assign — /api/shreyartha/admin (6 Nov 2026).
  if (getAdminPortal(roleKey)?.shreyarthaQueries) return <ShreyarthaQueriesScreen homeRoute={`/staff/${roleKey}`} />;
  const portal = getCounsellorPortal(roleKey);
  if (!portal?.hasQueries) return null;

  return <QueriesScreen homeRoute={`/staff/${roleKey}`} />;
}
