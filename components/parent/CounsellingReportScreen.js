import CounsellingReportTabs from '../shared/CounsellingReportTabs';
import { COUNSELLING_REPORT_TABS } from '../../constants/counsellingReport';
import AssessmentResultsScreen from './AssessmentResultsScreen';
import CounselorNotesScreen from './CounselorNotesScreen';
import CounsellorReportScreen from './CounsellorReportScreen';
import ParentWebPage from './ParentWebPage';

/**
 * Counselling Report — what used to be three tiles (Assessment Results, Counselor Notes, Counsellor
 * Report) as three tabs of one screen, in the web's order: the psychometric result first, then the
 * counsellor's notes, then the counsellor's report.
 *
 * Each tab is the WEBSITE's own tab (6 Nov 2026) — /app-report/parent-counselling, fetching as the
 * website's parent portal does — with the native screen kept as the fallback for when the website
 * page cannot draw.
 */
const TABS = [
  {
    value: COUNSELLING_REPORT_TABS.PSYCHOMETRIC,
    label: 'Psychometric Result',
    render: () => (
      <ParentWebPage kind="parent-counselling" payload={{ tab: 'psychometric' }} native={<AssessmentResultsScreen embedded />} />
    ),
  },
  {
    value: COUNSELLING_REPORT_TABS.NOTES,
    label: 'Counsellor Notes',
    render: () => (
      <ParentWebPage kind="parent-counselling" payload={{ tab: 'notes' }} native={<CounselorNotesScreen embedded />} />
    ),
  },
  {
    value: COUNSELLING_REPORT_TABS.REPORT,
    label: 'Counsellor Report',
    render: () => (
      <ParentWebPage kind="parent-counselling" payload={{ tab: 'report' }} native={<CounsellorReportScreen embedded />} />
    ),
  },
];

export default function CounsellingReportScreen() {
  return <CounsellingReportTabs title="Counselling Report" fallbackRoute="/parent" tabs={TABS} />;
}

/**
 * The same three tabs inside View Report's Counselling Report tab (4 Nov 2026), opening on
 * `initialTab` (psychometric | notes | report).
 */
export function CounsellingReportBody({ initialTab }) {
  return <CounsellingReportTabs embedded initialTab={initialTab} tabs={TABS} />;
}
