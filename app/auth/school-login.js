import StaffAuthScreen from '../../components/auth/StaffAuthScreen';

/**
 * The partner-school staff door: Teacher, Counselor, Principal, Vice Principal, School Admin.
 *
 * Thin on purpose. The screen is shared with /auth/employee-login and lives in
 * components/auth/StaffAuthScreen.js — two routes, one implementation, exactly as the website
 * renders /schoollogin and /employeelogin from one SchoolAuth component.
 *
 * The four Shreyartha (SHREYA01) roles are NOT here any more. They moved to the employee door
 * because having all nine in one signup dropdown is what had school teachers registering as
 * Shreyartha teachers. A staff member who signs in at the wrong door is told which one is theirs
 * and nothing is persisted — see the wrong-door guard in StaffAuthScreen.
 */
export default function SchoolLoginScreen() {
  return <StaffAuthScreen variant="school" />;
}
