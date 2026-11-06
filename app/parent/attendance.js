import { Redirect } from 'expo-router';

/** Attendance is a tab of Attendance & Schedule now (4 Nov 2026); old links land on it. */
export default function ParentAttendance() {
  return <Redirect href="/parent/attendance-schedule?tab=attendance" />;
}
