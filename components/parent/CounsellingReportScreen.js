import CounsellingReportTabs from '../shared/CounsellingReportTabs';
import { COUNSELLING_REPORT_TABS } from '../../constants/counsellingReport';
import AssessmentResultsScreen from './AssessmentResultsScreen';
import CounselorNotesScreen from './CounselorNotesScreen';
import CounsellorReportScreen from './CounsellorReportScreen';

/**
 * Counselling Report — what used to be three tiles (Assessment Results, Counselor Notes, Counsellor
 * Report) as three tabs of one screen, in the web's order: the psychometric result first, then the
 * counsellor's notes, then the counsellor's report. Each tab is the old screen, unchanged inside.
 */
const TABS = [
  {
    value: COUNSELLING_REPORT_TABS.PSYCHOMETRIC,
    label: 'Psychometric Result',
    render: () => <AssessmentResultsScreen embedded />,
  },
  {
    value: COUNSELLING_REPORT_TABS.NOTES,
    label: 'Counsellor Notes',
    render: () => <CounselorNotesScreen embedded />,
  },
  {
    value: COUNSELLING_REPORT_TABS.REPORT,
    label: 'Counsellor Report',
    render: () => <CounsellorReportScreen embedded />,
  },
];

export default function CounsellingReportScreen() {
  return <CounsellingReportTabs title="Counselling Report" fallbackRoute="/parent" tabs={TABS} />;
}
