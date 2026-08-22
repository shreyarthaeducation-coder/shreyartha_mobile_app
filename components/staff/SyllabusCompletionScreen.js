import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, PORTALS, SLATE, SPACING } from '../../constants/theme';
import {
  Card,
  CardTitle,
  DonutChart,
  EMPTY_SCHOOL_SCOPE,
  EmptyState,
  ProgressBar,
  SchoolClassPicker,
  ScreenScaffold,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  IN_PROGRESS_LABEL,
  SYLLABUS_STATUS,
  chaptersFor,
  fetchShreya01SyllabusCompletion,
  fetchSyllabusCompletion,
} from '../../services/teacher/syllabusService';

/**
 * Native Syllabus Completion.
 *
 * The web is a 7-column subject table with an expanding chapter sub-table, two desktop-width pie
 * rows, and a `/subject` round trip on every expansion. Here it is: class chips → section chips →
 * an overall ring and stat tiles → a card per subject that expands into its chapters. Same
 * information, and **no network call at all after the first** — the chapters are already in the
 * payload (see syllabusService).
 */

const PALETTE = PORTALS.school;

const STATUS_STYLE = {
  [SYLLABUS_STATUS.COMPLETED]: { label: 'Completed', color: '#0f7a3d', bg: '#d1fae5' },
  [SYLLABUS_STATUS.IN_PROGRESS]: { label: 'In progress', color: '#b45309', bg: '#fef3c7' },
  [SYLLABUS_STATUS.NOT_COMPLETED]: { label: 'Not started', color: SLATE[600], bg: SLATE[100] },
};

const statusOf = (status) => STATUS_STYLE[status] || STATUS_STYLE[SYLLABUS_STATUS.NOT_COMPLETED];
const round = (n) => Math.round(Number(n) || 0);

