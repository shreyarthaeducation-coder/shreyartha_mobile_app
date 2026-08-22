import { useLocalSearchParams } from 'expo-router';
import { SelfAttendanceScreen } from '../../../components/staff';

/**
 * Self Attendance for any staff shell.
 *
 * Reused verbatim from the teacher panel: `/api/teacher/self-attendance/*` is guarded
 * `hasAnyRole('TEACHER','COUNSELOR','PRINCIPAL','VICE_PRINCIPAL','SCHOOL_ADMIN', …)`, so the
 * teacher-shaped path serves every role. The web does the same — CounselorDashboard imports
 * TeacherSelfAttendance directly.
 */
export default function StaffSelfAttendance() {
  const { role } = useLocalSearchParams();
  return <SelfAttendanceScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
