import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
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
 * VERIFICATION IS DELIBERATELY NOT CHECKED HERE. The web's guard reads a stale `parentUserVerified`
 * written once at login and never refreshed, so a parent verified by an admin mid-session stays
 * locked out until they log in again. The menu screen re-derives it from the live
 * `/linked-student` response instead, and this layout only checks that a session exists.
 */

const PALETTE = PORTALS.parent;

export default function ParentLayout() {
  const [state, setState] = useState({ checking: true, token: null });

  useEffect(() => {
    let alive = true;

    (async () => {
      let token = null;
      try {
        token = await AsyncStorage.getItem('parentUserToken');
      } catch {
        // Fall through with null — treated as "no session".
      }
      if (!alive) return;
      setState({ checking: false, token: token && String(token).trim() ? token : null });
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
