import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SelfAttendanceScreen } from '../../components/staff';
import { TAB_BAR_HEIGHT } from '../../components/shared/home/PortalTabBar';

/**
 * Native Self Attendance — thin wrapper over the shared staff screen.
 * Reads GET /api/teacher/self-attendance/sheet and writes POST .../mark.
 *
 * This is a TAB ROOT for the teacher (it replaced the centre (+) button), so it must clear the
 * footer the layout paints over it. The five `app/staff/[role]` shells render the same screen from
 * a menu, with no bar above it, and pass no inset.
 */
export default function TeacherSelfAttendance() {
  const insets = useSafeAreaInsets();
  return (
    <SelfAttendanceScreen
      homeRoute="/teacher"
      bottomInset={TAB_BAR_HEIGHT + (insets.bottom || 8)}
    />
  );
}
