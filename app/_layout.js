import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Tab navigation group */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Auth screens */}
        <Stack.Screen name="auth/login-select" />
        <Stack.Screen name="auth/student-login" />
        <Stack.Screen name="auth/school-login" />
        <Stack.Screen name="auth/parent-login" />
        <Stack.Screen name="auth/admin-login" />

        {/* Individual service pages */}
        <Stack.Screen name="pages/[slug]" options={{ headerShown: false }} />

        {/* Dashboard screens */}
        <Stack.Screen name="dashboard/student" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard/school" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard/parent" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard/admin" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}