import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PaletteProvider } from '../ui/PaletteContext';

/**
 * Route guard and theme host for a portal carried over from the website (5 Nov 2026) — the same
 * job app/parent/_layout.js does for the parent, written once for Alumni, University, University
 * Staff, Industry and Investor.
 *
 * - No token → the sign-in gate.
 * - Not yet approved (`okKey` holds anything but "true") → the portal's pending screen, unless the
 *   route is one an unapproved account may still open (`openRoutes`). The server refuses an
 *   unapproved account anyway; this only spares the person a row of empty screens.
 *
 * `okKey` may be omitted for a portal with no approval step (Alumni).
 */
export default function PortalGate({ tokenKey, okKey, palette, pendingRoute, openRoutes = [] }) {
  const pathname = usePathname();
  const [state, setState] = useState({ checking: true, token: null, ok: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      let values = {};
      try {
        values = Object.fromEntries(await AsyncStorage.multiGet([tokenKey, okKey].filter(Boolean)));
      } catch {
        // Nothing read: treated as no session.
      }
      if (!alive) return;
      const token = values[tokenKey];
      setState({
        checking: false,
        token: token && String(token).trim() ? token : null,
        ok: !okKey || values[okKey] === 'true',
      });
    })();
    return () => {
      alive = false;
    };
  }, [tokenKey, okKey]);

  if (state.checking) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }
  if (!state.token) return <Redirect href="/auth/sign-in" />;
  if (!state.ok && pendingRoute && pathname !== pendingRoute && !openRoutes.includes(pathname)) {
    return <Redirect href={pendingRoute} />;
  }

  return (
    <PaletteProvider palette={palette}>
      <Stack screenOptions={{ headerShown: false }} />
    </PaletteProvider>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
});
