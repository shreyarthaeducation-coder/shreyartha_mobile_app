import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, PORTALS, SLATE, SPACING } from '../../../constants/theme';
import { FormSheet } from '../../ui';
import {
  EXAM_STATUS,
  fetchMarksSheet,
  fetchQuestionMarksSheet,
  saveMarks,
  saveQuestionMarks,
} from '../../../services/teacher/examService';

/**
 * Marks entry for one exam — both shapes behind one sheet.
 *
 * WHICH SHAPE IS NOT A CHOICE: `exam.questionCount > 0` means per-question marking, otherwise flat
 * marks. That's the web's rule and the backend's two endpoints; a teacher who adds one question to
 * an exam silently gets the other screen.
 *
 * The web renders both as `students × columns` tables with a horizontal scroller. Here the roster
 * is a vertical list, and per-question marking opens a second sheet for one student at a time with
 * a running total — a 20-question exam is simply not a grid a thumb can use.
 *
 * THE MAXIMUM-MARK GUARD ONLY EXISTS HERE. On the web it is a `max=` attribute on a number input,
 * with no JS check and nothing blocking Save. RN's TextInput has no such attribute, so without the
 * explicit clamp below the guard would vanish entirely and out-of-range marks would reach the API.
 */

const PALETTE = PORTALS.school;

/** Keeps only digits and a single dot, then rejects anything above `max`. */
const sanitise = (text, max) => {
  const cleaned = String(text).replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  if (cleaned === '') return '';
  const value = Number(cleaned);
  if (Number.isNaN(value)) return '';
  if (max != null && value > max) return String(max);
  return cleaned;
};

