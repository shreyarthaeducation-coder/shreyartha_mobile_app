import { StudentAnalyticsScreen } from '../../components/staff';

/** Native My Students Analytics — reached from the header chip, not the sidebar. */
export default function TeacherStudentAnalytics() {
  return <StudentAnalyticsScreen homeRoute="/teacher" />;
}
