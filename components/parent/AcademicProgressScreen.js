import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { Card, CardTitle, ScreenScaffold } from '../ui';
import AnalyticsBody from '../student/analytics/AnalyticsBody';
import {
  fetchAcademicProfile,
  fetchMockTests,
  loadParentAnalytics,
} from '../../services/parent/analyticsService';
import { fetchHiddenNodes, visible } from '../../services/parent/accessService';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Academic Progress — the parent's view of everything their child is doing.
 *
 * TWO PARTS, as on the web:
 *   A. the child's selected Academic IQ subjects → chapters → topics
 *   B. the full analytics overview
 *
 * Part B is `AnalyticsBody`, the SAME component the student's My Analytics renders — because it is
 * the same data. Every parent endpoint resolves the linked child and calls the very same service
 * method the student endpoint calls, so there is nothing to translate.
 *
 * `showPsychometric={false}`: the parent's psychometric lives on its own Assessment Results tab and
 * arrives flat (`completedCount`/`totalTopics`/`hasCompletedAssessment`), not as the report slices
 * `PsychometricSummary` cross-cuts. The opaque `ui/Card` pair is passed in for the same reason the
 * student passes its translucent one — see AnalyticsBody's note on injected cards.
 *
 * HIDDEN NODES ARE FILTERED, and must be: the web runs every tree through its hidden-nodes hook, so
 * skipping it here would show parents content an admin has deliberately hidden. It goes through
 * `services/parent/accessService`, NOT the student one — that file explains why at length.
 */

export default function AcademicProgressScreen() {
  const styles = useStyles();
  const palette = usePalette();

  const [state, setState] = useState({ analytics: null, spineError: null, parts: {} });
  const [profile, setProfile] = useState(null);
  const [hidden, setHidden] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openExam, setOpenExam] = useState(null);
  const [mockTests, setMockTests] = useState({});
  const [openSubject, setOpenSubject] = useState(null);
  const [openChapter, setOpenChapter] = useState(null);

  const load = useCallback(async () => {
    const [next, profileRes, hiddenRes] = await Promise.all([
      loadParentAnalytics(),
      // Part A is its own read and its own failure: a child with no Academic IQ profile still gets
      // the whole analytics overview below.
      fetchAcademicProfile().catch(() => null),
      fetchHiddenNodes('ACADEMIC_IQ'),
    ]);
    setState(next);
    setProfile(profileRes);
    setHidden(hiddenRes);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { analytics, spineError, parts } = state;

  /** Lazy per-exam, on expand — a child can have several and each is its own round trip. */
  const toggleExam = async (exam) => {
    if (openExam === exam.id) {
      setOpenExam(null);
      return;
    }
    setOpenExam(exam.id);
    if (mockTests[exam.id]) return;
    try {
      const data = await fetchMockTests(exam.id);
      setMockTests((prev) => ({ ...prev, [exam.id]: data }));
    } catch {
      setMockTests((prev) => ({ ...prev, [exam.id]: null }));
    }
  };

  const subjects = visible(hidden, 'SUBJECT', profile?.subjects, (s) => s.subjectId);

  return (
    <ScreenScaffold
      title="Academic Progress"
      fallbackRoute="/parent"
      loading={loading}
      error={spineError && !analytics ? spineError : ''}
      onRetry={load}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {/* ── Part A: selected chapters and topics ─────────────────────────── */}
      <Card>
        <CardTitle>📖 Selected Chapters &amp; Topics</CardTitle>
        {subjects.length === 0 ? (
          <Text style={styles.empty}>
            No chapters or topics selected in the Academic IQ profile yet.
          </Text>
        ) : (
          subjects.map((subject) => {
            const subjectOpen = openSubject === subject.subjectId;
            const chapters = visible(
              hidden,
              'CHAPTER',
              subject.chapters,
              (c) => c.chapterId,
            );
            return (
              <View key={subject.subjectId} style={styles.node}>
                <Pressable
                  onPress={() => setOpenSubject(subjectOpen ? null : subject.subjectId)}
                  style={({ pressed }) => [styles.nodeHead, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: subjectOpen }}
                >
                  <Ionicons
                    name={subjectOpen ? 'chevron-down' : 'chevron-forward'}
                    size={18}
                    color={palette.primaryDark}
                  />
                  <Text style={styles.subject} numberOfLines={2}>
                    {subject.subjectName}
                  </Text>
                  <Text style={styles.count}>{chapters.length}</Text>
                </Pressable>

                {subjectOpen
                  ? chapters.map((chapter) => {
                      const key = `${subject.subjectId}:${chapter.chapterId}`;
                      const chapterOpen = openChapter === key;
                      const topics = visible(
                        hidden,
                        'TOPIC',
                        chapter.topics,
                        (t) => t.topicId,
                      );
                      return (
                        <View key={key} style={styles.chapter}>
                          <Pressable
                            onPress={() => setOpenChapter(chapterOpen ? null : key)}
                            style={({ pressed }) => [styles.nodeHead, pressed && styles.pressed]}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: chapterOpen }}
                          >
                            <Ionicons
                              name={chapterOpen ? 'remove' : 'add'}
                              size={17}
                              color={SLATE[500]}
                            />
                            <Text style={styles.chapterName} numberOfLines={2}>
                              {chapter.chapterName}
                            </Text>
                            <Text style={styles.count}>{topics.length}</Text>
                          </Pressable>

                          {chapterOpen ? (
                            <View style={styles.topicWrap}>
                              {topics.length === 0 ? (
                                <Text style={styles.empty}>No topics selected.</Text>
                              ) : (
                                topics.map((topic) => (
                                  <View key={topic.topicId} style={styles.topic}>
                                    <Text style={styles.topicText}>{topic.topicName}</Text>
                                  </View>
                                ))
                              )}
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  : null}
              </View>
            );
          })
        )}
      </Card>

      {/* ── Part B: the analytics overview, shared with the student panel ── */}
      <AnalyticsBody
        analytics={analytics}
        parts={parts}
        Card={Card}
        CardTitle={CardTitle}
        showPsychometric={false}
        // AnalyticsBody now renders subject → chapter → topic trees of its own (Syllabus
        // Completion and My Progress). This screen filters hidden nodes for Part A above, but that
        // filtering stops at this boundary — without threading it in, those trees would show a
        // parent content an admin has deliberately hidden. The student panel passes nothing and
        // gets the identity default, which is correct: its own screens gate at the tree.
        filterNodes={(entityType, list) =>
          visible(hidden, entityType, list, (n) => n?.subjectId ?? n?.chapterId ?? n?.topicId ?? n?.id)
        }
        openExam={openExam}
        onToggleExam={toggleExam}
        mockTests={mockTests}
      />
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  empty: { fontSize: TYPE.body, color: SLATE[500], fontStyle: 'italic', paddingVertical: 6 },
  node: {
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
    paddingTop: 4,
    marginTop: 4,
  },
  nodeHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
  subject: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  chapter: { paddingLeft: SPACING.md },
  chapterName: { flex: 1, fontSize: TYPE.body, fontWeight: '600', color: SLATE[700] },
  count: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: p.primaryDark,
    backgroundColor: p.tint,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  topicWrap: { paddingLeft: SPACING.md, paddingBottom: 6, gap: 4 },
  topic: {
    backgroundColor: SLATE[50],
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  topicText: { fontSize: TYPE.label, color: SLATE[600] },
  pressed: { opacity: 0.7 },
}));
