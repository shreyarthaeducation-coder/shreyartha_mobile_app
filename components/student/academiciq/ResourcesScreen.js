import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { formatLongDateTime } from '../../../utils/dates';
import { EmptyState, useToast } from '../../ui';
import RichText from '../../RichText';
import StudentScaffold from '../StudentScaffold';
import { StudentCard, StudentCardTitle, StudentNote } from '../StudentCard';
import LimitedAccessNote from '../LimitedAccessNote';
import { SOURCES } from '../../../services/student/doubtService';
import AiActionBar from '../ai/AiActionBar';
import UnderstandingTest from '../skillsedge/UnderstandingTest';
import MyReflection from './MyReflection';
import useStudentAccess from '../../../hooks/useStudentAccess';
import { ACCESS } from '../../../services/student/accessService';
import {
  CONTENT_TABS,
  fetchAcademicProfile,
  fetchPersonalizedSubjects,
  fetchTopicContent,
  fetchTree,
  fetchUnderstandingQuestions,
  resolveClassSubjects,
} from '../../../services/student/academicIqService';

/**
 * School Resources and Personalized Resources — one screen, two sources.
 *
 * The two web components are 84% identical (316 differing lines out of ~1,928): same drill, same
 * six content tabs, same understanding test, same reflection. They differ only in where the
 * subject list comes from:
 *
 *   school        /api/academiciq/tree, narrowed to the profile's curriculum + class
 *   personalized  /api/students/personalized-resources — its OWN tree of what a teacher assigned
 *
 * Note personalized does NOT filter the academiciq tree; it is a separate endpoint returning the
 * same `subjects → chapters → topics` shape. The web fetches the academiciq tree on that screen
 * too, but only to look up the board and class names for the header.
 *
 * Jyora and Shreya Speak are wired (`AiActionBar`). **Doubt Resolution is still out of scope** —
 * it is a staged multi-step flow with camera and screenshot capture, deferred to its own pass.
 */

