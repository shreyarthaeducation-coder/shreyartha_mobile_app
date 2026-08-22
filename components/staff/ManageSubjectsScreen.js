import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, PORTALS, SHADOWS, SLATE, SPACING } from '../../constants/theme';
import {
  Card,
  EMPTY_SCHOOL_SCOPE,
  EmptyState,
  SchoolClassPicker,
  ScreenScaffold,
  TextField,
  useToast,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  addClassSubject,
  deleteClassSubject,
  fetchClassSubjects,
} from '../../services/teacher/subjectService';

/**
 * Manage Subjects — Shreyartha teacher (Portal B) only.
 *
 * Portal A has no equivalent: its subjects come from the AcademicIQ curriculum and are set by an
 * admin, whereas a SHREYA01 teacher maintains the subject list for each of their classes here.
 *
 * The only screen in this panel with a **destructive** write. Deleting a subject also detaches it
 * from that class's homework and syllabus rows server-side, so the confirmation spells that out
 * rather than asking a bare "are you sure".
 */

const PALETTE = PORTALS.school;

export default function ManageSubjectsScreen({ homeRoute = '/teacher', schoolsEndpoint }) {
  const [scope, setScope] = useState(EMPTY_SCHOOL_SCOPE);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const { toast, showToast } = useToast();

  const subjectsFetcher = useCallback(
    (signal) => fetchClassSubjects(scope.classId, signal),
    [scope.classId],
  );
  const {
    data: subjects,
    loading,
    error,
    reload,
    revalidate,
  } = useStaffResource(subjectsFetcher, { enabled: !!scope.classId, initialData: [] });

  const list = subjects || [];

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Enter a subject name first.', 'error');
      return;
    }
    if (adding || !scope.classId) return;

    setAdding(true);
    try {
      await addClassSubject(scope.classId, trimmed);
      setName('');
      showToast('Subject added.', 'success');
      await revalidate();
    } catch (e) {
      // The server's own message is the useful one — a duplicate name reads clearly.
      showToast(e?.message || 'Could not add the subject.', 'error');
    } finally {
      setAdding(false);
    }
  };

  const confirmDelete = (subject) => {
    Alert.alert(
      `Remove ${subject.subjectName}?`,
      'This also removes it from homework and syllabus for this class.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusyId(subject.subjectId);
            try {
              await deleteClassSubject(subject.subjectId);
              showToast(`${subject.subjectName} removed.`, 'success');
              await revalidate();
            } catch (e) {
              showToast(e?.message || 'Could not remove the subject.', 'error');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenScaffold
      title="Manage Subjects"
      fallbackRoute={homeRoute}
      error={scope.classId ? error : ''}
      onRetry={reload}
      toast={toast}
    >
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
          message="Pick a school and class to manage its subjects."
        />
      ) : (
        <>
          <Card>
            <Text style={styles.label}>Add a subject</Text>
            <View style={styles.addRow}>
              <TextField
                value={name}
                onChangeText={setName}
                placeholder="e.g. Mathematics"
                style={styles.input}
                onSubmitEditing={add}
                returnKeyType="done"
              />
              <Pressable
                onPress={add}
                disabled={adding}
                style={({ pressed }) => [
                  styles.addBtn,
                  (pressed || adding) && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Add subject"
              >
                {adding ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="add" size={20} color="#ffffff" />
                )}
              </Pressable>
            </View>
          </Card>

          {loading ? (
            <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
          ) : list.length === 0 ? (
            <EmptyState
              icon="book-outline"
              title="No subjects yet"
              message={`Class ${scope.className} has no subjects. Add the first one above.`}
            />
          ) : (
            <View style={styles.list}>
              {list.map((subject) => (
                <View key={subject.subjectId} style={styles.row}>
                  <Ionicons name="book-outline" size={17} color={PALETTE.primaryDark} />
                  <Text style={styles.rowName} numberOfLines={2}>
                    {subject.subjectName}
                  </Text>
                  {busyId === subject.subjectId ? (
                    <ActivityIndicator size="small" color={PALETTE.primary} />
                  ) : (
                    <Pressable
                      onPress={() => confirmDelete(subject)}
                      hitSlop={8}
                      style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${subject.subjectName}`}
                    >
                      <Ionicons name="trash-outline" size={17} color={FEEDBACK.errorText} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  picker: { paddingHorizontal: 0, paddingVertical: 0 },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  input: { flex: 1, marginBottom: 0 },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: PALETTE.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: { marginTop: SPACING.xl },
  list: { gap: SPACING.sm, marginTop: SPACING.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    ...SHADOWS.sm,
  },
  rowName: { flex: 1, fontSize: 14, fontWeight: '600', color: SLATE[800] },
  iconBtn: { padding: 4, borderRadius: 8 },
  pressed: { opacity: 0.7 },
});