function StatusToggle({ status, onPick, disabled }) {
  return (
    <View style={styles.statusToggle}>
      {[
        { value: EXAM_STATUS.PRESENT, short: 'P', tone: FEEDBACK.successText, bg: FEEDBACK.successBg },
        { value: EXAM_STATUS.ABSENT, short: 'A', tone: FEEDBACK.errorText, bg: FEEDBACK.errorBg },
      ].map((option) => {
        const active = status === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onPick(option.value)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.statusBtn,
              active && { backgroundColor: option.bg, borderColor: option.tone },
              pressed && styles.pressed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.value === EXAM_STATUS.PRESENT ? 'Present' : 'Absent'}
          >
            <Text style={[styles.statusText, active && { color: option.tone }]}>
              {option.short}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function MarksSheet({ visible, exam, onClose, onSaved, showToast }) {
  const perQuestion = (exam?.questionCount || 0) > 0;

  const [sheet, setSheet] = useState(null);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openStudent, setOpenStudent] = useState(null);

  useEffect(() => {
    if (!visible || !exam?.id) return undefined;
    let alive = true;
    setLoading(true);
    setOpenStudent(null);

    (async () => {
      try {
        const data = perQuestion
          ? await fetchQuestionMarksSheet(exam.id)
          : await fetchMarksSheet(exam.id);
        if (!alive) return;
        setSheet(data);

        const seeded = {};
        (data?.students || []).forEach((student) => {
          if (perQuestion) {
            const marks = {};
            (student.questionMarks || []).forEach((qm) => {
              marks[qm.questionId] = qm.marksObtained == null ? '' : String(qm.marksObtained);
            });
            seeded[student.studentId] = {
              status: student.status || EXAM_STATUS.PRESENT,
              remarks: student.remarks || '',
              marks,
            };
          } else {
            seeded[student.studentId] = {
              status: student.status || EXAM_STATUS.PRESENT,
              remarks: student.remarks || '',
              marksObtained: student.marksObtained == null ? '' : String(student.marksObtained),
            };
          }
        });
        setEdits(seeded);
      } catch (e) {
        if (alive) showToast?.(e?.message || 'Could not load the marks sheet.', 'error');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [visible, exam?.id, perQuestion, showToast]);

  const students = sheet?.students || [];
  const questions = sheet?.questions || [];
  const maxMarks = perQuestion ? sheet?.totalQuestionMarks : sheet?.maxMarks;

  const rowTotal = useCallback(
    (studentId) => {
      const entry = edits[studentId];
      if (!entry || entry.status === EXAM_STATUS.ABSENT) return 0;
      return Object.values(entry.marks || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
    },
    [edits],
  );

  const entered = useMemo(
    () =>
      students.filter((s) => {
        const entry = edits[s.studentId];
        if (!entry) return false;
        if (entry.status === EXAM_STATUS.ABSENT) return true;
        return perQuestion
          ? Object.values(entry.marks || {}).some((v) => v !== '')
          : entry.marksObtained !== '';
      }).length,
    [students, edits, perQuestion],
  );

  const patch = (studentId, changes) =>
    setEdits((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...changes } }));

  const markAll = (status) =>
    setEdits((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        next[s.studentId] = { ...next[s.studentId], status };
      });
      return next;
    });

  const submit = async () => {
    setSaving(true);
    try {
      const entries = students.map((student) => {
        const entry = edits[student.studentId] || {};
        const absent = entry.status === EXAM_STATUS.ABSENT;

        if (perQuestion) {
          return {
            studentId: student.studentId,
            status: entry.status || EXAM_STATUS.PRESENT,
            remarks: entry.remarks || null,
            // ABSENT drops the whole array — the flat endpoint uses a null mark instead. Built
            // from `questions`, not the edit map, so untouched questions still appear as null.
            questionMarks: absent
              ? []
              : questions.map((q) => ({
                  questionId: q.id,
                  marksObtained:
                    entry.marks?.[q.id] === '' || entry.marks?.[q.id] == null
                      ? null
                      : Number(entry.marks[q.id]),
                })),
          };
        }

        return {
          studentId: student.studentId,
          status: entry.status || EXAM_STATUS.PRESENT,
          marksObtained:
            absent || entry.marksObtained === '' || entry.marksObtained == null
              ? null
              : Number(entry.marksObtained),
          remarks: entry.remarks || null,
        };
      });

      if (perQuestion) await saveQuestionMarks(exam.id, entries);
      else await saveMarks(exam.id, entries);

      showToast?.('Marks saved.', 'success');
      onSaved?.();
    } catch (e) {
      showToast?.(e?.message || 'Could not save the marks.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const student = students.find((s) => s.studentId === openStudent) || null;
  const studentEntry = openStudent ? edits[openStudent] : null;

  return (
    <>
      <FormSheet
        visible={visible && !openStudent}
        title={exam ? `${exam.examName}` : 'Marks'}
        subtitle={
          exam
            ? `${exam.examCode} · ${perQuestion ? 'per-question' : 'total'} marking · max ${maxMarks ?? '—'}`
            : undefined
        }
        onClose={onClose}
        onSubmit={submit}
        submitting={saving}
        submitLabel="Save marks"
        fullHeight
      >
        {loading ? (
          <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />
        ) : students.length === 0 ? (
          <Text style={styles.empty}>No students found for this class and section.</Text>
        ) : (
          <>
            <View style={styles.bulkRow}>
              <Text style={styles.progress}>
                {entered} of {students.length} entered
              </Text>
              <Pressable
                onPress={() => markAll(EXAM_STATUS.PRESENT)}
                style={({ pressed }) => [styles.bulkBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={[styles.bulkText, { color: FEEDBACK.successText }]}>All present</Text>
              </Pressable>
              <Pressable
                onPress={() => markAll(EXAM_STATUS.ABSENT)}
                style={({ pressed }) => [styles.bulkBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={[styles.bulkText, { color: FEEDBACK.errorText }]}>All absent</Text>
              </Pressable>
            </View>

            {students.map((s, index) => {
              const entry = edits[s.studentId] || {};
              const absent = entry.status === EXAM_STATUS.ABSENT;
              return (
                <View key={s.studentId} style={styles.row}>
                  <Text style={styles.index}>{index + 1}</Text>
                  <Text style={styles.name} numberOfLines={1}>
                    {s.studentName}
                  </Text>

                  {perQuestion ? (
                    <Pressable
                      onPress={() => setOpenStudent(s.studentId)}
                      disabled={absent}
                      style={({ pressed }) => [
                        styles.totalBtn,
                        absent && styles.disabled,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Enter per-question marks for ${s.studentName}`}
                    >
                      <Text style={styles.totalText}>
                        {absent ? '—' : `${rowTotal(s.studentId)}/${maxMarks ?? 0}`}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={SLATE[500]} />
                    </Pressable>
                  ) : (
                    <View style={styles.markBox}>
                      <TextInput
                        style={[styles.markInput, absent && styles.disabled]}
                        value={absent ? '' : entry.marksObtained ?? ''}
                        editable={!absent}
                        keyboardType="numeric"
                        placeholder="—"
                        placeholderTextColor={SLATE[400]}
                        onChangeText={(text) =>
                          patch(s.studentId, { marksObtained: sanitise(text, maxMarks) })
                        }
                      />
                      <Text style={styles.markMax}>/{maxMarks ?? 0}</Text>
                    </View>
                  )}

                  <StatusToggle
                    status={entry.status}
                    onPick={(status) => patch(s.studentId, { status })}
                  />
                </View>
              );
            })}
          </>
        )}
      </FormSheet>

      {/* Per-question entry for a single student. */}
      <FormSheet
        visible={!!openStudent}
        title={student?.studentName || 'Marks'}
        subtitle={`Total ${openStudent ? rowTotal(openStudent) : 0} / ${maxMarks ?? 0}`}
        onClose={() => setOpenStudent(null)}
        onSubmit={() => setOpenStudent(null)}
        submitLabel="Done"
        fullHeight
      >
        {questions.map((q, index) => (
          <View key={q.id} style={styles.qRow}>
            <Text style={styles.qLabel} numberOfLines={2}>
              Q{index + 1}
              {q.questionStatement ? ` · ${q.questionStatement}` : ''}
            </Text>
            <View style={styles.markBox}>
              <TextInput
                style={styles.markInput}
                value={studentEntry?.marks?.[q.id] ?? ''}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={SLATE[400]}
                onChangeText={(text) =>
                  patch(openStudent, {
                    marks: { ...(studentEntry?.marks || {}), [q.id]: sanitise(text, q.marks) },
                  })
                }
              />
              <Text style={styles.markMax}>/{q.marks ?? 0}</Text>
            </View>
          </View>
        ))}
      </FormSheet>
    </>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: SPACING.xl },
  empty: { fontSize: 13, color: SLATE[500], textAlign: 'center', paddingVertical: SPACING.lg },

  bulkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  progress: { flex: 1, fontSize: 12.5, fontWeight: '700', color: SLATE[600] },
  bulkBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  bulkText: { fontSize: 12, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  index: { width: 20, fontSize: 12, fontWeight: '700', color: SLATE[400] },
  name: { flex: 1, fontSize: 14, fontWeight: '600', color: SLATE[800] },

  markBox: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  markInput: {
    width: 52,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: SLATE[900],
    backgroundColor: '#ffffff',
  },
  markMax: { fontSize: 11.5, color: SLATE[500], fontWeight: '600' },
  disabled: { opacity: 0.45 },

  totalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 8,
    backgroundColor: SLATE[50],
  },
  totalText: { fontSize: 13, fontWeight: '700', color: SLATE[700] },

  statusToggle: { flexDirection: 'row', gap: 4 },
  statusBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: SLATE[50],
  },
  statusText: { fontSize: 12.5, fontWeight: '800', color: SLATE[400] },

  qRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  qLabel: { flex: 1, fontSize: 13, color: SLATE[700] },

  pressed: { opacity: 0.72 },
});
