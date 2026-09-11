import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { EmptyState, SegmentedTabs } from '../ui';
import StudentScaffold from './StudentScaffold';
import { StudentCard, StudentCardTitle, StudentNote } from './StudentCard';
import { useTranslations } from '../../hooks/useTranslations';
import JyoraSheet from './ai/JyoraSheet';
import DoubtSheet from './ai/DoubtSheet';
import { SOURCES } from '../../services/student/doubtService';
import {
  fetchAcademicProfile,
  fetchTopicContent,
  fetchTree,
  resolveClassSubjects,
} from '../../services/student/academicIqService';

/**
 * "Connect with Jyora" — the destination for the dashboard's tutor card.
 *
 * ── WHY THIS IS NOT A CHAT BOX ──────────────────────────────────────────────
 * `JyoraSheet` explains the topic a student is already looking at, and every other entry point in
 * the app is an action bar sitting next to that topic's content. The dashboard card has no topic, so
 * something had to supply one.
 *
 * The obvious answer — a free-text "ask Jyora anything" field — is the one thing the website
 * deliberately does not have. `JyoraModal.js` records the reason: students could enter unsafe
 * queries, so the modal ships with no input at all and its "Explore more" button resends a fixed
 * prompt. Adding a free-text box on mobile would quietly undo a safety decision made on the web, so
 * this screen gives Jyora a topic instead:
 *
 *   Explain a topic     pick Subject → Chapter → Topic from the student's own syllabus, then open
 *                       the existing sheet with real context and the topic's real content.
 *   I'm stuck           open Doubt Resolution with `source: CHATBOT` — the photograph-a-question
 *                       route, which IS the free-form path and already exists.
 *
 * Both reuse their sheets verbatim; nothing about the AI plumbing is new here.
 *
 * ── DOUBT RESOLUTION IS THREE-ROLE ──────────────────────────────────────────
 * `/api/student/doubt/*` is FREE / SCHOOL / PREMIUM only — college students get a 403. The tab is
 * still shown, because the sheet surfaces the server's own refusal, and hiding a feature a student
 * may have used on the website would be more confusing than letting it say why.
 */

const STRINGS = {
  title: 'Jyora',
  subtitle: 'Your personal tutor. Pick something to go over, or show me what you are stuck on.',
  tabTopic: 'Explain a topic',
  tabStuck: "I'm stuck",
  subject: 'Subject',
  loadingTree: 'Loading your syllabus…',
  noSubjects: 'No syllabus yet',
  noSubjectsBody:
    'Choose your board and class in your Academic IQ profile and your subjects will appear here.',
  stuckTitle: 'Show Jyora the question',
  stuckBody:
    'Take a photo of the question — or pick one from your gallery — and work through it together, a step at a time.',
  stuckCta: 'Start with a photo',
  preparing: 'Opening…',
};