export default function ResourcesScreen({ source = 'school' }) {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const { toast, showToast } = useToast();
  const gate = useStudentAccess('ACADEMIC_IQ');

  const isPersonalized = source === 'personalized';

  const [subjects, setSubjects] = useState([]);
  const [header, setHeader] = useState({ boardName: '', className: '' });
  // When the student last saved their Academic IQ profile. The web shows it on this screen
  // (`PersonalizedResources.js`) precisely because an empty tree here usually means the profile was
  // never saved, and a date — or its absence — is the fastest way for a student to tell.
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [openSubject, setOpenSubject] = useState(null);
  const [openChapter, setOpenChapter] = useState(null);
  const [topic, setTopic] = useState(null);
  const [content, setContent] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [tab, setTab] = useState(CONTENT_TABS[0].key);
  const [mode, setMode] = useState('content'); // content | understanding | reflection

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    // The profile is needed by both: it selects the class for `school`, and supplies the header
    // names for `personalized`.
    const [profileRes, treeRes, personalRes] = await Promise.allSettled([
      fetchAcademicProfile(),
      fetchTree(),
      isPersonalized ? fetchPersonalizedSubjects() : Promise.resolve(null),
    ]);

    const profile = profileRes.status === 'fulfilled' ? profileRes.value : null;
    const tree = treeRes.status === 'fulfilled' ? treeRes.value : [];
    const resolved = resolveClassSubjects(tree, profile);
    setHeader({ boardName: resolved.boardName, className: resolved.className });
    setLastSavedAt(profile?.lastSavedAt || null);

    if (isPersonalized) {
      if (personalRes.status !== 'fulfilled') {
        setError('Could not load your personalized resources.');
        setLoading(false);
        return;
      }
      setSubjects(personalRes.value);
    } else {
      // A missing curriculum/class is a "go and choose" state, not a failure — the web says so
      // explicitly rather than showing an empty tree.
      if (resolved.error) {
        setError(resolved.error);
        setLoading(false);
        return;
      }
      setSubjects(resolved.subjects);
    }
    setLoading(false);
  }, [isPersonalized]);

  useEffect(() => {
    load();
  }, [load]);

  const openTopic = async (t, subjectName, chapterName) => {
    if (gate.level('TOPIC', t.id) === ACCESS.LOCKED) {
      showToast('Upgrade your plan to open this topic.', 'error');
      return;
    }
    setTopic({ ...t, subjectName, chapterName });
    setTab(CONTENT_TABS[0].key);
    setMode('content');
    setContent(null);
    setContentLoading(true);
    try {
      setContent(await fetchTopicContent(t.id));
    } catch {
      setContent({});
    } finally {
      setContentLoading(false);
    }
  };

  const openUrl = (url) => {
    if (url) Linking.openURL(url).catch(() => showToast('Could not open that link.', 'error'));
  };

  const visibleSubjects = gate.visible('SUBJECT', subjects);

  /* ── Topic detail ────────────────────────────────────────────────────── */

  const renderContentTab = () => {
    const activeTab = CONTENT_TABS.find((t) => t.key === tab);
    const body = content?.[tab];
    const video = content?.[`${tab}VideoUrl`];
    const image = content?.[`${tab}ImageUrl`];

    return (
      <StudentCard>
        <StudentCardTitle>{activeTab?.label}</StudentCardTitle>

        {/* Jyora + Shreya Speak. Above the prose, matching the web's `.jyora-action-section`,
            which sits beside the tab strip rather than inside the content. */}
        <AiActionBar
          contentLabel={activeTab?.label}
          doubtSource={isPersonalized ? SOURCES.PERSONALIZED : SOURCES.SCHOOL}
          context={{
            boardName: header.boardName,
            className: header.className,
            subjectName: topic.subjectName,
            chapterName: topic.chapterName,
            topicName: topic.name,
            contentLabel: activeTab?.label || '',
            contentHtml: body || '',
          }}
        />

        {body ? (
          <RichText html={body} />
        ) : (
          <StudentNote>Nothing has been added under this heading yet.</StudentNote>
        )}
        {video ? (
          <Pressable
            onPress={() => openUrl(video)}
            style={({ pressed }) => [styles.mediaBtn, pressed && styles.pressed]}
          >
            <Ionicons name="videocam-outline" size={15} color={palette.deep} />
            <Text style={styles.mediaText}>Watch the video</Text>
          </Pressable>
        ) : null}
        {image ? (
          <Pressable
            onPress={() => openUrl(image)}
            style={({ pressed }) => [styles.mediaBtn, pressed && styles.pressed]}
          >
            <Ionicons name="image-outline" size={15} color={palette.deep} />
            <Text style={styles.mediaText}>View the image</Text>
          </Pressable>
        ) : null}
      </StudentCard>
    );
  };

  const renderTopic = () => (
    <>
      <View style={styles.modeRow}>
        {[
          { key: 'content', label: 'Resources' },
          { key: 'understanding', label: 'Test Yourself' },
          { key: 'reflection', label: 'My Reflection' },
        ].map((m) => {
          const on = mode === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => setMode(m.key)}
              style={({ pressed }) => [styles.mode, on && styles.modeOn, pressed && styles.pressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.modeText, on && styles.modeTextOn]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'understanding' ? (
        <UnderstandingTest
          key={`u-${topic.id}`}
          moduleId={topic.id}
          loadQuestions={fetchUnderstandingQuestions}
          showToast={showToast}
          topicName={topic.name}
          subjectName={topic.subjectName}
          chapterName={topic.chapterName}
        />
      ) : mode === 'reflection' ? (
        <MyReflection key={`r-${topic.id}`} topicId={topic.id} topicName={topic.name} showToast={showToast} />
      ) : contentLoading ? (
        <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
          >
            {CONTENT_TABS.map((t) => {
              const on = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {renderContentTab()}
        </>
      )}
    </>
  );

  /* ── Tree ────────────────────────────────────────────────────────────── */

  const renderTree = () =>
    visibleSubjects.length === 0 ? (
      /* THE OLD COPY HERE BLAMED THE TEACHER, AND THAT WAS WRONG.
         It said "your teacher has not assigned any resources to you yet". This endpoint —
         `/api/students/personalized-resources`, the American `z` — reads the student's OWN
         AcademicProfile: `PersonalizedResourcesService` walks profile_subjects → profile_chapters
         → profile_topics and returns an empty list when the student has no profile at all. No
         teacher is involved anywhere in it. A student who had simply never saved their subject
         selections was told their teacher had done nothing, and sent to a dead end.

         The teacher-assigned material is the OTHER spelling — `/api/students/personalised-resources`
         with an `s` — which is now its own screen. Hence the second action below. */
      <EmptyState
        icon="library-outline"
        title={isPersonalized ? 'No subjects selected yet' : 'No subjects yet'}
        message={
          isPersonalized
            ? 'These are the subjects, chapters and topics you picked in your Academic IQ profile. Choose some there and they will appear here.'
            : 'No subjects have been published for your class yet.'
        }
        actionLabel={isPersonalized ? 'Open my Academic IQ profile' : undefined}
        onAction={
          isPersonalized
            ? () => router.push({ pathname: '/student/profile', params: { tab: 'academic' } })
            : undefined
        }
      />
    ) : (
      visibleSubjects.map((subject) => {
        const subjectOpen = openSubject === subject.id;
        const chapters = gate.visible('CHAPTER', subject.chapters || []);
        return (
          <StudentCard key={subject.id}>
            <Pressable
              onPress={() => {
                setOpenSubject(subjectOpen ? null : subject.id);
                setOpenChapter(null);
              }}
              style={({ pressed }) => [styles.rowHead, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ expanded: subjectOpen }}
            >
              <Text style={styles.subjectName}>{subject.name}</Text>
              <Ionicons
                name={subjectOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={palette.deep}
              />
            </Pressable>

            {subjectOpen
              ? chapters.map((chapter) => {
                  const chapterOpen = openChapter === chapter.id;
                  const topics = gate.visible('TOPIC', chapter.topics || []);
                  return (
                    <View key={chapter.id} style={styles.chapter}>
                      <Pressable
                        onPress={() => setOpenChapter(chapterOpen ? null : chapter.id)}
                        style={({ pressed }) => [styles.rowHead, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: chapterOpen }}
                      >
                        <Text style={styles.chapterName}>{chapter.name}</Text>
                        <Ionicons
                          name={chapterOpen ? 'remove' : 'add'}
                          size={15}
                          color={SLATE[500]}
                        />
                      </Pressable>

                      {chapterOpen
                        ? topics.map((t) => {
                            const locked = gate.level('TOPIC', t.id) === ACCESS.LOCKED;
                            return (
                              <Pressable
                                key={t.id}
                                onPress={() => openTopic(t, subject.name, chapter.name)}
                                style={({ pressed }) => [
                                  styles.topic,
                                  locked && styles.topicLocked,
                                  pressed && styles.pressed,
                                ]}
                                accessibilityRole="button"
                              >
                                <Ionicons
                                  name={locked ? 'lock-closed' : 'document-text-outline'}
                                  size={13}
                                  color={locked ? SLATE[400] : palette.deep}
                                />
                                <Text style={styles.topicName}>{t.name}</Text>
                              </Pressable>
                            );
                          })
                        : null}
                      {chapterOpen && topics.length === 0 ? (
                        <Text style={styles.emptyInline}>No topics in this chapter yet.</Text>
                      ) : null}
                    </View>
                  );
                })
              : null}
            {subjectOpen && chapters.length === 0 ? (
              <Text style={styles.emptyInline}>No chapters in this subject yet.</Text>
            ) : null}
          </StudentCard>
        );
      })
    );

  const title = isPersonalized ? 'Personalized Resources' : 'School Resources';

  return (
    <StudentScaffold
      title={title}
      loading={loading || gate.loading}
      error={error}
      onRetry={load}
      toast={toast}
    >
      {gate.limited && !gate.loading ? <LimitedAccessNote /> : null}

      {topic ? (
        <Pressable
          onPress={() => {
            setTopic(null);
            setContent(null);
            setMode('content');
          }}
          style={({ pressed }) => [styles.crumb, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to the subject list"
        >
          <Ionicons name="arrow-back" size={14} color={palette.onDark} />
          <Text style={styles.crumbText} numberOfLines={1}>
            {[topic.subjectName, topic.chapterName, topic.name].filter(Boolean).join(' › ')}
          </Text>
        </Pressable>
      ) : header.boardName || header.className ? (
        <Text style={styles.header}>
          {[header.boardName, header.className].filter(Boolean).join(' · ')}
        </Text>
      ) : null}

      {/* The web's `lastSavedAt` line, ported. On this screen the tree IS the student's saved
          profile, so when it looks wrong the first question is always "when did I last save it" —
          and "never" is the answer that explains an empty list. */}
      {isPersonalized && !topic ? (
        <Text style={styles.saved}>
          {lastSavedAt
            ? `Your selections were last saved ${formatLongDateTime(lastSavedAt)}.`
            : 'You have not saved your Academic IQ selections yet.'}
        </Text>
      ) : null}

      {topic ? renderTopic() : renderTree()}
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },
  emptyInline: { fontSize: TYPE.label, color: SLATE[400], paddingVertical: 6, paddingLeft: 4 },

  header: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: p.onDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  saved: { fontSize: TYPE.caption, color: p.onDark, marginBottom: SPACING.sm },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: p.glass,
    borderWidth: 1,
    borderColor: p.glassBorder,
    marginBottom: SPACING.md,
  },
  crumbText: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: p.onDark },

  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  subjectName: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  chapter: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
  },
  chapterName: { flex: 1, fontSize: TYPE.body, fontWeight: '600', color: SLATE[700] },
  topic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 4,
  },
  topicLocked: { opacity: 0.55 },
  topicName: { flex: 1, fontSize: TYPE.label, color: SLATE[600] },

  modeRow: { flexDirection: 'row', gap: 7, marginBottom: SPACING.md },
  mode: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: p.headerBorder,
  },
  modeOn: { backgroundColor: p.primary, borderColor: p.primary },
  modeText: { fontSize: TYPE.label, fontWeight: '600', color: p.onDark },
  modeTextOn: { color: p.onPrimary },

  tabRow: { gap: 7, paddingBottom: SPACING.md, paddingRight: SPACING.md },
  tab: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: p.headerBorder,
  },
  tabOn: { backgroundColor: p.primary, borderColor: p.primary },
  tabText: { fontSize: TYPE.label, fontWeight: '600', color: p.onDark },
  tabTextOn: { color: p.onPrimary },

  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: SPACING.sm,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: p.tint,
  },
  mediaText: { fontSize: TYPE.label, fontWeight: '600', color: p.deep },

  pressed: { opacity: 0.78 },
}));
