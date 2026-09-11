import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import RichText from '../../RichText';
import ShreyaSpeakButton from './ShreyaSpeakButton';
import JyoraWebBlock from './JyoraWebBlock';
import { EXPLORE_MORE_PROMPT, explainTopic } from '../../../services/student/jyoraService';

/**
 * "Explore more with Jyora" — an AI explanation of the topic the student is looking at.
 *
 * Port of `frontendmain/src/student/components/JyoraModal/JyoraModal.js`.
 *
 * ── LAYOUT: A SEGMENTED SWITCH, NOT TWO PANES ────────────────────────────────
 * The web is a two-pane modal — the page's own content on the left (44%), Jyora's answer on the
 * right. Its OWN `@media (max-width: 768px)` rule already abandons that: it stacks them 35/65 and
 * hides the topic badge. On a phone, stacking two independently-scrolling regions in a modal is
 * worse than either — so this is a `Jyora | Content` segmented switch, defaulting to **Jyora**,
 * which is what the student tapped the button for. Nothing is lost; both are one tap apart.
 *
 * ── PURPLE, NOT THE STUDENT BLUE ─────────────────────────────────────────────
 * Jyora has its own identity on the web (`#7C3AED` / `#5B21B6`) and keeps it here. This is the one
 * student surface that deliberately does not take the panel palette — it is a guest, not a section.
 *
 * ── WEBVIEWS ARE CONDITIONAL AND LAZY ────────────────────────────────────────
 * Mermaid diagrams and the YouTube embed have no native equivalent, so each mounts a scoped
 * WebView — but ONLY when that field is present in the response. The common text-only answer never
 * mounts one. See `JyoraWebBlock`.
 */

const PURPLE = {
  primary: '#7C3AED',
  deep: '#5B21B6',
  heading: '#4c1d95',
  tint: '#faf5ff',
  border: '#ede9fe',
};

const TABS = [
  { key: 'jyora', label: '🤖 Jyora says' },
  { key: 'content', label: '📖 Content' },
];

