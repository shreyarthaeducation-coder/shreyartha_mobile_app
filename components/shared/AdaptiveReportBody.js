import { useState } from 'react';
import { Text, View } from 'react-native';
import { FEEDBACK, SLATE, SPACING } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { GroupedBars, ProgressBar, RadarChart, SegmentedTabs } from '../ui';
import {
  PERFORMANCE_METRICS,
  REMARK_TIER,
  formatDuration,
  levelLabel,
} from '../../services/teacher/adaptiveService';

/**
 * One adaptive attempt's full analysis — shared by the STUDENT and the TEACHER.
 *
 * ── WHY THIS IS SHARED ───────────────────────────────────────────────────────
 * The website shares one component here too (`AdaptiveReportCharts`, rendered by both the
 * student's own report and the teacher's detailed analysis), and both read the SAME DTO:
 * `UniversalAdaptiveAnalysisResponse`. Two copies of a renderer over one DTO is how this codebase
 * ended up with three near-identical Bloom's remark tables that can no longer be merged.
 *
 * It was extracted from `components/staff/adaptive/AdaptiveReport.js`, which now supplies the
 * modal, the fetch and the share button and delegates the body here unchanged.
 *
 * ── PALETTE ──────────────────────────────────────────────────────────────────
 * Colours come from `usePalette()`, which defaults to `PORTALS.school` — so the staff screens,
 * which sit outside a PaletteProvider, render exactly as before. The student panel wraps its Stack
 * in a provider (`app/student/_layout.js`), so the same markup comes out in the student blue.
 * Only `primary`, `primaryDark` and `tint` are used; those are the three tokens BOTH palettes
 * define (`PORTALS.school` has no `deep`/`onDark`/`card`, so nothing here may reach for them).
 *
 * The radar is deliberately the *secondary* reading. The web pairs it with a grid of labelled
 * values and mini bars because a radar cannot be read to a number, and on a phone that matters
 * more — so the tiles come first and the shape follows. There are no tooltips, for the same
 * reason: everything the web hid behind hover is stated outright.
 */

const BREAKDOWN_TABS = [
  { value: 'blooms', label: "Bloom's" },
  { value: 'skills', label: 'Skills' },
];

const pct = (v) => Math.round(Number(v) || 0);

