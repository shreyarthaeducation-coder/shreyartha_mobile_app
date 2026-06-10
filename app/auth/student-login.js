import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppWebView from '../../components/AppWebView';
import { useAuth } from '../../context/AuthContext';

const LOGIN_URL = 'https://shreyartha.com/studentlogin';
const DASHBOARD_PATTERN = /\/student\/platform\//i;
const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const LOGIN_POLL_JS = `
(function() {
  function sendPayload() {
    var studentToken = localStorage.getItem('studentToken');
    var studentLoggedIn = localStorage.getItem('studentLoggedIn');
    if (studentToken && studentLoggedIn === 'true') {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'LOGIN_SUCCESS',
        studentToken: studentToken,
        userToken: localStorage.getItem('userToken') || studentToken,
        studentLoggedIn: 'true',
        studentRole: localStorage.getItem('studentRole') || ''
      }));
      return true;
    }
    return false;
  }

  if (!sendPayload()) {
    var interval = setInterval(function() {
      if (sendPayload()) {
        clearInterval(interval);
      }
    }, 500);
    setTimeout(function() { clearInterval(interval); }, 20000);
  }
})();
true;
`;

const CLEAR_STUDENT_AUTH_JS = `
(function() {
  try {
    localStorage.removeItem('studentToken');
    localStorage.removeItem('userToken');
    localStorage.removeItem('studentLoggedIn');
    localStorage.removeItem('studentRole');
  } catch(e) {}
})();
true;
`;

const READ_STORAGE_JS = `
(function() {
  var studentToken = localStorage.getItem('studentToken') || '';
  var studentLoggedIn = localStorage.getItem('studentLoggedIn');
  if (studentToken && studentLoggedIn === 'true') {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'LOGIN_SUCCESS',
      studentToken: studentToken,
      userToken: localStorage.getItem('userToken') || studentToken,
      studentLoggedIn: 'true',
      studentRole: localStorage.getItem('studentRole') || ''
    }));
  }
})();
true;
`;

export default function StudentLoginScreen() {
  const router = useRouter();
  const { setUserType } = useAuth();
  const webViewRef = useRef(null);
  const handledLoginRef = useRef(false);
  const [loading, setLoading] = useState(true);

  const onMessage = async (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || '{}');
      if (
        payload?.type !== 'LOGIN_SUCCESS' ||
        handledLoginRef.current ||
        !payload.studentToken
      )
        return;

      handledLoginRef.current = true;
      const token = payload.studentToken;
      const pairs = [
        ['studentToken', token],
        ['userToken', payload.userToken || token],
        ['accessToken', token],
        ['token', token],
        ['studentLoggedIn', 'true'],
        ['userType', 'student'],
      ];

      if (payload.studentRole) pairs.push(['studentRole', payload.studentRole]);

      await AsyncStorage.multiSet(pairs);
      setUserType('student');
      router.replace('/student/');
    } catch {
      // Ignore malformed payloads posted by website scripts.
    }
  };

  const onNavigationStateChange = (navState) => {
    if (
      DASHBOARD_PATTERN.test(navState?.url || '') &&
      webViewRef.current &&
      !handledLoginRef.current
    ) {
      webViewRef.current.injectJavaScript(READ_STORAGE_JS);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Login</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.webViewContainer}>
        <AppWebView
          ref={webViewRef}
          source={{ uri: LOGIN_URL }}
          userAgent={MOBILE_USER_AGENT}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          originWhitelist={['*']}
          setSupportMultipleWindows={false}
          injectedJavaScriptBeforeContentLoaded={CLEAR_STUDENT_AUTH_JS}
          injectedJavaScript={LOGIN_POLL_JS}
          onMessage={onMessage}
          onNavigationStateChange={onNavigationStateChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          renderError={() => (
            <View style={styles.errorView}>
              <Text style={styles.errorText}>Failed to load page.</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => webViewRef.current?.reload()}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        {loading ? (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color="#b0003a" />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  backText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  headerSpacer: { width: 56 },
  webViewContainer: { flex: 1, backgroundColor: '#fff' },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  errorView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  errorText: { fontSize: 15, color: '#333', marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#b0003a',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