export default function JyoraHubScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const t = useTranslations(STRINGS);

  const [mode, setMode] = useState('topic');

  const [subjects, setSubjects] = useState([]);
  const [header, setHeader] = useState({ boardName: '', className: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [openSubject, setOpenSubject] = useState(null);
  const [openChapter, setOpenChapter] = useState(null);

  const [preparing, setPreparing] = useState(false);
  const [jyora, setJyora] = useState(null); // { context, contentLabel }
  const [doubtOpen, setDoubtOpen] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const [profileRes, treeRes] = await Promise.allSettled([fetchAcademicProfile(), fetchTree()]);
    const profile = profileRes.status === 'fulfilled' ? profileRes.value : null;
    const tree = treeRes.status === 'fulfilled' ? treeRes.value : [];

    // The same resolver School Resources uses: narrows the whole academiciq tree to this student's
    // board and class, and reports the "go and choose" state rather than an empty tree.
    const resolved = resolveClassSubjects(tree, profile);
    setHeader({ boardName: resolved.boardName, className: resolved.className });
    if (resolved.error) setError(resolved.error);
    else setSubjects(resolved.subjects);

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Open the sheet for a topic, with its content.
   *
   * The content fetch is best-effort and the sheet opens either way. `contentHtml` is what Jyora
   * actually reads — the controller takes a bare `Map<String,String>` with `getOrDefault`, so an
   * absent key is silently empty rather than an error, and Jyora falls back to explaining the topic
   * name alone. A missing content record is a thinner answer, not a broken screen.
   */
  const explain = async (subject, chapter, topic) => {
    setPreparing(true);
    let content = null;
    try {
      content = await fetchTopicContent(topic.id);
    } catch {
      content = null;
    }
    setPreparing(false);
    setJyora({
      contentLabel: 'Topic Explanation',
      context: {
        boardName: header.boardName,
        className: header.className,
        subjectName: subject.name,
        chapterName: chapter.name,
        topicName: topic.name,
        contentLabel: 'Topic Explanation',
        // THE FIELD IS `contentHtml`. The web component's prop is called `staticContent`, and using
        // that name here sends Jyora nothing at all — silently.
        contentHtml: content?.topicExplanation || content?.lessonPlan || '',
      },
    });
  };

  return (
    <StudentScaffold title={t.title} loading={loading}>
      <View style={styles.hero}>
        <Image source={require('../../assets/images/Jyora.png')} style={styles.avatar} />
        <Text style={styles.subtitle}>{t.subtitle}</Text>
      </View>

      <SegmentedTabs
        options={[
          { value: 'topic', label: t.tabTopic },
          { value: 'stuck', label: t.tabStuck },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'stuck' ? (
        <StudentCard style={styles.stuck}>
          <StudentCardTitle>{t.stuckTitle}</StudentCardTitle>
          <StudentNote>{t.stuckBody}</StudentNote>
          <Pressable
            onPress={() => setDoubtOpen(true)}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="camera-outline" size={18} color={palette.onPrimary} />
            <Text style={styles.ctaText}>{t.stuckCta}</Text>
          </Pressable>
        </StudentCard>
      ) : error ? (
        <StudentCard>
          <StudentNote>{error}</StudentNote>
        </StudentCard>
      ) : subjects.length === 0 ? (
        <EmptyState icon="school-outline" title={t.noSubjects} message={t.noSubjectsBody} />
      ) : (
        <View style={styles.tree}>
          {header.boardName || header.className ? (
            <Text style={styles.header}>
              {[header.boardName, header.className].filter(Boolean).join(' · ')}
            </Text>
          ) : null}

          {subjects.map((subject) => {
            const subjectOpen = openSubject === subject.id;
            return (
              <StudentCard key={subject.id}>
                <Pressable
                  onPress={() => {
                    setOpenSubject(subjectOpen ? null : subject.id);
                    setOpenChapter(null);
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: subjectOpen }}
                >
                  <Text style={styles.subjectName}>{subject.name}</Text>
                  <Ionicons
                    name={subjectOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={palette.primary}
                  />
                </Pressable>

                {subjectOpen
                  ? (subject.chapters || []).map((chapter) => {
                      const chapterOpen = openChapter === chapter.id;
                      return (
                        <View key={chapter.id} style={styles.chapter}>
                          <Pressable
                            onPress={() => setOpenChapter(chapterOpen ? null : chapter.id)}
                            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: chapterOpen }}
                          >
                            <Text style={styles.chapterName}>{chapter.name}</Text>
                            <Ionicons
                              name={chapterOpen ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={SLATE[600]}
                            />
                          </Pressable>

                          {chapterOpen
                            ? (chapter.topics || []).map((topic) => (
                                <Pressable
                                  key={topic.id}
                                  onPress={() => explain(subject, chapter, topic)}
                                  disabled={preparing}
                                  style={({ pressed }) => [styles.topic, pressed && styles.pressed]}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Ask Jyora about ${topic.name}`}
                                >
                                  <Text style={styles.topicText} numberOfLines={2}>
                                    {topic.name}
                                  </Text>
                                  <Ionicons name="sparkles-outline" size={16} color={palette.primary} />
                                </Pressable>
                              ))
                            : null}
                        </View>
                      );
                    })
                  : null}
              </StudentCard>
            );
          })}
        </View>
      )}

      {preparing ? (
        <View style={styles.preparing}>
          <ActivityIndicator size="small" color={palette.primary} />
          <Text style={styles.preparingText}>{t.preparing}</Text>
        </View>
      ) : null}

      {/* Mounted only while open — a 120-second request must not be able to fire from a closed
          sheet, and a tree of topics must not hold a sheet each. */}
      {jyora ? (
        <JyoraSheet
          visible
          onClose={() => setJyora(null)}
          context={jyora.context}
          contentLabel={jyora.contentLabel}
        />
      ) : null}

      {doubtOpen ? (
        <DoubtSheet visible onClose={() => setDoubtOpen(false)} source={SOURCES.CHATBOT} />
      ) : null}
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  hero: { alignItems: 'center', marginBottom: SPACING.md },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: SPACING.sm },
  subtitle: {
    fontSize: TYPE.label,
    color: SLATE[600],
    textAlign: 'center',
    lineHeight: leading(TYPE.label),
  },

  tree: { marginTop: SPACING.md },
  header: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: SLATE[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
  },
  subjectName: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  chapter: { marginLeft: SPACING.sm, marginTop: 2 },
  chapterName: { flex: 1, fontSize: TYPE.body, fontWeight: '600', color: SLATE[600] },
  topic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    paddingHorizontal: 12,
    marginLeft: SPACING.md,
    marginBottom: 5,
    borderRadius: 10,
    backgroundColor: SLATE[50],
  },
  topicText: { flex: 1, fontSize: TYPE.body, color: SLATE[700] },

  stuck: { marginTop: SPACING.md },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: TOUCH.min,
    borderRadius: 999,
    backgroundColor: p.primary,
    marginTop: SPACING.md,
  },
  ctaText: { fontSize: TYPE.heading, fontWeight: '800', color: p.onPrimary },

  preparing: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  preparingText: { fontSize: TYPE.label, color: SLATE[600] },

  pressed: { opacity: 0.78 },
}));
