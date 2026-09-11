import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { Card, CardTitle, ScreenScaffold } from '../ui';
import { ProgressBar } from '../ui/charts';
import useStaffResource from '../../hooks/useStaffResource';
import { parentApi } from '../../services/parentApi';
import {
  fetchPersonalStatement,
  fetchPsychometric,
  psychometricPercent,
} from '../../services/parent/insightsService';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Assessment Results — the child's personal statement and psychometric completion.
 *
 * Two independent reads, settled separately: a child with no personal statement is normal, and the
 * psychometric call can refuse for a non-school child. `Promise.all` would lose both cards to
 * either failure, which is exactly what the web avoids with two try/catches.
 */

export default function AssessmentResultsScreen() {
  const styles = useStyles();
  const palette = usePalette();

  const fetcher = useCallback(
    (signal) =>
      parentApi.settleAll({
        statement: fetchPersonalStatement(signal),
        psychometric: fetchPsychometric(signal),
      }),
    [],
  );
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher, {
    initialData: null,
  });

  const statement = data?.statement?.data || '';
  const psych = data?.psychometric?.data;
  // The web shows "Data unavailable" as the card title when this call fails; keep that signal.
  const psychFailed = !!data?.psychometric?.error;
  const percent = psychometricPercent(psych);

  return (
    <ScreenScaffold
      title="Assessment Results"
      fallbackRoute="/parent"
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <Card style={styles.card}>
        <CardTitle>My Personal Statement</CardTitle>
        <Text style={statement ? styles.statement : styles.muted}>
          {statement || 'No personal statement added yet.'}
        </Text>
      </Card>

      <Card style={styles.card}>
        <CardTitle>{psychFailed ? 'Data unavailable' : psych?.chapterName}</CardTitle>

        {psychFailed ? (
          <Text style={styles.muted}>
            Could not load the psychometric assessment right now.
          </Text>
        ) : (
          <>
            <Text style={styles.count}>
              {psych?.completedCount || 0}/{psych?.totalTopics || 0} Completed
            </Text>
            <ProgressBar value={percent} color={palette.primary} />

            <View style={styles.statusRow}>
              <Ionicons
                name={psych?.hasCompletedAssessment ? 'checkmark-circle' : 'time-outline'}
                size={18}
                color={psych?.hasCompletedAssessment ? FEEDBACK.successText : SLATE[400]}
              />
              <Text
                style={[
                  styles.status,
                  psych?.hasCompletedAssessment && { color: FEEDBACK.successText },
                ]}
              >
                {psych?.hasCompletedAssessment
                  ? 'Assessment completed. Results are available.'
                  : 'Psychometric assessment not yet completed by the student.'}
              </Text>
            </View>
          </>
        )}
      </Card>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  card: { marginBottom: SPACING.sm },
  statement: { fontSize: TYPE.body, color: SLATE[600], lineHeight: leading(TYPE.body) },
  muted: { fontSize: TYPE.body, color: SLATE[500], lineHeight: leading(TYPE.body), fontStyle: 'italic' },
  count: { fontSize: TYPE.body, color: SLATE[600], fontWeight: '700', marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: SPACING.sm },
  status: { flex: 1, fontSize: TYPE.body, color: SLATE[500], lineHeight: leading(TYPE.body) },
}));
