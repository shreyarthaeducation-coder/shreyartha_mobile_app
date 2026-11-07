import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { LineChart, ProgressBar, SegmentedDonut } from '../ui';
import WebReport from '../shared/WebReport';
import { fetchStudentInsights } from '../../services/staff/studentStatusService';
import { indexChartData, riskMeta } from '../../services/counsellor/surveyService';
import { STATES } from '../../utils/studentStatus';

/**
 * "View insights" — one student of a Student Status section, as charts, on frosted glass
 * (14 Oct 2026). The website's StudentInsights pop-up, for the app.
 *
 * Shows (7 Nov 2026) each area in the report's order, each opening into its details; their school
 * exams, one chart per exam with its subjects side by side, and each exam's average; syllabus
 * covered and their own reflections subject by subject; and how they rated their understanding.
 * This native drawing is the fallback — the website's own page (WebReport below) is what shows. The server only answers for a section this member of staff may open and a student
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

/**
 * The areas in the report's order (7 Nov 2026): Profile completeness, Wellness Groups,
 * Psychometric, Academic IQ, Competitive Exam, Skills Edge, Language Pro, Coding Pro, Subject &
 * Career, School exams — the server's `sections`. A server from before then sends only `areas`, in
 * the table's order and without details.
 */
export function sectionsOf(data) {
  if (Array.isArray(data?.sections)) return data.sections;
  return (data?.areas || []).map((a) => ({ ...a, details: null }));
}

/** The exams worth a chart: one per exam, with its subjects (7 Nov 2026). */
export function examGroupsOf(data) {
  return (data?.examGroups || []).filter((g) => (g.subjects || []).length > 0);
}

/** "38 / 50", "Absent", or "Not entered" — what one subject's bar says. */
export function paperText(s) {
  if (s.absent) return 'Absent';
  if (s.marks == null) return 'Not entered';
  return `${s.marks} / ${s.maxMarks}`;
}

const hasDetails = (d) =>
  !!d && ((d.items || []).length > 0 || (d.facts || []).length > 0 || (d.groups || []).length > 0 || !!d.wellness);

