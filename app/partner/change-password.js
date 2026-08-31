import PartnerChangePasswordScreen from '../../components/partner/PartnerChangePasswordScreen';

/**
 * Change Password for a partner — by emailed reset link.
 *
 * There is no partner change-password endpoint; `PartnerAuthService.changePassword()` exists but no
 * controller calls it. See the header of the screen for what this posts to instead.
 *
 * By path, not through components/partner/index.js: a barrel import here is an app-wide import.
 */
export default function PartnerChangePassword() {
  return <PartnerChangePasswordScreen />;
}
