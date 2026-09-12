import { useLocalSearchParams } from 'expo-router';
import { GradeManagementScreen } from '../../../components/staff';

/**
 * Grade Management — the grading scales this school marks against.
 *
 * Takes no API base. Unlike the class tree, /api/school-admin/grade-scales is one fixed path for
 * every role its guard admits, so there is nothing for a portal descriptor to vary.
 */
export default function GradeManagement() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  return <GradeManagementScreen homeRoute={`/staff/${roleKey}`} />;
}
