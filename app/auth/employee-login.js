import StaffAuthScreen from '../../components/auth/StaffAuthScreen';

/**
 * The Shreyartha employee door: Shreyartha Admin, Shreyartha Councellor, Shreyartha Teacher and
 * Sales — the four roles that sit under SHREYA01 rather than under a partner school.
 *
 * Mirrors the website's /employeelogin, which is the same component as /schoollogin with a
 * different variant. Note that the LOGIN endpoint is identical for both doors
 * (`/api/school/auth/login`); what differs is the signup role list and the wrong-door guard.
 *
 * Every role behind this door registers through the ordinary school signup endpoint, gives the
 * shared Shreyartha signup code (`requiresSignupCode`) and is active on submission — sales included,
 * since 18 Sept 2026. The door is about who the person works for, not about which endpoint mints the
 * account.
 *
 * HR is missing on purpose: its portal is website-only, so the app offers no door into it yet.
 */
export default function EmployeeLoginScreen() {
  return <StaffAuthScreen variant="employee" />;
}
