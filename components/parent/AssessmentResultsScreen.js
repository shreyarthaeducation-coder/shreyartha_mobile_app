import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { ScreenScaffold } from '../ui';
import PsychometricResultCards from '../shared/PsychometricResultCards';
import useStaffResource from '../../hooks/useStaffResource';
import { parentApi } from '../../services/parentApi';
import { fetchPersonalStatement, fetchPsychometric } from '../../services/parent/insightsService';
import { printChildReports } from '../../services/shared/psychometricReportService';
import { PsychometricPrintLink } from '../shared/BulkPsychometricPrintScreen';

/**
 * The Counselling Report's Psychometric Result tab (formerly the Assessment Results screen): the
 * child's personal statement and psychometric completion.
 *
 * Two independent reads, settled separately: a child with no personal statement is normal, and the
 * psychometric call can refuse for a non-school child. `Promise.all` would lose both cards to
 * either failure, which is exactly what the web avoids with two try/catches.
 *
 * `embedded` — rendered inside the Counselling Report's tabs, which draw the header.
 */

export default function AssessmentResultsScreen({ embedded = false }) {
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

  // Every report the child has completed, as one PDF (1 Oct 2026). A parent has one linked child.
  const [printing, setPrinting] = useState(false);
  const printAll = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      const { printed } = await printChildReports();
      if (!printed) Alert.alert('Nothing to print yet', 'No psychometric assessment has been completed yet.');
    } catch (e) {
      Alert.alert('Could not print', e?.message || 'The reports could not be printed.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <ScreenScaffold
      title="Assessment Results"
      fallbackRoute="/parent"
      embedded={embedded}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      selectableReadAloud
    >
      <PsychometricPrintLink
        label={printing ? 'Preparing reports…' : 'Print all reports'}
        onPress={printAll}
      />
      <PsychometricResultCards
        statement={data?.statement?.data || ''}
        psych={data?.psychometric?.data}
        psychFailed={!!data?.psychometric?.error}
      />
    </ScreenScaffold>
  );
}
