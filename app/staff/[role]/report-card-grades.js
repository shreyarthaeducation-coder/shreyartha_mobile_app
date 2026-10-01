import { useLocalSearchParams } from 'expo-router';
import ReportCardGradesScreen from '../../../components/staff/admin/ReportCardGradesScreen';

/** Report Card Grades — what teachers have graded, read-only. See ReportCardAreas' route. */
export default function ReportCardGrades() {
  const { role } = useLocalSearchParams();
  return <ReportCardGradesScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
