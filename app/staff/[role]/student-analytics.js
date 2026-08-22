import { useLocalSearchParams } from 'expo-router';
import { StudentAnalyticsScreen } from '../../../components/staff';

/**
 * My Students Analytics — a header action rather than a menu tab, in both portals.
 *
 * Reached through the TEACHER namespace, which SHREYARTHA_TEACHER implies; the web imports
 * MyStudentAnalytics into the Portal B dashboard unchanged for the same reason.
 */
export default function StaffStudentAnalytics() {
  const { role } = useLocalSearchParams();
  return <StudentAnalyticsScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
