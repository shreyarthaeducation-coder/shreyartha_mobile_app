import { useLocalSearchParams } from 'expo-router';
import { EventManagementScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/**
 * Events — create and delete school events.
 *
 * Needs BOTH bases: events themselves, and the classes list that fills the audience picker.
 * `targetClasses` is stored as class NAMES, not ids.
 */
export default function StaffEvents() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  // Guard on the KEY, not just the descriptor: SCHOOL_ADMIN_PORTALS now also holds a
  // vice_principal entry that carries HR only, so `portal` alone is truthy for a role that
  // has no events base — and an undefined apiBase produces requests to "undefined/...".
  if (!portal?.events) return null;

  return (
    <EventManagementScreen
      homeRoute={`/staff/${roleKey}`}
      apiBase={portal.events}
      classesBase={portal.classes}
    />
  );
}
