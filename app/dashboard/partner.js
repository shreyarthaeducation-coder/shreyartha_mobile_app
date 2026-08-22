import { Redirect } from 'expo-router';

/**
 * Legacy route. This file used to BE the partner portal — a single full-page WebView of
 * shreyartha.com/partner/platform/dashboard with the session injected into localStorage, forced to
 * a desktop viewport and a desktop user-agent.
 *
 * The panel is native now, so this only forwards. It stays rather than being deleted because
 * app/auth/partner-login.js and any stored deep link still point here.
 */
export default function PartnerDashboardRedirect() {
  return <Redirect href="/partner" />;
}
