import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../../components/ui/PaletteContext';
import { Card, CardTitle, EMPTY_SCHOOL_SCOPE, EmptyState, SchoolClassPicker } from '../../ui';
import useStaffResource from '../../../hooks/useStaffResource';
import { staffApi } from '../../../services/staffApi';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * My Profile → Academic Management, for the Shreyartha counsellor.
 *
 * Ports `Shreya01CounsellorProfile`'s second tab: School → Class → the students in it. **Read-only
 * despite the web's `assignment-form` class name** — this portal has no assign-class endpoints at
 * all, and the page is a roster browser, not an editor.
 *
 * That makes it the one place in the portal where a counsellor can see who is actually in a class
 * without going through attendance or counselling, which is why leaving it out (as the first pass
 * did, reasoning it merely restated the pickers) was wrong.
 */


export default function ScopeBrowserTab({ schoolsEndpoint, studentsEndpoint }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const [scope, setScope] = useState(EMPTY_SCHOOL_SCOPE);

  const fetcher = useCallback(
    (signal) => staffApi.get(studentsEndpoint, { params: { classId: scope.classId }, signal }),
    [studentsEndpoint, scope.classId],
  );
  const { data, loading, error } = useStaffResource(fetcher, {
    enabled: !!scope.classId,
    initialData: [],
  });
  const students = Array.isArray(data) ? data : [];

  return (
    <>
      <SchoolClassPicker
        endpoint={schoolsEndpoint}
        value={scope}
        onChange={setScope}
        style={styles.picker}
      />

      {!scope.classId ? (
        <EmptyState
          icon="school-outline"
          title="Choose a class"
          message="Pick a school and class to see the students in it."
        />
      ) : loading ? (
        <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : students.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No students"
          message="No students are registered for this class yet."
        />
      ) : (
        <Card>
          <CardTitle>
            Class {scope.className} · {students.length} student
            {students.length === 1 ? '' : 's'}
          </CardTitle>
          {/* The web spells this out, and it matters: SHREYA01 has no section tier, so a class
              roster here is every section at once. */}
          <Text style={styles.note}>All sections included.</Text>

          {students.map((s) => (
            <View key={s.id ?? s.studentId} style={styles.row}>
              <Ionicons name="person-outline" size={17} color={PALETTE.primaryDark} />
              <View style={styles.rowText}>
                <Text style={styles.name}>{s.fullName || s.studentName}</Text>
                {s.email ? <Text style={styles.meta}>{s.email}</Text> : null}
              </View>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

const useStyles = makeStyles((p) => ({
  picker: { paddingHorizontal: 0, paddingVertical: 0 },
  loader: { marginVertical: SPACING.xl },
  error: { fontSize: TYPE.body, color: SLATE[600], textAlign: 'center', paddingVertical: SPACING.lg },
  note: { fontSize: TYPE.caption, color: SLATE[500], fontStyle: 'italic', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  rowText: { flex: 1 },
  name: { fontSize: TYPE.body, color: SLATE[800] },
  meta: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 1 },
}));
