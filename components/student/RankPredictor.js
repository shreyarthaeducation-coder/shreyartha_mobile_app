import { StyleSheet, Text, View } from 'react-native';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { NO_RANK_REMARK } from '../../constants/analytics';

/**
 * The Rank Predictor card — the mobile twin of
 * `frontendmain/src/student/platform/AcademicIQ/RankPredictorCard.js`.
 *
 * ── EVERY FIGURE COMES FROM THE SERVER ──────────────────────────────────────
 * The band floors, the rank labels and the remark are computed by `MockRankPredictor` and handed
 * over whole; this renders them and computes nothing. That is not a style preference — those
 * strings were copy-pasted into four files on the web and drifted, which is why `checkbatch2.mjs`
 * asserts no client recomputes them. A `?? 'Beyond 1,00,000'` here would invent a rank for a
 * student who has attempted nothing.
 *
 * ── WHY THIS IS A COMPONENT AND NOT A BLOCK INSIDE AnalyticsBody ────────────
 * The website renders this card in three places — My Analytics, the Mock Test page and the
 * post-submit result screen — while mobile rendered it in one, inline. Adding the second call site
 * (the Competitive Exam screen's Mock Test section) is what turned the inline block into a shared
 * component; copying it would have been the fifth transcription of the same box.
 *
 * The third web surface, the result screen, has no mobile equivalent yet: there is no mock-test
 * RUNNER in the app, so nothing submits an attempt. When one is built it passes `testPercent` and
 * `testPredictedRank`; those props are deliberately absent here rather than sitting unused.
 *
 * ── PLAIN StyleSheet, NOT makeStyles ────────────────────────────────────────
 * The indigo is fixed rather than palette-derived, exactly as the inline block was. This card is
 * shared by the student panel (purple) and the parent portal (orange) through `AnalyticsBody`, and
 * it read the same in both before this extraction; taking a palette here would change that.
 */
export default function RankPredictor({
  title,
  predictedRank,
  rankRemark,
  mockAveragePercent,
  mockTestsAttempted,
  emptyMessage = NO_RANK_REMARK,
}) {
  const attempted = Number(mockTestsAttempted) || 0;

  return (
    <View style={styles.box}>
      {title ? <Text style={styles.title}>{title}</Text> : null}

      {predictedRank ? (
        <>
          <Text style={styles.value}>Probable Rank: {predictedRank}</Text>
          <Text style={styles.meta}>
            Mock test average: {mockAveragePercent}% across {attempted} mock test
            {attempted === 1 ? '' : 's'}
          </Text>
          {rankRemark ? <Text style={styles.remark}>{rankRemark}</Text> : null}
          <Text style={styles.note}>
            Indicative — based on your mock test average, not an official rank.
          </Text>
        </>
      ) : (
        <Text style={styles.meta}>{emptyMessage}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 10,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  title: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    color: '#3730a3',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: TYPE.body,
    fontWeight: '800',
    color: '#312e81',
    lineHeight: leading(TYPE.body),
  },
  meta: {
    fontSize: TYPE.label,
    color: SLATE[600],
    lineHeight: leading(TYPE.label),
    marginTop: 4,
  },
  remark: {
    fontSize: TYPE.label,
    fontWeight: '600',
    color: '#1e1b4b',
    lineHeight: leading(TYPE.label),
    marginTop: 6,
  },
  note: {
    fontSize: TYPE.caption,
    color: SLATE[600],
    lineHeight: leading(TYPE.caption),
    marginTop: 4,
  },
});
