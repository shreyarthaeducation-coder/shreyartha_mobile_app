import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login-select" />
        <Stack.Screen name="auth/student-login" />
        <Stack.Screen name="auth/school-login" />
        <Stack.Screen name="auth/parent-login" />
        <Stack.Screen name="auth/admin-login" />
        <Stack.Screen name="webpages/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="webpages/dashboard" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}