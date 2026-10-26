import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { Card } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import {
  fetchMyClassTeacherSections,
  fetchReportCardSheet,
  saveReportCardRemark,
} from '../../services/teacher/classReportCardService';

/**
 * The class teacher's report cards, under their class list — the website's TeacherReportCardPanel.
 *
 * What a card SAYS is theirs: the remark and the class each child goes up to, one child at a time
 * or the whole section at once. What a card SHOWS is the school's decision (Card Layout), and so is
 * who may see the cards at all, so neither appears here. Remark and promoted-to go to the same row
 * the school edits on its own screen, so there is one remark per child, not two that disagree.
 *
 * Viewing and printing a card stay on the website: the card is drawn and paginated by the
 * website's own layout code, which a phone does not have.
 *
 * Renders nothing unless this teacher is the section's class teacher; says why when the school has
 * not shared the cards yet.
 */
export default function ClassReportCardsPanel({ sectionId, academicYearId, showToast }) {
  const PALETTE = usePalette();
  const [mine, setMine] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [promoteAll, setPromoteAll] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!academicYearId) return undefined;
    const controller = new AbortController();
    fetchMyClassTeacherSections(academicYearId, controller.signal)
      .then(setMine)
      .catch(() => setMine([]));
    return () => controller.abort();
  }, [academicYearId]);

  const myClass = (mine || []).find((m) => m.sectionId === sectionId) || null;
  const shared = !!myClass?.reportViewEnabled;

  useEffect(() => {
    setSheet(null);
    setDrafts({});
    if (!sectionId || !shared) return undefined;
    const controller = new AbortController();
    setLoading(true);
    fetchReportCardSheet(sectionId, controller.signal)
      .then(setSheet)
      .catch((e) => {
        if (e?.name !== 'AbortError') showToast?.(e?.message || 'Could not load the report cards.', 'error');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // showToast is a notification callback; re-running on its identity would refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, shared]);

  if (!myClass) return null;

  if (!shared) {
    return (
      <Card>
        <Text style={styles.title}>Report cards</Text>
        <Text style={styles.note}>
          You are this section&apos;s class teacher. Its report cards appear here once the school shares them.
        </Text>
      </Card>
    );
  }

  if (loading || !sheet) {
    return loading ? <ActivityIndicator color={PALETTE.primary} style={styles.loader} /> : null;
  }

  const students = sheet.students || [];
  const draftOf = (student, key) => drafts[student.studentId]?.[key] ?? student[key] ?? '';
  const setDraft = (student, key, value) =>
    setDrafts((prev) => ({ ...prev, [student.studentId]: { ...prev[student.studentId], [key]: value } }));

  /** Saves one child's remark and promoted-to together, when a box is left with a change in it. */
  const save = async (student, patch) => {
    const next = { remarks: student.remarks || '', promotedTo: student.promotedTo || '', ...patch };
    if (next.remarks === (student.remarks || '') && next.promotedTo === (student.promotedTo || '')) return true;
    try {
      await saveReportCardRemark(sheet.sectionId, student.studentId, next.remarks, next.promotedTo);
      setSheet((prev) => ({
        ...prev,
        students: prev.students.map((s) => (s.studentId === student.studentId ? { ...s, ...next } : s)),
      }));
      return true;
    } catch (e) {
      showToast?.(e?.message || `Could not save ${student.studentName}'s card.`, 'error');
      return false;
    }
  };

  /** A whole section usually goes up to the same class, so it is set once, not forty times. */
  const applyPromotedToAll = async () => {
    const value = promoteAll.trim();
    if (!value || students.length === 0) return;
    setApplying(true);
    let failed = 0;
    for (const student of students) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await save(student, { promotedTo: value }))) failed += 1;
    }
    setDrafts((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        if (next[s.studentId]) delete next[s.studentId].promotedTo;
      });
      return next;
    });
    setApplying(false);
    showToast?.(
      failed
        ? `Saved for ${students.length - failed}; ${failed} could not be saved.`
        : `"Promoted to ${value}" saved for all ${students.length}.`,
      failed ? 'error' : 'success',
    );
  };

  const gradesFor = (student, term) =>
    (sheet.subjects || [])
      .map((s) => student.terms?.[term.id]?.[s.subjectId]?.grade)
      .filter(Boolean)
      .join(' ') || '–';

  return (
    <Card>
      <Text style={styles.title}>
        Report cards — Class {sheet.className}-{sheet.sectionName}
      </Text>
      <Text style={styles.note}>
        Write each child&apos;s remark and the class they go up to; both save when you leave the box. To view or
        print the cards, open Student Management on the website.
      </Text>

      <View style={styles.promoteRow}>
        <TextInput
          style={[styles.input, styles.flex]}
          value={promoteAll}
          onChangeText={setPromoteAll}
          placeholder="Promoted to, for everyone (e.g. Class 8)"
          placeholderTextColor={SLATE[400]}
          maxLength={60}
          accessibilityLabel="Promoted to, for everyone"
        />
        <Pressable
          onPress={applyPromotedToAll}
          disabled={applying || !promoteAll.trim()}
          style={({ pressed }) => [
            styles.applyBtn,
            { backgroundColor: PALETTE.primary },
            (applying || !promoteAll.trim()) && styles.disabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.applyText}>{applying ? 'Saving…' : 'Apply to all'}</Text>
        </Pressable>
      </View>

      {students.map((student) => (
        <View key={student.studentId} style={styles.row}>
          <Text style={styles.name}>
            {student.rollNumber ? `${student.rollNumber}. ` : ''}
            {student.studentName}
          </Text>
          {(sheet.terms || []).length ? (
            <Text style={styles.grades}>
              {(sheet.terms || []).map((t) => `${t.name}: ${gradesFor(student, t)}`).join('  ·  ')}
            </Text>
          ) : null}
          <TextInput
            style={[styles.input, styles.remark]}
            value={draftOf(student, 'remarks')}
            onChangeText={(v) => setDraft(student, 'remarks', v)}
            onBlur={() => save(student, { remarks: draftOf(student, 'remarks') })}
            placeholder="Class teacher's remark"
            placeholderTextColor={SLATE[400]}
            multiline
            maxLength={500}
            accessibilityLabel={`Remarks for ${student.studentName}`}
          />
          <TextInput
            style={styles.input}
            value={draftOf(student, 'promotedTo')}
            onChangeText={(v) => setDraft(student, 'promotedTo', v)}
            onBlur={() => save(student, { promotedTo: draftOf(student, 'promotedTo') })}
            placeholder="Promoted to"
            placeholderTextColor={SLATE[400]}
            maxLength={60}
            accessibilityLabel={`Promoted to, for ${student.studentName}`}
          />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginVertical: SPACING.md },
  title: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[900] },
  note: { fontSize: TYPE.label, color: SLATE[600], marginTop: 4 },
  promoteRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  applyBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  applyText: { fontSize: TYPE.label, fontWeight: '700', color: '#ffffff' },
  row: { borderTopWidth: 1, borderTopColor: SLATE[100], paddingTop: SPACING.sm, marginTop: SPACING.sm, gap: 6 },
  name: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  grades: { fontSize: TYPE.caption, color: SLATE[500] },
  input: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: TYPE.body,
    color: SLATE[900],
    backgroundColor: '#ffffff',
  },
  remark: { minHeight: 64, textAlignVertical: 'top' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
