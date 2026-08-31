import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DONE, FEEDBACK, INK, SPACING, TOUCH, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { EmptyState, SegmentedTabs, useToast } from '../../ui';
import StudentScaffold from '../StudentScaffold';
import { StudentCard, StudentCardTitle, StudentNote } from '../StudentCard';
import { useTranslations } from '../../../hooks/useTranslations';
import { formatLongDateTime } from '../../../utils/dates';
import { pickAttachment, formatFileSize } from '../../../utils/filePicker';
import {
  RESOURCE_TABS,
  fetchAllHomework,
  fetchChapters,
  fetchSubjects,
  fetchSubmission,
  fetchTopicItems,
  submitHomework,
  unsubmitHomework,
} from '../../../services/student/resourceService';

/**
 * Teacher's Resources and Homework — two of the three controls the website floats over its student
 * pages, restored to the app as one screen with a tab switch.
 *
 * ── ONE SCREEN, BECAUSE THE WEB IS ONE MODAL ────────────────────────────────
 * `StudentResourcesModal` takes an `activeTab` of "resources" or "homework" and is otherwise
 * identical: same subject list, same chapter/topic drill, same cards. The two floating buttons
 * differ only in which tab they open it on, which is exactly what `?tab=` does here.
 *
 * ── THE TWO SUBJECT IDS ─────────────────────────────────────────────────────
 * Chapters hang off `subject.academicIqSubjectId`; items are scoped by `subject.id`. They are
 * different columns and a subject can legitimately have no academic mapping at all — the web shows
 * "not linked to curriculum content" for that, and so does this, rather than an empty list that
 * looks like the teacher simply uploaded nothing.
 *
 * ── SUBMITTING ──────────────────────────────────────────────────────────────
 * A submission may carry a file or be a bare "turned in" — `@RequestPart("file")` is optional
 * server-side. After either action the row's submission is re-read from the server rather than
 * assumed, because `submittedAt` and the file URL are the server's to decide.
 */

const STRINGS = {
  title: 'From your teacher',
  introResources: 'Notes, videos and links your teacher shared, by topic.',
  introHomework: 'What has been set for you, and where you turn it in.',
  subject: 'Subject',
  chapter: 'Chapter',
  topic: 'Topic',
  pickSubject: 'Choose a subject to begin.',
  pickTopic: 'Choose a topic to see what is there.',
  noSubjects: 'No subjects yet',
  noSubjectsBody: 'Your class has no subjects set up yet. Your school adds these.',
  noChapters: 'This subject is not linked to curriculum content yet, so it has no chapters.',
  noItems: 'Nothing here for this topic yet.',
  forbidden: "Your teacher's resources are available on school student accounts.",
  due: 'Due',
  submitted: 'Turned in',
  submit: 'Turn in',
  unsubmit: 'Undo turn in',
  attach: 'Attach a file',
  open: 'Open',
  change: 'Change file',
  removeFile: 'Remove',
  submitting: 'Sending…',
  upcoming: 'Coming up',
  upcomingNote: 'Open the topic below to turn something in.',
};

