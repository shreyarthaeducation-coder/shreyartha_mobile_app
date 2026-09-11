import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DONE, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { EmptyState, useToast } from '../ui';
import RichText from '../RichText';
import StudentScaffold from './StudentScaffold';
import { StudentCard, StudentCardTitle, StudentNote } from './StudentCard';
import AiActionBar from './ai/AiActionBar';
import LimitedAccessNote from './LimitedAccessNote';
import CodingAssessment from './coding/CodingAssessment';
import MyProject from './MyProject';
import useStudentAccess from '../../hooks/useStudentAccess';
import { ACCESS } from '../../services/student/accessService';
import { SECTIONS } from '../../services/student/projectService';
import {
  ARENA_WEB_PATH,
  CONTENT_TABS,
  fetchCompletedTopics,
  fetchStudentClass,
  fetchTopicContent,
  fetchTree,
  noClassMatchMessage,
  resolveCodingClass,
  toggleTopicComplete,
} from '../../services/student/codingProService';

/**
 * Coding Pro — curriculum → the student's class → chapters → topics.
 *
 * THE CLASS IS MATCHED BY NAME. Coding Pro has no `classId` on the profile, so the student's class
 * name is normalised and compared against the curriculum's class names (`utils/classMatch`, which
 * is the website's own correct Roman-numeral matcher).
 *
 * **An unmatched class shows NOTHING, not the first class.** Only college students — who have no
 * grade concept — fall back to `classes[0]`. See `resolveCodingClass`: applying that fallback to
 * school students showed a Class 6 student the Class 9 syllabus with nothing on screen to say so.
 *
 * THE CODING ARENA IS NOT NATIVE YET. It needs a code editor and Monaco is browser-only, so the
 * hub links out to the existing web workspace. That is a deliberate hand-off, not a stub.
 */

