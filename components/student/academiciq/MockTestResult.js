import { useState } from 'react';
import { Text, View } from 'react-native';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import GroupedBars from '../../ui/charts/GroupedBars';
import SegmentedTabs from '../../ui/SegmentedTabs';
import RankPredictor from '../RankPredictor';
import { StudentCard, StudentCardTitle, StudentNote } from '../StudentCard';

/**
 * What a student sees after submitting a mock test.
 *
 * ── IT USED TO BE THREE NUMBERS ─────────────────────────────────────────────
 * Marks, percentage, and a predicted rank. That says how well the paper went and nothing about
 * WHY, so there was no way to tell a student which kind of thinking, or which skill, cost them the
 * marks. Every mock question already carries a Bloom's level and a skill set; the student endpoint
 * simply never sent them.
 *
 * ── PERCENTAGES, NOT REMARKS ────────────────────────────────────────────────
 * This deliberately touches none of the three Bloom's REMARK tables
 * (`services/student/understandingScoring.js`, `constants/practiceZone.js`,
 * `constants/codingProBlooms.js`). Those belong to the understanding tests, they differ from each
 * other on purpose, and merging them into a mock report is exactly the "obviously right" change
 * their own headers warn against. A mock report shows how much, not what it means.
 *
 * `GroupedBars` and `SegmentedTabs` are the existing kit, so this adds no charting dependency — the
 * app ships through EAS with no over-the-air channel, and a native module would force a store
 * build.
 */
export default function MockTestResult({ result, paperName }) {
  const styles = useStyles();
  const [view, setView] = useState('blooms');

  if (!result) return null;

  const { bloomsBreakdown = [], skillBreakdown = [] } = result.breakdown || {};
  // Levels the paper never tested would otherwise show as six bars at zero, which reads as six
  // failures rather than as four absences.
  const bloomsRows = bloomsBreakdown.filter((row) => row.total > 0);
  const rows = view === 'blooms' ? bloomsRows : skillBreakdown;

  return (
    <>
      <StudentCard>
        <StudentCardTitle>Mock Test Results{paperName ? ` — ${paperName}` : ''}</StudentCardTitle>
        <View style={styles.summary}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{Math.round(result.scorePercent ?? 0)}%</Text>
            <Text style={styles.statLabel}>Score</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {result.scoredMarks ?? 0}/{result.totalMarks ?? 0}
            </Text>
            <Text style={styles.statLabel}>Marks</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{result.status === 'GREEN' ? 'Passed' : 'Keep going'}</Text>
            <Text style={styles.statLabel}>Result</Text>
          </View>
        </View>
      </StudentCard>

      <StudentCard>
        <StudentCardTitle>
          {view === 'blooms' ? "Bloom's Taxonomy Breakdown" : 'Skill Set Breakdown'}
        </StudentCardTitle>
        <SegmentedTabs
          options={[
            { key: 'blooms', label: "Bloom's" },
            { key: 'skills', label: 'Skills' },
          ]}
          value={view}
          onChange={setView}
          style={styles.tabs}
        />
        {rows.length === 0 ? (
          <StudentNote>
            {view === 'blooms'
              ? "This paper's questions have no Bloom's levels recorded, so there is nothing to break down yet."
              : 'This paper’s questions have no skills recorded yet.'}
          </StudentNote>
        ) : (
          <GroupedBars rows={rows} studentLabel="You" />
        )}
      </StudentCard>

      {result.rankPrediction || result.testPredictedRank ? (
        <RankPredictor
          title="Rank Predictor"
          predictedRank={result.testPredictedRank ?? result.rankPrediction?.predictedRank}
          rankRemark={result.rankPrediction?.rankRemark}
          mockAveragePercent={result.rankPrediction?.mockAveragePercent}
          mockTestsAttempted={result.rankPrediction?.mockTestsAttempted}
        />
      ) : null}
    </>
  );
}

const useStyles = makeStyles((p) => ({
  summary: { flexDirection: 'row', gap: SPACING.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    backgroundColor: p.tint,
  },
  statValue: { fontSize: TYPE.title, fontWeight: '800', color: p.primaryDark },
  statLabel: { fontSize: TYPE.micro, fontWeight: '600', color: SLATE[500], marginTop: 2 },
  tabs: { marginBottom: SPACING.sm },
}));
