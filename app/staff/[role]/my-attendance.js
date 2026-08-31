import StaffAttendanceHubScreen from '../../../components/staff/home/StaffAttendanceHubScreen';

/**
 * Imported BY PATH, not through the components/staff barrel: expo-router scans every route file,
 * so a barrel import here is an app-wide import. The screen returns null for any role without a
 * constants/staffHome.js descriptor, which is how the not-yet-redesigned shells stay unaffected.
 */
export default function StaffRoute() {
  return <StaffAttendanceHubScreen />;
}