export default function CodingProScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const { toast, showToast } = useToast();
  const gate = useStudentAccess('CODING_PRO');

  const [curriculums, setCurriculums] = useState([]);
  const [studentClass, setStudentClass] = useState(null);
  const [isCollege, setIsCollege] = useState(false);
  const [curriculum, setCurriculum] = useState(null);
  const [matchedClass, setMatchedClass] = useState(null);
  const [completed, setCompleted] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [openChapter, setOpenChapter] = useState(null);
  /** The My Projects panel, opened from the landing — a list, unlike Skills Edge's single record. */
  const [projectPanel, setProjectPanel] = useState(false);
  const [topic, setTopic] = useState(null);
  const [content, setContent] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [tab, setTab] = useState(CONTENT_TABS[0].key);
  const [mode, setMode] = useState('content'); // content | assessment

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [treeRes, classRes] = await Promise.allSettled([fetchTree(), fetchStudentClass()]);

    if (treeRes.status !== 'fulfilled') {
      setError('Failed to load data');
      setLoading(false);
      return;
    }
    setCurriculums(treeRes.value);
    // The profile is a decoration for the tree but the DECIDER for which class to show, so a
    // failure here must not silently become "school student, no class" — that would render the
    // no-match message for a college student who should see content.
    const who = classRes.status === 'fulfilled' ? classRes.value : null;
    setStudentClass(who?.className ?? null);
    setIsCollege(!!who?.isCollege);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCurriculum = async (c) => {
    if (gate.level('CURRICULUM', c.id) === ACCESS.LOCKED) {
      showToast('Upgrade your plan to access this curriculum.', 'error');
      return;
    }
    setCurriculum(c);
    setTopic(null);
    setOpenChapter(null);
    // College → classes[0]; school → a real name match or NOTHING. Never a blind fallback.
    setMatchedClass(resolveCodingClass(c, studentClass, isCollege));

    // Completion is scoped to this curriculum; the previous one's set must not carry over.
    setCompleted(new Set());
    try {
      setCompleted(await fetchCompletedTopics(c.id));
    } catch {
      setCompleted(new Set());
    }
  };

  const openTopic = async (t, chapterName) => {
    if (gate.level('TOPIC', t.id) === ACCESS.LOCKED) {
      showToast('Upgrade your plan to open this topic.', 'error');
      return;
    }
    setTopic({ ...t, chapterName });
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

  const toggleComplete = async () => {
    try {
      const res = await toggleTopicComplete(topic.id);
      setCompleted((prev) => {
        const next = new Set(prev);
        if (res?.completed) next.add(topic.id);
        else next.delete(topic.id);
        return next;
      });
    } catch (e) {
      showToast(e?.message || 'Could not update your progress.', 'error');
    }
  };

  const chapters = gate.visible('CHAPTER', matchedClass?.chapters || []);
  const isDone = topic ? completed.has(topic.id) : false;

  /* ── Bodies ──────────────────────────────────────────────────────────── */

  const renderTopic = () => (
    <>
      <View style={styles.modeRow}>
        {[
          { key: 'content', label: 'Content' },
          { key: 'assessment', label: 'My Assessment' },
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

      {mode === 'assessment' ? (
        <CodingAssessment
          key={`ca-${topic.id}`}
          topicId={topic.id}
          topicName={topic.name}
          showToast={showToast}
        />
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

          <StudentCard>
            <StudentCardTitle>{CONTENT_TABS.find((t) => t.key === tab)?.label}</StudentCardTitle>

            {/* Coding Pro's tree is curriculum → class → chapter → topic, so there is no subject.
                The web hardcodes `subjectName="Coding Pro"` at its call site; same here. */}
            <AiActionBar
              contentLabel={CONTENT_TABS.find((t) => t.key === tab)?.label}
              context={{
                boardName: curriculum?.name || '',
                className: matchedClass?.name || '',
                subjectName: 'Coding Pro',
                chapterName: topic.chapterName,
                topicName: topic.name,
                contentLabel: CONTENT_TABS.find((t) => t.key === tab)?.label || '',
                contentHtml: content?.[tab] || '',
              }}
            />
            {content?.[tab] ? (
              <RichText html={content[tab]} />
            ) : (
              <StudentNote>
                No {CONTENT_TABS.find((t) => t.key === tab)?.label.toLowerCase()} available.
              </StudentNote>
            )}
          </StudentCard>

          <Pressable
            onPress={toggleComplete}
            style={({ pressed }) => [
              styles.completeBtn,
              isDone && styles.completeOn,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Ionicons
              name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
              size={19}
              color={isDone ? '#ffffff' : palette.onPrimary}
            />
            <Text style={[styles.completeText, isDone && styles.completeTextOn]}>
              {isDone ? 'Completed' : 'Mark as complete'}
            </Text>
          </Pressable>
        </>
      )}
    </>
  );

  const renderChapters = () =>
    // Two DISTINCT empty states, as the web has (CodingPro.js:308-313). "We could not find your
    // class" and "your class has no chapters yet" send the student to different places — the first
    // to their profile, the second to waiting. Collapsing them hides a mismatched class label,
    // which is the condition that produced the wrong-syllabus bug in the first place.
    !matchedClass ? (
      <StudentCard>
        <StudentNote>{noClassMatchMessage(studentClass)}</StudentNote>
        <Text style={styles.emptyHint}>
          Check that the class on your profile matches how your school has named it.
        </Text>
      </StudentCard>
    ) : chapters.length === 0 ? (
      <StudentCard>
        <StudentNote>No chapters available for your class.</StudentNote>
      </StudentCard>
    ) : (
      chapters.map((chapter) => {
        const open = openChapter === chapter.id;
        const topics = gate.visible('TOPIC', chapter.topics || []);
        return (
          <StudentCard key={chapter.id}>
            <Pressable
              onPress={() => setOpenChapter(open ? null : chapter.id)}
              style={({ pressed }) => [styles.rowHead, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
            >
              <Text style={styles.chapterName}>{chapter.name}</Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={palette.deep} />
            </Pressable>

            {open
              ? topics.map((t) => {
                  const locked = gate.level('TOPIC', t.id) === ACCESS.LOCKED;
                  const done = completed.has(t.id);
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => openTopic(t, chapter.name)}
                      style={({ pressed }) => [
                        styles.topic,
                        locked && styles.topicLocked,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={
                          locked ? 'lock-closed' : done ? 'checkmark-circle' : 'code-slash-outline'
                        }
                        size={16}
                        color={locked ? SLATE[400] : done ? DONE : palette.deep}
                      />
                      <Text style={styles.topicName}>{t.name}</Text>
                    </Pressable>
                  );
                })
              : null}
            {open && topics.length === 0 ? (
              <Text style={styles.emptyInline}>No topics in this chapter yet.</Text>
            ) : null}
          </StudentCard>
        );
      })
    );

  const renderCurriculums = () => (
    <>
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/student/feature',
            params: { path: ARENA_WEB_PATH, title: 'Coding Arena' },
          })
        }
        style={({ pressed }) => [pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Open the Coding Arena"
      >
        <StudentCard>
          <View style={styles.rowHead}>
            <View style={styles.arenaIcon}>
              <Ionicons name="terminal-outline" size={19} color={palette.deep} />
            </View>
            <View style={styles.arenaText}>
              <Text style={styles.arenaTitle}>Coding Arena</Text>
              <Text style={styles.arenaSub}>
                Solve problems in Python, Java or C with the full editor.
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color={palette.deep} />
          </View>
        </StudentCard>
      </Pressable>

      {/*
        My Projects — a LIST here, not a single upserted record. Coding is the one section where a
        student can hold several projects and manage them individually, which is why it is a
        top-level card rather than a tab inside a topic the way Skills Edge's is.
      */}
      <Pressable
        onPress={() => setProjectPanel(true)}
        style={({ pressed }) => [pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Open my coding projects"
      >
        <StudentCard>
          <View style={styles.rowHead}>
            <View style={styles.arenaIcon}>
              <Ionicons name="folder-open-outline" size={19} color={palette.deep} />
            </View>
            <View style={styles.arenaText}>
              <Text style={styles.arenaTitle}>My Projects</Text>
              <Text style={styles.arenaSub}>
                Everything you have built — add a title, a write-up and your files.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.deep} />
          </View>
        </StudentCard>
      </Pressable>

      {curriculums.length === 0 ? (
        <EmptyState
          icon="code-slash-outline"
          title="No curriculums yet"
          message="No coding curriculums have been published yet."
        />
      ) : (
        gate.visible('CURRICULUM', curriculums).map((c) => {
          const locked = gate.level('CURRICULUM', c.id) === ACCESS.LOCKED;
          return (
            <Pressable
              key={c.id}
              onPress={() => openCurriculum(c)}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <StudentCard style={locked ? styles.lockedCard : undefined}>
                <View style={styles.rowHead}>
                  <Text style={styles.curriculumName}>{c.name}</Text>
                  <Ionicons
                    name={locked ? 'lock-closed' : 'chevron-forward'}
                    size={18}
                    color={locked ? SLATE[400] : palette.deep}
                  />
                </View>
                {locked ? (
                  <Text style={styles.emptyInline}>Upgrade to access this curriculum.</Text>
                ) : null}
              </StudentCard>
            </Pressable>
          );
        })
      )}
    </>
  );

  const back = () => {
    if (projectPanel) {
      setProjectPanel(false);
      return;
    }
    if (topic) {
      setTopic(null);
      setContent(null);
      setMode('content');
      return;
    }
    setCurriculum(null);
    setMatchedClass(null);
    setOpenChapter(null);
  };

  return (
    <StudentScaffold
      title="Coding"
      loading={loading || gate.loading}
      error={error}
      onRetry={load}
      toast={toast}
    >
      {gate.limited && !gate.loading ? <LimitedAccessNote /> : null}

      {curriculum || projectPanel ? (
        <Pressable
          onPress={back}
          style={({ pressed }) => [styles.crumb, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={16} color={SLATE[600]} />
          <Text style={styles.crumbText} numberOfLines={1}>
            {projectPanel
              ? 'My Projects'
              : [curriculum.name, matchedClass?.name, topic?.chapterName, topic?.name]
                  .filter(Boolean)
                  .join(' › ')}
          </Text>
        </Pressable>
      ) : null}

      {projectPanel ? (
        <MyProject section={SECTIONS.CODING} showToast={showToast} />
      ) : topic ? (
        renderTopic()
      ) : curriculum ? (
        renderChapters()
      ) : (
        renderCurriculums()
      )}
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },

  emptyHint: { fontSize: TYPE.label, color: SLATE[500], lineHeight: leading(TYPE.label), marginTop: 6 },
  emptyInline: { fontSize: TYPE.label, color: SLATE[500], paddingVertical: 6 },

  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: SLATE[200],
    marginBottom: SPACING.md,
  },
  crumbText: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: SLATE[600] },

  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  curriculumName: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  lockedCard: { opacity: 0.62 },
  chapterName: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingLeft: 4 },
  topicLocked: { opacity: 0.55 },
  topicName: { flex: 1, fontSize: TYPE.label, color: SLATE[600] },

  arenaIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  arenaText: { flex: 1 },
  arenaTitle: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  arenaSub: { fontSize: TYPE.caption, color: SLATE[500], lineHeight: leading(TYPE.caption), marginTop: 2 },

  modeRow: { flexDirection: 'row', gap: 7, marginBottom: SPACING.md },
  mode: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: p.headerBorder,
  },
  modeOn: { backgroundColor: p.primary, borderColor: p.primary },
  modeText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[600] },
  modeTextOn: { color: p.onPrimary },

  tabRow: { gap: 7, paddingBottom: SPACING.md, paddingRight: SPACING.md },
  tab: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: SLATE[100],
    borderWidth: 1,
    borderColor: p.headerBorder,
  },
  tabOn: { backgroundColor: p.primary, borderColor: p.primary },
  tabText: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[600] },
  tabTextOn: { color: p.onPrimary },

  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.lg,
  },
  completeOn: { backgroundColor: DONE },
  completeText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  // `onPrimary` is near-black — right on the light-blue button, unreadable on the green one.
  completeTextOn: { color: '#ffffff' },

  pressed: { opacity: 0.78 },
}));
