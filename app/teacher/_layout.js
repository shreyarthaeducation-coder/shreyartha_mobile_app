import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PORTALS } from '../../constants/theme';
import { api } from '../../services/apiService';
import { getStaffRoleConfig } from '../../constants/staffRoles';
import PortalTabBar, {
  TEACHER_TABS,
  isTabRoot,
} from '../../components/shared/home/PortalTabBar';

/**
 * Route guard for the native teacher area — the mobile counterpart of the web's
 * RequireSchoolAuth (frontendmain/src/App.js).
 *
 * Only verified TEACHERs get the native shell. Other staff roles have no native screens yet and
 * are sent to the WebView dashboard; unverified teachers are held at the pending screen.
 */
export default function TeacherLayout() {
  // Drives the footer only. Read here rather than inside PortalTabBar so the bar is not mounted at
  // all on the inner screens — an absolutely-positioned View over a scroll area still eats touches
  // along its edge even when it renders nothing.
  const pathname = usePathname();
  const [state, setState] = useState({ checking: true, token: null, role: '', verified: false });

  useEffect(() => {
    let alive = true;

    (async () => {
      let entries = [];
      try {
        entries = await AsyncStorage.multiGet([
          'schoolUserToken',
          'schoolUserType',
          'schoolUserVerified',
        ]);
      } catch {
        // Fall through with empty values — treated as "no session".
      }
      if (!alive) return;

      const values = Object.fromEntries(entries);
      setState({
        checking: false,
        token: values.schoolUserToken || null,
        role: String(values.schoolUserType || '').toLowerCase(),
        verified: values.schoolUserVerified === 'true',
      });

      // Web-parity liveness check. Non-blocking: a 401 lets apiService clear the session and
      // redirect on its own, so we don't duplicate that logic here.
      if (values.schoolUserToken) {
        api.get('/api/school/auth/check').catch(() => {});
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (state.checking) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={PORTALS.school.primary} />
      </View>
    );
  }

  if (!state.token) return <Redirect href="/auth/school-login" />;
  // A non-teacher who somehow reaches this group belongs in their own native shell.
  if (state.role && state.role !== 'teacher') {
    return getStaffRoleConfig(state.role) ? (
      <Redirect href={`/staff/${state.role}`} />
    ) : (
      <Redirect href="/auth/school-login" />
    );
  }
  // THE VERIFICATION GATE, which this file's docblock has always claimed and never performed.
  //
  // `verified` was read into state above and then never used, so the only gate was the one inside
  // TeacherHomeScreen — covering `/teacher` and none of the other twenty-four routes in this group.
  // Login sends an unverified teacher to the pending screen, so nothing routine landed them
  // elsewhere, but any deep link, chatbot `routeSuffix` or back-stack pop put them on a full screen
  // whose every call 403s. Gating here covers the whole group at once.
  //
  // The pending screen is itself in this group and must be exempt, or the redirect loops.
  if (!state.verified && pathname !== '/teacher/pending-verification') {
    return <Redirect href="/teacher/pending-verification" />;
  }

  return (
    <View style={styles.shell}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="self-attendance" />
        <Stack.Screen name="attendance" />
        <Stack.Screen name="groups" />
        <Stack.Screen name="homework" />
        <Stack.Screen name="resources" />
        <Stack.Screen name="syllabus" />
        <Stack.Screen name="live-classes" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="adaptive-assessment" />
        <Stack.Screen name="counselling" />
        <Stack.Screen name="counsellor-report" />
        <Stack.Screen name="upskill" />
        <Stack.Screen name="my-calendar" />
        <Stack.Screen name="leave" />
        <Stack.Screen name="payroll" />
        <Stack.Screen name="student-analytics" />
        <Stack.Screen name="pending-verification" />
        <Stack.Screen name="change-password" />
        <Stack.Screen name="feature" />
        <Stack.Screen name="workspace" />
        <Stack.Screen name="my-attendance" />
        <Stack.Screen name="support" />
        <Stack.Screen name="search" />
      </Stack>

      {/* tone="light" like the teacher's BrandBar: this panel resolves to PORTALS.school, which
          defines none of the dark-glass tokens the bar's default styles read. */}
      {isTabRoot(pathname, TEACHER_TABS)
      ? <PortalTabBar tabs={TEACHER_TABS} tone="light" />
      : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The footer is absolutely positioned over the navigator, so the Stack needs a positioned parent.
  shell: { flex: 1 },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
