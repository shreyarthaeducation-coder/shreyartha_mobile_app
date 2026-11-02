import { useCallback } from 'react';
import { ScreenScaffold } from '../ui';
import PsychometricResultCards from '../shared/PsychometricResultCards';
import useStaffResource from '../../hooks/useStaffResource';
import { parentApi } from '../../services/parentApi';
import { fetchPersonalStatement, fetchPsychometric } from '../../services/parent/insightsService';
import ParentReportActions from './ParentReportActions';

/**
 * The Counselling Report's Psychometric Result tab (formerly the Assessment Results screen): the
 * child's personal statement and psychometric completion, with Preview and Download in the
 * psychometric card.
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
      <PsychometricResultCards
        statement={data?.statement?.data || ''}
        psych={data?.psychometric?.data}
        psychFailed={!!data?.psychometric?.error}
      >
        {/* Preview and Download in the card itself (2 Nov 2026), once a test is done. */}
        {data?.psychometric?.data?.completedCount > 0 ? <ParentReportActions /> : null}
      </PsychometricResultCards>
    </ScreenScaffold>
  );
}
