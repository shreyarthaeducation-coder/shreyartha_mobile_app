import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { EmptyState, ScreenScaffold, Select } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import PsychometricResultCards from '../shared/PsychometricResultCards';
import useStaffResource from '../../hooks/useStaffResource';
import { useRouter } from 'expo-router';
import { PsychometricPrintLink } from '../shared/BulkPsychometricPrintScreen';
import {
  fetchCounsellingClasses,
  fetchCounsellingStudents,
  fetchStudentPsychometric,
} from '../../services/teacher/counsellingService';
import { makeStyles } from '../../utils/makeStyles';

/**
 * The Counselling Report's Psychometric Result tab, for teachers: class → section → student, then
 * the card the parent sees for that child (PsychometricResultCards), from
 * GET /api/teacher/counselling/students/{id}/psychometric.
 *
 * The picker is the staff Counsellor Report's class/section chips and student strip over the same
 * roster endpoints, so a teacher reaches the same students in either tab. Portal A only: the
 * endpoint is the school teacher's, and no other role has this tab.
 *
 * `embedded` — rendered inside the Counselling Report's tabs, which draw the header.
 */
export default function StudentPsychometricScreen({ embedded = false, printRoute }) {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();

  const [klass, setKlass] = useState(null);
  const [section, setSection] = useState(null);
  const [student, setStudent] = useState(null);

  const classesFetcher = useCallback((signal) => fetchCounsellingClasses(undefined, signal), []);
  const { data: classes, loading: classesLoading, error: classesError, reload } =
    useStaffResource(classesFetcher, { initialData: [] });

  const classList = classes || [];
  const sectionList = klass?.sections || [];
  const rosterReady = !!(klass && section);

  const studentsFetcher = useCallback(
    (signal) => {
      const now = new Date();
      return fetchCounsellingStudents(
        {
          scope: { className: klass.className, sectionName: section.sectionName },
          // The endpoint requires a month; this screen doesn't use the session index it returns.
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        },
        signal,
      );
    },
    [klass?.className, section?.sectionName],
  );
  const { data: roster, loading: rosterLoading } = useStaffResource(studentsFetcher, {
    enabled: rosterReady,
    initialData: { students: [], sessions: {} },
  });
  const students = roster?.students || [];

  const resultFetcher = useCallback(
    (signal) => fetchStudentPsychometric(student.studentId, signal),
    [student?.studentId],
  );
  // `result` still holds the previous student's card while the next one loads or if it fails, so
  // loading and error are checked before it is shown.
  const { data: result, loading: resultLoading, error: resultError } = useStaffResource(
    resultFetcher,
    { enabled: !!student?.studentId, initialData: null },
  );

  return (
    <ScreenScaffold
      title="Psychometric Result"
      fallbackRoute="/teacher"
      embedded={embedded}
      loading={classesLoading}
      error={classList.length === 0 ? classesError : ''}
      onRetry={reload}
      // No Shreya Speak on the page: the teacher hears Shreya in the chat, as on the website.
    >
      {/* Several students' reports in one print (1 Oct 2026), as on the website's tab. */}
      {printRoute ? <PsychometricPrintLink route={printRoute} onPress={() => router.push(printRoute)} /> : null}
      {classList.length === 0 ? (
        <EmptyState
          icon="school-outline"
          title="No classes assigned"
          message="Once classes are assigned to you, their students' psychometric results appear here."
        />
      ) : (
        <>
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

          {!rosterReady ? (
            <EmptyState
              icon="people-outline"
              title="Choose a section"
              message="Pick a class and section to see its students."
            />
          ) : rosterLoading ? (
            <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />
          ) : students.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No students"
              message="This section has no students registered."
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
                        active && { backgroundColor: palette.tint, borderColor: palette.primary },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[styles.studentChipText, active && { color: palette.primaryDark }]}
                        numberOfLines={1}
                      >
                        {s.studentName}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {!student ? (
                <Text style={styles.hint}>Choose a student to see their psychometric result.</Text>
              ) : resultLoading ? (
                <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />
              ) : resultError ? (
                // The server's own reason, e.g. "Student does not belong to your school".
                <EmptyState icon="alert-circle-outline" title="Not available" message={resultError} />
              ) : (
                <PsychometricResultCards
                  statementTitle="Personal Statement"
                  statement={result?.personalStatement || ''}
                  psych={result}
                />
              )}
            </>
          )}
        </>
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  pickers: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
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
  studentChipText: { fontSize: TYPE.body, fontWeight: '600', color: SLATE[600] },
  hint: { fontSize: TYPE.body, color: SLATE[500], textAlign: 'center', paddingVertical: SPACING.lg },
  pressed: { opacity: 0.72 },
}));
