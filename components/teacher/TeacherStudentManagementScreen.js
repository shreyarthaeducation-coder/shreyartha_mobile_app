import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, PORTALS, SLATE, SPACING, TYPE } from '../../constants/theme';
import { Card, EMPTY_SCOPE, EmptyState, FormSheet, ScopePicker, ScreenScaffold, TextField, useToast } from '../ui';
import { attendanceClassesLoaderFor } from '../../services/teacher/attendanceService';
import {
  fetchDuplicates,
  fetchSectionRoster,
  mergeStudents,
  previewMerge,
  updateStudentRecord,
  uploadFormalPhoto,
} from '../../services/teacher/studentDirectoryService';
import { normaliseDoubtImage } from '../../utils/doubtImage';
import { DuplicateStudentsCard, StudentMergeSheet } from '../staff/shared/StudentMerge';
import { pickImage, takePhoto } from '../../utils/filePicker';

/**
 * Student Management for a class teacher — the website's TeacherStudentManagement.
 *
 * Class and section are chosen exactly as in Mark Attendance, through the same list, because to a
 * teacher it is the same list of classes. Each student's school record can be corrected — name,
 * admission and roll numbers, parents, date of birth — and given the school's FORMAL photograph,
 * the one on report cards (a student's own profile picture is separate and stays theirs).
 *
 * The same child listed twice — the school's record and an account they made themselves — is
 * OFFERED for joining, never joined unasked: two children in a class really can share a name. What a
 * merge would move is shown first, and a merge cannot be undone.
 */

const PALETTE = PORTALS.school;
const EMPTY_DRAFT = {
  studentName: '',
  admissionNumber: '',
  rollNumber: '',
  fatherName: '',
  motherName: '',
  dob: '',
  formalPhotoUrl: '',
};

