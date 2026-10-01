import { useLocalSearchParams } from 'expo-router';
// By path, not through a barrel: in this repo a barrel import is an app-wide import.
import TeacherCounsellingReportScreen from '../../../components/teacher/TeacherCounsellingReportScreen';
import { resolveFeatureScope } from '../../../constants/staffScope';

/**
 * Counselling Report — the teacher's screen (Psychometric Result + Counsellor Report tabs), for the
 * vice principal, whose web panel mounts the teacher's page beside Counselling Needs and Notes
 * (1 Oct 2026). The VP reads the same /api/teacher endpoints through VICE_PRINCIPAL implies TEACHER.
 *
 * Only a role whose descriptor names `counsellingReport` gets it; the counsellor roles author
 * reports at counsellor-report instead.
 */
export default function StaffCounsellingReport() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  if (!resolveFeatureScope(roleKey, 'counsellingReport')) return null; // the layout guard has already redirected

  return (
    <TeacherCounsellingReportScreen
      homeRoute={`/staff/${roleKey}`}
      notesRoute={`/staff/${roleKey}/counselling`}
    />
  );
}
