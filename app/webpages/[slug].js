import { useState, useRef } from 'react';
import { StyleSheet, ActivityIndicator, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { COLORS, SPACING } from '../../constants/theme';
import SearchBar from '../components/SearchBar';
import ChatbotWidget from '../components/ChatbotWidget';

const PAGE_CONFIG = {
  'learning-assessment': { title: 'Learning & Assessment' },
  'skills-learning': { title: 'Skills Learning' },
  'students-profile': { title: 'Students Profile' },
  'counselling': { title: 'Counselling' },
  'psychometric-assessment': { title: 'Psychometric Assessment' },
  'subject-career': { title: 'Subject & Career' },
  'competitive-examination': { title: 'Competitive Examination' },
  'coding-ai-robotics': { title: 'AI/Robotics & Coding' },
  'language-learning': { title: 'Language Learning' },
  'global-opportunities': { title: 'Global Opportunities' },
  'progress-tracking': { title: 'Progress Tracking' },
  'store': { title: 'Shreyartha Store' },
};

// Delays (ms) for retrying SPA navigation after the initial inject
const NAVIGATION_RETRY_DELAY_MS = 500;
const NAVIGATION_RETRY_FALLBACK_MS = 1500;

// CSS injected before the page renders to suppress website chrome immediately
const buildInjectedJSBefore = () => `
  (function() {
    var style = document.createElement('style');
    style.id = '__app_hide_chrome__';
    style.textContent = [
      'header', 'nav', 'footer',
      '.navbar', '.top-bar',
      '.landing-header', '.la-header', '.sl-header', '.sp-header',
      '.co-header', '.ps-header', '.sc-header', '.ce-header',
      '.car-header', '.ll-header', '.go-header', '.pt-header',
      '.global-search-section',
      '.landing-tagline-section',
      '.chatbot-widget', '.chatbot-container', '.floating-chatbot',
      '[class*="chatbot"]', '[id*="chatbot"]',
      '[class*="header"]', '[class*="navbar"]', '[class*="topbar"]',
      '[class*="whatsapp"]', '.whatsapp-float',
      '[class*="footer"]', '.footer'
    ].map(function(s) { return s + ' { display: none !important; }'; }).join('\\n');
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.documentElement.appendChild(style);
    }
  })();
  true;
`;

// Build the injected JS for a given slug — navigates SPA and hides redundant UI
function buildInjectedJS(slug) {
  return `
    (function() {
      var TARGET_PATH = '/${slug}';

      // Ensure hide-chrome style is present
      if (!document.getElementById('__app_hide_chrome__')) {
        var style = document.createElement('style');
        style.id = '__app_hide_chrome__';
        style.textContent = [
          'header', 'nav', 'footer',
          '.navbar', '.top-bar',
          '.landing-header', '.la-header', '.sl-header', '.sp-header',
          '.co-header', '.ps-header', '.sc-header', '.ce-header',
          '.car-header', '.ll-header', '.go-header', '.pt-header',
          '.global-search-section',
          '.landing-tagline-section',
          '.chatbot-widget', '.chatbot-container', '.floating-chatbot',
          '[class*="chatbot"]', '[id*="chatbot"]',
          '[class*="header"]', '[class*="navbar"]', '[class*="topbar"]',
          '[class*="whatsapp"]', '.whatsapp-float',
          '[class*="footer"]', '.footer'
        ].map(function(s) { return s + ' { display: none !important; }'; }).join('\\n');
        document.head.appendChild(style);
      }
      if (document.body) document.body.style.paddingTop = '0px';

      // Navigate the React SPA to the target route if not already there
      function navigateToRoute() {
        try {
          if (window.location.pathname !== TARGET_PATH) {
            window.history.pushState({}, '', TARGET_PATH);
            window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
          }
        } catch(e) {}
      }

      navigateToRoute();

      // Retry navigation after short delays to handle deferred React Router mounting
      setTimeout(navigateToRoute, ${NAVIGATION_RETRY_DELAY_MS});
      setTimeout(navigateToRoute, ${NAVIGATION_RETRY_FALLBACK_MS});

      // Mutation observer to reapply body padding reset as React re-renders.
      // Throttled with a flag to avoid redundant style writes on high-frequency mutations.
      var _padPending = false;
      var observer = new MutationObserver(function() {
        if (_padPending) return;
        _padPending = true;
        requestAnimationFrame(function() {
          _padPending = false;
          if (document.body && document.body.style.paddingTop !== '0px') {
            document.body.style.paddingTop = '0px';
          }
        });
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    })();
    true;
  `;
}

export default function WebPageScreen() {
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  const webViewRef = useRef(null);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const config = PAGE_CONFIG[slug];
  const title = config?.title || 'Page';

  // Always load the SPA root. The injectedJavaScript will navigate React Router
  // to the target route after the app has mounted. Loading deep-linked URLs directly
  // causes the server to return {"error":"Short URL not found"} since the backend
  // treats unknown paths as short-URL lookups.
  const pageUrl = 'https://the3cedge.com';

  if (loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Unable to load page</Text>
          <Text style={styles.errorMsg}>
            Please check your internet connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLoadError(false);
              setIsLoading(true);
            }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Hide expo-router's default header */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* App search bar — provides consistent search UX on WebView pages */}
      <SearchBar />

      {/* WebView — loads SPA root then navigates client-side to the target route */}
      <WebView
        ref={webViewRef}
        source={{ uri: pageUrl }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        cacheEnabled
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        startInLoadingState
        injectedJavaScriptBeforeContentLoaded={buildInjectedJSBefore()}
        injectedJavaScript={buildInjectedJS(slug)}
        onLoadEnd={() => {
          setIsLoading(false);
          // Re-inject after load to ensure navigation ran after React Router mounted
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(buildInjectedJS(slug));
          }
        }}
        onNavigationStateChange={() => {
          // Re-apply element hiding whenever the WebView URL changes
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(buildInjectedJS(slug));
          }
        }}
        onError={() => setLoadError(true)}
      />

      {/* Loading overlay — covers the full screen while the WebView initializes */}
      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading {title}...</Text>
        </View>
      )}

      {/* Floating chatbot — accessible from every web-page screen */}
      <ChatbotWidget />
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
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
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