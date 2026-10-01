import { Redirect, useLocalSearchParams } from 'expo-router';
import CounsellingReportTabs from '../shared/CounsellingReportTabs';
import { COUNSELLING_REPORT_TABS } from '../../constants/counsellingReport';
// By path, not through the staff barrel: in this repo a barrel import is an app-wide import.
import CounsellorReportScreen from '../staff/CounsellorReportScreen';
import StudentPsychometricScreen from './StudentPsychometricScreen';
import { psychometricPrintRoute } from '../../constants/psychometricPrint';

/**
 * Counselling Report, under Student Support: the psychometric result and the counsellor's report, as
 * two tabs of one screen — the web's staff report. Counselling Needs and Notes sits beside it as its
 * own tile again (split back out on 1 Oct 2026, having been this screen's middle tab since 29 Sep).
 *
 * Shared by the teacher and the vice principal. `homeRoute` is the panel's home; `notesRoute` is where
 * a link naming the old notes tab (`?tab=notes`, which shipped builds and chatbot answers may still
 * carry) is sent — the app has no over-the-air update channel, so such links must keep landing.
 */
export default function TeacherCounsellingReportScreen({
  homeRoute = '/teacher',
  notesRoute = '/teacher/counselling',
}) {
  const { tab } = useLocalSearchParams();
  if (tab === COUNSELLING_REPORT_TABS.NOTES) return <Redirect href={notesRoute} />;

  const tabs = [
    {
      value: COUNSELLING_REPORT_TABS.PSYCHOMETRIC,
      label: 'Psychometric Result',
      render: () => <StudentPsychometricScreen embedded printRoute={psychometricPrintRoute(homeRoute)} />,
    },
    {
      value: COUNSELLING_REPORT_TABS.REPORT,
      label: 'Counsellor Report',
      render: () => <CounsellorReportScreen homeRoute={homeRoute} embedded />,
    },
  ];

  return <CounsellingReportTabs title="Counselling Report" fallbackRoute={homeRoute} tabs={tabs} />;
}
