import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { GroupedBars, ProgressBar, SegmentedDonut } from '../ui';
import { fetchStudentInsights } from '../../services/staff/studentStatusService';
import { STATES } from '../../utils/studentStatus';

/**
 * "View insights" — one student of a Student Status section, as charts, on frosted glass
 * (14 Oct 2026). The website's StudentInsights pop-up, for the app.
 *
 * Shows where the student has got to in each area, their school exam marks beside the section's
 * average, syllabus covered and their own reflections subject by subject, and how they rated their
 * understanding. The server only answers for a section this member of staff may open and a student
 * on its roster (StudentInsightsService), so nothing here decides who may see what.
 *
 * ── THE BLUR IS OPTIONAL ─────────────────────────────────────────────────────
 * `expo-blur` is required lazily, inside a try: a native module the installed build does not carry
 * throws at import time, and a top-level import would take the whole Student Status screen down with
 * it (react-native-pdf did exactly that to the teacher panel). Without it the backdrop is a dimmed,
 * translucent wash and the sheet is still a clear, near-white glass panel.
 */

let BlurView = null;
try {
  // eslint-disable-next-line global-require
  BlurView = require('expo-blur').BlurView;
} catch {
  BlurView = null;
}

// Beginner → Proficient, from "needs help" to "has it" — the same colours as the website.
const LEVELS = [
  { key: 'Beginner', color: '#ef4444' },
  { key: 'Developing', color: '#f59e0b' },
  { key: 'Progressing', color: '#3b82f6' },
  { key: 'Proficient', color: '#16a34a' },
];

const AREA_EDGE = { DONE: '#16a34a', PARTIAL: '#f59e0b', NONE: '#ef4444', LOCKED: SLATE[400], CLOSED: SLATE[400], NA: SLATE[300] };

/** "7" → "Class 7"; a name that already says so ("Class 6") is left as it is. */
export const classLabel = (name) => (/^class\b/i.test(String(name).trim()) ? String(name).trim() : `Class ${name}`);

/** The exams worth a bar: those the student or anyone in the section has a mark for. */
export function examRows(exams = []) {
  return exams
    .filter((e) => e.percent != null || e.sectionAverage != null)
    .map((e) => ({
      tag: e.percent == null ? `${e.name} (${e.text || 'no mark'})` : `${e.name}${e.marks ? ` · ${e.marks}` : ''}`,
      percentage: e.percent ?? 0,
      classAveragePercentage: e.sectionAverage,
    }));
}

/** Frosted where the build has expo-blur; a dimmed wash where it has not. Outside the sheet, so it
 *  is the same component from one render to the next and the sheet under it is never remounted. */
function Backdrop({ children }) {
  if (BlurView) return <BlurView intensity={40} tint="dark" style={styles.backdrop}>{children}</BlurView>;
  return <View style={[styles.backdrop, styles.backdropPlain]}>{children}</View>;
}

function Card({ title, note, children }) {
  return (
    <View style={styles.card} accessibilityLabel={title}>
      <Text style={styles.cardTitle} accessibilityRole="header">{title}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {children}
    </View>
  );
}

function SubjectBars({ items, color }) {
  return items.map((s) => (
    <View key={s.name} style={styles.subjectRow}>
      <View style={styles.subjectHead}>
        <Text style={styles.subjectName} numberOfLines={1}>{s.name}</Text>
        <Text style={styles.subjectValue}>{s.percent}%</Text>
      </View>
      <ProgressBar value={s.percent} color={color} height={8} />
    </View>
  ));
}

/**
 * @param sectionId the section the row belongs to
 * @param student   the row: `{ studentId, name, rollNumber }`; null when closed
 * @param onClose
 */
