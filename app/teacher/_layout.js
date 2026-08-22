import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PORTALS } from '../../constants/theme';
import { api } from '../../services/apiService';
import { getStaffRoleConfig } from '../../constants/staffRoles';

/**
 * Route guard for the native teacher area — the mobile counterpart of the web's
 * RequireSchoolAuth (frontendmain/src/App.js).
 *
 * Only verified TEACHERs get the native shell. Other staff roles have no native screens yet and
 * are sent to the WebView dashboard; unverified teachers are held at the pending screen.
 */
export default function TeacherLayout() {
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

  return (
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
    </Stack>
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
