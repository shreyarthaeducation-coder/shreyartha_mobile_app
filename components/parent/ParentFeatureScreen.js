import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppWebView, { FORCE_DESKTOP_VIEWPORT_JS } from '../AppWebView';
import { SLATE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
// By PATH, not through components/staff/index.js. In this repo a barrel import is an app-wide
// import — the staff barrel pulls in every staff screen, and one of those once reached a native
// module at import time and boot-crashed the app on every route. ScreenScaffold imports this
// same header the same way, for the same reason.
import StaffHeader from '../staff/StaffHeader';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Native header + web body, for parent tabs that are not native yet.
 *
 * This is what keeps the panel usable mid-port: a tile whose phase has not landed opens here
 * instead of vanishing. The twin of StaffFeatureScreen and StudentFeatureScreen.
 *
 * IT ALSO HAS A PERMANENT JOB. Fees hands its "Pay Now" tap here even after that screen is native,
 * because the Razorpay checkout is browser-only — see components/parent/FeesScreen. Keeping the
 * checkout in a real browser context is what makes UPI app redirects work, and it avoids adding a
 * native payment SDK (and therefore a dev-client build) to an app that otherwise runs in Expo Go.
 *
 * The session is injected into the WebView's localStorage before the page loads, which is what
 * lets `RequireParentAuth` accept it rather than bouncing to /parentlogin. All six keys the web
 * writes at login go in; `parentUserEmail` is included even though the web never writes it, because
 * ParentFees reads it for the Razorpay prefill and gets an empty string on the website today.
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

export default function ParentFeatureScreen({ title, path, homeRoute = '/parent' }) {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const webRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [injectValues, setInjectValues] = useState(null);
  const [webLoading, setWebLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const entries = await AsyncStorage.multiGet([
        'parentUserToken',
        'parentLoggedIn',
        'parentUserVerified',
        'parentUserName',
        'parentUserEmail',
        'linkedStudentName',
        'linkedStudentEmail',
      ]);
      const values = Object.fromEntries(entries);
      setInjectValues({
        parentUserToken: values.parentUserToken || '',
        parentLoggedIn: values.parentLoggedIn || 'true',
        // Fail closed, like the login that writes it. A stored 'false' already survives (the string
        // is truthy), so this only decides the absent case — and injecting 'true' there would hand
        // the WEB guard a verified session the app itself never established.
        parentUserVerified: values.parentUserVerified || 'false',
        parentUserName: values.parentUserName || '',
        parentUserEmail: values.parentUserEmail || '',
        linkedStudentName: values.linkedStudentName || '',
        linkedStudentEmail: values.linkedStudentEmail || '',
      });
    })();
  }, []);

  // Android hardware back walks the web history first, then leaves the screen. This matters more
  // here than elsewhere: a Razorpay checkout pushes several history entries.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      if (router.canGoBack()) router.back();
      else router.replace(homeRoute);
      return true;
    });
    return () => sub.remove();
  }, [canGoBack, router, homeRoute]);

  const injectedBeforeLoad = useMemo(() => {
    if (!injectValues) return 'true;';
    return `${FORCE_DESKTOP_VIEWPORT_JS}\n${getInjectedJS(injectValues)}`;
  }, [injectValues]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StaffHeader title={title || 'Shreyartha'} fallbackRoute={homeRoute} />

      <View style={styles.body}>
        {injectValues ? (
          <AppWebView
            ref={webRef}
            source={{ uri: `${BASE_URL}${path}` }}
            userAgent={DESKTOP_USER_AGENT}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            setSupportMultipleWindows={false}
            injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
            onLoadEnd={() => setWebLoading(false)}
            onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
          />
        ) : null}

        {!injectValues || webLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: SLATE[50] },
  body: { flex: 1, backgroundColor: '#ffffff' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
}));
