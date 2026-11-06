import ReportCardScreen from '../../components/parent/ReportCardScreen';
import ParentWebPage from '../../components/parent/ParentWebPage';
import { ScreenScaffold } from '../../components/ui';

/**
 * The child's report card, from View Report → View Report Card (4 Nov 2026).
 *
 * Drawn by the website itself since 6 Nov 2026 — its ParentReportCard, the card the school prints
 * in that class's layout, with the year picker and Print / Save as PDF — so it is exactly the
 * website's. The native card is the fallback, shown whole (its own header) when the page cannot draw.
 */
export default function ParentReportCard() {
  return (
    <ParentWebPage
      kind="parent-report-card"
      scroll={false}
      native={<ReportCardScreen />}
      page={(content) => (
        <ScreenScaffold title="Report Card" fallbackRoute="/parent/view-report">
          {content}
        </ScreenScaffold>
      )}
    />
  );
}
