import { CounsellorReportScreen } from '../../components/staff';

/** Native Counsellor Report — read-only; teachers can view but never author these. */
export default function TeacherCounsellorReport() {
  return <CounsellorReportScreen homeRoute="/teacher" />;
}
