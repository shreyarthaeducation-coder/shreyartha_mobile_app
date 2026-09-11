import StaffAuthScreen from '../../components/auth/StaffAuthScreen';

/**
 * The Shreyartha employee door: Shreyartha Admin, Shreyartha Councellor, Shreyartha Teacher and
 * Sales — the four roles that sit under SHREYA01 rather than under a partner school.
 *
 * Mirrors the website's /employeelogin, which is the same component as /schoollogin with a
 * different variant. Note that the LOGIN endpoint is identical for both doors
 * (`/api/school/auth/login`); what differs is the signup role list and the wrong-door guard.
 *
 * Sales is here even though it registers through the ORDINARY school signup endpoint and waits for
 * admin approval — the door is about who the person works for, not about which endpoint mints the
 * account. `requiresSignupCode` is what decides the latter, and it deliberately excludes SALES.
 */
export default function EmployeeLoginScreen() {
  return <StaffAuthScreen variant="employee" />;
}
