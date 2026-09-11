import { Text, View } from 'react-native';
import { FEEDBACK, QUIZ, SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * The psychometric summary shown inside My Analytics.
 *
 * Ported from `frontendmain/src/student/platform/MyAnalytics/PsychometricSummaryReport.js`, which
 * Phase 1 deferred to this phase. It is NOT one of the six assessment reports: it cross-cuts
 * **twelve categories drawn from three different report slices** and sorts them into strengths and
 * development areas, giving one view over everything the student has taken rather than one
 * assessment's detail.
 *
 * Prop-driven. `analyticsService` already fetches `/api/psychometrics/results`; `unwrapResults`
 * below carries that endpoint's two shapes.
 */

/** The four primary-stream remarks, verbatim. */
const STREAM_REMARKS = {
  science: {
    title: 'Science – Primary Fit',
    shortRemark:
      'Strong aptitude for logical reasoning and analytical thinking. Science is your ideal stream.',
  },
  commerce: {
    title: 'Commerce – Primary Fit',
    shortRemark: 'Natural affinity for numbers, systems, and business-oriented thinking.',
  },
  humanities: {
    title: 'Humanities – Primary Fit',
    shortRemark:
      'Strong inclination toward reading, expression, and understanding people and society.',
  },
  skillBased: {
    title: 'Skill-Based / Applied Learning – Primary Fit',
    shortRemark:
      'Excel at practical, hands-on learning and applying concepts in real-world contexts.',
  },
};

/**
 * The twelve categories the summary reads, in the web's order, each naming the slice it comes
 * from. Note they span three different reports — this is the only place that mixes them.
 */
const SUMMARY_CATEGORIES = [
  ['personalityBlueprint', 'selfAwareness', 'Self-Awareness'],
  ['personalityBlueprint', 'growthMindset', 'Growth Mindset'],
  ['personalityBlueprint', 'adaptabilityResilience', 'Adaptability & Resilience'],
  ['personalityBlueprint', 'motivationDiscipline', 'Motivation & Discipline'],
  ['personalityBlueprint', 'decisionMaking', 'Decision-Making'],
  ['personalityBlueprint', 'futureReadiness', 'Future Readiness'],
  ['learningProductivityMatrix', 'criticalThinking', 'Critical Thinking'],
  ['learningProductivityMatrix', 'creativity', 'Creativity'],
  ['learningProductivityMatrix', 'learningStrategyAwareness', 'Learning Strategy'],
  ['skillProficiency', 'communication', 'Communication'],
  ['skillProficiency', 'collaboration', 'Collaboration'],
  ['skillProficiency', 'digitalSkills', 'Digital Skills'],
];

/**
 * `/api/psychometrics/results` answers in two shapes — `{ results: {...} }` or the result object
 * itself. The web tests `overallReadiness !== undefined` to tell them apart; same here.
 */
export function unwrapResults(payload) {
  if (!payload) return null;
  if (payload.results) return payload.results;
  if (payload.overallReadiness !== undefined) return payload;
  return null;
}

// No `hasResults` here on purpose — `hasPsychometricResults` in services/student/analyticsService.js
// already answers that question and AnalyticsScreen already calls it. Two predicates for one
// question is how they drift apart.

export default function PsychometricSummary({ results }) {
  const styles = useStyles();
  const data = unwrapResults(results);
  if (!data) return null;

  const stream = STREAM_REMARKS[data.primaryStream] || STREAM_REMARKS.science;

  const strengths = [];
  const developments = [];
  SUMMARY_CATEGORIES.forEach(([slice, key, name]) => {
    const score = data[slice]?.[key] || 0;
    (score >= 50 ? strengths : developments).push(name);
  });

  return (
    <>
      <View style={styles.headline}>
        <Text style={styles.readiness}>{Math.round(data.overallReadiness || 0)}%</Text>
        <View style={styles.headlineText}>
          <Text style={styles.streamTitle}>{stream.title}</Text>
          <Text style={styles.streamRemark}>{stream.shortRemark}</Text>
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>Strengths</Text>
        {strengths.length === 0 ? (
          <Text style={styles.none}>No category has reached 50% yet.</Text>
        ) : (
          <View style={styles.chips}>
            {strengths.map((name) => (
              <Text key={name} style={[styles.chip, styles.chipStrength]}>
                {name}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>Development areas</Text>
        {developments.length === 0 ? (
          <Text style={styles.none}>Every category is at or above 50%.</Text>
        ) : (
          <View style={styles.chips}>
            {developments.map((name) => (
              <Text key={name} style={[styles.chip, styles.chipFocus]}>
                {name}
              </Text>
            ))}
          </View>
        )}
      </View>

      {data.assessmentDate ? (
        <Text style={styles.date}>Last assessed {data.assessmentDate}</Text>
      ) : null}
    </>
  );
}

const useStyles = makeStyles((p) => ({
  headline: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  readiness: { fontSize: TYPE.figure, fontWeight: '800', color: p.primaryDark },
  headlineText: { flex: 1 },
  streamTitle: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  streamRemark: { fontSize: TYPE.label, color: SLATE[500], lineHeight: leading(TYPE.label), marginTop: 2 },

  group: { marginBottom: SPACING.sm },
  groupLabel: {
    fontSize: TYPE.micro,
    fontWeight: '800',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: {
    fontSize: TYPE.caption,
    fontWeight: '600',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  chipStrength: { backgroundColor: QUIZ.correctBg, color: FEEDBACK.successOnBg },
  chipFocus: { backgroundColor: FEEDBACK.warningBg, color: FEEDBACK.warningOnBg },
  none: { fontSize: TYPE.label, color: SLATE[500] },
  date: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 4 },
}));
