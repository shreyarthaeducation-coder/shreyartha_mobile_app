import { useLocalSearchParams } from 'expo-router';
import { StaffMeetingScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/**
 * Live Meeting — staff-attendee Google Meet sessions.
 *
 * The endpoint lives at /api/school/staff-meetings, NOT under /api/school-admin, which is why
 * the descriptor keeps `meetings` as its own key.
 */
export default function StaffMeetings() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  // Guard on the KEY, not just the descriptor: SCHOOL_ADMIN_PORTALS now also holds a
  // vice_principal entry that carries HR only, so `portal` alone is truthy for a role that
  // has no meetings base — and an undefined apiBase produces requests to "undefined/...".
  if (!portal?.meetings) return null;

  return <StaffMeetingScreen homeRoute={`/staff/${roleKey}`} apiBase={portal.meetings} />;
}
