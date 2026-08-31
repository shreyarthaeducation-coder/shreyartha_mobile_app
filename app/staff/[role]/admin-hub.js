import StaffAttendanceHubScreen from '../../../components/staff/home/StaffAttendanceHubScreen';

/**
 * The destination for a descriptor hero that fronts several tiles rather than one — today only the
 * Principal's "Payroll & Leave Management" card, which covers two approver screens.
 *
 * ONE route, not one per hero, because expo-router needs a file per path and a nested dynamic
 * segment for the hero key would be a second dynamic level under `[role]`. `heroKey` is passed as a
 * literal instead: a role gains a multi-tile hero by naming `itemKeys` in its descriptor, and this
 * file stays as it is.
 *
 * Imported BY PATH, not through the components/staff barrel — expo-router scans every route file,
 * so a barrel import here is an app-wide import, which once boot-crashed the app.
 */
export default function StaffRoute() {
  return <StaffAttendanceHubScreen heroKey="hrAdmin" />;
}
