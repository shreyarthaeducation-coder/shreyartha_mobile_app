import { Text, View } from 'react-native';
import { BAND, FEEDBACK, QUIZ, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import { GroupedBars, RadarChart } from '../../ui/charts';
import { StudentCard, StudentCardTitle, StudentNote } from '../StudentCard';
import { REPORT_CONFIG, STREAM_CONFIG, fitLevel, reportFor } from '../../../constants/psychometricReports';

/**
 * The psychometric report — one renderer for all six assessment types.
 *
 * The web has six components totalling ~2,700 lines that share a single skeleton and differ only
 * in their categories, their chart and their text. That difference is data, so it lives in
 * `constants/psychometricReports.js` and this renders it — the same collapse ProfileFormTab made
 * for the profile forms.
 *
 * TWO SHAPES, not one. Five reports score named categories against a **single 50% threshold**
 * (below → `low` text, at-or-above → `high`). Stream Aptitude does something different: it RANKS
 * four streams and names the top one as the student's fit. Forcing it into the category shape
 * would misrepresent the result — a 45% top stream is still that student's primary fit, whereas a
 * 45% category is a development area.
 *
 * No PDF button: the web's download merges a webpack-bundled framework PDF and calls
 * window.print(), neither of which exists here.
 */

/** Green at or above the 50% threshold, amber below — the report's only band boundary. */
const bandColor = (percentage) => (percentage >= 50 ? BAND.good : BAND.fair);

export default function PsychometricReport({ results, topicType, topicName, studentInfo }) {
  const styles = useStyles();

  if (!results) return null;

  const isStream = topicType === 'streamAptitude';
  const config = reportFor(topicType);

  return (
    <>
      <StudentCard>
        <StudentCardTitle>{isStream ? STREAM_CONFIG.title : config.title}</StudentCardTitle>
        {topicName ? <Text style={styles.topic}>{topicName}</Text> : null}
        {studentInfo?.name ? (
          <Text style={styles.who}>
            {studentInfo.name}
            {studentInfo.class && studentInfo.class !== 'N/A' ? ` · Class ${studentInfo.class}` : ''}
          </Text>
        ) : null}

        <View style={styles.headline}>
          <Text style={styles.headlineValue}>{results.overallReadiness}%</Text>
          <Text style={styles.headlineLabel}>Overall readiness</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.metaItem}>
            {results.answeredQuestions}/{results.totalQuestions} answered
          </Text>
          <Text style={styles.metaItem}>
            {results.totalScore}/{results.totalMaxScore} marks
          </Text>
          <Text style={styles.metaItem}>{results.assessmentDate}</Text>
        </View>
      </StudentCard>

      {isStream ? (
        <StreamBody results={results} styles={styles} />
      ) : (
        <CategoryBody results={results} config={config} styles={styles} />
      )}
    </>
  );
}

/* ── Five reports: categories against the 50% threshold ────────────────── */

