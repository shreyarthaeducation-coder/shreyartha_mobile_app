import { useState, useRef, useEffect } from 'react';
import { StyleSheet, ActivityIndicator, View, Text, TouchableOpacity, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING } from '../../constants/theme';

export default function DashboardScreen() {
  const { url, tokenKey, title } = useLocalSearchParams();
  const router = useRouter();
  const webViewRef = useRef(null);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [injectedScript, setInjectedScript] = useState(null);

  const dashboardUrl = url || 'https://the3cedge.com';
  const pageTitle = title || 'Dashboard';

  // Extract the path portion of the target URL for client-side navigation.
  // We always load the SPA root (https://the3cedge.com) to avoid the server
  // returning {"error":"Short URL not found"} for deep-linked SPA routes.
  let targetPath = '/';
  try {
    const parsed = new URL(dashboardUrl);
    targetPath = parsed.pathname || '/';
  } catch {
    targetPath = dashboardUrl.startsWith('/')
      ? dashboardUrl
      : `/${dashboardUrl}`;
  }

  useEffect(() => {
    buildInjectedScript();
  }, [tokenKey]);

  const buildInjectedScript = async () => {
    try {
      const storageKey = tokenKey || 'studentToken';
      const token = await AsyncStorage.getItem(storageKey);

      // Determine localStorage key used by the website based on token type
      const localStorageKeyMap = {
        studentToken: ['studentToken', 'userToken'],
        schoolUserToken: ['schoolUserToken'],
        parentUserToken: ['parentUserToken'],
        adminToken: ['adminToken'],
      };
      const keys = localStorageKeyMap[storageKey] || ['studentToken'];

      const setStorageLines = token
        ? keys
            .map(k => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(token)});`)
            .join('\n')
        : '';

      // injectedJavaScriptBeforeContentLoaded: set tokens before React app mounts
      setInjectedScript(`
        (function() {
          try {
            ${setStorageLines}
          } catch(e) {}
        })();
        true;
      `);
    } catch {
      setInjectedScript('true;');
    }
  };

  // Build the post-load JS that navigates the React SPA to the target route.
  // This runs after the React app has mounted so history.pushState + popstate works.
  const buildNavigationScript = () => {
    return `
      (function() {
        try {
          if (window.location.pathname !== ${JSON.stringify(targetPath)}) {
            window.history.pushState({}, '', ${JSON.stringify(targetPath)});
            window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
          }
          // Hide website-level header and chatbot (redundant inside the app)
          var hideSelectors = [
            '.landing-header', '[class*="chatbot"]', '[id*="chatbot"]'
          ];
          hideSelectors.forEach(function(sel) {
            try {
              document.querySelectorAll(sel).forEach(function(el) {
                el.style.setProperty('display', 'none', 'important');
              });
            } catch(e2) {}
          });
        } catch(e) {}
      })();
      true;
    `;
  };

  // Handle Android hardware back button
  useEffect(() => {
    const onBack = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [canGoBack]);

  if (loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{pageTitle}</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Unable to load dashboard</Text>
          <Text style={styles.errorMsg}>
            Please check your internet connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setLoadError(false); setIsLoading(true); }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Don't render WebView until injected script is ready
  if (injectedScript === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{pageTitle}</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Preparing dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (canGoBack && webViewRef.current) {
            webViewRef.current.goBack();
          } else {
            router.back();
          }
        }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{pageTitle}</Text>
        <View style={{ width: 50 }} />
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: 'https://the3cedge.com' }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        cacheEnabled
        startInLoadingState
        injectedJavaScriptBeforeContentLoaded={injectedScript}
        injectedJavaScript={buildNavigationScript()}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => setLoadError(true)}
        onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
      />

      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading {pageTitle}...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1,
    borderBottomColor: '#eee', backgroundColor: COLORS.white,
  },
  backText: { color: COLORS.primary, fontWeight: '600', fontSize: 15 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.secondary, flex: 1, textAlign: 'center' },
  loader: {
    position: 'absolute', top: 60, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white,
  },
  loadingText: { marginTop: 12, color: COLORS.textSecondary, fontSize: 14 },
  errorContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.secondary, marginBottom: 8 },
  errorMsg: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  retryBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 36, borderRadius: 24,
  },
  retryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
