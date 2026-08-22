import { Redirect } from 'expo-router';

/**
 * Legacy route. This file used to BE the parent portal — a single full-page WebView of
 * shreyartha.com with the session injected into localStorage.
 *
 * The panel is native now, so this only forwards. It stays rather than being deleted because the
 * login screen and any stored deep link still point here.
 */
export default function ParentDashboardRedirect() {
  return <Redirect href="/parent" />;
}
