import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StaffProfileScreen } from '../../components/staff';
import { TAB_BAR_HEIGHT } from '../../components/shared/home/PortalTabBar';

/**
 * Native teacher profile — thin wrapper over the shared staff profile screen.
 * Reads GET /api/teacher/profile (TeacherProfileResponse), falling back to the values cached at
 * login so the screen still renders something useful offline.
 *
 * `bottomInset` is the teacher-only bit: this is one of the three footer tab roots, so its last
 * control would otherwise sit under the bar. The app/staff/[role] shells have no footer and pass
 * nothing.
 */
export default function TeacherProfile() {
  const insets = useSafeAreaInsets();
  return (
    <StaffProfileScreen
      endpoints={['/api/teacher/profile']}
      homeRoute="/teacher"
      roleLabel="Teacher"
      // Only the teacher panel gets the editable tabs; the app/staff/[role] shells stay read-only
      // until each role's web parity is checked.
      showAcademic
      showHr
      bottomInset={TAB_BAR_HEIGHT + (insets.bottom || 8)}
    />
  );
}
