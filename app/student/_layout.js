import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PORTALS } from '../../constants/theme';
import { PaletteProvider } from '../../components/ui/PaletteContext';
import PortalTabBar, { STUDENT_TABS, isTabRoot } from '../../components/shared/home/PortalTabBar';

/**
 * Route guard and theme host for the native student panel — the student counterpart of
 * app/teacher/_layout.js.
 *
 * ── THE PHOTOGRAPHIC BACKGROUND IS GONE ────────────────────────────────────
 * This used to wrap the whole Stack in an `ImageBackground` painting `assets/images/Background.png`
 * over `#0a1628`, with the Stack itself transparent so the image stayed fixed across navigations —
 * mirroring the web's `.student-platform-theme` wrapper.
 *
 * It was removed for readability. White text over a photograph is only as legible as the brightest
 * region behind it, and the panel had accumulated four different translucent "glass" treatments
 * trying to buy contrast back. The page is now the same opaque SLATE[50] as every other panel.
 *
 * The Stack keeps `contentStyle` painted rather than transparent: with no image behind it there is
 * nothing for a transparent navigator card to reveal except the window, which flashes on push.
 *
 * `assets/images/Background.png` is deliberately left in the repo — the web still serves it, and
 * this file was its only mobile reference.
 */

const PALETTE = PORTALS.student;

export default function StudentLayout() {
  const [state, setState] = useState({ checking: true, token: null });
  // Drives the footer only. Read here rather than inside PortalTabBar so the bar is not mounted at
  // all on the sixteen inner screens — an absolutely-positioned View over a scroll area still eats
  // touches along its edge even when it renders nothing.
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;

    (async () => {
      let entries = [];
      try {
        // The student login mirrors one JWT across these four keys; any of them means a session.
        entries = await AsyncStorage.multiGet([
          'studentToken',
          'userToken',
          'accessToken',
          'token',
        ]);
      } catch {
        // Fall through with empty values — treated as "no session".
      }
      if (!alive) return;

      const token = entries.map(([, v]) => v).find((v) => v && String(v).trim());
      setState({ checking: false, token: token || null });
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

  if (!state.token) return <Redirect href="/auth/student-login" />;

  return (
    <PaletteProvider palette={PALETTE}>
      <View style={styles.bg}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: PALETTE.pageBg },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="analytics" />
          <Stack.Screen name="events" />
          <Stack.Screen name="subject-career" />
          <Stack.Screen name="skills-edge" />
          <Stack.Screen name="psychometric" />
          <Stack.Screen name="academic-iq" />
          <Stack.Screen name="academic-iq-resources" />
          <Stack.Screen name="practice-zone" />
          <Stack.Screen name="competitive-exam" />
          <Stack.Screen name="coding-pro" />
          <Stack.Screen name="language-pro" />
          <Stack.Screen name="language-pro-resources" />
          <Stack.Screen name="sound-studio" />
          <Stack.Screen name="learn-with-shreya" />
          <Stack.Screen name="change-password" />
          <Stack.Screen name="feature" />
          <Stack.Screen name="counselor" />
          <Stack.Screen name="workspace" />
          <Stack.Screen name="search" />
          <Stack.Screen name="jyora" />
          <Stack.Screen name="teacher-resources" />
          <Stack.Screen name="personalised-resources" />
        </Stack>

        {isTabRoot(pathname, STUDENT_TABS) ? <PortalTabBar tabs={STUDENT_TABS} tone="light" /> : null}
      </View>
    </PaletteProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.pageBg,
  },
  bg: { flex: 1, backgroundColor: PALETTE.pageBg },
});