function DetailItems({ items }) {
  if (!items?.length) return null;
  return (
    <View style={styles.items}>
      {items.map((it, i) => (
        <View key={`${it.label}-${i}`} style={[styles.item, { borderLeftColor: AREA_EDGE[it.state] || SLATE[300] }]}>
          <Text style={styles.areaLabel}>{it.label}</Text>
          <Text style={styles.itemText}>{it.text}</Text>
          {it.sub ? <Text style={styles.areaSub}>{it.sub}</Text> : null}
          {it.remark ? <Text style={styles.remark}>{it.remark}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function Details({ details }) {
  const wellness = details.wellness;
  const chart = wellness ? indexChartData(wellness.student, wellness.categories || []) : [];
  return (
    <View style={styles.details}>
      {(details.facts || []).map((f) => (
        <View key={f.label} style={styles.fact}>
          <Text style={styles.factLabel}>{f.label}</Text>
          <Text style={styles.factValue}>{f.value}</Text>
        </View>
      ))}
      {chart.length > 0 ? <LineChart data={chart} height={170} pointColor={(p) => riskMeta(p.level).color} /> : null}
      <DetailItems items={details.items} />
      {(details.groups || []).map((g) => (
        <View key={g.title} style={styles.group}>
          <Text style={styles.groupTitle}>{g.title}</Text>
          {(g.items || []).length ? <DetailItems items={g.items} /> : <Text style={styles.empty}>Nothing here yet.</Text>}
        </View>
      ))}
    </View>
  );
}

/** One area — what it says, opening into its details. */
function Section({ section }) {
  const [open, setOpen] = useState(false);
  const can = hasDetails(section.details);
  const label = `${section.label}: ${section.text}${section.sub ? `, ${section.sub}` : ''}, ${STATES[section.state] || ''}`;
  const head = (
    <>
      <View style={styles.sectionHeadText}>
        <Text style={styles.areaLabel}>{section.label}</Text>
        <Text style={styles.areaText}>{section.text}</Text>
        {section.sub ? <Text style={styles.areaSub}>{section.sub}</Text> : null}
      </View>
      {can ? <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={SLATE[500]} /> : null}
    </>
  );
  return (
    <View style={[styles.section, { borderLeftColor: AREA_EDGE[section.state] || SLATE[300] }]}>
      {can ? (
        <Pressable style={styles.sectionHead} onPress={() => setOpen((v) => !v)} accessibilityRole="button"
          accessibilityState={{ expanded: open }} accessibilityLabel={label}>
          {head}
        </Pressable>
      ) : (
        <View style={styles.sectionHead} accessibilityLabel={label}>{head}</View>
      )}
      {can && open ? <Details details={section.details} /> : null}
    </View>
  );
}

const COLUMN_HEIGHT = 120;

/** One exam: its subjects side by side, each column the student's marks out of that paper's. */
function ExamChart({ exam }) {
  const subjects = exam.subjects || [];
  const top = Math.max(1, ...subjects.map((s) => Number(s.maxMarks) || 0));
  return (
    <View style={styles.exam} accessibilityLabel={`${exam.name}: ${subjects.map((s) => `${s.subject} ${paperText(s)}`).join(', ')}`}>
      <Text style={styles.groupTitle}>{exam.name}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columns}>
        {subjects.map((s, i) => {
          const h = s.absent || s.marks == null ? 0 : Math.max(2, Math.round((Number(s.marks) / top) * COLUMN_HEIGHT));
          return (
            <View key={`${s.subject}-${i}`} style={styles.column}>
              <Text style={styles.columnValue}>{paperText(s)}</Text>
              <View style={styles.columnTrack}>
                <View style={[styles.columnFill, { height: h }]} />
              </View>
              <Text style={styles.columnLabel} numberOfLines={2}>{s.subject}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
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

  const exams = examGroupsOf(data);
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
              {/* The website's own insights (6 Nov 2026): its doughnut and bar charts, from the data
                  fetched above. The native cards are what shows without the website. */}
              <WebReport
                kind="student-insights"
                portal="staff"
                payload={{ sectionId, student, data }}
                fallback={
                  <>
              <Card title="Across the platform" note="Where they have got to in each area. Tap one to see its details.">
                <View style={styles.sections}>
                  {sectionsOf(data).map((s) => (
                    <Section key={s.key} section={s} />
                  ))}
                </View>
              </Card>

              <Card title="School exams" note="Each exam this year, subject by subject.">
                {exams.length === 0 ? (
                  <Text style={styles.empty}>No exam marks yet this year.</Text>
                ) : (
                  <>
                    {exams.map((g) => (
                      <ExamChart key={g.code || g.name} exam={g} />
                    ))}
                    {exams.map((g) => (
                      <Text key={`avg-${g.code || g.name}`} style={styles.average}>
                        • <Text style={styles.averageName}>{g.name}</Text>: average {g.average}%
                        {g.marked ? ` across ${g.marked} subject${g.marked === 1 ? '' : 's'}` : ''}
                      </Text>
                    ))}
                  </>
                )}
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
                  </>
                }
              />
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
  sections: { gap: SPACING.sm },
  section: { borderRadius: 10, padding: SPACING.sm, borderLeftWidth: 4, backgroundColor: 'rgba(248,250,252,0.95)' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionHeadText: { flex: 1 },
  details: { marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: SLATE[200], gap: SPACING.sm },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm },
  factLabel: { fontSize: TYPE.caption, color: SLATE[500] },
  factValue: { flexShrink: 1, fontSize: TYPE.label, fontWeight: '600', color: SLATE[800], textAlign: 'right' },
  items: { gap: 6 },
  item: { backgroundColor: '#fff', borderRadius: 8, padding: SPACING.sm, borderLeftWidth: 3 },
  itemText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[900] },
  remark: { fontSize: TYPE.caption, fontStyle: 'italic', color: SLATE[700] },
  group: { gap: 6 },
  groupTitle: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[800] },
  exam: { gap: 6, marginBottom: SPACING.sm, padding: SPACING.sm, borderRadius: 10, backgroundColor: 'rgba(248,250,252,0.95)' },
  columns: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm, paddingTop: 4 },
  column: { width: 64, alignItems: 'center', gap: 4 },
  columnValue: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[700], textAlign: 'center' },
  // The bar stands on the track's floor (absolute, not flex-end: this sheet is centred, and the
  // bottom-inset checker reads flex-end as a sheet pinned to the bottom of the screen).
  columnTrack: { width: 28, height: COLUMN_HEIGHT, backgroundColor: SLATE[100], borderRadius: 4, overflow: 'hidden' },
  columnFill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#4f46e5', borderRadius: 4 },
  columnLabel: { fontSize: TYPE.caption, color: SLATE[600], textAlign: 'center' },
  average: { fontSize: TYPE.label, lineHeight: leading(TYPE.label), color: SLATE[700], marginTop: 2 },
  averageName: { fontWeight: '700', color: SLATE[900] },
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