export default function TeacherStudentManagementScreen({ homeRoute = '/teacher' }) {
  const { toast, showToast } = useToast();
  const [scope, setScope] = useState(EMPTY_SCOPE);
  const [students, setStudents] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mergePair, setMergePair] = useState(null);
  const [mergePlan, setMergePlan] = useState(null);
  const [merging, setMerging] = useState(false);

  const sectionId = scope.sectionId;

  const load = useCallback(async () => {
    if (!sectionId) {
      setStudents([]);
      setDuplicates([]);
      return;
    }
    setLoading(true);
    try {
      setStudents(await fetchSectionRoster(sectionId));
    } catch (e) {
      setStudents([]);
      showToast(e?.message || 'Could not load the students.', 'error');
    } finally {
      setLoading(false);
    }
    // Quietly: a class with no duplicates should never know this exists, and a failure here must
    // not stop the class list.
    fetchDuplicates(sectionId)
      .then(setDuplicates)
      .catch(() => setDuplicates([]));
  }, [sectionId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // ── editing ───────────────────────────────────────────────────────────────────────────────────

  const startEdit = (student) => {
    setEditing(student);
    setDraft({
      studentName: student.studentName || '',
      admissionNumber: student.admissionNumber || '',
      rollNumber: student.rollNumber || '',
      fatherName: student.fatherName || '',
      motherName: student.motherName || '',
      dob: student.dob || '',
      formalPhotoUrl: student.formalPhotoUrl || '',
    });
  };

  const setField = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    if (!draft.studentName.trim()) {
      showToast('A student needs a name.', 'error');
      return;
    }
    if (draft.dob && !/^\d{4}-\d{2}-\d{2}$/.test(draft.dob)) {
      showToast('Write the date of birth as YYYY-MM-DD.', 'error');
      return;
    }
    setSaving(true);
    try {
      const saved = await updateStudentRecord(sectionId, editing.studentId, draft);
      // The server returns the stored row: show exactly that.
      setStudents((prev) => prev.map((s) => (s.studentId === editing.studentId ? saved : s)));
      showToast(`${saved?.studentName || draft.studentName} updated.`, 'success');
      setEditing(null);
    } catch (e) {
      showToast(e?.message || 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const attachPhoto = async (source) => {
    const picked = source === 'camera' ? await takePhoto() : await pickImage();
    if (!picked) return;
    if (picked.denied) {
      showToast(source === 'camera' ? 'Allow camera access to take the photo.' : 'Allow photo access to choose it.', 'error');
      return;
    }
    setUploading(true);
    try {
      const file = await normaliseDoubtImage(picked.uri);
      setField('formalPhotoUrl', await uploadFormalPhoto({ ...file, name: 'formal-photo.jpg' }));
      showToast('Photo attached. Press Save to keep it.', 'success');
    } catch (e) {
      showToast(e?.message || 'Upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const choosePhoto = () => {
    const options = [
      { text: 'Take photo', onPress: () => attachPhoto('camera') },
      { text: 'Choose photo', onPress: () => attachPhoto('library') },
    ];
    if (Platform.OS === 'ios') options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('The formal photograph', 'Used on report cards.', options, { cancelable: true });
  };

  // ── joining two records of one child ──────────────────────────────────────────────────────────

  const openMerge = async (pair) => {
    setMergePair(pair);
    setMergePlan(null);
    try {
      setMergePlan(await previewMerge(sectionId, pair.schoolRecord.studentId, pair.selfRegistered.studentId));
    } catch (e) {
      showToast(e?.message || 'Could not check that pair.', 'error');
      setMergePair(null);
    }
  };

  const confirmMerge = async () => {
    setMerging(true);
    try {
      await mergeStudents(sectionId, mergePair.schoolRecord.studentId, mergePair.selfRegistered.studentId);
      showToast(
        `${mergePair.schoolRecord.fullName} is now one record. They sign in with the account they already had.`,
        'success',
      );
      setMergePair(null);
      setMergePlan(null);
      load();
    } catch (e) {
      showToast(e?.message || 'Could not merge those records.', 'error');
    } finally {
      setMerging(false);
    }
  };

  return (
    <ScreenScaffold title="Student Management" fallbackRoute={homeRoute} scroll={false} toast={toast}>
      <View style={styles.header}>
        <ScopePicker loadClasses={attendanceClassesLoaderFor()} value={scope} onChange={setScope} />
      </View>

      {!sectionId ? (
        <View style={styles.fill}>
          <EmptyState
            icon="people-outline"
            title="Choose a class and section"
            message="Keep your class list up to date: names, numbers, parents, date of birth and the formal photograph used on report cards."
          />
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PALETTE.primary} />
        </View>
      ) : students.length === 0 ? (
        <View style={styles.fill}>
          <EmptyState
            icon="people-outline"
            title="No students yet"
            message={`No students in Class ${scope.className} - Section ${scope.sectionName} yet.`}
          />
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <DuplicateStudentsCard duplicates={duplicates} onReview={openMerge} />

          {students.map((s) => (
            <Card key={s.studentId}>
              <View style={styles.studentRow}>
                {s.formalPhotoUrl ? (
                  <Image source={{ uri: s.formalPhotoUrl }} style={styles.photo} />
                ) : (
                  <View style={[styles.photo, styles.photoEmpty]}>
                    <Ionicons name="person-outline" size={22} color={SLATE[400]} />
                  </View>
                )}
                <View style={styles.studentBody}>
                  <Text style={styles.name}>{s.studentName}</Text>
                  <Text style={styles.meta}>
                    {[
                      s.admissionNumber ? `Adm. ${s.admissionNumber}` : null,
                      s.rollNumber ? `Roll ${s.rollNumber}` : null,
                      s.dob ? `DOB ${s.dob}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No numbers recorded'}
                  </Text>
                  {s.fatherName || s.motherName ? (
                    <Text style={styles.meta}>
                      {[s.fatherName, s.motherName].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => startEdit(s)}
                  hitSlop={6}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${s.studentName}`}
                >
                  <Ionicons name="pencil" size={17} color={SLATE[600]} />
                </Pressable>
              </View>
            </Card>
          ))}
        </ScrollView>
      )}

      <FormSheet
        visible={!!editing}
        title={editing ? `Edit ${editing.studentName}` : 'Edit'}
        subtitle={`Class ${scope.className} - Section ${scope.sectionName}`}
        onClose={() => setEditing(null)}
        onSubmit={save}
        submitting={saving}
        submitLabel="Save"
        fullHeight
      >
        <View style={styles.photoEdit}>
          {draft.formalPhotoUrl ? (
            <Image source={{ uri: draft.formalPhotoUrl }} style={styles.photoLarge} />
          ) : (
            <View style={[styles.photoLarge, styles.photoEmpty]}>
              <Text style={styles.meta}>No photo</Text>
            </View>
          )}
          <View style={styles.photoButtons}>
            <Pressable
              onPress={choosePhoto}
              disabled={uploading}
              style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.smallBtnText}>{uploading ? 'Uploading…' : draft.formalPhotoUrl ? 'Replace photo' : 'Add photo'}</Text>
            </Pressable>
            {draft.formalPhotoUrl ? (
              <Pressable
                onPress={() => setField('formalPhotoUrl', '')}
                style={({ pressed }) => [styles.smallBtnPlain, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <TextField label="Student name" required value={draft.studentName} onChangeText={(v) => setField('studentName', v)} />
        <TextField label="Admission number" value={draft.admissionNumber} onChangeText={(v) => setField('admissionNumber', v)} />
        <TextField label="Roll number" value={draft.rollNumber} onChangeText={(v) => setField('rollNumber', v)} />
        <TextField label="Parent / guardian" value={draft.fatherName} onChangeText={(v) => setField('fatherName', v)} />
        <TextField label="Mother" value={draft.motherName} onChangeText={(v) => setField('motherName', v)} />
        <TextField
          label="Date of birth"
          value={draft.dob}
          onChangeText={(v) => setField('dob', v.replace(/[^0-9-]/g, ''))}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
        />
      </FormSheet>

      <StudentMergeSheet
        pair={mergePair}
        plan={mergePlan}
        merging={merging}
        onConfirm={confirmMerge}
        onClose={() => {
          setMergePair(null);
          setMergePlan(null);
        }}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  fill: { flex: 1, justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  listContent: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.sm },
  loader: { marginVertical: SPACING.lg },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  studentBody: { flex: 1 },
  photo: { width: 48, height: 48, borderRadius: 24, backgroundColor: SLATE[100] },
  photoLarge: { width: 96, height: 96, borderRadius: 12, backgroundColor: SLATE[100] },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  photoEdit: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  photoButtons: { gap: 6 },
  name: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  meta: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },
  agree: { color: FEEDBACK.successText },
  hint: { fontSize: TYPE.label, color: SLATE[500], marginVertical: 6 },
  body: { fontSize: TYPE.body, color: SLATE[700], marginBottom: 8 },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, marginTop: 8, fontWeight: '600' },
  dupTitle: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  dupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  dupBody: { flex: 1 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[50],
  },
  smallBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PALETTE.primary,
    backgroundColor: PALETTE.tint,
  },
  smallBtnText: { fontSize: TYPE.label, fontWeight: '700', color: PALETTE.primaryDark },
  smallBtnPlain: { paddingVertical: 7, paddingHorizontal: 10 },
  removeText: { fontSize: TYPE.label, fontWeight: '700', color: FEEDBACK.errorText },
  pressed: { opacity: 0.72 },
});
