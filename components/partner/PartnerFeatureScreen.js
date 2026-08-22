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
// module at import time and boot-crashed the app on every route.
import StaffHeader from '../staff/StaffHeader';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Native header + web body, for partner tabs whose phase has not landed yet.
 *
 * The twin of ParentFeatureScreen, StaffFeatureScreen and StudentFeatureScreen. Unlike the parent's,
 * this one is expected to be TEMPORARY: the parent keeps its WebView permanently for the Razorpay
 * fee checkout, whereas the partner portal has no payment surface at all — the ₹1,00,000 master
 * upgrade is commented out of the web's own sidebar and is not ported.
 *
 * The session is injected into the WebView's localStorage before the page loads, which is what lets
 * `RequirePartnerAuth` accept it rather than bouncing to /partnerlogin. All seven keys the web
 * writes at login go in, spelled as the WEB spells them — note `partnerUserType`, not `partnerType`.
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

export default function PartnerFeatureScreen({ title, path, homeRoute = '/partner' }) {
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
        'partnerUserToken',
        'partnerLoggedIn',
        'partnerUserVerified',
        'partnerUserType',
        'partnerUserName',
        'partnerUserEmail',
        'partnerCode',
      ]);
      const values = Object.fromEntries(entries);
      setInjectValues({
        partnerUserToken: values.partnerUserToken || '',
        partnerLoggedIn: values.partnerLoggedIn || 'true',
        partnerUserVerified: values.partnerUserVerified || 'true',
        partnerUserType: values.partnerUserType || '',
        partnerUserName: values.partnerUserName || '',
        partnerUserEmail: values.partnerUserEmail || '',
        partnerCode: values.partnerCode || '',
      });
    })();
  }, []);

  // Android hardware back walks the web history first, then leaves the screen.
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
