import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PORTALS, SLATE, SPACING } from '../../constants/theme';
import {
  Card,
  CardTitle,
  DateTimeField,
  DonutChart,
  EMPTY_SCOPE,
  EmptyState,
  FormSheet,
  ProgressBar,
  ScopePicker,
  ScreenScaffold,
  Select,
  TextField,
  useToast,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import { groupClassesLoader } from '../../services/teacher/groupService';
import { fetchGroupStudents } from '../../services/teacher/groupService';
import {
  GAP_LEVELS,
  RESOURCE_TYPES,
  fetchPersonalisedResources,
  fetchStudentAnalytics,
  uploadPersonalisedResource,
} from '../../services/teacher/studentAnalyticsService';
import { pickAttachment, formatFileSize } from '../../utils/filePicker';
import { todayIso } from '../../utils/dates';

/**
 * Native My Students Analytics — the last WebView surface in the teacher panel.
 *
 * Reached from the header chip rather than the sidebar, so it stays a `TEACHER_HEADER_ACTIONS`
 * entry. Scope reuses Create Group's loader and roster endpoints exactly.
 */

const PALETTE = PORTALS.school;

function Rating({ label, value, percent }) {
  return (
    <View style={styles.ratingRow}>
      <ProgressBar value={percent} label={label} showValue />
      {value ? <Text style={styles.ratingNote}>{value}</Text> : null}
    </View>
  );
}

export default function StudentAnalyticsScreen({ homeRoute = '/teacher' }) {
  const [scope, setScope] = useState(EMPTY_SCOPE);
  const [student, setStudent] = useState(null);
  const [openGap, setOpenGap] = useState(null);
  const [resourceTarget, setResourceTarget] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const { toast, showToast } = useToast();

  const ready = !!(scope.className && scope.sectionName);

  const rosterFetcher = useCallback(
    (signal) =>
      fetchGroupStudents({ className: scope.className, sectionName: scope.sectionName }, signal),
    [scope.className, scope.sectionName],
  );
  const { data: roster, loading: rosterLoading, error: rosterError } = useStaffResource(
    rosterFetcher,
    { enabled: ready, initialData: [] },
  );

  const analyticsFetcher = useCallback(
    (signal) => fetchStudentAnalytics(student.id, signal),
    [student?.id],
  );
  const { data: analytics, loading: analyticsLoading, error: analyticsError } = useStaffResource(
    analyticsFetcher,
    { enabled: !!student?.id },
  );

  const resourcesFetcher = useCallback(
    (signal) =>
      fetchPersonalisedResources({ studentId: student.id, topicId: resourceTarget.topicId }, signal),
    [student?.id, resourceTarget?.topicId],
  );
  const { data: topicResources, revalidate: revalidateResources } = useStaffResource(
    resourcesFetcher,
    { enabled: !!(student?.id && resourceTarget?.topicId), initialData: [] },
  );

  const students = roster || [];

  const gapCounts = analytics?.learningGaps || {};
  const topicsByLevel = analytics?.topicsByLevel || {};

  const totalGapTopics = useMemo(
    () => GAP_LEVELS.reduce((sum, level) => sum + (Number(gapCounts[level.key]) || 0), 0),
    [gapCounts],
  );

  const openResourceSheet = (topic, level) => {
    setResourceTarget({
      topicId: topic.topicId ?? topic.id,
      topicName: topic.topicName ?? topic.name,
      chapterName: topic.chapterName,
      subjectName: topic.subjectName,
      level,
    });
    setForm({
      title: '',
      description: '',
      resourceType: 'PDF',
      linkUrl: '',
      assignedDate: `${todayIso()}T09:00:00`,
      file: null,
    });
  };

  const attach = async () => {
    try {
      const file = await pickAttachment();
      if (file) setForm((f) => ({ ...f, file }));
    } catch (e) {
      showToast(e?.message || 'Could not open the file picker.', 'error');
    }
  };

  const submitResource = async () => {
    if (!form?.title.trim()) {
      showToast('Give the resource a title.', 'error');
      return;
    }
    setSaving(true);
    try {
      await uploadPersonalisedResource(
        {
          studentId: student.id,
          topicId: resourceTarget.topicId,
          topicName: resourceTarget.topicName,
          chapterName: resourceTarget.chapterName,
          subjectName: resourceTarget.subjectName,
          learningGapLevel: resourceTarget.level,
          title: form.title.trim(),
          description: form.description.trim(),
          resourceType: form.resourceType,
          linkUrl: form.linkUrl.trim() || null,
          assignedDate: form.assignedDate ? form.assignedDate.slice(0, 10) : todayIso(),
        },
        form.file || undefined,
      );
      showToast('Resource assigned.', 'success');
      setForm(null);
      setResourceTarget(null);
    } catch (e) {
      showToast(e?.message || 'Could not assign the resource.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderBody = () => {
    if (!ready) {
      return (
        <EmptyState
          icon="school-outline"
          title="Choose a class"
          message="Pick an academic year, class and section to see your students."
        />
      );
    }
    if (rosterLoading) {
      return <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />;
    }
    if (students.length === 0) {
      return (
        <EmptyState
          icon="people-outline"
          title={rosterError ? "Couldn't load students" : 'No students in this section'}
          message={rosterError || 'Students need to be assigned to this class and section.'}
        />
      );
    }

    return (
      <>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {students.map((s) => {
            const active = student?.id === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  setStudent(active ? null : s);
                  setOpenGap(null);
                }}
                style={({ pressed }) => [
                  styles.studentChip,
                  active && { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[styles.studentChipText, active && { color: PALETTE.primaryDark }]}
                  numberOfLines={1}
                >
                  {s.fullName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!student ? (
          <Text style={styles.hint}>Choose a student to see their analytics.</Text>
        ) : analyticsLoading ? (
          <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
        ) : !analytics ? (
          <EmptyState
            icon="analytics-outline"
            title="No analytics yet"
            message={analyticsError || `${student.fullName} has no recorded activity.`}
          />
        ) : (
          <>
            <Card>
              <CardTitle>Overview</CardTitle>
              <View style={styles.overview}>
                <DonutChart
                  value={analytics.syllabusCompletionPercent}
                  caption="syllabus"
                  color={PALETTE.primary}
                  size={116}
                />
                <View style={styles.overviewStats}>
                  <Rating
                    label="Syllabus completion"
                    percent={analytics.syllabusCompletionPercent}
                    value={analytics.syllabusRating ? `Rating ${analytics.syllabusRating}` : null}
                  />
                  <Rating
                    label="Self-reflected progress"
                    percent={analytics.progressPercent}
                    value={
                      analytics.totalReflections
                        ? `${analytics.totalReflections} reflections`
                        : 'No reflections yet'
                    }
                  />
                </View>
              </View>
            </Card>

            <Card>
              <CardTitle>Learning gaps</CardTitle>
              {totalGapTopics === 0 ? (
                <Text style={styles.empty}>No topics assessed yet.</Text>
              ) : (
                GAP_LEVELS.map((level) => {
                  const count = Number(gapCounts[level.key]) || 0;
                  const topics = topicsByLevel[level.key] || [];
                  const open = openGap === level.key;
                  return (
                    <View key={level.key}>
                      <Pressable
                        onPress={() => setOpenGap(open ? null : level.key)}
                        disabled={count === 0}
                        style={({ pressed }) => [
                          styles.gapRow,
                          pressed && count > 0 && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                      >
                        <View style={[styles.gapDot, { backgroundColor: level.color }]} />
                        <Text style={styles.gapLabel}>{level.key}</Text>
                        <View style={[styles.gapCount, { backgroundColor: level.bg }]}>
                          <Text style={[styles.gapCountText, { color: level.color }]}>{count}</Text>
                        </View>
                        {count > 0 ? (
                          <Ionicons
                            name={open ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={SLATE[400]}
                          />
                        ) : null}
                      </Pressable>

                      {open
                        ? topics.map((topic, index) => (
                            <Pressable
                              key={topic.topicId ?? topic.id ?? index}
                              onPress={() => openResourceSheet(topic, level.key)}
                              style={({ pressed }) => [styles.topicRow, pressed && styles.pressed]}
                              accessibilityRole="button"
                            >
                              <View style={styles.topicText}>
                                <Text style={styles.topicName} numberOfLines={2}>
                                  {topic.topicName ?? topic.name}
                                </Text>
                                {topic.chapterName || topic.subjectName ? (
                                  <Text style={styles.topicMeta} numberOfLines={1}>
                                    {[topic.subjectName, topic.chapterName]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </Text>
                                ) : null}
                              </View>
                              <Ionicons name="add-circle-outline" size={18} color={PALETTE.primaryDark} />
                            </Pressable>
                          ))
                        : null}
                    </View>
                  );
                })
              )}
            </Card>

            {analytics.teacherRemarks && Object.keys(analytics.teacherRemarks).length > 0 ? (
              <Card>
                <CardTitle>Teacher remarks</CardTitle>
                {Object.entries(analytics.teacherRemarks).map(([key, remark]) => (
                  <View key={key} style={styles.remarkRow}>
                    <Text style={styles.remarkKey}>{key}</Text>
                    <Text style={styles.remarkText}>{remark}</Text>
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        )}
      </>
    );
  };

  return (
    <ScreenScaffold
      title="My Students Analytics"
      fallbackRoute={homeRoute}
      toast={toast}
    >
      <ScopePicker loadClasses={groupClassesLoader} value={scope} onChange={setScope} />
      {renderBody()}

      <FormSheet
        visible={!!resourceTarget}
        title="Assign a resource"
        subtitle={resourceTarget ? `${resourceTarget.topicName} · ${resourceTarget.level}` : undefined}
        onClose={() => {
          setResourceTarget(null);
          setForm(null);
        }}
        onSubmit={submitResource}
        submitting={saving}
        submitLabel="Assign"
        fullHeight
      >
        {form ? (
          <>
            {(topicResources || []).length > 0 ? (
              <View style={styles.existing}>
                <Text style={styles.existingTitle}>Already assigned</Text>
                {topicResources.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => r.fileUrl && Linking.openURL(encodeURI(r.fileUrl)).catch(() => {})}
                    style={({ pressed }) => [styles.existingRow, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.existingName} numberOfLines={1}>
                      {r.title}
                    </Text>
                    <Text style={styles.existingType}>{r.resourceType}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <TextField
              label="Title"
              required
              value={form.title}
              onChangeText={(title) => setForm((f) => ({ ...f, title }))}
              placeholder="e.g. Extra practice on factorisation"
            />
            <TextField
              label="Description"
              value={form.description}
              onChangeText={(description) => setForm((f) => ({ ...f, description }))}
              placeholder="Optional"
              multiline
              inputStyle={styles.multiline}
            />
            <Select
              label="Type"
              value={form.resourceType}
              options={RESOURCE_TYPES}
              onChange={(resourceType) => setForm((f) => ({ ...f, resourceType }))}
            />
            {form.resourceType === 'LINK' ? (
              <TextField
                label="Link"
                value={form.linkUrl}
                onChangeText={(linkUrl) => setForm((f) => ({ ...f, linkUrl }))}
                placeholder="https://…"
                autoCapitalize="none"
                keyboardType="url"
              />
            ) : (
              <>
                <Text style={styles.fileLabel}>Attachment</Text>
                <Pressable
                  onPress={attach}
                  style={({ pressed }) => [styles.fileBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Ionicons name="attach-outline" size={18} color={PALETTE.primaryDark} />
                  <Text style={styles.fileText} numberOfLines={1}>
                    {form.file
                      ? `${form.file.name}${form.file.size ? ` · ${formatFileSize(form.file.size)}` : ''}`
                      : 'Choose an image or PDF'}
                  </Text>
                </Pressable>
              </>
            )}
            <DateTimeField
              label="Assigned date"
              mode="date"
              value={form.assignedDate}
              onChange={(assignedDate) => setForm((f) => ({ ...f, assignedDate }))}
            />
          </>
        ) : null}
      </FormSheet>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: SPACING.xl },
  strip: { gap: SPACING.sm, paddingVertical: SPACING.md },
  studentChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
    maxWidth: 200,
  },
  studentChipText: { fontSize: 13, fontWeight: '600', color: SLATE[600] },
  hint: { fontSize: 13, color: SLATE[500], textAlign: 'center', paddingVertical: SPACING.lg },
  empty: { fontSize: 12.5, color: SLATE[400], fontStyle: 'italic' },

  overview: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  overviewStats: { flex: 1, gap: SPACING.sm },
  ratingRow: {},
  ratingNote: { fontSize: 11, color: SLATE[400], marginTop: 2 },

  gapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  gapDot: { width: 10, height: 10, borderRadius: 5 },
  gapLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: SLATE[700] },
  gapCount: { minWidth: 28, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignItems: 'center' },
  gapCountText: { fontSize: 12, fontWeight: '800' },

  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 9,
    paddingLeft: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  topicText: { flex: 1 },
  topicName: { fontSize: 13, color: SLATE[700], fontWeight: '600' },
  topicMeta: { fontSize: 11, color: SLATE[400], marginTop: 1 },

  remarkRow: { paddingVertical: 6, borderTopWidth: 1, borderTopColor: SLATE[100] },
  remarkKey: { fontSize: 11, fontWeight: '700', color: SLATE[500], textTransform: 'uppercase' },
  remarkText: { fontSize: 13, color: SLATE[700], marginTop: 2, lineHeight: 18 },

  existing: { padding: SPACING.sm, borderRadius: 10, backgroundColor: SLATE[50], marginBottom: SPACING.md },
  existingTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  existingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 6 },
  existingName: { flex: 1, fontSize: 13, color: SLATE[700], fontWeight: '600' },
  existingType: { fontSize: 11, color: SLATE[500], fontWeight: '700' },

  fileLabel: { fontSize: 13, fontWeight: '600', color: SLATE[700], marginBottom: 6 },
  fileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: SLATE[200],
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: SPACING.md,
  },
  fileText: { flex: 1, fontSize: 14, color: SLATE[700] },
  multiline: { height: 76, textAlignVertical: 'top' },

  pressed: { opacity: 0.72 },
});
