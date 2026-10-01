import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { FEEDBACK, PORTALS, SLATE, SPACING, TYPE } from '../../../../constants/theme';
import { API_BASE_URL } from '../../../../services/apiService';

/**
 * The website's own rich-text editor (TipTap: formatting, tables, KaTeX maths, pictures), opened
 * full-screen for one field — the question, an option, a sample answer.
 *
 * One editor for both platforms, on purpose: a phone-native editor would write HTML the website's
 * does not, and a maths question edited here would come back subtly different there. The page is
 * frontendmain's /school/embed/rich-text (School/embed/RichTextEmbed.js), served by the backend; this
 * sheet hands it the text and the teacher's token before it loads, and hears every change back.
 * Done keeps what was written; Cancel leaves the field as it was.
 *
 * Looks like FormSheet — same header, same close button, same bottom actions.
 */

const PALETTE = PORTALS.school;
const EDITOR_PATH = '/school/embed/rich-text';

const injected = (token, html, placeholder) => `
(function () {
  try { ${token ? `localStorage.setItem('schoolUserToken', ${JSON.stringify(token)});` : ''} } catch (e) {}
  window.__RTE_INIT__ = { html: ${JSON.stringify(html || '')}, placeholder: ${JSON.stringify(placeholder || '')} };
})();
true;
`;

export default function RichTextEditorSheet({ visible, title, initialHtml, placeholder, onDone, onClose }) {
  const [token, setToken] = useState(undefined);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef(initialHtml || '');
  // A fresh page for every opening, so an old field's text can never show in a new one.
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    if (!visible) return undefined;
    let alive = true;
    latest.current = initialHtml || '';
    setReady(false);
    setFailed(false);
    setOpenCount((n) => n + 1);
    AsyncStorage.getItem('schoolUserToken')
      .then((value) => alive && setToken(value ? value.replace(/^Bearer\s+/i, '') : null))
      .catch(() => alive && setToken(null));
    return () => {
      alive = false;
    };
  }, [visible, initialHtml]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>
                {title || 'Write with formatting'}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                Formatting, tables, maths and pictures — the website&apos;s editor
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Ionicons name="close" size={20} color={SLATE[600]} />
            </Pressable>
          </View>

          <View style={styles.body}>
            {token === undefined ? null : failed ? (
              <View style={styles.center}>
                <Text style={styles.error}>
                  The editor could not be opened. Check the connection and try again.
                </Text>
              </View>
            ) : (
              <WebView
                key={openCount}
                source={{ uri: `${API_BASE_URL}${EDITOR_PATH}` }}
                injectedJavaScriptBeforeContentLoaded={injected(token, initialHtml, placeholder)}
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={['*']}
                keyboardDisplayRequiresUserAction={false}
                onMessage={(e) => {
                  try {
                    const message = JSON.parse(e.nativeEvent.data);
                    if (message?.type === 'ready') setReady(true);
                    if (message?.type === 'change' && typeof message.html === 'string') latest.current = message.html;
                  } catch {
                    // Not one of ours.
                  }
                }}
                onError={() => setFailed(true)}
                onHttpError={() => setFailed(true)}
                style={styles.web}
              />
            )}
            {!ready && !failed ? (
              <View style={[styles.center, StyleSheet.absoluteFill]} pointerEvents="none">
                <ActivityIndicator size="large" color={PALETTE.primary} />
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onDone(latest.current)}
              disabled={!ready}
              style={({ pressed }) => [styles.primaryBtn, !ready && styles.disabled, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    flex: 1,
    marginTop: 40,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  headerText: { flex: 1 },
  title: { fontSize: TYPE.title, fontWeight: '700', color: SLATE[800] },
  subtitle: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[100],
  },
  body: { flex: 1 },
  web: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  error: { fontSize: TYPE.body, color: FEEDBACK.errorText, textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  secondaryText: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[600] },
  primaryBtn: { flex: 2, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: PALETTE.primary },
  primaryText: { fontSize: TYPE.body, fontWeight: '700', color: '#ffffff' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
