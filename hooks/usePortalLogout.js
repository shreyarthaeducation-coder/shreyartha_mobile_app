import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

/**
 * Portal-aware logout: clear the session, then actually leave.
 *
 * `AuthContext.logout()` only wipes AsyncStorage — it does not navigate, and it cannot, because it
 * has no idea which portal the caller belongs to. Five screens were calling it bare
 * (PartnerMenuScreen, PartnerPendingScreen, ParentMenuScreen, ParentPendingScreen, StudentHome), so
 * tapping "Log out" emptied storage and left the user sitting on the same screen with a fully
 * rendered stale profile.
 *
 * The layout guards could not rescue it either: app/{partner,parent,student}/_layout.js each read
 * their token ONCE in a useEffect([]) and cache the result in state, so nothing re-evaluates after
 * the keys vanish. The redirect only arrived later, when some unrelated API call 401'd and
 * portalApi.handleExpiry fired — which is why logout felt like "nothing happened", followed some
 * time later by an unexplained bounce to a login screen.
 *
 * `beforeLogout` runs BEFORE the keys are cleared and is awaited. That ordering is not incidental:
 * the staff attendance end-ping is an authenticated request and needs the token this is about to
 * remove. Getting it backwards silently drops the staff member's checkout record. It runs inside
 * the same try as the logout so a failing hook can never strand the user in a half-signed-out
 * state — the navigation is in a `finally`.
 *
 * @param {object}   options
 * @param {string}   options.loginRoute    where to land, e.g. '/auth/partner-login'
 * @param {Function} [options.beforeLogout] awaited before the keys are cleared; failures are
 *                                          swallowed so they cannot block the logout
 * @returns {{ logoutNow: () => Promise<void>, confirmLogout: () => void, loggingOut: boolean }}
 */
export default function usePortalLogout({ loginRoute, beforeLogout } = {}) {
  const router = useRouter();
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!loginRoute) {
    // A missing route would silently reproduce the exact bug this hook exists to fix.
    throw new Error('usePortalLogout requires a loginRoute');
  }

  const logoutNow = useCallback(async () => {
    setLoggingOut(true);
    try {
      if (beforeLogout) {
        try {
          await beforeLogout(); // needs the token — must precede logout()
        } catch {
          // A failed pre-logout hook must not trap the user in the app.
        }
      }
      await logout();
    } finally {
      setLoggingOut(false);
      router.replace(loginRoute);
    }
  }, [logout, router, loginRoute, beforeLogout]);

  const confirmLogout = useCallback(() => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logoutNow },
    ]);
  }, [logoutNow]);

  return { logoutNow, confirmLogout, loggingOut };
}
