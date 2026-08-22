import { StudentHome } from '../../components/student';

/**
 * Native student dashboard.
 *
 * Replaces the desktop-forced WebView this route used to be — a full-page
 * `shreyartha.com/student/platform/dashboard` render at a fake 1024px viewport, pinch-zoomed on a
 * phone. Areas that are not native yet still open in a WebView, but one tile at a time through
 * app/student/feature.js, with a native header and the real device viewport.
 */
export default function StudentDashboard() {
  return <StudentHome />;
}