function CategoryBody({ results, config, styles }) {
  const slice = results[config.resultKey] || {};
  const rows = config.categories.map((c) => ({
    ...c,
    value: Number(slice[c.key] ?? results.categoryScores?.[c.key]?.percentage ?? 0),
  }));

  return (
    <>
      {/*
        BOTH chart kinds must have a branch. `chart` takes two values across the five configs —
        'radar' for two of them, 'bars' for the other three — and for a long time only the radar was
        handled, so the 3C Blueprint, the Learning Productivity Matrix and Interest Mapping rendered
        no summary chart at all. Nothing failed; the branch simply produced nothing, which is why it
        survived a build, a checker and an export. If a third `chart` value is ever added, add its
        branch here at the same time.

        A radar needs at least three axes to be a shape rather than a line, so it falls back to bars
        below three categories.
      */}
      {config.chart === 'radar' && rows.length >= 3 ? (
        <StudentCard>
          <StudentCardTitle>At a glance</StudentCardTitle>
          <View style={styles.radarWrap}>
            <RadarChart metrics={rows.map((r) => ({ label: r.label, value: r.value }))} />
          </View>
        </StudentCard>
      ) : rows.length ? (
        <StudentCard>
          <StudentCardTitle>At a glance</StudentCardTitle>
          {/*
            Single series — there is no class average for a psychometric assessment, and passing
            `classAveragePercentage` would make GroupedBars draw a legend for a series that does not
            exist. The per-category cards below repeat each bar with its own band colour; this is the
            one place a student can compare all their categories against each other.
          */}
          <GroupedBars
            rows={rows.map((r) => ({ tag: r.label, percentage: r.value }))}
            emptyMessage="No category scores could be calculated."
          />
        </StudentCard>
      ) : null}

      {rows.map((row) => (
        <StudentCard key={row.key}>
          <View style={styles.rowHead}>
            <View style={styles.rowTitleWrap}>
              <Text style={styles.rowTitle}>{row.label}</Text>
              {row.hint ? <Text style={styles.rowHint}>{row.hint}</Text> : null}
            </View>
            <Text style={[styles.rowValue, { color: bandColor(row.value) }]}>
              {row.value}%
            </Text>
          </View>

          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.max(0, Math.min(100, row.value))}%`, backgroundColor: bandColor(row.value) },
              ]}
            />
          </View>

          <View style={[styles.badge, row.value >= 50 ? styles.badgeStrength : styles.badgeFocus]}>
            <Text style={[styles.badgeText, row.value >= 50 ? styles.badgeTextStrength : styles.badgeTextFocus]}>
              {row.value >= 50 ? 'Strength' : 'Development area'}
            </Text>
          </View>

          <Text style={styles.remark}>{row.value < 50 ? row.low : row.high}</Text>

          {/* Tips are authored for the low band only — the web shows them nowhere else. */}
          {row.value < 50 && row.tips?.length ? (
            <View style={styles.tips}>
              <Text style={styles.tipsTitle}>Improvement focus</Text>
              {row.tips.map((tip) => (
                <Text key={tip} style={styles.tip}>
                  • {tip}
                </Text>
              ))}
            </View>
          ) : null}
        </StudentCard>
      ))}
    </>
  );
}

/* ── Stream Aptitude: ranked, not thresholded ──────────────────────────── */

function StreamBody({ results, styles }) {
  const slice = results[STREAM_CONFIG.resultKey] || {};
  const ranked = STREAM_CONFIG.streams
    .map((s) => ({ ...s, value: Number(slice[s.key] ?? 0) }))
    .sort((a, b) => b.value - a.value);

  const primary = ranked[0];
  const anyScore = ranked.some((s) => s.value > 0);

  return (
    <>
      {anyScore ? (
        <StudentCard>
          <StudentCardTitle>Your stream fit</StudentCardTitle>
          <Text style={styles.streamHeadline}>
            {primary.icon} {primary.title}
          </Text>
          <Text style={styles.streamFit}>{fitLevel(1)}</Text>
          <Text style={styles.remark}>{primary.statement}</Text>
        </StudentCard>
      ) : (
        <StudentCard>
          <StudentNote>
            No stream scores could be calculated. This assessment needs questions tagged with a
            stream before it can suggest a fit.
          </StudentNote>
        </StudentCard>
      )}

      <StudentCard>
        <StudentCardTitle>All streams</StudentCardTitle>
        {ranked.map((s, i) => (
          <View key={s.key} style={styles.streamRow}>
            <View style={styles.rowHead}>
              <Text style={styles.streamName}>
                {s.icon} {s.title}
              </Text>
              <Text style={styles.streamValue}>{s.value}%</Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.max(0, Math.min(100, s.value))}%`, backgroundColor: s.color },
                ]}
              />
            </View>
            <Text style={styles.streamFitSmall}>{fitLevel(i + 1)}</Text>
          </View>
        ))}
      </StudentCard>
    </>
  );
}

const useStyles = makeStyles((p) => ({
  topic: { fontSize: TYPE.label, fontWeight: '600', color: p.deep },
  who: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },

  headline: { alignItems: 'center', marginTop: SPACING.md },
  headlineValue: { fontSize: TYPE.figure, fontWeight: '800', color: p.primaryDark },
  headlineLabel: { fontSize: TYPE.caption, fontWeight: '600', color: SLATE[500], marginTop: -2 },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  metaItem: { fontSize: TYPE.caption, color: SLATE[500] },

  radarWrap: { alignItems: 'center' },

  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitleWrap: { flex: 1 },
  rowTitle: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  rowHint: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 1 },
  rowValue: { fontSize: TYPE.title, fontWeight: '800' },

  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: SLATE[200],
    overflow: 'hidden',
    marginTop: 7,
  },
  fill: { height: '100%', borderRadius: 4 },

  badge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeStrength: { backgroundColor: QUIZ.correctBg },
  badgeFocus: { backgroundColor: FEEDBACK.warningBg },
  badgeText: { fontSize: TYPE.micro, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  badgeTextStrength: { color: FEEDBACK.successOnBg },
  badgeTextFocus: { color: FEEDBACK.warningOnBg },

  remark: { fontSize: TYPE.label, color: SLATE[600], lineHeight: 19, marginTop: 8 },

  tips: { marginTop: SPACING.sm, padding: SPACING.sm, borderRadius: 10, backgroundColor: SLATE[100] },
  tipsTitle: {
    fontSize: TYPE.micro,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  tip: { fontSize: TYPE.label, color: SLATE[600], lineHeight: 18 },

  streamHeadline: { fontSize: TYPE.headline, fontWeight: '800', color: SLATE[800], marginTop: 2 },
  streamFit: { fontSize: TYPE.label, fontWeight: '700', color: p.deep, marginTop: 1 },
  streamRow: { marginBottom: SPACING.md },
  streamName: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  streamValue: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[600] },
  streamFitSmall: { fontSize: TYPE.micro, fontWeight: '600', color: SLATE[500], marginTop: 4 },
}));
