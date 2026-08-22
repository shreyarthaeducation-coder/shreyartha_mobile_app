import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PORTALS } from '../../constants/theme';
import { PaletteProvider } from '../../components/ui/PaletteContext';

/**
 * Route guard and theme host for the native partner panel — the partner counterpart of
 * app/parent/_layout.js.
 *
 * PURPLE, AND DELIBERATELY THE PARENT'S PURPLE. `Partner/PartnerAuth.css` is `#6b21a8` / `#9333ea`,
 * byte-identical to `Parent/ParentAuth.css`, which is what PORTALS.parent already holds. A separate
 * `partner:` entry with the same six colours would be a near-duplicate key in the same object
 * literal — that is exactly how the duplicate `student:` key mis-themed every student screen for
 * two phases. One palette, two portals, on purpose.
 *
 * VERIFICATION IS NOT CHECKED HERE, only the session. `UNVERIFIED_PARTNER` is granted nothing, so
 * the gate matters more than in any other portal — but the authority for it is
 * `PartnerProfileResponse.verified`, which the menu screen fetches and re-derives. The web reads a
 * login-time `partnerUserVerified` snapshot instead, so an admin verifying a partner mid-session
 * leaves them locked out until they log in again.
 */

const PALETTE = PORTALS.parent;

export default function PartnerLayout() {
  const [state, setState] = useState({ checking: true, token: null });

  useEffect(() => {
    let alive = true;

    (async () => {
      let token = null;
      try {
        token = await AsyncStorage.getItem('partnerUserToken');
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

  if (!state.token) return <Redirect href="/auth/partner-login" />;

  return (
    <PaletteProvider palette={PALETTE}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="pending-verification" />
        <Stack.Screen name="overview" />
        <Stack.Screen name="school-analytics" />
        <Stack.Screen name="monetization" />
        <Stack.Screen name="plans" />
        <Stack.Screen name="school-plans" />
        <Stack.Screen name="bank-info" />
        <Stack.Screen name="linked-partners" />
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
