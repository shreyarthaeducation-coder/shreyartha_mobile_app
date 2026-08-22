import { useLocalSearchParams } from 'expo-router';
import { MarkAttendanceScreen } from '../../../components/staff';
import { resolveFeatureScope } from '../../../constants/staffScope';

/**
 * Mark Attendance for every staff shell that has it.
 *
 * Portal A counsellor (`/api/counselor/attendance`) is an exact mirror of the teacher endpoints —
 * name-keyed sheet, same every-day-of-the-month `attendance` map, same upsert on /mark — so it is
 * the teacher screen with one namespace swapped.
 *
 * The Shreyartha counsellor (`/api/shreya01/counsellor/attendance`) and the Shreyartha teacher
 * (`/api/shreya01/attendance`) return the SAME response DTO but take **id-keyed requests** and a
 * School → Class scope with no academic year, so they swap the picker and the request builder as
 * well. See ATTENDANCE_ADAPTERS. Note the two Shreyartha portals do NOT share a scope endpoint —
 * each has its own, which is why the base comes from the resolver rather than a constant.
 */
export default function StaffAttendance() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const scope = resolveFeatureScope(roleKey, 'attendance');
  if (!scope) return null; // the layout guard has already redirected

  return (
    <MarkAttendanceScreen
      homeRoute={`/staff/${roleKey}`}
      apiBase={scope.apiBase}
      scopeKind={scope.scopeKind}
      schoolsEndpoint={scope.schoolsEndpoint}
    />
  );
}
