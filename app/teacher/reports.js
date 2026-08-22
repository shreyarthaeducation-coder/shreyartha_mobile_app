import { ExamsScreen } from '../../components/staff';

/**
 * Native Test and Examination — exams, question papers, marks entry and per-student analysis.
 * Teachers cannot create or delete exams; those belong to the School Admin / Principal.
 */
export default function TeacherReports() {
  return <ExamsScreen homeRoute="/teacher" />;
}
