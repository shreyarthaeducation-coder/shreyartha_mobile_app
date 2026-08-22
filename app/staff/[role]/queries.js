import { useLocalSearchParams } from 'expo-router';
import { QueriesScreen } from '../../../components/staff';
import { getCounsellorPortal } from '../../../constants/counsellorPortals';

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
  const portal = getCounsellorPortal(roleKey);
  if (!portal?.hasQueries) return null;

  return <QueriesScreen homeRoute={`/staff/${roleKey}`} />;
}
