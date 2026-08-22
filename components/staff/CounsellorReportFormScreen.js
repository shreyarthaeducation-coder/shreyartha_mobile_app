import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING } from '../../constants/theme';
import { usePalette } from '../../components/ui/PaletteContext';
import { EmptyState, ScreenScaffold, StatusChip, useToast } from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import ReportFormSheet from './counsellor/ReportFormSheet';
import {
  fetchReport,
  fetchReportStudents,
  fetchReportTree,
  saveReport,
} from '../../services/counsellor/reportService';
import {
  buildEmptyForm,
  hydrateForm,
  parseReportForm,
} from '../../constants/counsellorReportConfig';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Counsellor Report — the AUTHORING side, for both counsellor portals.
 *
 * The teacher panel's `CounsellorReportScreen` is the read-only twin: a teacher can view these
 * reports and can never write one. This screen is the other half.
 *
 * SCOPE. The tree is `School → Class → Year → [Section]` and is ONE shape with two populations:
 * the school-bound counsellor gets a single school with only their ASSIGNED sections, and the
 * Shreyartha counsellor gets one root per linked school with `sections` always empty. So the same
 * accordion serves both — a leaf is a year node, and it only shows section chips when it has any.
 *
 * `classId` lives on the YEAR node, not the class node: one class name spans several years and
 * each of those is a different SchoolClass row.
 */


/** Classes with no academic year collapse into this token server-side. */
const UNASSIGNED_YEAR = 'UNASSIGNED';
const yearLabelOf = (year) =>
  !year?.yearLabel || year.yearLabel === UNASSIGNED_YEAR ? 'Year not set' : year.yearLabel;

