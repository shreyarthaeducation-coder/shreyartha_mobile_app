import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AppWebView, { FORCE_DESKTOP_VIEWPORT_JS } from '../AppWebView';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { readSchoolSession } from '../../services/schoolSession';
import StaffHeader from './StaffHeader';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Native header + web body, for staff features that aren't native yet — shared by the teacher
 * shell and every app/staff/[role] shell.
 *
 * The seven school session keys are written into the WebView's localStorage before the page
 * loads, which is what lets the web route guard (GET /api/school/auth/check) accept the session
 * instead of bouncing to /schoollogin.
 *
 * Props:
 *   label           — header title
 *   path            — web path under shreyartha.com
 *   homeRoute       — native route Back falls back to when there is no history
 *   defaultUserType — injected as schoolUserType when storage has none (web parity default)
 */

const BASE_URL = 'https://shreyartha.com';
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const getInjectedJS = (values) => `
(function() {
  var values = ${JSON.stringify(values)};
  Object.keys(values).forEach(function(key) {
    if (values[key] !== null && values[key] !== undefined) {
      localStorage.setItem(key, String(values[key]));
    }
  });
})();
true;
`;

export default function StaffFeatureScreen({
  label = 'Dashboard',
  path,
  homeRoute,
  defaultUserType = 'TEACHER',
}) {
  // Palette-aware so a half-ported panel is not red on its native tiles and teal on its WebView
  // ones. Defaults to the school teal via PaletteContext, so app/teacher is unaffected.
  const styles = useStyles();
  const PALETTE = usePalette();
  const router = useRouter();
  const { logout } = useAuth();

  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [injectValues, setInjectValues] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const url = `${BASE_URL}${path}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const session = await readSchoolSession();
        if (!alive) return;
        setInjectValues({
          schoolUserToken: session.schoolUserToken || '',
          schoolLoggedIn: session.schoolLoggedIn || 'true',
          schoolUserType: session.schoolUserType || defaultUserType,
          // Absent means NOT verified, matching the web.
          schoolUserVerified: session.schoolUserVerified || 'false',
          schoolUserName: session.schoolUserName || '',
          schoolUserEmail: session.schoolUserEmail || '',
          schoolCode: session.schoolCode || '',
        });
      } catch {
        if (alive) setLoadError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [defaultUserType]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      if (router.canGoBack()) router.back();
      else router.replace(homeRoute);
      return true;
    });
    return () => sub.remove();
  }, [canGoBack, router, homeRoute]);

  // The web page logs out in its own context (including its own attendance end-ping), then
  // redirects to /schoollogin — mirror that by clearing the native session too.
  const handleNavChange = async (navUrl) => {
    if (navUrl.includes('/schoollogin')) {
      await logout();
      router.replace('/auth/school-login');
    }
  };

  const injectedBeforeLoad = useMemo(() => {
    if (!injectValues) return 'true;';
    return `${FORCE_DESKTOP_VIEWPORT_JS}\n${getInjectedJS(injectValues)}`;
  }, [injectValues]);

  const retry = () => {
    setLoadError(false);
    setPageLoading(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StaffHeader title={label} fallbackRoute={homeRoute} />

      <View style={styles.body}>
        {injectValues && !loadError ? (
          <AppWebView
            key={reloadKey}
            ref={webViewRef}
            source={{ uri: url }}
            userAgent={DESKTOP_USER_AGENT}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="never"
            originWhitelist={['https://shreyartha.com', 'https://*.shreyartha.com']}
            setSupportMultipleWindows={false}
            injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack);
              handleNavChange(navState.url || '');
            }}
            onLoadStart={() => setPageLoading(true)}
            onLoadEnd={() => setPageLoading(false)}
            onError={() => {
              setPageLoading(false);
              setLoadError(true);
            }}
          />
        ) : null}

        {loadError ? (
          <View style={styles.errorOverlay}>
            <Ionicons name="cloud-offline-outline" size={40} color={SLATE[400]} />
            <Text style={styles.errorTitle}>Couldn&apos;t load this page</Text>
            <Text style={styles.errorText}>
              Check your internet connection and try again.
            </Text>
            <Pressable onPress={retry} style={styles.retryBtn} accessibilityRole="button">
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loadError && (pageLoading || !injectValues) ? (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color={PALETTE.primary} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((p) => ({
  safe: { flex: 1, backgroundColor: p.headerBg },
  body: { flex: 1, backgroundColor: '#ffffff' },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: SPACING.lg,
  },
  errorTitle: {
    fontSize: TYPE.title,
    fontWeight: '700',
    color: SLATE[800],
    marginTop: SPACING.sm,
  },
  errorText: {
    fontSize: TYPE.body,
    color: SLATE[500],
    textAlign: 'center',
    marginTop: 6,
  },
  retryBtn: {
    marginTop: SPACING.md,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: p.primaryDark,
  },
  retryText: { color: '#ffffff', fontWeight: '700', fontSize: TYPE.heading },
}));
