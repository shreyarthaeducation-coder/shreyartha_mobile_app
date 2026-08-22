import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, PORTALS, SLATE, SPACING } from '../../../constants/theme';
import RichText from '../../RichText';
import ClassQuiz from './ClassQuiz';
import MermaidView from './MermaidView';
import {
  aiErrorText,
  exploreContent,
  fetch3dModels,
  fetchAiSession,
  fetchAiSessions,
  fetchHots,
  fetchQuiz,
} from '../../../services/teacher/aiContentService';

/**
 * The AI half of the resource viewer — ports TeachAiPanel.js.
 *
 * Shows either the current session (brief → follow-ups → results) or, with nothing generated yet,
 * the history of past generations and the saved 3D models for this resource.
 *
 * No DOMPurify equivalent is needed: react-native-render-html cannot execute script, and the
 * backend prompts already constrain the output to the tag set the web's allow-list permits.
 */

const PALETTE = PORTALS.school;

/** Each follow-up is cache-first server-side, so a filled result means the button is done. */
const FOLLOW_UPS = [
  {
    key: 'explore',
    idle: '🔎 Explore Content',
    busy: 'Exploring…',
    has: (s) => !!s.exploreContentHtml,
    run: (id) => exploreContent(id),
    merge: (d) => ({ exploreContentHtml: d.exploreContentHtml }),
  },
  {
    key: 'hots',
    idle: '🧠 Explore HOTS Concept',
    busy: 'Thinking…',
    has: (s) => !!s.hots,
    run: (id) => fetchHots(id),
    merge: (d) => ({ hots: d }),
  },
  {
    key: 'quiz',
    idle: '📝 Test Class Understanding',
    busy: 'Writing questions…',
    has: (s) => !!s.quiz,
    run: (id) => fetchQuiz(id),
    merge: (d) => ({ quiz: d }),
  },
];

