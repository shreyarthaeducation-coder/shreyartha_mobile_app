import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PORTALS, SLATE, SPACING } from '../../constants/theme';
import { EmptyState, EMPTY_SCHOOL_SCOPE, SchoolClassPicker, ScreenScaffold, Select } from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  fetchCounsellingClasses,
  fetchCounsellingStudents,
  fetchCounsellorReports,
} from '../../services/teacher/counsellingService';
// The report body itself is shared with the parent panel, which renders the same ten sections
// with no picker at all. See counsellor/ReportBody.js.
import ReportBody from './counsellor/ReportBody';

/**
 * Native Counsellor Report — read-only.
 *
 * There is no create or edit anywhere: the teacher controller exposes a single GET, and the web
 * view is equally read-only. Don't add an edit affordance.
 */

const PALETTE = PORTALS.school;

export default function CounsellorReportScreen({
  homeRoute = '/teacher',
  // Portal A (TEACHER) reads its roster from /api/teacher/counselling and its reports from
  // /api/teacher/counsellor-report/reports.
  apiBase,
  reportsEndpoint,
  // 'schoolClass' switches the two Class/Section chips for a School → Class picker — the
  // Shreyartha teacher has no section tier at all. The report body below is identical either way.
  scopeKind = 'classSection',
  schoolsEndpoint,
}) {
  const schoolScoped = scopeKind === 'schoolClass';

  const [klass, setKlass] = useState(null);
  const [section, setSection] = useState(null);
  const [schoolScope, setSchoolScope] = useState(EMPTY_SCHOOL_SCOPE);
  const [student, setStudent] = useState(null);

  // Portal B's scope tree comes from SchoolClassPicker, which fetches its own endpoint — so the
  // class list is only fetched for the section-based portals.
  const classesFetcher = useCallback(
    (signal) => fetchCounsellingClasses(undefined, signal, apiBase),
    [apiBase],
  );
  const { data: classes, loading: classesLoading, error: classesError, reload } =
    useStaffResource(classesFetcher, { enabled: !schoolScoped, initialData: [] });

  const classList = classes || [];
  const sectionList = klass?.sections || [];

  const rosterReady = schoolScoped ? !!schoolScope.classId : !!(klass && section);

  const studentsFetcher = useCallback(
    (signal) => {
      const now = new Date();
      return fetchCounsellingStudents(
        {
          scope: schoolScoped
            ? { classId: schoolScope.classId }
            : { className: klass.className, sectionName: section.sectionName },
          // The endpoint requires a month; this screen doesn't use the session index it returns.
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          apiBase,
          scopeKind,
        },
        signal,
      );
    },
    [schoolScoped, schoolScope.classId, klass?.className, section?.sectionName, apiBase, scopeKind],
  );
  const { data: roster, loading: rosterLoading } = useStaffResource(studentsFetcher, {
    enabled: rosterReady,
    initialData: { students: [], sessions: {} },
  });

  const reportsFetcher = useCallback(
    (signal) => fetchCounsellorReports(student.studentId, signal, reportsEndpoint),
    [student?.studentId, reportsEndpoint],
  );
  const { data: reports, loading: reportsLoading, error: reportsError } = useStaffResource(
    reportsFetcher,
    { enabled: !!student?.studentId, initialData: [] },
  );

  const students = roster?.students || [];
  const reportList = useMemo(() => (student ? reports || [] : []), [reports, student]);

  return (
    <ScreenScaffold
      title="Counsellor Report"
      fallbackRoute={homeRoute}
      loading={classesLoading}
      error={classList.length === 0 ? classesError : ''}
      onRetry={reload}
    >
      {!schoolScoped && classList.length === 0 ? (
        <EmptyState
          icon="school-outline"
          title="No classes assigned"
          message="Once classes are assigned to you, their students' counsellor reports appear here."
        />
      ) : (
        <>
          {schoolScoped ? (
            <SchoolClassPicker
              endpoint={schoolsEndpoint}
              value={schoolScope}
              onChange={(next) => {
                setSchoolScope(next);
                setStudent(null);
              }}
              style={styles.schoolPicker}
            />
          ) : (
          <View style={styles.pickers}>
            <Select
              variant="chip"
              label="Class"
              placeholder="Class"
              value={klass?.classId}
              options={classList.map((c) => ({ value: c.classId, label: `Class ${c.className}` }))}
              onChange={(id) => {
                setKlass(classList.find((c) => c.classId === id) || null);
                setSection(null);
                setStudent(null);
              }}
            />
            <Select
              variant="chip"
              label="Section"
              placeholder="Section"
              value={section?.sectionId}
              options={sectionList.map((s) => ({
                value: s.sectionId,
                label: `Section ${s.sectionName}`,
              }))}
              onChange={(id) => {
                setSection(sectionList.find((s) => s.sectionId === id) || null);
                setStudent(null);
              }}
              disabled={!klass}
            />
          </View>
          )}

          {!rosterReady ? (
            <EmptyState
              icon="people-outline"
              title={schoolScoped ? 'Choose a class' : 'Choose a section'}
              message={
                schoolScoped
                  ? 'Pick a school and class to see its students.'
                  : 'Pick a class and section to see its students.'
              }
            />
          ) : rosterLoading ? (
            <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
          ) : students.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No students"
              message={schoolScoped ? 'This class has no students registered.' : 'This section has no students registered.'}
            />
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.strip}
              >
                {students.map((s) => {
                  const active = student?.studentId === s.studentId;
                  return (
                    <Pressable
                      key={s.studentId}
                      onPress={() => setStudent(active ? null : s)}
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
                        {s.studentName}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {!student ? (
                <Text style={styles.hint}>Choose a student to read their reports.</Text>
              ) : reportsLoading ? (
                <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
              ) : reportList.length === 0 ? (
                <EmptyState
                  icon="reader-outline"
                  title="No reports yet"
                  message={
                    reportsError || `No counsellor has written a report for ${student.studentName}.`
                  }
                />
              ) : (
                reportList.map((report) => <ReportBody key={report.id} report={report} />)
              )}
            </>
          )}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  pickers: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  // SchoolClassPicker pads itself; the scaffold already provides the outer gutter.
  schoolPicker: { paddingHorizontal: 0, paddingVertical: 0 },
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

  pressed: { opacity: 0.72 },
});
