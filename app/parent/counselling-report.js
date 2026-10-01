import { CounsellingReportScreen } from '../../components/parent';

/**
 * Counselling Report — Psychometric Result, Counsellor Notes and Counsellor Report as three tabs.
 * `?tab=psychometric|notes|report` opens one directly; the three old tiles' routes redirect here.
 */
export default function ParentCounsellingReport() {
  return <CounsellingReportScreen />;
}
