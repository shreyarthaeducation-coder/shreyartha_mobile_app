import { useLocalSearchParams } from 'expo-router';
import { MyCalendarScreen } from '../../../components/staff';

/**
 * My Calendar for any staff shell — `/api/staff/events/calendar` and
 * `/api/staff/attendance/calendar` are role-agnostic by design (StaffMyCalendar serves six web
 * dashboards), so this needs no portal descriptor at all.
 */
export default function StaffMyCalendar() {
  const { role } = useLocalSearchParams();
  return <MyCalendarScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
