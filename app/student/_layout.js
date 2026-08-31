import { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, StyleSheet, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PORTALS } from '../../constants/theme';
import { PaletteProvider } from '../../components/ui/PaletteContext';
import PortalTabBar, { STUDENT_TABS, isTabRoot } from '../../components/shared/home/PortalTabBar';

/**
 * Route guard and theme host for the native student panel — the student counterpart of
 * app/teacher/_layout.js.
 *
 * THE BACKGROUND LIVES HERE, NOT IN THE SCREENS, and that is the whole point. The web applies
 * `Background.png` once on a `.student-platform-theme` wrapper with `background-attachment: fixed`
 * (frontendmain/src/styles/student-platform.css), so it stays put while pages change. Painting it
 * per screen would restart and re-crop the image on every push — the fixed effect would be lost
 * and every navigation would flash. So the ImageBackground wraps the whole Stack, the Stack is
 * transparent, and every student screen renders over it.
 *
 * `#0a1628` is the fallback colour behind the image, matching the web's, so a slow image decode
 * shows the right dark rather than white.
 */

const PALETTE = PORTALS.student;
const BACKGROUND = require('../../assets/images/Background.png');

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
      <ImageBackground source={BACKGROUND} style={styles.bg} resizeMode="cover">
        <Stack
          screenOptions={{
            headerShown: false,
            // Without this the navigator paints its own opaque card and hides the background.
            contentStyle: { backgroundColor: 'transparent' },
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

        {isTabRoot(pathname, STUDENT_TABS) ? <PortalTabBar tabs={STUDENT_TABS} /> : null}
      </ImageBackground>
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
