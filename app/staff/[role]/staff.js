import { useLocalSearchParams } from 'expo-router';
import { StaffManagementScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/**
 * Staff Management — verify / unverify the school's own staff.
 *
 * The Overview screen deep-links here with `?type=TEACHER` etc.; the screen reads that param
 * itself, so nothing needs passing through here.
 */
export default function StaffManagement() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  // Guard on the KEY, not just the descriptor: SCHOOL_ADMIN_PORTALS now also holds a
  // vice_principal entry that carries HR only, so `portal` alone is truthy for a role that
  // has no verification base — and an undefined apiBase produces requests to "undefined/...".
  if (!portal?.verification) return null;

  return (
    <StaffManagementScreen homeRoute={`/staff/${roleKey}`} apiBase={portal.verification} />
  );
}
