import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import AppWebView from '../AppWebView';
import { usePalette } from '../ui/PaletteContext';
import { webSessionFor } from '../../services/webReportSession';

/**
 * A report drawn by the WEBSITE, inside an app screen (6 Nov 2026).
 *
 * ── WHY ──────────────────────────────────────────────────────────────────────
 * Reports and graphs must be identical to the website's — the same charts, the same layout, the
 * same PDF. Redrawing them natively only ever approximated them. So the app opens the website's
 * report page (frontendmain/src/appReports, route /app-report/<kind>) and hands it the data it has
 * already loaded; the page draws it with the website's own components. One implementation, two
 * places: a change to a report on the website is a change in the app.
 *
 * ── HOW IT SITS IN A SCREEN ─────────────────────────────────────────────────
 * The page reports its own height (`{type:"height"}`) and the WebView takes exactly that height
 * with its own scrolling off, so the report scrolls with the native screen around it like any
 * other card. Downloads the page makes (`{type:"file"}`, see the website's appReports/nativeBridge)
 * are saved to the cache and opened in the phone's share sheet; `{type:"print"}` goes to the
 * system print dialog.
 *
 * ── WHEN THE WEBSITE CANNOT DRAW IT ─────────────────────────────────────────
 * No connection, or a website that does not have the report page yet: the page never says
 * `ready`. After READY_TIMEOUT_MS — or at once on a load error — the screen's own native report
 * (`fallback`) is shown instead, so a report is never lost to a blank box. The web build of the
 * app (expo start --web) has no WebView at all and always shows the fallback.
 *
 * @param kind     the report page: psychometric | adaptive | blooms | mock-test
 * @param payload  the data to draw, JSON-serialisable
 * @param portal   whose session the page gets: student | parent | staff
 * @param fallback the native report, for when the website cannot draw it
 * @param onClose  the report's own Close/Back button
 * @param onStateChange called with 'loading' | 'ready' | 'failed' — a screen hides its own Share
 *        while the website's report (which has its own Download) is the one showing
 */

const WEB_BASE = (process.env.EXPO_PUBLIC_WEB_BASE_URL || 'https://shreyartha.com').replace(/\/+$/, '');
const READY_TIMEOUT_MS = 15000;
const MIN_HEIGHT = 240;

/** A value made safe to write inside the injected script (U+2028/9 end a JS string literal). */
// Built from char codes: these characters (and a backslash) do not survive every editor and shell.
const BACKSLASH = String.fromCharCode(92);
const LINE_SEP = new RegExp(String.fromCharCode(0x2028), 'g');
const PARA_SEP = new RegExp(String.fromCharCode(0x2029), 'g');
const asScript = (value) =>
  JSON.stringify(value ?? null)
    .replace(LINE_SEP, `${BACKSLASH}u2028`)
    .replace(PARA_SEP, `${BACKSLASH}u2029`);

const safeFileName = (name) => String(name || 'report.pdf').replace(/[^\w.-]+/g, '-').slice(0, 120) || 'report.pdf';

export default function WebReport({ kind, payload, portal, fallback = null, onClose, onStateChange }) {
  const palette = usePalette();
  const [session, setSession] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | failed
  const [height, setHeight] = useState(MIN_HEIGHT);
  const webRef = useRef(null);
  const timer = useRef(null);

  const stateRef = useRef(onStateChange);
  stateRef.current = onStateChange;
  useEffect(() => {
    stateRef.current?.(Platform.OS === 'web' ? 'failed' : state);
  }, [state]);

  useEffect(() => {
    let alive = true;
    webSessionFor(portal).then((s) => alive && setSession(s));
    return () => {
      alive = false;
    };
  }, [portal]);

  // The website gets READY_TIMEOUT_MS to draw; after that the native report takes over.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    timer.current = setTimeout(() => setState((s) => (s === 'loading' ? 'failed' : s)), READY_TIMEOUT_MS);
    return () => clearTimeout(timer.current);
  }, [kind]);

  const injected = useMemo(() => {
    if (!session) return null;
    return `(function () {
  try { localStorage.clear(); } catch (e) {}
  var s = ${asScript(session)};
  Object.keys(s).forEach(function (k) { try { localStorage.setItem(k, String(s[k])); } catch (e) {} });
  window.__APP_REPORT__ = ${asScript(payload)};
  if (window.__setAppReport) window.__setAppReport(window.__APP_REPORT__);
})();
true;`;
  }, [session, payload]);

  // A payload that changes after the page loaded (another tab, a refresh) is handed over in place.
  const loadedPayload = useRef(false);
  useEffect(() => {
    if (!loadedPayload.current || !webRef.current) return;
    webRef.current.injectJavaScript(`if (window.__setAppReport) window.__setAppReport(${asScript(payload)}); true;`);
  }, [payload]);

  const saveAndShare = useCallback(async ({ filename, mimeType, base64 }) => {
    const uri = `${FileSystem.cacheDirectory}${safeFileName(filename)}`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: mimeType || 'application/pdf', dialogTitle: filename, UTI: 'com.adobe.pdf' });
    } else {
      Alert.alert('Saved', 'The report was saved, but this device cannot open the share sheet.');
    }
  }, []);

  const onMessage = useCallback(
    (event) => {
      let msg;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      switch (msg?.type) {
        case 'ready':
          clearTimeout(timer.current);
          loadedPayload.current = true;
          setState('ready');
          break;
        case 'height':
          if (Number(msg.height) > 0) setHeight(Math.max(MIN_HEIGHT, Math.ceil(Number(msg.height))));
          break;
        case 'close':
          onClose?.();
          break;
        case 'file':
          saveAndShare(msg).catch((e) => Alert.alert('Could not save the report', e?.message || 'Please try again.'));
          break;
        case 'print': {
          const html = String(msg.html || '').replace('<head>', `<head><base href="${msg.origin || WEB_BASE}/">`);
          Print.printAsync({ html }).catch(() => {});
          break;
        }
        case 'error':
          Alert.alert('Could not prepare the report', msg.message || 'Please try again.');
          break;
        default:
      }
    },
    [onClose, saveAndShare],
  );

  if (Platform.OS === 'web' || state === 'failed') return fallback;

  return (
    <View style={[styles.frame, { height }]}>
      {injected ? (
        <AppWebView
          ref={webRef}
          source={{ uri: `${WEB_BASE}/app-report/${encodeURIComponent(kind)}` }}
          // The report must be the website's CURRENT one: no stale cached page after a deploy.
          cacheEnabled={false}
          cacheMode="LOAD_DEFAULT"
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          setSupportMultipleWindows={false}
          scrollEnabled={false}
          nestedScrollEnabled={false}
          injectedJavaScriptBeforeContentLoaded={injected}
          onMessage={onMessage}
          onError={() => setState('failed')}
          onHttpError={(e) => {
            if (e?.nativeEvent?.statusCode >= 400) setState('failed');
          }}
          style={[styles.web, state !== 'ready' && styles.hidden]}
        />
      ) : null}
      {state !== 'ready' ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: '#ffffff' },
  hidden: { opacity: 0 },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
});
