import { ParentChangePasswordScreen } from '../../components/parent';

/**
 * Change Password — a header action, as on the web, not a sidebar item.
 * Reachable before verification: /api/parent/change-password is the one endpoint that names
 * UNVERIFIED_PARENT.
 */
export default function ParentChangePassword() {
  return <ParentChangePasswordScreen />;
}
