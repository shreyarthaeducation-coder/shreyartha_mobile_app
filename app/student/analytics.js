import { AnalyticsScreen } from '../../components/student';

/**
 * Native My Analytics — reached from the dashboard header action, as on the web.
 * One spine (`/api/students/analytics`) plus eleven optional enrichments; see analyticsService.
 */
export default function StudentAnalytics() {
  return <AnalyticsScreen />;
}