function Tile({ label, value, note, highlight }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <View style={[styles.tile, highlight && styles.tileHighlight]}>
      <Text style={[styles.tileValue, highlight && { color: palette.primaryDark }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {note ? <Text style={styles.tileNote}>{note}</Text> : null}
    </View>
  );
}

/**
 * Class rank, global rank and remark are guarded **independently**: class rank and the remark need
 * a resolved school section, whereas the global rank only needs peers on the same topic anywhere
 * on the platform. A student with no school scope legitimately gets a global tile and nothing else.
 */
function Standing({ report }) {
  const styles = useStyles();
  const hasClass = report.rank != null && report.totalParticipants != null;
  const hasGlobal = report.globalRank != null && report.globalParticipants != null;
  if (!hasClass && !hasGlobal) return null;

  const tierColor = REMARK_TIER[report.remark] || SLATE[500];

  return (
    <>
      <Text style={styles.heading}>Your standing</Text>
      <View style={styles.tiles}>
        {hasClass ? (
          <Tile label="Class rank" value={`${report.rank}/${report.totalParticipants}`} />
        ) : null}
        {hasGlobal ? (
          <Tile label="Global rank" value={`${report.globalRank}/${report.globalParticipants}`} />
        ) : null}
      </View>
      {hasClass && report.remark ? (
        <View style={[styles.remark, { borderLeftColor: tierColor }]}>
          <Text style={[styles.remarkLabel, { color: tierColor }]}>{report.remark}</Text>
          <Text style={styles.remarkNote}>
            {pct(report.accuracy)}% vs. class average{' '}
            {report.classAverageAccuracy != null ? `${pct(report.classAverageAccuracy)}%` : '—'}
          </Text>
        </View>
      ) : null}
    </>
  );
}

function Timing({ timing, questionScores }) {
  const styles = useStyles();
  if (!timing) return null;

  const idle = Math.max(0, (timing.totalSeconds ?? 0) - (timing.activeSeconds ?? 0));
  const rows = (questionScores || []).filter((q) => q.timeTakenSeconds != null);
  const slowest = Math.max(1, ...rows.map((q) => q.timeTakenSeconds || 0));

  return (
    <>
      <Text style={styles.heading}>Time taken</Text>
      <View style={styles.tiles}>
        <Tile label="On questions" value={formatDuration(timing.activeSeconds)} />
        <Tile
          label="Total elapsed"
          value={formatDuration(timing.totalSeconds)}
          // Only worth showing when it's a real gap; below a minute it's just rounding.
          note={idle >= 60 ? `${formatDuration(idle)} idle` : undefined}
        />
        <Tile
          label="Avg / question"
          value={timing.averageSecondsPerQuestion != null ? `${timing.averageSecondsPerQuestion}s` : '—'}
          note={timing.pace || undefined}
        />
        <Tile
          label="Fastest"
          value={timing.fastestSeconds != null ? `${timing.fastestSeconds}s` : '—'}
        />
        <Tile
          label="Slowest"
          value={timing.slowestSeconds != null ? `${timing.slowestSeconds}s` : '—'}
          note={timing.slowestQuestionNo ? `on Q${timing.slowestQuestionNo}` : undefined}
        />
      </View>

      {rows.length > 0 ? (
        <View style={styles.timeBars}>
          {rows.map((q) => (
            <View key={q.sequenceNo} style={styles.timeRow}>
              <Text style={styles.timeLabel}>Q{q.sequenceNo}</Text>
              <View style={styles.timeTrack}>
                <View
                  style={[
                    styles.timeFill,
                    {
                      width: `${Math.max(2, ((q.timeTakenSeconds || 0) / slowest) * 100)}%`,
                      backgroundColor: q.isCorrect ? FEEDBACK.successText : FEEDBACK.errorText,
                    },
                  ]}
                />
              </View>
              <Text style={styles.timeValue}>{q.timeTakenSeconds}s</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>No per-question timings were recorded for this attempt.</Text>
      )}
    </>
  );
}

/**
 * @param {object}  report        a `UniversalAdaptiveAnalysisResponse`
 * @param {boolean} [showQuestions=true] the question-by-question review. The teacher always wants
 *                  it; a student re-reading their own attempt does too, so it defaults on — but it
 *                  is the longest section, so callers can drop it.
 */
export default function AdaptiveReportBody({ report, showQuestions = true }) {
  const styles = useStyles();
  const [breakdown, setBreakdown] = useState('blooms');

  if (!report) return null;

  const metrics = PERFORMANCE_METRICS.map((m) => ({
    ...m,
    value: pct(report?.performance?.[m.key]),
  }));

  return (
    <>
      <View style={styles.tiles}>
        <Tile label="Answered" value={`${report.totalAnswered}/${report.poolSize}`} />
        <Tile label="Correct" value={report.correctCount ?? 0} />
        <Tile label="Wrong" value={report.wrongCount ?? 0} />
        <Tile label="Accuracy" value={`${pct(report.accuracy)}%`} highlight />
        <Tile label="Final level" value={levelLabel(report.finalLevel)} />
        <Tile
          label="Time"
          value={formatDuration(report.timing?.activeSeconds ?? report.durationSeconds)}
        />
      </View>

      {report.stoppedEarly ? (
        <Text style={styles.note}>
          Stopped after {report.totalAnswered} of {report.poolSize} questions, so coverage is
          partial.
        </Text>
      ) : null}

      <Standing report={report} />

      <Text style={styles.heading}>Performance profile</Text>
      {/* Numbers first: the radar shows the shape, these state the values. */}
      {metrics.map((m) => (
        <View key={m.key} style={styles.metric}>
          <ProgressBar value={m.value} label={m.label} showValue />
          <Text style={styles.metricHint}>{m.hint}</Text>
        </View>
      ))}
      <RadarChart metrics={metrics} style={styles.radar} />

      <Timing timing={report.timing} questionScores={report.questionScores} />

      <Text style={styles.heading}>Breakdown</Text>
      <SegmentedTabs options={BREAKDOWN_TABS} value={breakdown} onChange={setBreakdown} />
      <View style={styles.breakdown}>
        <GroupedBars
          rows={breakdown === 'blooms' ? report.bloomsBreakdown || [] : report.skillBreakdown || []}
          emptyMessage={
            breakdown === 'blooms'
              ? "No Bloom's data for this attempt."
              : 'None of the questions in this attempt carry a skill tag.'
          }
        />
      </View>

      {showQuestions && (report.questionScores || []).length > 0 ? (
        <>
          <Text style={styles.heading}>Question-wise result</Text>
          {report.questionScores.map((q) => (
            <View key={q.sequenceNo} style={styles.qCard}>
              <View style={styles.qHead}>
                <Text style={styles.qIndex}>Q{q.sequenceNo}</Text>
                <Text
                  style={[
                    styles.qResult,
                    { color: q.isCorrect ? FEEDBACK.successText : FEEDBACK.errorText },
                  ]}
                >
                  {q.isCorrect ? 'Correct' : 'Wrong'}
                  {q.timeTakenSeconds != null ? ` · ${q.timeTakenSeconds}s` : ''}
                </Text>
              </View>
              <Text style={styles.qText}>{q.questionText}</Text>
              <View style={styles.qMeta}>
                {[levelLabel(q.testLevel), q.bloomsLevel, q.skillSet].filter(Boolean).map((meta) => (
                  <View key={meta} style={styles.qChip}>
                    <Text style={styles.qChipText} numberOfLines={1}>
                      {meta}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </>
      ) : null}
    </>
  );
}

const useStyles = makeStyles((p) => ({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tile: {
    flexGrow: 1,
    minWidth: '30%',
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  tileHighlight: { backgroundColor: p.tint, borderColor: p.primary },
  tileValue: { fontSize: 17, fontWeight: '800', color: SLATE[800] },
  tileLabel: { fontSize: 10.5, color: SLATE[500], fontWeight: '600', marginTop: 2, textAlign: 'center' },
  tileNote: { fontSize: 10, color: SLATE[400], marginTop: 1, textAlign: 'center' },

  note: {
    marginTop: SPACING.sm,
    fontSize: 12.5,
    color: '#b45309',
    backgroundColor: '#fffbeb',
    padding: SPACING.sm,
    borderRadius: 10,
  },

  heading: {
    fontSize: 12,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },

  remark: {
    borderLeftWidth: 4,
    backgroundColor: SLATE[50],
    borderRadius: 10,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  remarkLabel: { fontSize: 14, fontWeight: '800' },
  remarkNote: { fontSize: 12, color: SLATE[600], marginTop: 2 },

  metric: { marginBottom: SPACING.sm },
  metricHint: { fontSize: 11, color: SLATE[400], marginTop: 3 },
  radar: { marginTop: SPACING.sm },

  timeBars: { marginTop: SPACING.sm },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  timeLabel: { width: 34, fontSize: 11, fontWeight: '700', color: SLATE[500] },
  timeTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: SLATE[200], overflow: 'hidden' },
  timeFill: { height: 10, borderRadius: 5 },
  timeValue: { width: 38, textAlign: 'right', fontSize: 11, fontWeight: '700', color: SLATE[600] },

  breakdown: { marginTop: SPACING.md },
  empty: { fontSize: 12.5, color: SLATE[400], fontStyle: 'italic', marginTop: SPACING.sm },

  qCard: {
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 12,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  qHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  qIndex: { flex: 1, fontSize: 12, fontWeight: '800', color: p.primaryDark },
  qResult: { fontSize: 12, fontWeight: '700' },
  qText: { fontSize: 13, color: SLATE[700], lineHeight: 18 },
  qMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  qChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: SLATE[100] },
  qChipText: { fontSize: 10.5, fontWeight: '600', color: SLATE[500] },
}));
