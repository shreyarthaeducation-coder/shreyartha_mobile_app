import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../../components/ui/PaletteContext';
import { Card, CardTitle, EmptyState, FormSheet, Select } from '../../ui';
import useStaffResource from '../../../hooks/useStaffResource';
import { staffApi } from '../../../services/staffApi';
import { fetchAcademicYears, defaultAcademicYear } from '../../../services/teacher/scopeService';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * My Profile → Academic. Add and remove your own class-subject assignments.
 *
 * This is the one thing on the profile a teacher genuinely cannot do anywhere else on the phone —
 * without it, fixing a wrong assignment means opening the website.
 *
 * `/api/teacher/available-classes` returns `SchoolClassResponse`, so ids are `id` at every level
 * (not `classId`/`sectionId`) — the same shape trap that made `classesFromSchoolClasses` necessary.
 *
 * The counsellor mirrors all three endpoints under `/api/counselor`, hence `apiBase`.
 */


export default function AcademicTab({ profile, onChanged, showToast, apiBase = '/api/teacher' }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const [yearId, setYearId] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [classId, setClassId] = useState(null);
  const [sectionId, setSectionId] = useState(null);
  const [subjectIds, setSubjectIds] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const yearsFetcher = useCallback((signal) => fetchAcademicYears(signal), []);
  const { data: years } = useStaffResource(yearsFetcher, { initialData: [] });

  const effectiveYearId = yearId ?? defaultAcademicYear(years || [])?.id ?? null;

  const availableFetcher = useCallback(
    (signal) =>
      staffApi.get(`${apiBase}/available-classes`, {
        params: { academicYearId: effectiveYearId },
        signal,
      }),
    [effectiveYearId, apiBase],
  );
  const { data: available, loading: availableLoading } = useStaffResource(availableFetcher, {
    enabled: sheetOpen && !!effectiveYearId,
    initialData: [],
  });

  const classList = Array.isArray(available) ? available : [];
  const selectedClass = classList.find((c) => c.id === classId) || null;
  const sectionList = selectedClass?.sections || [];
  const selectedSection = sectionList.find((s) => s.id === sectionId) || null;
  const subjectList = selectedSection?.subjects || [];

  // Assignments come from the profile, and cover every year — filter to the one on screen.
  const assignments = useMemo(() => {
    const all = Array.isArray(profile?.assignedClasses) ? profile.assignedClasses : [];
    return effectiveYearId ? all.filter((a) => a.academicYearId === effectiveYearId) : all;
  }, [profile, effectiveYearId]);

  const toggleSubject = (id) =>
    setSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (!sectionId || subjectIds.size === 0) {
      showToast?.('Choose a section and at least one subject.', 'error');
      return;
    }
    setSaving(true);
    try {
      await staffApi.post(`${apiBase}/assign-class`, {
        sectionId,
        subjectIds: Array.from(subjectIds),
      });
      showToast?.('Class assigned.', 'success');
      setSheetOpen(false);
      setClassId(null);
      setSectionId(null);
      setSubjectIds(new Set());
      await onChanged?.();
    } catch (e) {
      showToast?.(e?.message || 'Could not assign the class.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = (assignment) => {
    Alert.alert(
      'Remove this assignment?',
      `Class ${assignment.className}${assignment.sectionName ? `-${assignment.sectionName}` : ''} · ${assignment.subjectName}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusyId(assignment.id);
            try {
              await staffApi.del(`${apiBase}/class-assignment/${assignment.id}`);
              showToast?.('Assignment removed.', 'success');
              await onChanged?.();
            } catch (e) {
              showToast?.(e?.message || 'Could not remove the assignment.', 'error');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <View style={styles.toolbar}>
        <Select
          variant="chip"
          label="Academic year"
          value={effectiveYearId}
          options={(years || []).map((y) => ({
            value: y.id,
            label: y.current ? `${y.yearLabel} (current)` : y.yearLabel,
          }))}
          onChange={setYearId}
        />
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={16} color="#ffffff" />
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>

      {assignments.length === 0 ? (
        <EmptyState
          icon="easel-outline"
          title="No classes assigned"
          message="Add the classes and subjects you teach so they appear across the app."
        />
      ) : (
        <Card>
          <CardTitle>My classes</CardTitle>
          {assignments.map((a) => (
            <View key={a.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>
                  Class {a.className}
                  {a.sectionName ? `-${a.sectionName}` : ''}
                </Text>
                <Text style={styles.rowMeta}>
                  {a.subjectName}
                  {a.academicIqSubjectId ? '' : ' · not linked to curriculum'}
                </Text>
              </View>
              {busyId === a.id ? (
                <ActivityIndicator size="small" color={PALETTE.primary} />
              ) : (
                <Pressable
                  onPress={() => confirmRemove(a)}
                  hitSlop={6}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${a.subjectName}`}
                >
                  <Ionicons name="close" size={17} color={FEEDBACK.errorText} />
                </Pressable>
              )}
            </View>
          ))}
        </Card>
      )}

      <FormSheet
        visible={sheetOpen}
        title="Add a class"
        onClose={() => setSheetOpen(false)}
        onSubmit={submit}
        submitting={saving}
        submitLabel="Assign"
        fullHeight
      >
        {availableLoading ? (
          <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
        ) : (
          <>
            <Select
              label="Class"
              value={classId}
              options={classList.map((c) => ({ value: c.id, label: `Class ${c.className}` }))}
              onChange={(id) => {
                setClassId(id);
                setSectionId(null);
                setSubjectIds(new Set());
              }}
              placeholder={classList.length ? 'Choose a class' : 'No classes for this year'}
            />
            <Select
              label="Section"
              value={sectionId}
              options={sectionList.map((s) => ({ value: s.id, label: `Section ${s.sectionName}` }))}
              onChange={(id) => {
                setSectionId(id);
                setSubjectIds(new Set());
              }}
              disabled={!classId}
              placeholder={classId ? 'Choose a section' : 'Choose a class first'}
            />

            <Text style={styles.subjectLabel}>Subjects</Text>
            {subjectList.length === 0 ? (
              <Text style={styles.empty}>
                {sectionId ? 'This section has no subjects yet.' : 'Choose a section first.'}
              </Text>
            ) : (
              <View style={styles.subjectWrap}>
                {subjectList.map((subject) => {
                  const on = subjectIds.has(subject.id);
                  return (
                    <Pressable
                      key={subject.id}
                      onPress={() => toggleSubject(subject.id)}
                      style={({ pressed }) => [
                        styles.subjectChip,
                        on && { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      <Text style={[styles.subjectText, on && { color: PALETTE.primaryDark }]}>
                        {subject.subjectName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}
      </FormSheet>
    </>
  );
}

const useStyles = makeStyles((p) => ({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: p.primaryDark,
  },
  addText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  loader: { marginVertical: SPACING.xl },
  empty: { fontSize: 12.5, color: SLATE[400], fontStyle: 'italic', marginBottom: SPACING.md },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: SLATE[800] },
  rowMeta: { fontSize: 12, color: SLATE[500], marginTop: 1 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FEEDBACK.errorBg,
  },

  subjectLabel: { fontSize: 13, fontWeight: '600', color: SLATE[700], marginBottom: 6 },
  subjectWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.md },
  subjectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  subjectText: { fontSize: 13, fontWeight: '600', color: SLATE[600] },

  pressed: { opacity: 0.72 },
}));
