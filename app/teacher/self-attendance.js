import { SelfAttendanceScreen } from '../../components/staff';

/**
 * Native Self Attendance — thin wrapper over the shared staff screen.
 * Reads GET /api/teacher/self-attendance/sheet and writes POST .../mark.
 */
export default function TeacherSelfAttendance() {
  return <SelfAttendanceScreen homeRoute="/teacher" />;
}
