import TeacherCounsellingReportScreen from '../../components/teacher/TeacherCounsellingReportScreen';

/**
 * Counselling Report — Psychometric Result and Counsellor Report as two tabs (since 1 Oct 2026;
 * Counselling Needs and Notes is its own tile again). `?tab=psychometric|report` opens one directly;
 * `?tab=notes` is sent to /teacher/counselling, and the old Counsellor Report route redirects here.
 *
 * By path, not through a barrel: a barrel import here is an app-wide import, and expo-router scans
 * every route file.
 */
export default function TeacherCounsellingReport() {
  return <TeacherCounsellingReportScreen />;
}
