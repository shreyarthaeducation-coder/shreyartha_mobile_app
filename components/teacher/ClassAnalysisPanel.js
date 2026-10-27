import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../constants/theme';
import { Card, Select } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import { fetchMyClassTeacherSections } from '../../services/teacher/classReportCardService';
import { fetchClassAnalysis, fetchClassAnalysisExams } from '../../services/teacher/classAnalysisService';
import { cellText, classAnalysisHtml, isLow, mark, shortDate, summaryRows } from '../../utils/classAnalysisSheet';

const ROW = 30;
const ROLL_W = 40;
const NAME_W = 150;
const MARK_W = 64;

/**
 * The class teacher's class analysis (28 Oct 2026) — the website's ClassAnalysisReport: one exam
 * across every subject of her section, laid out as the school's paper sheet. Roll and name stay put
 * while the subjects scroll sideways; "Share as PDF" gives the landscape sheet.
 *
 * Shown only to the section's class teacher; the server checks the same.
 */
export default function ClassAnalysisPanel({ sectionId, academicYearId, showToast }) {
  const PALETTE = usePalette();
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [exams, setExams] = useState(null);
  const [examName, setExamName] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    setIsClassTeacher(false);
    if (!academicYearId || !sectionId) return undefined;
    const controller = new AbortController();
    fetchMyClassTeacherSections(academicYearId, controller.signal)
      .then((mine) => setIsClassTeacher(mine.some((m) => m.sectionId === sectionId)))
      .catch(() => setIsClassTeacher(false));
    return () => controller.abort();
  }, [academicYearId, sectionId]);

  useEffect(() => {
    setExams(null);
    setExamName('');
    setReport(null);
    if (!isClassTeacher) return undefined;
    const controller = new AbortController();
    fetchClassAnalysisExams(sectionId, controller.signal)
      .then((list) => {
        setExams(list);
        // The latest exam is the one a class teacher is usually looking at.
        if (list.length) setExamName(list[list.length - 1].examName);
      })
      .catch(() => setExams([]));
    return () => controller.abort();
  }, [isClassTeacher, sectionId]);

  useEffect(() => {
    if (!isClassTeacher || !examName) return undefined;
    const controller = new AbortController();
    setLoading(true);
    fetchClassAnalysis(sectionId, examName, controller.signal)
      .then(setReport)
      .catch((e) => {
        if (e?.name !== 'AbortError') {
          setReport(null);
          showToast?.(e?.message || 'Could not load the class analysis.', 'error');
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // showToast is a notification callback; re-running on its identity would refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClassTeacher, sectionId, examName]);

  if (!isClassTeacher) return null;

  const share = async () => {
    if (!report) return;
    setSharing(true);
    try {
      // A4 landscape in points: the sheet is wider than it is tall.
      const { uri } = await Print.printToFileAsync({ html: classAnalysisHtml(report), width: 842, height: 595 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Class analysis', UTI: 'com.adobe.pdf' });
      } else {
        showToast?.('Sharing is not available on this phone.', 'error');
      }
    } catch (e) {
      showToast?.(e?.message || 'Could not create the PDF.', 'error');
    } finally {
      setSharing(false);
    }
  };

  const columns = report?.columns || [];
  const summaries = summaryRows(report);
  const students = report?.students || [];

  return (
    <Card>
      <Text style={styles.title}>Class analysis</Text>
      <Text style={styles.note}>One exam across every subject of your class, as the school&apos;s marks sheet.</Text>

      {exams && exams.length === 0 ? (
        <Text style={styles.note}>No exams in this class yet.</Text>
      ) : (
        <View style={styles.controls}>
          <View style={styles.flex}>
            <Select
              label="Exam"
              value={examName}
              options={(exams || []).map((e) => ({
                value: e.examName,
                label: `${e.examName} (${e.subjects} subject${e.subjects === 1 ? '' : 's'})`,
              }))}
              onChange={setExamName}
              disabled={!exams}
            />
          </View>
          <Pressable
            onPress={share}
            disabled={!report || sharing}
            style={({ pressed }) => [
              styles.shareBtn,
              { backgroundColor: PALETTE.primary },
              (!report || sharing) && styles.disabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Ionicons name="share-outline" size={16} color="#ffffff" />
            <Text style={styles.shareText}>{sharing ? 'Preparing…' : 'Share as PDF'}</Text>
          </Pressable>
        </View>
      )}

      {loading && !report ? <ActivityIndicator color={PALETTE.primary} style={styles.loader} /> : null}

      {report ? (
        <>
          <View style={styles.header}>
            <Text style={styles.headerSchool}>{report.schoolName}</Text>
            <Text style={styles.headerLine}>EXAMINATION: {String(report.examName || '').toUpperCase()}</Text>
            {report.session ? <Text style={styles.headerLine}>SESSION: {report.session}</Text> : null}
            <Text style={styles.headerLine}>
              CLASS- {report.className}-{report.sectionName}
            </Text>
            <Text style={[styles.headerLine, styles.headerLeft]}>CLASS TEACHER- {report.classTeacher || ''}</Text>
          </View>

          <View style={styles.grid}>
            {/* Roll and name: fixed while the subjects scroll. */}
            <View>
              <Cell text="TEACHER NAME" width={ROLL_W + NAME_W} left bold />
              <Cell text="DATE" width={ROLL_W + NAME_W} left bold />
              <View style={styles.row}>
                <Cell text="ROLL" width={ROLL_W} bold />
                <Cell text="STUDENT'S NAME" width={NAME_W} left bold />
              </View>
              {students.map((s) => (
                <View key={s.studentId} style={styles.row}>
                  <Cell text={s.rollNumber || ''} width={ROLL_W} />
                  <Cell text={s.studentName} width={NAME_W} left />
                </View>
              ))}
              <Cell text="" width={ROLL_W + NAME_W} gap />
              {summaries.map(([label]) => (
                <Cell key={label} text={label} width={ROLL_W + NAME_W} left />
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={styles.row}>
                  {columns.map((c) => <Cell key={c.subjectId} text={c.teacherInitials} width={MARK_W} bold />)}
                </View>
                <View style={styles.row}>
                  {columns.map((c) => <Cell key={c.subjectId} text={shortDate(c.examDate)} width={MARK_W} bold />)}
                </View>
                <View style={styles.row}>
                  {columns.map((c) => <Cell key={c.subjectId} text={c.heading} width={MARK_W} bold />)}
                </View>
                {students.map((s) => (
                  <View key={s.studentId} style={styles.row}>
                    {columns.map((c) => {
                      const cell = s.marks?.[c.subjectId];
                      return <Cell key={c.subjectId} text={cellText(cell)} width={MARK_W} right low={isLow(cell, c.outOf)} />;
                    })}
                  </View>
                ))}
                <Cell text="" width={Math.max(MARK_W, MARK_W * columns.length)} gap />
                {summaries.map(([label, value]) => (
                  <View key={label} style={styles.row}>
                    {columns.map((c) => <Cell key={c.subjectId} text={value(c)} width={MARK_W} right />)}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
          <Text style={styles.footnote}>
            Out of {[...new Set(columns.map((c) => mark(c.outOf)))].join(' / ')}. A blank is a subject with no mark
            recorded; AB is absent. Neither counts in the average or the bands.
          </Text>
        </>
      ) : null}
    </Card>
  );
}

function Cell({ text, width, left, right, bold, low, gap }) {
  return (
    <View style={[styles.cell, { width }, gap && styles.gapCell]}>
      <Text
        numberOfLines={1}
        style={[
          styles.cellText,
          left && styles.leftText,
          right && styles.rightText,
          bold && styles.boldText,
          low && styles.lowText,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[900] },
  note: { fontSize: TYPE.label, color: SLATE[600], marginTop: 4 },
  controls: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  shareText: { fontSize: TYPE.label, fontWeight: '700', color: '#ffffff' },
  loader: { marginVertical: SPACING.md },
  header: { alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.sm },
  headerSchool: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[900] },
  headerLine: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[900] },
  headerLeft: { alignSelf: 'flex-start', marginTop: 4 },
  grid: { flexDirection: 'row' },
  row: { flexDirection: 'row' },
  cell: {
    height: ROW,
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SLATE[900],
    backgroundColor: '#ffffff',
  },
  gapCell: { borderLeftWidth: 0, borderRightWidth: 0 },
  cellText: { fontSize: TYPE.label, color: SLATE[900], textAlign: 'center' },
  leftText: { textAlign: 'left' },
  rightText: { textAlign: 'right' },
  boldText: { fontWeight: '700' },
  lowText: { color: FEEDBACK.errorText, textDecorationLine: 'underline' },
  footnote: { fontSize: TYPE.caption, color: SLATE[500], marginTop: SPACING.sm },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
