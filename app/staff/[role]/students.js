import { useLocalSearchParams } from 'expo-router';
import { StudentManagementScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/** Student Management — read-only roster plus the Academic IQ change log. */
export default function StudentManagement() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  // Guard on the KEY, not just the descriptor: SCHOOL_ADMIN_PORTALS now also holds a
  // vice_principal entry that carries HR only, so `portal` alone is truthy for a role that
  // has no classes base — and an undefined apiBase produces requests to "undefined/...".
  if (!portal?.classes) return null;

  return (
    <StudentManagementScreen homeRoute={`/staff/${roleKey}`} apiBase={portal.classes} />
  );
}
