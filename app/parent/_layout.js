import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PORTALS } from '../../constants/theme';
import { PaletteProvider } from '../../components/ui/PaletteContext';

/**
 * Route guard and theme host for the native parent panel — the parent counterpart of
 * app/student/_layout.js and app/staff/[role]/_layout.js.
 *
 * PURPLE. `Parent/ParentAuth.css` and `ParentDashboard.css` are both `#6b21a8`/`#9333ea`, which is
 * what PORTALS.parent already holds. The partner portal is the *same* purple on the web, so both
 * portals share this palette deliberately — see constants/theme.js.
 *
 * VERIFICATION IS CHECKED HERE, AND THE STORED FLAG IS NO LONGER STALE.
 *
 * This layout used to skip the check on the grounds that the web's stored `parentUserVerified` is
 * written once at login and never refreshed, while the menu screen "re-derives it from the live
 * `/linked-student` response". That reasoning did not hold up: `ParentDashboardService` hardcodes
 * `response.setParentVerified(true)` — the only occurrence in the backend — and throws before
 * reaching it when the account is unverified. The field can never say `false`, so the menu screen
 * was falling back to the same stored flag it was supposed to be replacing, and the other twelve
 * routes in this group had no gate at all.
 *
 * `ParentMenuScreen` now treats the **403** as the signal and writes the answer back, so the stored
 * flag is refreshed on every visit to the dashboard and this gate can safely read it. A network
 * failure deliberately writes nothing, so a flaky connection cannot lock anyone out.
 *
 * Nothing here is load-bearing for data safety — an unverified parent holds ROLE_UNVERIFIED_PARENT,
 * so `@PreAuthorize("hasRole('PARENT')")` already 403s every dashboard endpoint. This stops them
 * reaching screens that would render as empty shells.
 */

const PALETTE = PORTALS.parent;

/**
 * The three routes an unverified parent may still open. Every other route in this group redirects
 * to the pending screen.
 *
 *   /parent                       the dashboard is what REFRESHES the stored flag, so gating it
 *                                 here would mean a parent verified mid-session could never reach
 *                                 the one screen able to notice. It carries its own redirect to the
 *                                 pending screen once it has a definite answer.
 *   /parent/pending-verification  the destination; gating it would loop.
 *   /parent/change-password       genuinely works before verification — `ParentAccountController`
 *                                 is the one endpoint that names UNVERIFIED_PARENT — and the
 *                                 pending screen's own button pushes here.
 */
const UNVERIFIED_OK = new Set([
  '/parent',
  '/parent/pending-verification',
  '/parent/change-password',
]);

export default function ParentLayout() {
  const [state, setState] = useState({ checking: true, token: null, verified: false });
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;

    (async () => {
      let values = {};
      try {
        const entries = await AsyncStorage.multiGet(['parentUserToken', 'parentUserVerified']);
        values = Object.fromEntries(entries);
      } catch {
        // Fall through with nothing — treated as "no session".
      }
      if (!alive) return;
      const token = values.parentUserToken;
      setState({
        checking: false,
        token: token && String(token).trim() ? token : null,
        verified: values.parentUserVerified === 'true' || values.parentUserVerified === '1',
      });
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (state.checking) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={PALETTE.primary} />
      </View>
    );
  }

  if (!state.token) return <Redirect href="/auth/parent-login" />;

  if (!state.verified && !UNVERIFIED_OK.has(pathname)) {
    return <Redirect href="/parent/pending-verification" />;
  }

  return (
    <PaletteProvider palette={PALETTE}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="pending-verification" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="counselor-notes" />
        <Stack.Screen name="assessment-results" />
        <Stack.Screen name="attendance" />
        <Stack.Screen name="schedule" />
        <Stack.Screen name="counsellor-report" />
        <Stack.Screen name="academic-progress" />
        <Stack.Screen name="fees" />
        <Stack.Screen name="learning-activities" />
        <Stack.Screen name="feature" />
        <Stack.Screen name="search" />
      </Stack>
    </PaletteProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
