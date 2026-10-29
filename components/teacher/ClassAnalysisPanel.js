import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../constants/theme';
import { Card, ChipMultiSelect } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import {
  fetchClassAnalysis,
  fetchClassAnalysisOptions,
  shareClassAnalysisFile,
} from '../../services/teacher/classAnalysisService';
import {
  ALL_EXAMS,
  cellText,
  classAnalysisHtml,
  dateRange,
  isLow,
  isPartial,
  mark,
  selectionQuery,
  summaryRows,
} from '../../utils/classAnalysisSheet';

const ROW = 30;
const ROLL_W = 40;
const NAME_W = 150;
const MARK_W = 72;

const FILES = [
  { format: 'xlsx', label: 'Excel' },
  { format: 'docx', label: 'Word' },
  { format: 'csv', label: 'CSV' },
];

/**
 * The class teacher's class analysis (28 Oct 2026; choices 29 Oct) — the website's
 * ClassAnalysisReport: the exams and subjects she ticks, laid out as the school's paper sheet. Several
 * exams, or Total, add up subject by subject, out of their Full Marks added. Nothing loads until
 * "Generate report". Roll and name stay put while the subjects scroll sideways; the sheet shares as
 * a PDF, Excel, Word or CSV.
 *
 * The screen around it shows it only for a section the teacher is class teacher of; the server
 * checks the same.
 */
