import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../context/AuthContext";
import { LanguageProvider } from "../context/LanguageContext";
import { SubscriptionProvider } from "../context/SubscriptionContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <SubscriptionProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            {/* Tab navigation group */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

            {/* Auth screens */}
            <Stack.Screen name="auth/login-select" />
            <Stack.Screen name="auth/student-login" />
            <Stack.Screen
              name="auth/school-login"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="auth/parent-login"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="auth/partner-login"
              options={{ headerShown: false }}
            />

            {/* Individual service pages */}
            <Stack.Screen
              name="pages/[slug]"
              options={{ headerShown: false }}
            />

            {/* Native student panel (tab group) */}
            <Stack.Screen name="student" options={{ headerShown: false }} />

            {/* Legacy dashboard redirect screens */}
            <Stack.Screen
              name="dashboard/student"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="dashboard/school"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="dashboard/parent"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="dashboard/partner"
              options={{ headerShown: false }}
            />
          </Stack>
        </SubscriptionProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