export default function TeacherResourcesScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const t = useTranslations(STRINGS);
  const { tab: tabParam } = useLocalSearchParams();

  const [tab, setTab] = useState(tabParam === 'homework' ? 'homework' : 'resources');

  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [openChapter, setOpenChapter] = useState(null);
  const [topic, setTopic] = useState(null);

  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [submissions, setSubmissions] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [pending, setPending] = useState({});
  const [upcoming, setUpcoming] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  /* ── Subjects ─────────────────────────────────────────────────────────── */

  const load = useCallback(async () => {
    setError('');
    try {
      const list = await fetchSubjects();
      setSubjects(list);
      // Auto-select when there is only one — a single-item picker is a tap that teaches nothing.
      if (list.length === 1) setSubject(list[0]);
    } catch (e) {
      setError(e?.isForbidden ? STRINGS.forbidden : e?.message || 'Could not load your subjects.');
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ── Chapters, on the ACADEMIC id ─────────────────────────────────────── */

  useEffect(() => {
    let alive = true;
    setChapters([]);
    setOpenChapter(null);
    setTopic(null);
    setNotice('');

    if (!subject) return undefined;

    if (!subject.academicIqSubjectId) {
      setNotice(STRINGS.noChapters);
      return undefined;
    }

    fetchChapters(subject.academicIqSubjectId)
      .then((list) => {
        if (!alive) return;
        setChapters(list);
        if (!list.length) setNotice(STRINGS.noChapters);
      })
      .catch(() => {
        if (alive) setNotice(STRINGS.noChapters);
      });

    return () => {
      alive = false;
    };
  }, [subject]);

  /* ── Items for a topic, on the SCHOOL id ──────────────────────────────── */

  useEffect(() => {
    let alive = true;
    if (!topic || !subject) {
      setItems([]);
      return undefined;
    }

    setItemsLoading(true);
    fetchTopicItems(tab, topic.id, subject.id)
      .then((list) => {
        if (!alive) return;
        setItems(list);
        // Homework rows each have their own submission record; read them alongside rather than
        // lazily on tap, so the button says the right thing the first time it is seen.
        if (tab === 'homework') loadSubmissions(list);
      })
      .catch((e) => {
        if (!alive) return;
        setItems([]);
        showToast(e?.message || 'Could not load that topic.', 'error');
      })
      .finally(() => {
        if (alive) setItemsLoading(false);
      });

    return () => {
      alive = false;
    };
    // `loadSubmissions` and `showToast` are stable for the life of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, subject, tab]);

  /**
   * Every homework for the chosen subject, across all topics — the "what is due" view.
   *
   * The website answers this with a month calendar. On a phone the same question is better served
   * by the next few due dates in order: a student opening Homework wants to know what is coming,
   * and a grid of mostly-empty squares makes them hunt for it. The per-topic drill below is still
   * where they go to turn something in.
   *
   * Failure is silent on purpose. This is an overview above the real content, so a student whose
   * `/homework/all` call fails still gets the full topic drill rather than an error screen.
   */
  const loadUpcoming = useCallback(async (subj) => {
    if (!subj) {
      setUpcoming([]);
      return;
    }
    try {
      const list = await fetchAllHomework(subj.id);
      const withDates = list.filter((hw) => hw.dueDate);
      withDates.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
      setUpcoming(withDates);
    } catch {
      setUpcoming([]);
    }
  }, []);

  useEffect(() => {
    if (tab === 'homework') loadUpcoming(subject);
    else setUpcoming([]);
  }, [tab, subject, loadUpcoming]);

  const loadSubmissions = async (list) => {
    const results = await Promise.allSettled(list.map((hw) => fetchSubmission(hw.id)));
    const next = {};
    list.forEach((hw, i) => {
      const r = results[i];
      next[hw.id] = r.status === 'fulfilled' ? r.value : null;
    });
    setSubmissions((prev) => ({ ...prev, ...next }));
  };

  /* ── Turn in / undo ───────────────────────────────────────────────────── */

  const attach = async (homeworkId) => {
    const file = await pickAttachment();
    if (!file) return;
    setPending((prev) => ({ ...prev, [homeworkId]: file }));
  };

  const turnIn = async (homework) => {
    setBusyId(homework.id);
    try {
      await submitHomework(homework.id, pending[homework.id] || null);
      // Re-read rather than trust: `submittedAt` and the stored file URL are the server's.
      const fresh = await fetchSubmission(homework.id).catch(() => null);
      setSubmissions((prev) => ({ ...prev, [homework.id]: fresh }));
      setPending((prev) => {
        const next = { ...prev };
        delete next[homework.id];
        return next;
      });
      showToast('Turned in.');
    } catch (e) {
      showToast(e?.message || 'Could not turn that in.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const undo = async (homework) => {
    setBusyId(homework.id);
    try {
      await unsubmitHomework(homework.id);
      setSubmissions((prev) => ({ ...prev, [homework.id]: null }));
      showToast('Taken back.');
    } catch (e) {
      showToast(e?.message || 'Could not undo that.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  /* ── Render ───────────────────────────────────────────────────────────── */

  const tabOptions = useMemo(
    () => RESOURCE_TABS.map((r) => ({ value: r.key, label: r.label })),
    [],
  );

  const openUrl = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => showToast('Could not open that link.', 'error'));
  };

  return (
    <StudentScaffold
      title={t.title}
      loading={loading}
      error={error}
      onRetry={error && error !== STRINGS.forbidden ? load : undefined}
      toast={toast}
    >
      <SegmentedTabs
        tone="dark"
        options={tabOptions}
        value={tab}
        onChange={(next) => {
          setTab(next);
          setItems([]);
        }}
      />

      <Text style={styles.intro}>{tab === 'homework' ? t.introHomework : t.introResources}</Text>

      {subjects.length === 0 ? (
        <EmptyState icon="library-outline" title={t.noSubjects} message={t.noSubjectsBody} />
      ) : (
        <>
          <StudentCard tone="dark">
            <StudentCardTitle>{t.subject}</StudentCardTitle>
            <View style={styles.chips}>
              {subjects.map((s) => {
                const on = subject?.id === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSubject(s)}
                    style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </StudentCard>

          {tab === 'homework' && subject && upcoming.length > 0 ? (
            <StudentCard tone="dark">
              <StudentCardTitle>{t.upcoming}</StudentCardTitle>
              {upcoming.slice(0, 5).map((hw) => (
                <View key={hw.id} style={styles.dueRow}>
                  <Ionicons name="time-outline" size={14} color={palette.primary} />
                  <Text style={styles.dueTitle} numberOfLines={1}>
                    {hw.title}
                  </Text>
                  <Text style={styles.dueDate}>{formatLongDateTime(hw.dueDate)}</Text>
                </View>
              ))}
              <StudentNote style={styles.dueNote}>{t.upcomingNote}</StudentNote>
            </StudentCard>
          ) : null}

          {!subject ? (
            <StudentCard tone="dark">
              <StudentNote>{t.pickSubject}</StudentNote>
            </StudentCard>
          ) : notice ? (
            <StudentCard tone="dark">
              <StudentNote>{notice}</StudentNote>
            </StudentCard>
          ) : (
            <StudentCard tone="dark">
              <StudentCardTitle>{t.chapter}</StudentCardTitle>
              {chapters.map((ch) => {
                const expanded = openChapter === ch.id;
                const topics = ch.topics || [];
                return (
                  <View key={ch.id}>
                    <Pressable
                      onPress={() => setOpenChapter(expanded ? null : ch.id)}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                    >
                      <Ionicons
                        name={expanded ? 'chevron-down' : 'chevron-forward'}
                        size={15}
                        color={palette.primary}
                      />
                      <Text style={styles.rowText}>{ch.name}</Text>
                    </Pressable>

                    {expanded
                      ? topics.map((tp) => {
                          const on = topic?.id === tp.id;
                          return (
                            <Pressable
                              key={tp.id}
                              onPress={() => setTopic(tp)}
                              style={({ pressed }) => [
                                styles.topic,
                                on && styles.topicOn,
                                pressed && styles.pressed,
                              ]}
                              accessibilityRole="button"
                              accessibilityState={{ selected: on }}
                            >
                              <Text style={[styles.topicText, on && styles.topicTextOn]}>
                                {tp.name}
                              </Text>
                            </Pressable>
                          );
                        })
                      : null}
                  </View>
                );
              })}
            </StudentCard>
          )}

          {subject && !topic ? (
            <StudentCard tone="dark">
              <StudentNote>{t.pickTopic}</StudentNote>
            </StudentCard>
          ) : null}

          {topic ? (
            itemsLoading ? (
              <View style={styles.centre}>
                <ActivityIndicator color={palette.primary} />
              </View>
            ) : items.length === 0 ? (
              <StudentCard tone="dark">
                <StudentNote>{t.noItems}</StudentNote>
              </StudentCard>
            ) : (
              items.map((item) =>
                tab === 'homework' ? (
                  <HomeworkCard
                    key={item.id}
                    homework={item}
                    submission={submissions[item.id]}
                    pendingFile={pending[item.id]}
                    busy={busyId === item.id}
                    strings={t}
                    onAttach={() => attach(item.id)}
                    onClearFile={() =>
                      setPending((prev) => {
                        const next = { ...prev };
                        delete next[item.id];
                        return next;
                      })
                    }
                    onSubmit={() => turnIn(item)}
                    onUndo={() => undo(item)}
                    onOpen={openUrl}
                  />
                ) : (
                  <ResourceCard key={item.id} resource={item} strings={t} onOpen={openUrl} />
                ),
              )
            )
          ) : null}
        </>
      )}
    </StudentScaffold>
  );
}

/* ── Cards ─────────────────────────────────────────────────────────────── */

function ResourceCard({ resource, strings, onOpen }) {
  const styles = useStyles();
  const palette = usePalette();
  const url = resource.fileUrl || resource.linkUrl;

  return (
    <StudentCard tone="dark">
      <Text style={styles.itemTitle}>{resource.title}</Text>
      {resource.description ? <Text style={styles.itemBody}>{resource.description}</Text> : null}
      <View style={styles.meta}>
        {/* `resourceType`, not `type` — TeacherResourceResponse has no `type` field, and reading a
            property that does not exist renders nothing rather than failing. */}
        {resource.resourceType ? <Text style={styles.metaText}>{resource.resourceType}</Text> : null}
        {resource.fileName ? <Text style={styles.metaText}>· {resource.fileName}</Text> : null}
        {resource.teacherName ? <Text style={styles.metaText}>· {resource.teacherName}</Text> : null}
      </View>
      {url ? (
        <Pressable
          onPress={() => onOpen(url)}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="open-outline" size={14} color={palette.onPrimary} />
          <Text style={styles.actionText}>{strings.open}</Text>
        </Pressable>
      ) : null}
    </StudentCard>
  );
}

function HomeworkCard({
  homework,
  submission,
  pendingFile,
  busy,
  strings,
  onAttach,
  onClearFile,
  onSubmit,
  onUndo,
  onOpen,
}) {
  const styles = useStyles();
  const palette = usePalette();
  const turnedIn = !!submission;
  const url = homework.fileUrl || homework.linkUrl;

  return (
    <StudentCard tone="dark">
      <View style={styles.itemHead}>
        <Text style={styles.itemTitle}>{homework.title}</Text>
        {turnedIn ? (
          <View style={styles.doneChip}>
            <Ionicons name="checkmark" size={12} color="#ffffff" />
            <Text style={styles.doneChipText}>{strings.submitted}</Text>
          </View>
        ) : null}
      </View>

      {homework.description ? <Text style={styles.itemBody}>{homework.description}</Text> : null}

      <View style={styles.meta}>
        {/* A `LocalDateTime` — "2026-08-30T23:59:00" — which must never be printed raw. */}
        {homework.dueDate ? (
          <Text style={styles.metaText}>
            {strings.due} {formatLongDateTime(homework.dueDate)}
          </Text>
        ) : null}
        {homework.targetGroupLevel ? (
          <Text style={styles.metaText}>· {homework.targetGroupLevel}</Text>
        ) : null}
        {homework.teacherName ? <Text style={styles.metaText}>· {homework.teacherName}</Text> : null}
      </View>

      {url ? (
        <Pressable
          onPress={() => onOpen(url)}
          style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="document-attach-outline" size={14} color={palette.primary} />
          <Text style={styles.ghostText}>{strings.open}</Text>
        </Pressable>
      ) : null}

      {turnedIn ? (
        <>
          {submission?.fileUrl ? (
            <Pressable
              onPress={() => onOpen(submission.fileUrl)}
              style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="cloud-done-outline" size={14} color={palette.primary} />
              <Text style={styles.ghostText}>Your file</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onUndo}
            disabled={busy}
            style={({ pressed }) => [styles.undo, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator size="small" color={FEEDBACK.errorText} />
            ) : (
              <Text style={styles.undoText}>{strings.unsubmit}</Text>
            )}
          </Pressable>
        </>
      ) : (
        <>
          {pendingFile ? (
            <View style={styles.file}>
              <Ionicons name="document-outline" size={15} color={palette.primary} />
              <Text style={styles.fileName} numberOfLines={1}>
                {pendingFile.name}
                {pendingFile.size ? ` · ${formatFileSize(pendingFile.size)}` : ''}
              </Text>
              <Pressable onPress={onClearFile} hitSlop={8} accessibilityLabel={strings.removeFile}>
                <Ionicons name="close-circle" size={17} color={palette.onDark} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.buttons}>
            <Pressable
              onPress={onAttach}
              disabled={busy}
              style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="attach-outline" size={15} color={palette.primary} />
              <Text style={styles.ghostText}>{pendingFile ? strings.change : strings.attach}</Text>
            </Pressable>

            <Pressable
              onPress={onSubmit}
              disabled={busy}
              style={({ pressed }) => [styles.action, styles.grow, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator size="small" color={palette.onPrimary} />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={14} color={palette.onPrimary} />
                  <Text style={styles.actionText}>{strings.submit}</Text>
                </>
              )}
            </Pressable>
          </View>
        </>
      )}
    </StudentCard>
  );
}

const useStyles = makeStyles((p) => ({
  intro: { fontSize: TYPE.label, color: p.onDark, lineHeight: 19, marginVertical: SPACING.md },
  centre: { paddingVertical: SPACING.lg, alignItems: 'center' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: p.glassDarkRaised,
    borderWidth: 1,
    borderColor: p.glassDarkBorder,
  },
  chipOn: { backgroundColor: p.primary, borderColor: p.primary },
  chipText: { fontSize: TYPE.label, fontWeight: '600', color: '#ffffff' },
  chipTextOn: { color: p.onPrimary, fontWeight: '800' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: TOUCH.min },
  rowText: { flex: 1, fontSize: TYPE.body, fontWeight: '600', color: '#ffffff' },
  topic: {
    minHeight: TOUCH.min,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginLeft: SPACING.lg,
    marginBottom: 5,
    borderRadius: 10,
    backgroundColor: p.glassDarkRaised,
  },
  topicOn: { backgroundColor: p.tint, borderWidth: 1, borderColor: p.primary },
  topicText: { fontSize: TYPE.body, color: INK.dark.body },
  topicTextOn: { color: p.primary, fontWeight: '700' },

  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  dueTitle: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: '#ffffff' },
  dueDate: { fontSize: TYPE.caption, color: p.onDark },
  dueNote: { marginTop: 6 },

  itemHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  itemTitle: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  itemBody: { fontSize: TYPE.body, color: INK.dark.body, lineHeight: 19, marginTop: 4 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: SPACING.sm },
  metaText: { fontSize: TYPE.caption, color: p.onDark },

  doneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: DONE,
  },
  doneChipText: { fontSize: TYPE.micro, fontWeight: '800', color: '#ffffff' },

  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 12,
    backgroundColor: p.glassDarkRaised,
  },
  fileName: { flex: 1, fontSize: TYPE.caption, color: '#ffffff' },

  buttons: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  grow: { flex: 1 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: TOUCH.min,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: p.primary,
    marginTop: SPACING.md,
  },
  actionText: { fontSize: TYPE.label, fontWeight: '800', color: p.onPrimary },

  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: TOUCH.min,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: TOUCH.min,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: p.glassDarkBorder,
    backgroundColor: p.glassDarkRaised,
  },
  ghostText: { fontSize: TYPE.label, fontWeight: '700', color: p.primary },

  undo: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH.min,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FEEDBACK.errorBorder,
    marginTop: SPACING.md,
  },
  undoText: { fontSize: TYPE.label, fontWeight: '700', color: FEEDBACK.errorText },

  pressed: { opacity: 0.78 },
}));