export default function CounsellorReportFormScreen({ homeRoute = '/teacher', apiBase }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const [openSchool, setOpenSchool] = useState(null);
  const [openClass, setOpenClass] = useState(null);
  /** The chosen leaf: `{ schoolId, className, classId, yearLabel, sectionId, sectionName }`. */
  const [leaf, setLeaf] = useState(null);
  /**
   * The tree folds away once a leaf is picked, so the roster gets the screen instead of sitting
   * below every class the counsellor has. Same idea as Mark Attendance's pinned scope bar: the
   * selection stays visible as one chip, and tapping it brings the tree back with the current
   * leaf still lit.
   */
  const [treeOpen, setTreeOpen] = useState(true);

  const [student, setStudent] = useState(null);
  const [form, setForm] = useState(buildEmptyForm);
  const [reportId, setReportId] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const { toast, showToast } = useToast();

  const treeFetcher = useCallback((signal) => fetchReportTree(apiBase, signal), [apiBase]);
  const { data: tree, loading: treeLoading, error: treeError, reload } = useStaffResource(
    treeFetcher,
    { initialData: [] },
  );
  const schools = tree || [];

  // Primitives only — `leaf` is a new object on every pick.
  const leafKey = leaf ? `${leaf.classId}|${leaf.sectionName}|${leaf.yearLabel}` : '';
  const rosterFetcher = useCallback(
    (signal) =>
      fetchReportStudents(
        {
          apiBase,
          classId: leaf.classId,
          sectionName: leaf.sectionName,
          yearLabel: leaf.yearLabel,
        },
        signal,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiBase, leafKey],
  );
  const { data: students, loading: rosterLoading, revalidate: revalidateRoster } = useStaffResource(
    rosterFetcher,
    { enabled: !!leaf, initialData: [] },
  );
  const roster = students || [];

  const openStudent = async (next) => {
    setStudent(next);
    setFormError('');
    setReportLoading(true);
    setForm(buildEmptyForm());
    setReportId(null);
    try {
      const report = await fetchReport(
        { apiBase, studentId: next.studentId, yearLabel: leaf.yearLabel },
        undefined,
      );
      if (report) {
        setReportId(report.id);
        // `formData` comes back as a JSON STRING even though it goes out as an object.
        setForm(hydrateForm(parseReportForm(report)));
      }
    } catch (e) {
      setFormError(e?.message || 'Could not load this report. You can still fill it in.');
    } finally {
      setReportLoading(false);
    }
  };

  const patch = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setSaving(true);
    setFormError('');
    try {
      // Recovers automatically when the server says a report already exists — see saveReport.
      const saved = await saveReport({
        apiBase,
        reportId,
        studentId: student.studentId,
        leaf,
        form,
      });
      if (saved?.id) setReportId(saved.id);
      showToast(reportId ? 'Report updated.' : 'Report saved.', 'success');
      setStudent(null);
      await revalidateRoster();
    } catch (e) {
      setFormError(e?.message || 'Could not save the report.');
    } finally {
      setSaving(false);
    }
  };

  const pickLeaf = (school, klass, year, section) => {
    setStudent(null);
    setLeaf({
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      className: klass.className,
      classId: year.classId,
      yearLabel: year.yearLabel,
      sectionId: section?.sectionId ?? null,
      sectionName: section?.sectionName || '',
    });
    setTreeOpen(false);
  };

  /** `Class 9 · A · 2026-27` — the pinned summary of the current selection. */
  const leafSummary = leaf
    ? [
        `Class ${leaf.className}`,
        leaf.sectionName || null,
        leaf.yearLabel && leaf.yearLabel !== UNASSIGNED_YEAR ? leaf.yearLabel : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const isActiveLeaf = (year, section) =>
    leaf?.classId === year.classId &&
    leaf?.yearLabel === year.yearLabel &&
    (leaf?.sectionName || '') === (section?.sectionName || '');

  return (
    <ScreenScaffold
      title="Counsellor Report"
      fallbackRoute={homeRoute}
      loading={treeLoading}
      error={schools.length === 0 ? treeError : ''}
      onRetry={reload}
      toast={toast}
    >
      {schools.length === 0 ? (
        <EmptyState
          icon="reader-outline"
          title="No classes assigned"
          message="Once classes are assigned to you, their students appear here."
        />
      ) : (
        <>
          {/* Pinned summary. Only exists once something is selected — before that the tree is the
              whole screen anyway, so a chip would be an empty frame. */}
          {leaf ? (
            <Pressable
              onPress={() => setTreeOpen((v) => !v)}
              style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ expanded: treeOpen }}
              accessibilityLabel={`Change selection, currently ${leafSummary}`}
            >
              <Ionicons name="funnel-outline" size={15} color={PALETTE.primaryDark} />
              <Text style={styles.summaryText} numberOfLines={1}>
                {leafSummary}
              </Text>
              <Ionicons
                name={treeOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={PALETTE.primaryDark}
              />
            </Pressable>
          ) : null}

          {treeOpen ? schools.map((school) => {
            const schoolOpen = openSchool === school.schoolId || schools.length === 1;
            return (
              <View key={school.schoolId ?? school.schoolCode} style={styles.school}>
                {/* A counsellor with one school should not have to open it first. */}
                {schools.length > 1 ? (
                  <Pressable
                    onPress={() => setOpenSchool(schoolOpen ? null : school.schoolId)}
                    style={({ pressed }) => [styles.schoolRow, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="business-outline" size={17} color={PALETTE.primaryDark} />
                    <Text style={styles.schoolName}>{school.schoolName}</Text>
                    <Ionicons
                      name={schoolOpen ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={SLATE[400]}
                    />
                  </Pressable>
                ) : null}

                {schoolOpen
                  ? (school.classes || []).map((klass) => {
                      const key = `${school.schoolId}|${klass.className}`;
                      const classOpen = openClass === key;
                      return (
                        <View key={key} style={styles.class}>
                          <Pressable
                            onPress={() => setOpenClass(classOpen ? null : key)}
                            style={({ pressed }) => [styles.classRow, pressed && styles.pressed]}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: classOpen }}
                          >
                            <Text style={styles.className}>Class {klass.className}</Text>
                            <Ionicons
                              name={classOpen ? 'chevron-up' : 'chevron-down'}
                              size={16}
                              color={SLATE[400]}
                            />
                          </Pressable>

                          {classOpen
                            ? (klass.years || []).map((year) => (
                                <View key={`${year.classId}|${year.yearLabel}`} style={styles.year}>
                                  <View style={styles.yearHeader}>
                                    <Text style={styles.yearLabel}>{yearLabelOf(year)}</Text>
                                    {year.isCurrent ? (
                                      <StatusChip label="Current" tone="success" />
                                    ) : null}
                                  </View>

                                  <View style={styles.leafRow}>
                                    {/* No sections means the Shreyartha portal, where the year
                                        node IS the leaf. */}
                                    {(year.sections || []).length === 0 ? (
                                      <Pressable
                                        onPress={() => pickLeaf(school, klass, year, null)}
                                        style={({ pressed }) => [
                                          styles.leaf,
                                          isActiveLeaf(year, null) && styles.leafOn,
                                          pressed && styles.pressed,
                                        ]}
                                        accessibilityRole="button"
                                      >
                                        <Text
                                          style={[
                                            styles.leafText,
                                            isActiveLeaf(year, null) && styles.leafTextOn,
                                          ]}
                                        >
                                          All students
                                        </Text>
                                      </Pressable>
                                    ) : (
                                      year.sections.map((section) => (
                                        <Pressable
                                          key={section.sectionId}
                                          onPress={() => pickLeaf(school, klass, year, section)}
                                          style={({ pressed }) => [
                                            styles.leaf,
                                            isActiveLeaf(year, section) && styles.leafOn,
                                            pressed && styles.pressed,
                                          ]}
                                          accessibilityRole="button"
                                        >
                                          <Text
                                            style={[
                                              styles.leafText,
                                              isActiveLeaf(year, section) && styles.leafTextOn,
                                            ]}
                                          >
                                            Section {section.sectionName}
                                          </Text>
                                        </Pressable>
                                      ))
                                    )}
                                  </View>
                                </View>
                              ))
                            : null}
                        </View>
                      );
                    })
                  : null}
              </View>
            );
          }) : null}

          {leaf && !treeOpen ? (
            rosterLoading ? (
              <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
            ) : roster.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="No students"
                message="This selection has no students registered."
              />
            ) : (
              <View style={styles.roster}>
                <Text style={styles.rosterTitle}>
                  {roster.length} student{roster.length === 1 ? '' : 's'}
                </Text>
                {roster.map((s) => (
                  <Pressable
                    key={s.studentId}
                    onPress={() => openStudent(s)}
                    style={({ pressed }) => [styles.studentRow, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <View style={styles.studentText}>
                      <Text style={styles.studentName}>{s.studentName}</Text>
                      {s.rollNumber ? (
                        <Text style={styles.studentMeta}>Roll {s.rollNumber}</Text>
                      ) : null}
                    </View>
                    {s.hasReport ? <StatusChip label="Report saved" tone="success" /> : null}
                    <Ionicons name="chevron-forward" size={16} color={SLATE[400]} />
                  </Pressable>
                ))}
              </View>
            )
          ) : null}
        </>
      )}

      <ReportFormSheet
        visible={!!student}
        student={student}
        leaf={leaf}
        form={form}
        onPatch={patch}
        onClose={() => setStudent(null)}
        onSubmit={submit}
        saving={saving}
        loading={reportLoading}
        error={formError}
        existing={!!reportId}
      />
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: p.tint,
    marginBottom: SPACING.sm,
  },
  summaryText: { flex: 1, fontSize: 13, fontWeight: '700', color: p.primaryDark },
  school: { marginBottom: SPACING.sm },
  schoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
  },
  schoolName: { flex: 1, fontSize: 14.5, fontWeight: '700', color: SLATE[800] },

  class: { borderTopWidth: 1, borderTopColor: SLATE[100] },
  classRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  className: { flex: 1, fontSize: 14, fontWeight: '600', color: SLATE[700] },

  year: { paddingLeft: SPACING.sm, paddingBottom: SPACING.sm },
  yearHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  yearLabel: { fontSize: 12.5, fontWeight: '600', color: SLATE[500] },
  leafRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  leaf: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  leafOn: { backgroundColor: p.tint, borderColor: p.primary },
  leafText: { fontSize: 12.5, fontWeight: '600', color: SLATE[600] },
  leafTextOn: { color: p.primaryDark },

  loader: { marginVertical: SPACING.xl },
  roster: { marginTop: SPACING.md },
  rosterTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: SLATE[400],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  studentText: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '600', color: SLATE[800] },
  studentMeta: { fontSize: 11.5, color: SLATE[500], marginTop: 1 },
  pressed: { opacity: 0.72 },
}));