export default function StudentInsightsSheet({ sectionId, student, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!student) return undefined;
    const controller = new AbortController();
    setData(null);
    setError('');
    fetchStudentInsights(sectionId, student.studentId, controller.signal)
      .then((res) => setData(res))
      .catch((err) => {
        if (err?.name === 'AbortError' || err?.name === 'CanceledError') return;
        setError(err?.message || 'The insights could not be loaded.');
      });
    return () => controller.abort();
  }, [sectionId, student]);

  if (!student) return null;

  const rows = examRows(data?.exams);
  const levels = LEVELS.map((l) => ({ ...l, label: l.key, value: Number(data?.understanding?.levels?.[l.key] || 0) }));
  const rated = levels.reduce((sum, l) => sum + l.value, 0);
  const className = data?.student?.className;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Backdrop>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close insights" />
        <View style={styles.glass} accessibilityViewIsModal>
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.name} numberOfLines={2}>{student.name}</Text>
              <Text style={styles.sub}>
                {student.rollNumber ? `Roll ${student.rollNumber}` : 'No roll number'}
                {className ? ` · ${classLabel(className)}${data.student.sectionName ? `-${data.student.sectionName}` : ''}` : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel="Close insights">
              <Ionicons name="close" size={22} color={SLATE[700]} />
            </Pressable>
          </View>

          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          {!data && !error ? (
            <View style={styles.loading}>
              <ActivityIndicator />
              <Text style={styles.note}>Gathering {student.name}’s insights…</Text>
            </View>
          ) : null}

          {data ? (
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <Card title="Across the platform" note="Where they have got to in each area, as in the Student Status table.">
                <View style={styles.areas}>
                  {(data.areas || []).map((a) => (
                    <View key={a.key} style={[styles.area, { borderLeftColor: AREA_EDGE[a.state] || SLATE[300] }]}
                      accessibilityLabel={`${a.label}: ${a.text}${a.sub ? `, ${a.sub}` : ''}, ${STATES[a.state] || ''}`}>
                      <Text style={styles.areaLabel}>{a.label}</Text>
                      <Text style={styles.areaText}>{a.text}</Text>
                      {a.sub ? <Text style={styles.areaSub}>{a.sub}</Text> : null}
                    </View>
                  ))}
                </View>
              </Card>

              <Card title="School exams" note="Their percentage beside the section's average for each exam this year.">
                <GroupedBars rows={rows} studentLabel={student.name} averageLabel="Section average"
                  emptyMessage="No exam marks yet this year." />
              </Card>

              <Card title="Syllabus covered"
                note={data.syllabus?.subjects?.length ? `${data.syllabus.overall}% of the syllabus overall.` : null}>
                {data.syllabus?.subjects?.length
                  ? <SubjectBars items={data.syllabus.subjects} color="#4f46e5" />
                  : <Text style={styles.empty}>No syllabus coverage recorded yet.</Text>}
              </Card>

              <Card title="Their reflections"
                note={data.progress?.coveredTopics
                  ? `${data.progress.reflectedTopics} of ${data.progress.coveredTopics} topics taught reflected on (${data.progress.overall}%).`
                  : null}>
                {data.progress?.subjects?.length
                  ? <SubjectBars items={data.progress.subjects} color="#0ea5e9" />
                  : <Text style={styles.empty}>No topics have been marked as taught yet.</Text>}
              </Card>

              <Card title="How they rate their understanding" note={rated ? `${rated} topic${rated === 1 ? '' : 's'} rated.` : null}>
                {rated === 0 ? (
                  <Text style={styles.empty}>No reflections yet.</Text>
                ) : (
                  <View style={styles.donutRow}>
                    <SegmentedDonut segments={levels} size={132} thickness={18} centreValue={String(rated)} centreCaption="topics" />
                    <View style={styles.legend}>
                      {levels.map((l) => (
                        <View key={l.key} style={styles.legendItem}>
                          <View style={[styles.swatch, { backgroundColor: l.color }]} />
                          <Text style={styles.legendText}>{l.key} · {l.value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </Card>
            </ScrollView>
          ) : null}
        </View>
      </Backdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: SPACING.md },
  backdropPlain: { backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  glass: {
    maxHeight: '92%',
    borderRadius: 20,
    padding: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.sm },
  headText: { flex: 1 },
  name: { fontSize: TYPE.title, lineHeight: leading(TYPE.title), fontWeight: '700', color: SLATE[900] },
  sub: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.8)' },
  body: { gap: SPACING.sm, paddingBottom: SPACING.sm },
  card: { backgroundColor: 'rgba(255, 255, 255, 0.78)', borderRadius: 14, padding: SPACING.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)' },
  cardTitle: { fontSize: TYPE.heading, lineHeight: leading(TYPE.heading), fontWeight: '700', color: SLATE[900] },
  note: { fontSize: TYPE.caption, lineHeight: leading(TYPE.caption), color: SLATE[600], marginTop: 2, marginBottom: SPACING.sm },
  empty: { fontSize: TYPE.label, color: SLATE[500], paddingVertical: SPACING.sm },
  error: { fontSize: TYPE.label, color: FEEDBACK.errorText, backgroundColor: FEEDBACK.errorBg, borderRadius: 10, padding: SPACING.sm },
  loading: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg },
  areas: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  area: { width: '47%', flexGrow: 1, borderRadius: 10, padding: SPACING.sm, borderLeftWidth: 4, backgroundColor: 'rgba(248,250,252,0.95)' },
  areaLabel: { fontSize: TYPE.caption, color: SLATE[600] },
  areaText: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[900] },
  areaSub: { fontSize: TYPE.caption, color: SLATE[500] },
  subjectRow: { marginBottom: SPACING.sm },
  subjectHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  subjectName: { flex: 1, fontSize: TYPE.label, color: SLATE[700] },
  subjectValue: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[800] },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  legend: { gap: 6, flex: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: TYPE.label, color: SLATE[700] },
});