export default function TeachAiPanel({
  resource,
  session,
  setSession,
  loading,
  error,
  onView3D,
  models3dVersion = 0,
}) {
  const [history, setHistory] = useState([]);
  const [models3d, setModels3d] = useState([]);
  const [pending, setPending] = useState('');
  const [followUpError, setFollowUpError] = useState('');

  const resourceId = resource?.id;
  const sessionId = session?.id;

  useEffect(() => {
    let alive = true;
    if (!resourceId) return undefined;
    fetchAiSessions(resourceId)
      .then((rows) => alive && setHistory(rows))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // Keyed on primitives only. `session` itself changes identity on every merge, which would
    // refetch the history on each follow-up — the same effect-loop trap the report sheets hit.
  }, [resourceId, sessionId]);

  useEffect(() => {
    let alive = true;
    if (!resourceId) return undefined;
    fetch3dModels(resourceId)
      .then((rows) => alive && setModels3d(rows))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [resourceId, models3dVersion]);

  // setSession comes from the parent as an inline setter; hold it in a ref so the callbacks below
  // stay stable and never re-key an effect.
  const setSessionRef = useRef(setSession);
  useEffect(() => {
    setSessionRef.current = setSession;
  }, [setSession]);

  const openHistorySession = useCallback(async (id) => {
    setFollowUpError('');
    try {
      const dto = await fetchAiSession(id);
      setSessionRef.current(dto);
    } catch (e) {
      setFollowUpError(aiErrorText(e, "Couldn't open that generation."));
    }
  }, []);

  const runFollowUp = useCallback(
    async (item) => {
      if (pending || !sessionId) return;
      setPending(item.key);
      setFollowUpError('');
      try {
        const data = await item.run(sessionId);
        setSessionRef.current((prev) => ({ ...prev, ...item.merge(data) }));
      } catch (e) {
        setFollowUpError(aiErrorText(e, "That didn't work — please try again."));
      }
      setPending('');
    },
    [pending, sessionId],
  );

  const video = session?.brief?.video;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {followUpError ? <Text style={styles.errorBanner}>{followUpError}</Text> : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={PALETTE.primary} />
          <Text style={styles.loadingText}>Reading the selection…</Text>
        </View>
      ) : null}

      {!loading && !session ? (
        <>
          <Text style={styles.emptyHint}>
            Tap the 🔍 button and select a part of the document — I'll turn it into teaching
            content: an explanation with real-life relevance, an illustration, a diagram and a
            video suggestion. Or select an object (a heart, a molecule…) and tap 🧊 3D to
            demonstrate it in three dimensions.
          </Text>

          {models3d.length > 0 && onView3D ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>🧊 3D models for this resource</Text>
              <View style={styles.modelGrid}>
                {models3d.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => onView3D(m.modelUrl)}
                    style={({ pressed }) => [styles.modelItem, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Open in the 3D viewer"
                  >
                    {m.regionImageUrl ? (
                      <Image source={{ uri: m.regionImageUrl }} style={styles.modelThumb} />
                    ) : (
                      <View style={[styles.modelThumb, styles.modelThumbBlank]} />
                    )}
                    <Text style={styles.modelBadge}>3D</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {history.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Past generations for this resource</Text>
              {history.map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => openHistorySession(h.id)}
                  style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  {h.regionImageUrl ? (
                    <Image source={{ uri: h.regionImageUrl }} style={styles.historyThumb} />
                  ) : null}
                  <View style={styles.historyText}>
                    <Text style={styles.historyPreview} numberOfLines={2}>
                      {h.preview || '(selection)'}
                    </Text>
                    <Text style={styles.historyMeta}>{formatStamp(h.createdAt)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={SLATE[400]} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {!loading && session ? (
        <>
          {session.regionImageUrl ? (
            <Image
              source={{ uri: session.regionImageUrl }}
              style={styles.regionThumb}
              resizeMode="contain"
              accessibilityLabel="Selected region"
            />
          ) : null}

          {session.brief?.html ? (
            <RichText html={session.brief.html} textStyle={styles.richText} />
          ) : null}

          {session.brief?.imageUrl ? (
            <View style={styles.figure}>
              <Image
                source={{ uri: session.brief.imageUrl }}
                style={styles.figureImg}
                resizeMode="contain"
              />
              {session.brief.imageCaption ? (
                <Text style={styles.caption}>{session.brief.imageCaption}</Text>
              ) : null}
            </View>
          ) : null}

          <MermaidView code={session.brief?.diagramMermaid} />

          {/* The web embeds a YouTube iframe. A card that opens the YouTube app is better on a
              phone — full screen, real playback controls, and no in-page WebView to manage. */}
          {video?.videoId ? (
            <Pressable
              onPress={() =>
                Linking.openURL(`https://www.youtube.com/watch?v=${video.videoId}`).catch(() => {})
              }
              style={({ pressed }) => [styles.videoCard, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="logo-youtube" size={24} color="#dc2626" />
              <Text style={styles.videoTitle} numberOfLines={2}>
                {video.title || 'Suggested video'}
              </Text>
              <Ionicons name="open-outline" size={16} color={SLATE[400]} />
            </Pressable>
          ) : null}

          <View style={styles.followUps}>
            {FOLLOW_UPS.map((item) => {
              const done = item.has(session);
              const busy = pending === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => runFollowUp(item)}
                  disabled={!!pending || done}
                  style={({ pressed }) => [
                    styles.followBtn,
                    (done || !!pending) && styles.followBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.followText, (done || !!pending) && styles.followTextOff]}>
                    {busy ? item.busy : item.idle}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {session.exploreContentHtml ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>🔎 Deeper Exploration</Text>
              <RichText html={session.exploreContentHtml} textStyle={styles.richText} />
            </View>
          ) : null}

          {session.hots ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>🧠 HOTS Deep-Dive</Text>
              <RichText html={session.hots.analysisHtml} textStyle={styles.richText} />
              {(session.hots.discussionQuestions || []).length > 0 ? (
                <>
                  <Text style={styles.blockTitle}>💬 Classroom Discussion Questions</Text>
                  {session.hots.discussionQuestions.map((q, i) => (
                    <View key={i} style={styles.discussionRow}>
                      <Text style={styles.discussionNum}>{i + 1}.</Text>
                      <Text style={styles.discussionText}>{q}</Text>
                    </View>
                  ))}
                </>
              ) : null}
            </View>
          ) : null}

          {session.quiz ? (
            // Keyed on the session so switching generations resets the quiz rather than carrying
            // the previous one's solved/wrong maps across.
            <ClassQuiz key={session.id} questions={session.quiz.questions || []} />
          ) : null}

          <Pressable
            onPress={() => setSessionRef.current(null)}
            style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.newText}>↩ New selection / history</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

/** `createdAt` is a bare LocalDateTime string — no zone suffix, so never hand it to new Date(). */
function formatStamp(raw) {
  if (!raw) return '';
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return String(raw);
  const [, y, mo, d, hh, mm] = m;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}, ${hh}:${mm}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: SLATE[50] },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },

  errorBanner: {
    fontSize: 12.5,
    color: FEEDBACK.errorText,
    backgroundColor: FEEDBACK.errorBg,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  loading: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xl },
  loadingText: { fontSize: 13, color: SLATE[500] },
  emptyHint: { fontSize: 13, lineHeight: 20, color: SLATE[600] },

  block: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  blockTitle: { fontSize: 13.5, fontWeight: '700', color: SLATE[800], marginBottom: SPACING.sm },

  modelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modelItem: { width: 78, height: 78, borderRadius: 10, overflow: 'hidden', backgroundColor: SLATE[100] },
  modelThumb: { width: '100%', height: '100%' },
  modelThumbBlank: { backgroundColor: SLATE[200] },
  modelBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    backgroundColor: 'rgba(15,23,42,0.72)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  historyThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: SLATE[100] },
  historyText: { flex: 1 },
  historyPreview: { fontSize: 13, color: SLATE[700] },
  historyMeta: { fontSize: 11, color: SLATE[400], marginTop: 2 },

  regionThumb: {
    width: '100%',
    height: 130,
    borderRadius: 10,
    marginBottom: SPACING.sm,
    backgroundColor: SLATE[100],
  },
  richText: { fontSize: 14, lineHeight: 21, color: SLATE[700] },
  figure: { marginBottom: SPACING.sm },
  figureImg: { width: '100%', height: 190, borderRadius: 10, backgroundColor: SLATE[100] },
  caption: { fontSize: 11.5, color: SLATE[500], fontStyle: 'italic', marginTop: 4, textAlign: 'center' },

  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
    marginBottom: SPACING.sm,
  },
  videoTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: SLATE[700] },

  followUps: { gap: 8, marginTop: SPACING.sm },
  followBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: PALETTE.tint,
  },
  followBtnDisabled: { backgroundColor: SLATE[100] },
  followText: { fontSize: 13.5, fontWeight: '700', color: PALETTE.primaryDark },
  followTextOff: { color: SLATE[400] },

  discussionRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  discussionNum: { fontSize: 13, fontWeight: '700', color: PALETTE.primaryDark },
  discussionText: { flex: 1, fontSize: 13, lineHeight: 20, color: SLATE[700] },

  newBtn: {
    marginTop: SPACING.lg,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  newText: { fontSize: 13, fontWeight: '700', color: SLATE[600] },
  pressed: { opacity: 0.75 },
});
