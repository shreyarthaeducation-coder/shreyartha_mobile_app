import { useCallback } from 'react';
import { EmptyState, ScreenScaffold } from '../ui';
import ReportBody from '../staff/counsellor/ReportBody';
import useStaffResource from '../../hooks/useStaffResource';
import { fetchCounsellorReports } from '../../services/parent/reportService';

/**
 * Counsellor Report — every report the counsellor has shared about this parent's child.
 *
 * THE WHOLE DIFFERENCE FROM THE STAFF SCREEN IS THE ABSENCE OF A PICKER. A teacher browses many
 * students and needs class → section → student chips before a report exists to show; a parent has
 * exactly one child, the endpoint takes no parameters, and the list arrives ready to render.
 *
 * The body itself is the shared `ReportBody`, imported BY PATH rather than through the staff
 * barrel — in this repo a barrel import is an app-wide import, and the staff barrel pulls in every
 * staff screen. `ScreenScaffold` imports `StaffHeader` the same way for the same reason.
 */

export default function CounsellorReportScreen() {
  const fetcher = useCallback((signal) => fetchCounsellorReports(signal), []);
  const { data, loading, error, refreshing, reload, refresh } = useStaffResource(fetcher, {
    initialData: [],
  });

  const reports = data || [];

  // Read-aloud speaks the report's identity only. The body is a hydrated multi-section form built
  // inside ReportBody (and Griffin is withheld until published), so the prose is not reachable from
  // here — and a button that spoke an empty string would look broken. Narrow rather than wrong.
  const spoken = reports
    .map((report) => [
      report.className ? `Counsellor report for ${report.className}` : 'Counsellor report',
      report.counsellorName ? `by ${report.counsellorName}` : '',
      report.reportDate ? `dated ${report.reportDate}` : '',
    ].filter(Boolean).join(', '))
    .join('. ');

  return (
    <ScreenScaffold
      title="Counsellor Report"
      fallbackRoute="/parent"
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      readAloud={spoken}
    >
      {reports.length === 0 ? (
        <EmptyState
          icon="reader-outline"
          title="No counsellor reports"
          message="No counsellor reports have been shared for your child yet."
        />
      ) : (
        reports.map((report) => <ReportBody key={report.id} report={report} />)
      )}
    </ScreenScaffold>
  );
}
