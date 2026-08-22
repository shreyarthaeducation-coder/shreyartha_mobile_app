import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppWebView, { FORCE_DESKTOP_VIEWPORT_JS } from '../AppWebView';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import StudentHeader from './StudentHeader';

/**
 * Native header + web body, for the student areas that are not native yet.
 *
 * This is what keeps the panel usable mid-port: a tile whose area has not landed opens here
 * instead of vanishing. It is the student twin of `StaffFeatureScreen`, and the same escape hatch
 * the teacher panel used tile-by-tile.
 *
 * The session is injected into the WebView's localStorage before the page loads, which is what
 * lets the web route guard accept it rather than bouncing to /studentlogin. The student login
 * mirrors one JWT across four keys, so all four go in — the web reads different ones in different
 * places.
 *
 * The desktop viewport is retained ON PURPOSE for these pages: the web student panel has no
 * mobile layout, and the alternative is a broken narrow render rather than a small readable one.
 * Every area that goes native drops this.
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

export default function StudentFeatureScreen({ title, path, homeRoute = '/student' }) {
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
        'studentToken',
        'userToken',
        'accessToken',
        'token',
        'studentLoggedIn',
        'studentRole',
      ]);
      const values = Object.fromEntries(entries);
      const token =
        values.studentToken || values.userToken || values.accessToken || values.token || '';
      setInjectValues({
        studentToken: token,
        userToken: values.userToken || token,
        accessToken: token,
        token,
        studentLoggedIn: values.studentLoggedIn || 'true',
        studentRole: values.studentRole || '',
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
      <StudentHeader title={title || 'Shreyartha'} fallbackRoute={homeRoute} />

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

const useStyles = makeStyles((p) => ({
  safe: { flex: 1, backgroundColor: 'transparent' },
  // The web page paints its own background, so this pane is opaque unlike the native screens.
  body: { flex: 1, backgroundColor: '#ffffff' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.pageBg,
  },
}));
