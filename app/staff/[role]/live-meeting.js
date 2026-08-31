import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StaffMeetingScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';
import { TAB_BAR_HEIGHT, staffTabsFor } from '../../../components/shared/home/PortalTabBar';

/**
 * Live Meeting — staff-attendee Google Meet sessions.
 *
 * The endpoint lives at /api/school/staff-meetings, NOT under /api/school-admin, which is why
 * the descriptor keeps `meetings` as its own key.
 */
export default function StaffMeetings() {
  const { role } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  // Guard on the KEY, not just the descriptor: SCHOOL_ADMIN_PORTALS now also holds a
  // vice_principal entry that carries HR only, so `portal` alone is truthy for a role that
  // has no meetings base — and an undefined apiBase produces requests to "undefined/...".
  if (!portal?.meetings) return null;

  // Padded only for a role whose footer actually renders — derived from the SAME tab list the
  // layout tests with `isTabRoot`, so a role that loses its footer loses the padding with it
  // rather than keeping a strip of dead space at the bottom of the screen.
  return (
    <StaffMeetingScreen
      homeRoute={`/staff/${roleKey}`}
      apiBase={portal.meetings}
      bottomInset={staffTabsFor(roleKey).length ? TAB_BAR_HEIGHT + (insets.bottom || 8) : 0}
    />
  );
}
