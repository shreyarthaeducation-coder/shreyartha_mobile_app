import { useLocalSearchParams } from 'expo-router';
import ParentTabsScreen from './ParentTabsScreen';
import TestAnalysisPanel from './TestAnalysisPanel';
import { CounsellingReportBody } from './CounsellingReportScreen';

/**
 * View Report (4 Nov 2026) — what the parent asked for in place of "Download Reports":
 *   Test & Analysis     the tests teachers shared, each one's Detailed Analysis, and View Report Card
 *   Counselling Report  Psychometric Result, Counsellor Notes and Counsellor Report, as before
 * Counselling Report is no longer one of the home's sections; it lives here.
 *
 * `?tab=tests|counselling` picks the tab, and `?sub=psychometric|notes|report` the Counselling
 * Report's own tab — what the old /parent/counselling-report links and Shreya's links arrive with.
 */
export const VIEW_REPORT_TABS = Object.freeze({ TESTS: 'tests', COUNSELLING: 'counselling' });

export default function ViewReportScreen() {
  const { sub } = useLocalSearchParams();
  return (
    <ParentTabsScreen
      title="View Report"
      tabs={[
        { value: VIEW_REPORT_TABS.TESTS, label: 'Test & Analysis', render: () => <TestAnalysisPanel /> },
        {
          value: VIEW_REPORT_TABS.COUNSELLING,
          label: 'Counselling Report',
          render: () => <CounsellingReportBody initialTab={sub} />,
        },
      ]}
    />
  );
}