export default function ClassAnalysisPanel({ sectionId, showToast }) {
  const PALETTE = usePalette();
  const [options, setOptions] = useState(null);
  const [optionsError, setOptionsError] = useState('');
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [generated, setGenerated] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState('');
  const ticket = useRef(0);

  useEffect(() => {
    setOptions(null);
    setOptionsError('');
    setReport(null);
    setGenerated(null);
    setExams([]);
    setSubjects([]);
    if (!sectionId) return undefined;
    const controller = new AbortController();
    fetchClassAnalysisOptions(sectionId, controller.signal)
      .then((res) => {
        setOptions(res);
        // The latest exam is the one a class teacher is usually looking at; every subject.
        if (res.exams.length) setExams([res.exams[res.exams.length - 1].examName]);
        setSubjects(res.subjects.map((s) => String(s.subjectId)));
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setOptionsError(e?.message || 'Could not load the exams.');
      });
    return () => controller.abort();
  }, [sectionId]);

  const allSubjects = !!options && subjects.length === options.subjects.length;
  const query = sectionId ? selectionQuery(sectionId, { exams, subjects, allSubjects }) : '';
  const stale = !!generated && generated !== query;
  const canGenerate = exams.length > 0 && subjects.length > 0 && !loading;

  const generate = async () => {
    if (!canGenerate) return;
    const mine = ++ticket.current;
    setLoading(true);
    try {
      const res = await fetchClassAnalysis(query);
      if (mine !== ticket.current) return;
      setReport(res);
      setGenerated(query);
    } catch (e) {
      if (mine !== ticket.current) return;
      setReport(null);
      setGenerated(null);
      showToast?.(e?.message || 'Could not load the class analysis.', 'error');
    } finally {
      if (mine === ticket.current) setLoading(false);
    }
  };

  /** Ticking Total clears the exams; ticking an exam clears Total — the website's rule. */
  const changeExams = (next) => {
    const added = next.find((v) => !exams.includes(v));
    if (added === ALL_EXAMS) setExams([ALL_EXAMS]);
    else setExams(next.filter((v) => v !== ALL_EXAMS));
  };

  const fileBase = report
    ? `class-analysis-${report.className}-${report.sectionName}-${report.allExams ? 'Total' : report.examName}`
        .replace(/[^\w-]+/g, '-')
        .replace(/-+$/, '')
    : 'class-analysis';

  const sharePdf = async () => {
    if (!report) return;
    setSharing('pdf');
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
      setSharing('');
    }
  };

  /** Excel, Word and CSV come from the server, for the sheet last generated. */
  const shareFile = async (format) => {
    if (!generated) return;
    setSharing(format);
    try {
      const { shared } = await shareClassAnalysisFile(generated, format, `${fileBase}.${format}`);
      if (!shared) showToast?.('Sharing is not available on this phone.', 'error');
    } catch (e) {
      showToast?.(e?.message || `Could not create the ${format.toUpperCase()} file.`, 'error');
    } finally {
      setSharing('');
    }
  };

  if (optionsError) {
    return (
      <Card>
        <Text style={styles.title}>Class analysis</Text>
        <Text style={[styles.note, { color: FEEDBACK.errorText }]}>{optionsError}</Text>
      </Card>
    );
  }
  if (!options) {
    return <ActivityIndicator color={PALETTE.primary} style={styles.loader} />;
  }
  if (options.exams.length === 0) {
    return (
      <Card>
        <Text style={styles.title}>Class analysis</Text>
        <Text style={styles.note}>No exams in this class yet.</Text>
      </Card>
    );
  }

  const examOptions = [
    ...options.exams.map((e) => ({ value: e.examName, label: e.examName })),
    ...(options.exams.length > 1 ? [{ value: ALL_EXAMS, label: 'Total — all exams' }] : []),
  ];
  const subjectOptions = options.subjects.map((s) => ({ value: String(s.subjectId), label: s.heading }));
  const regularExams = options.exams.map((e) => e.examName);
  const allExamsTicked = regularExams.every((n) => exams.includes(n));

  const columns = report?.columns || [];
  const summaries = summaryRows(report);
  const students = report?.students || [];
  const anyPartial = students.some((s) => Object.values(s.marks || {}).some(isPartial));

  return (
    <Card>
      <Text style={styles.title}>Class analysis</Text>
      <Text style={styles.note}>
        Tick exams and subjects, then generate. Several exams add up subject by subject, out of their Full Marks added.
      </Text>

      <View style={styles.pickerHead}>
        <Text style={styles.pickerLabel}>Exams</Text>
        <Pressable
          onPress={() => setExams(allExamsTicked ? [] : regularExams)}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={[styles.link, { color: PALETTE.primary }]}>{allExamsTicked ? 'Clear' : 'Select all'}</Text>
        </Pressable>
      </View>
      <ChipMultiSelect options={examOptions} value={exams} onChange={changeExams} />

      <View style={styles.pickerHead}>
        <Text style={styles.pickerLabel}>Subjects</Text>
        <Pressable
          onPress={() => setSubjects(allSubjects ? [] : options.subjects.map((s) => String(s.subjectId)))}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={[styles.link, { color: PALETTE.primary }]}>{allSubjects ? 'Clear' : 'Select all'}</Text>
        </Pressable>
      </View>
      <ChipMultiSelect options={subjectOptions} value={subjects} onChange={setSubjects} />

      <Pressable
        onPress={generate}
        disabled={!canGenerate}
        style={({ pressed }) => [
          styles.generateBtn,
          { backgroundColor: PALETTE.primary },
          !canGenerate && styles.disabled,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
      >
        {loading ? <ActivityIndicator color="#ffffff" /> : <Ionicons name="bar-chart-outline" size={16} color="#ffffff" />}
        <Text style={styles.shareText}>{loading ? 'Generating…' : 'Generate report'}</Text>
      </Pressable>

      {report ? (
        <>
          {stale ? (
            <Text style={[styles.stale, { color: PALETTE.primary }]}>
              Selection changed — tap Generate report to update the sheet.
            </Text>
          ) : null}

          <View style={styles.shareRow}>
            {[{ format: 'pdf', label: 'PDF' }, ...FILES].map((f) => (
              <Pressable
                key={f.format}
                onPress={() => (f.format === 'pdf' ? sharePdf() : shareFile(f.format))}
                disabled={!!sharing}
                style={({ pressed }) => [styles.shareChip, { borderColor: PALETTE.primary }, !!sharing && styles.disabled, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Share as ${f.label}`}
              >
                <Ionicons name="share-outline" size={14} color={PALETTE.primary} />
                <Text style={[styles.shareChipText, { color: PALETTE.primary }]}>
                  {sharing === f.format ? 'Preparing…' : f.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {report.warnings?.length ? (
            <View style={styles.warnings}>
              <Text style={styles.warningsTitle}>Full Marks to check with the school admin</Text>
              {report.warnings.map((w) => (
                <Text key={w} style={styles.warningText}>• {w}</Text>
              ))}
            </View>
          ) : null}

          <View style={stale ? styles.staleSheet : null}>
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
                <Cell text="OUT OF" width={ROLL_W + NAME_W} left bold />
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
                    {columns.map((c) => <Cell key={c.subjectId} text={dateRange(c)} width={MARK_W} bold small />)}
                  </View>
                  <View style={styles.row}>
                    {columns.map((c) => <Cell key={c.subjectId} text={mark(c.outOf)} width={MARK_W} bold />)}
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
              {report.exams?.length > 1 ? `Marks added across: ${report.exams.join(', ')}. ` : ''}
              {anyPartial ? '† no mark in one or more of the exams added. ' : ''}A blank is a subject with no mark
              recorded; AB is absent. Neither counts in the average or the bands.
            </Text>
          </View>
        </>
      ) : null}
    </Card>
  );
}

function Cell({ text, width, left, right, bold, low, gap, small }) {
  return (
    <View style={[styles.cell, { width }, gap && styles.gapCell]}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit={small}
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
  title: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[900] },
  note: { fontSize: TYPE.label, color: SLATE[600], marginTop: 4 },
  pickerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, marginBottom: 6 },
  pickerLabel: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700] },
  link: { fontSize: TYPE.label, fontWeight: '600' },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: SPACING.md,
  },
  shareText: { fontSize: TYPE.label, fontWeight: '700', color: '#ffffff' },
  stale: { fontSize: TYPE.label, marginTop: SPACING.sm },
  staleSheet: { opacity: 0.45 },
  shareRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  shareChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 999,
  },
  shareChipText: { fontSize: TYPE.label, fontWeight: '600' },
  warnings: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FEEDBACK.warningBorder,
    backgroundColor: FEEDBACK.warningBg,
  },
  warningsTitle: { fontSize: TYPE.label, fontWeight: '700', color: FEEDBACK.warningOnBg },
  warningText: { fontSize: TYPE.label, color: FEEDBACK.warningOnBg, marginTop: 2 },
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
