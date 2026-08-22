import { MarkAttendanceScreen } from '../../components/staff';

/**
 * Native Mark Attendance — thin wrapper over the shared staff screen.
 * Reads GET /api/teacher/attendance/{classes,sheet} and writes POST .../mark.
 */
export default function TeacherMarkAttendance() {
  return <MarkAttendanceScreen homeRoute="/teacher" />;
}
