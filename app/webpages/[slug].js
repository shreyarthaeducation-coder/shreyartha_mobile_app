import { useState, useRef } from 'react';
import { StyleSheet, ActivityIndicator, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { COLORS, SPACING } from '../../constants/theme';

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

// Build the injected JS for a given slug — navigates SPA and hides redundant UI
function buildInjectedJS(slug) {
  return `
    (function() {
      var TARGET_PATH = '/${slug}';

      // Hide website headers, search bar, tagline, and chatbot — redundant in app
      var HIDE_SELECTORS = [
        '.landing-header', '.la-header', '.sl-header', '.sp-header',
        '.co-header', '.ps-header', '.sc-header', '.ce-header',
        '.car-header', '.ll-header',
        '.global-search-section',
        '.landing-tagline-section',
        '.chatbot-widget', '.chatbot-container', '.floating-chatbot',
        '[class*="chatbot"]', '[id*="chatbot"]'
      ];

      function hideElements() {
        HIDE_SELECTORS.forEach(function(sel) {
          try {
            document.querySelectorAll(sel).forEach(function(el) {
              el.style.setProperty('display', 'none', 'important');
            });
          } catch(e) {}
        });
        if (document.body) document.body.style.paddingTop = '0px';
      }

      // Navigate the React SPA to the target route
      function navigateToRoute() {
        try {
          if (window.location.pathname !== TARGET_PATH) {
            window.history.pushState({}, '', TARGET_PATH);
            window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
          }
        } catch(e) {}
      }

      // Run hide + navigate now (React app should be mounted when injectedJavaScript fires)
      hideElements();
      navigateToRoute();

      // Keep hiding as React re-renders components
      var observer = new MutationObserver(function() {
        hideElements();
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
        injectedJavaScript={buildInjectedJS(slug)}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => setLoadError(true)}
      />

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading {title}...</Text>
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