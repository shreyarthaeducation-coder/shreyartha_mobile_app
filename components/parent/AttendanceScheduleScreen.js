import ParentTabsScreen from './ParentTabsScreen';
import ParentCalendarScreen from './ParentCalendarScreen';

/**
 * Attendance & Schedule (4 Nov 2026): one section with two tabs, as on the website since its
 * 3 Nov restructure. Each tab is the calendar screen it used to be, `embedded`.
 */
export default function AttendanceScheduleScreen() {
  return (
    <ParentTabsScreen
      title="Attendance & Schedule"
      tabs={[
        { value: 'attendance', label: 'Attendance', render: () => <ParentCalendarScreen mode="attendance" embedded /> },
        { value: 'schedule', label: 'Schedule', render: () => <ParentCalendarScreen mode="schedule" embedded /> },
      ]}
    />
  );
}
