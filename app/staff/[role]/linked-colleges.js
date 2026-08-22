import { useLocalSearchParams } from 'expo-router';
import { LinkedCollegesScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/**
 * Linked Colleges — read plus a visibility switch. Linking itself is the platform admin's job,
 * so there is deliberately no create or delete here.
 */
export default function StaffLinkedColleges() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  // Guard on the KEY, not just the descriptor: SCHOOL_ADMIN_PORTALS now also holds a
  // vice_principal entry that carries HR only, so `portal` alone is truthy for a role that
  // has no linkedUniversities base — and an undefined apiBase produces requests to "undefined/...".
  if (!portal?.linkedUniversities) return null;

  return (
    <LinkedCollegesScreen
      homeRoute={`/staff/${roleKey}`}
      apiBase={portal.linkedUniversities}
    />
  );
}
