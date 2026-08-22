import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Stack, useRouter, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "../context/AuthContext";
import { LanguageProvider } from "../context/LanguageContext";
import { SubscriptionProvider } from "../context/SubscriptionContext";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Always start at the tabs landing page regardless of previous navigation state.
export const unstable_settings = { initialRouteName: "(tabs)" };

const LOGO = require("../assets/images/AppLogo.png");

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const navState = useRootNavigationState();
  const didNavigate = useRef(false);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const t = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(t);
  }, []);

  // Once the splash finishes AND the navigator is mounted, force start at tabs.
  // This overrides any persisted navigation state so the app always opens at landing.
  useEffect(() => {
    if (ready && navState?.key && !didNavigate.current) {
      didNavigate.current = true;
      router.replace("/(tabs)");
    }
  }, [ready, navState?.key]);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <Image source={LOGO} style={styles.splashLogo} resizeMode="contain" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <LanguageProvider>
        <SubscriptionProvider>
          <StatusBar style="dark" />
          {/*
            freezeOnBlur: screens beneath a pushed one are frozen (react-freeze). Without it the
            landing page's TextInputs (search bar, contact form) stay live under a login screen
            and Android's focus search can hand them focus during the keyboard's re-layout —
            which blurs the login field and instantly closes the keyboard.
          */}
          <Stack screenOptions={{ headerShown: false, freezeOnBlur: true }}>
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
            <Stack.Screen
              name="auth/forgot-password"
              options={{ headerShown: false }}
            />

            {/* Individual service pages */}
            <Stack.Screen
              name="pages/[slug]"
              options={{ headerShown: false }}
            />

            {/* Native student panel (tab group) */}
            <Stack.Screen name="student" options={{ headerShown: false }} />

            {/* Native teacher panel (route group) */}
            <Stack.Screen name="teacher" options={{ headerShown: false }} />

            {/* Native staff shells for the other school roles (config-driven route group) */}
            <Stack.Screen name="staff" options={{ headerShown: false }} />

            {/* Legacy dashboard redirect screens */}
            <Stack.Screen
              name="dashboard/student"
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

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  splashLogo: {
    width: "80%",
    height: "40%",
  },
});