export default function JyoraSheet({ visible, onClose, context, contentLabel }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();

  const [tab, setTab] = useState('jyora');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const aliveRef = useRef(true);
  const scrollRef = useRef(null);

  const ask = useCallback(
    async (followUpQuestion = '') => {
      setLoading(true);
      setError('');
      try {
        const res = await explainTopic({ ...context, followUpQuestion });
        if (!aliveRef.current) return;
        setData(res);
        // The web scrolls the answer pane back to the top on every new response.
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      } catch (e) {
        if (!aliveRef.current) return;
        setError(e?.message || 'Jyora could not generate a response. Please try again.');
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    },
    [context],
  );

  useEffect(() => {
    aliveRef.current = true;
    if (visible) {
      setTab('jyora');
      setData(null);
      setError('');
      ask('');
    }
    return () => {
      aliveRef.current = false;
    };
    // `ask` closes over `context`; re-asking on every context change is the web's behaviour too,
    // but only while open — a closed sheet must not fire a 120-second request.
  }, [visible, ask]);

  // `html` is the rich answer; `response` is the server's plain-text "legacy field for older
  // clients/mobile" and is the guaranteed fallback. The server has already sanitised `html` to
  // h2/h3/p/ul/ol/li/b/strong/em/br.
  const answerHtml = data?.html || data?.response || '';
  const speakText = data?.response || data?.html || '';

  const renderJyora = () => {
    if (loading) {
      return (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={PURPLE.primary} />
          <Text style={styles.loadingText}>Jyora is thinking…</Text>
          <Text style={styles.loadingHint}>This can take up to a minute.</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centre}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            onPress={() => ask('')}
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    if (!answerHtml) return <Text style={styles.muted}>Jyora had nothing to add here.</Text>;

    return (
      <>
        <View style={styles.aiBadgeRow}>
          {/* The label is longer than the "AI generated" it replaced, and this row also carries the
              speak button — so it shrinks rather than pushing that button off a 360dp screen. */}
          <Text style={styles.aiBadge} numberOfLines={1}>
            Shreyartha.ai content
          </Text>
          <ShreyaSpeakButton text={speakText} compact />
        </View>

        <RichText html={answerHtml} />

        {data?.imageUrl ? (
          <View style={styles.figure}>
            <Image
              source={{ uri: data.imageUrl }}
              style={[styles.image, { width: width - 72 }]}
              resizeMode="contain"
              accessibilityLabel={data.imageCaption || 'Topic illustration'}
            />
            {data.imageCaption ? <Text style={styles.caption}>{data.imageCaption}</Text> : null}
          </View>
        ) : null}

        {/* Both of these mount a WebView, and only when the field is actually present. */}
        {data?.diagramMermaid ? (
          <JyoraWebBlock kind="mermaid" value={data.diagramMermaid} title="Diagram" />
        ) : null}

        {data?.video?.videoId ? (
          <JyoraWebBlock
            kind="youtube"
            value={data.video.videoId}
            title={data.video.title || 'Watch & learn'}
          />
        ) : null}
      </>
    );
  };

  const renderContent = () =>
    context?.contentHtml ? (
      <RichText html={context.contentHtml} />
    ) : (
      <Text style={styles.muted}>No content uploaded for this section yet.</Text>
    );

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Image
            source={require('../../../assets/images/Jyora.png')}
            style={styles.headerAvatar}
            resizeMode="contain"
          />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Explore more with Jyora</Text>
            {context?.topicName ? (
              <Text style={styles.headerTopic} numberOfLines={1}>
                {context.topicName}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color="#ffffff" />
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>
                  {t.key === 'content' && contentLabel ? `📖 ${contentLabel}` : t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.body}>
          {tab === 'jyora' ? renderJyora() : renderContent()}
        </ScrollView>

        {/* The web has no free-text input — one fixed deepen-this prompt. */}
        <Pressable
          onPress={() => ask(EXPLORE_MORE_PROMPT)}
          disabled={loading}
          style={({ pressed }) => [
            styles.exploreMore,
            loading && styles.exploreMoreOff,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.exploreMoreText}>
            {loading ? 'Exploring…' : '✨ Explore more'}
          </Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: '#ffffff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    backgroundColor: PURPLE.primary,
  },
  headerAvatar: { width: 34, height: 34, borderRadius: 17 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: TYPE.heading, fontWeight: '800', color: '#ffffff' },
  headerTopic: { fontSize: TYPE.caption, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  close: { padding: 4 },

  tabs: {
    flexDirection: 'row',
    gap: 7,
    padding: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: PURPLE.tint,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PURPLE.border,
    backgroundColor: '#ffffff',
  },
  tabOn: { backgroundColor: PURPLE.primary, borderColor: PURPLE.primary },
  tabText: { fontSize: TYPE.label, fontWeight: '700', color: PURPLE.deep },
  tabTextOn: { color: '#ffffff' },

  body: { padding: SPACING.md, paddingBottom: SPACING.xl },

  aiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  aiBadge: {
    fontSize: TYPE.micro,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: PURPLE.deep,
    backgroundColor: PURPLE.border,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    overflow: 'hidden',
    flexShrink: 1,
  },

  figure: { marginTop: SPACING.md, alignItems: 'center' },
  image: { height: 200, borderRadius: 12 },
  caption: { fontSize: TYPE.caption, fontStyle: 'italic', color: SLATE[500], marginTop: 6, textAlign: 'center' },

  centre: { alignItems: 'center', paddingVertical: SPACING.xl, gap: 6 },
  loadingText: { fontSize: TYPE.body, fontWeight: '700', color: PURPLE.deep, marginTop: SPACING.sm },
  loadingHint: { fontSize: TYPE.caption, color: SLATE[500] },
  error: { fontSize: TYPE.body, color: FEEDBACK.errorText, textAlign: 'center', lineHeight: leading(TYPE.body) },
  muted: { fontSize: TYPE.body, color: SLATE[500], fontStyle: 'italic', lineHeight: leading(TYPE.body) },
  retry: {
    marginTop: SPACING.md,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: PURPLE.tint,
    borderWidth: 1,
    borderColor: PURPLE.primary,
  },
  retryText: { fontSize: TYPE.label, fontWeight: '700', color: PURPLE.deep },

  exploreMore: {
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: PURPLE.primary,
  },
  exploreMoreOff: { opacity: 0.6 },
  exploreMoreText: { fontSize: TYPE.heading, fontWeight: '800', color: '#ffffff' },

  pressed: { opacity: 0.8 },
}));