function StatusChipSmall({ status }) {
  const meta = statusOf(status);
  return (
    <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
      <Text style={[styles.statusChipText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

function StatTile({ label, value, color }) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ChipRow({ items, activeId, onSelect, idKey, render }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {items.map((item) => {
        const active = item[idKey] === activeId;
        return (
          <Pressable
            key={item[idKey]}
            onPress={() => onSelect(item)}
            style={({ pressed }) => [
              styles.chip,
              active && { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && { color: PALETTE.primaryDark }]}>
              {render(item)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function SyllabusCompletionScreen({
  homeRoute = '/teacher',
  // 'schoolClass' is the Shreyartha teacher. SAME response DTO — only the request is scoped, so
  // everything below this fetch is shared. See syllabusService's Portal B block.
  scopeKind = 'classSection',
  schoolsEndpoint,
}) {
  const schoolScoped = scopeKind === 'schoolClass';

  const [scope, setScope] = useState(EMPTY_SCHOOL_SCOPE);
  const [classId, setClassId] = useState(null);
  const [sectionId, setSectionId] = useState(null);
  const [openSubject, setOpenSubject] = useState(null);

  const fetcher = useCallback(
    (signal) =>
      schoolScoped
        ? fetchShreya01SyllabusCompletion({ schoolId: scope.schoolId, classId: scope.classId }, signal)
        : fetchSyllabusCompletion(signal),
    [schoolScoped, scope.schoolId, scope.classId],
  );
  const { data, loading, refreshing, error, reload, refresh } = useStaffResource(fetcher, {
    enabled: !schoolScoped || !!scope.classId,
  });

  const classes = useMemo(() => data?.classWiseCompletion || [], [data]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.classId === classId) || null,
    [classes, classId],
  );
  const sections = useMemo(
    () => selectedClass?.sectionWiseCompletion || [],
    [selectedClass],
  );
  const selectedSection = useMemo(
    () => sections.find((s) => s.sectionId === sectionId) || null,
    [sections, sectionId],
  );

  // A new school/class means a new tree; clear the inner selection so the effect below re-lands.
  useEffect(() => {
    if (!schoolScoped) return;
    setClassId(null);
    setSectionId(null);
    setOpenSubject(null);
  }, [schoolScoped, scope.schoolId, scope.classId]);

  // Land on the first class and its first section, as the web does.
  useEffect(() => {
    if (classId || classes.length === 0) return;
    const first = classes[0];
    setClassId(first.classId);
    setSectionId(first.sectionWiseCompletion?.[0]?.sectionId ?? null);
  }, [classes, classId]);

  const pickClass = (cls) => {
    setClassId(cls.classId);
    // The web leaves a stale sectionId when a class has no sections, which silently blanks the
    // lower half of the page. Null it explicitly instead.
    setSectionId(cls.sectionWiseCompletion?.[0]?.sectionId ?? null);
    setOpenSubject(null);
  };

  const pickSection = (section) => {
    setSectionId(section.sectionId);
    setOpenSubject(null);
  };

  const subjects = selectedSection?.subjectWiseCompletion || [];

  return (
    <ScreenScaffold
      title="Syllabus Completion"
      fallbackRoute={homeRoute}
      loading={loading}
      error={data ? '' : error}
      notice={data && error ? error : ''}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {schoolScoped ? (
        <SchoolClassPicker
          endpoint={schoolsEndpoint}
          value={scope}
          onChange={setScope}
          style={styles.schoolPicker}
        />
      ) : null}

      {classes.length === 0 ? (
        <EmptyState
          icon="school-outline"
          title="No classes assigned yet"
          message="Once classes are assigned to you, their syllabus progress appears here."
        />
      ) : (
        <>
          {/* Portal B's tree holds the one class the picker already selected, so a second chip
              offering that same class is noise. */}
          {schoolScoped ? null : (
            <ChipRow
              items={classes}
              activeId={classId}
              onSelect={pickClass}
              idKey="classId"
              render={(c) => `Class ${c.className} · ${round(c.completionPercent)}%`}
            />
          )}

          {sections.length > 0 ? (
            <ChipRow
              items={sections}
              activeId={sectionId}
              onSelect={pickSection}
              idKey="sectionId"
              // A SHREYARTHA_TEACHER gets one virtual section with an empty name; the web renders
              // a bare " (83%)" for it.
              render={(s) =>
                `${s.sectionName ? `Section ${s.sectionName}` : 'All sections'} · ${round(s.completionPercent)}%`
              }
            />
          ) : null}

          <Card>
            <CardTitle>Overall</CardTitle>
            <View style={styles.overview}>
              <DonutChart
                value={data?.overallCompletionPercent}
                caption="complete"
                color="#4caf50"
              />
              <View style={styles.statColumn}>
                <StatTile label="Total topics" value={data?.totalTopics ?? 0} />
                <StatTile
                  label="Completed"
                  value={data?.completedTopics ?? 0}
                  color={FEEDBACK.successText}
                />
                <StatTile
                  label="Not started"
                  value={data?.notCompletedTopics ?? 0}
                  color={SLATE[600]}
                />
                {/* Not a topic count — it's how many CLASSES are mid-syllabus. The web mislabels
                    this by putting it next to "Total Topics". */}
                <StatTile
                  label={IN_PROGRESS_LABEL.root}
                  value={data?.inProgressTopics ?? 0}
                  color="#b45309"
                />
              </View>
            </View>
          </Card>

          {selectedSection ? (
            <>
              <Text style={styles.sectionHeading}>
                Subjects · {selectedSection.sectionName ? `Section ${selectedSection.sectionName}` : 'All sections'}
              </Text>

              {subjects.length === 0 ? (
                <Card>
                  <Text style={styles.empty}>No subjects in this section yet.</Text>
                </Card>
              ) : (
                subjects.map((subject) => {
                  const open = openSubject === subject.subjectId;
                  const chapters = open
                    ? chaptersFor(data, classId, sectionId, subject.subjectId)
                    : [];
                  return (
                    <Card key={subject.subjectId}>
                      <Pressable
                        onPress={() => setOpenSubject(open ? null : subject.subjectId)}
                        style={({ pressed }) => [styles.subjectHead, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                      >
                        <View style={styles.subjectText}>
                          <Text style={styles.subjectName}>{subject.subjectName}</Text>
                          <Text style={styles.subjectMeta}>
                            {subject.completedTopics} of {subject.totalTopics} topics
                          </Text>
                        </View>
                        <StatusChipSmall status={subject.status} />
                        <Ionicons
                          name={open ? 'chevron-up' : 'chevron-down'}
                          size={17}
                          color={SLATE[500]}
                        />
                      </Pressable>

                      <ProgressBar
                        value={subject.completionPercent}
                        showValue
                        color={statusOf(subject.status).color}
                        style={styles.subjectBar}
                      />

                      {open ? (
                        chapters.length === 0 ? (
                          <Text style={styles.empty}>No chapters recorded for this subject.</Text>
                        ) : (
                          <View style={styles.chapterList}>
                            {chapters.map((chapter) => (
                              <View key={chapter.chapterId} style={styles.chapterRow}>
                                <View style={styles.chapterText}>
                                  <Text style={styles.chapterName} numberOfLines={2}>
                                    {chapter.chapterName}
                                  </Text>
                                  <Text style={styles.chapterMeta}>
                                    {chapter.completedTopics}/{chapter.totalTopics} topics ·{' '}
                                    {round(chapter.completionPercent)}%
                                  </Text>
                                </View>
                                <Ionicons
                                  name={
                                    chapter.status === SYLLABUS_STATUS.COMPLETED
                                      ? 'checkmark-circle'
                                      : chapter.status === SYLLABUS_STATUS.IN_PROGRESS
                                        ? 'time-outline'
                                        : 'ellipse-outline'
                                  }
                                  size={18}
                                  color={statusOf(chapter.status).color}
                                />
                              </View>
                            ))}
                          </View>
                        )
                      ) : null}
                    </Card>
                  );
                })
              )}
            </>
          ) : null}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  schoolPicker: { paddingHorizontal: 0, paddingVertical: 0 },
  chipRow: { gap: SPACING.sm, paddingVertical: 2, paddingRight: SPACING.md },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: SLATE[600] },
  pressed: { opacity: 0.72 },

  overview: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  statColumn: { flex: 1, gap: 6 },
  statTile: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  statValue: { fontSize: 17, fontWeight: '800', color: SLATE[800], minWidth: 34 },
  statLabel: { flex: 1, fontSize: 12, color: SLATE[500], fontWeight: '600' },

  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.lg,
  },

  subjectHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  subjectText: { flex: 1 },
  subjectName: { fontSize: 15, fontWeight: '700', color: SLATE[800] },
  subjectMeta: { fontSize: 12, color: SLATE[500], marginTop: 1 },
  subjectBar: { marginTop: SPACING.sm },

  statusChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusChipText: { fontSize: 11, fontWeight: '700' },

  chapterList: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 8,
  },
  chapterText: { flex: 1 },
  chapterName: { fontSize: 13.5, fontWeight: '600', color: SLATE[700] },
  chapterMeta: { fontSize: 11.5, color: SLATE[500], marginTop: 1 },

  empty: { fontSize: 12.5, color: SLATE[400], fontStyle: 'italic', paddingVertical: 6 },
});
