import { useState } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { SPACING } from '../../constants/theme';
import WebReport from '../shared/WebReport';

/**
 * One of the website's parent pages, inside the app (6 Nov 2026): the Counselling Report's tabs
 * and the report card are drawn by the website itself (/app-report/parent-counselling and
 * /app-report/parent-report-card), so a parent sees exactly what the website shows — fetched the
 * website's way, with their own token.
 *
 * When the page cannot draw (no connection, the website not yet carrying the page, the app's web
 * build) the native screen is shown instead — OUTSIDE this scroll view, since every native screen
 * scrolls itself and two vertical scroll views inside each other collapse the inner one.
 *
 * @param kind    parent-counselling | parent-report-card
 * @param payload what that page needs ({ tab } for the Counselling Report)
 * @param native  the native screen, the fallback
 * @param scroll  false when the caller already scrolls (a ScreenScaffold)
 * @param page    optional `(content) => element` around the website page only — a screen header
 *                the native fallback, being a whole screen, already has
 */
export default function ParentWebPage({ kind, payload, native, scroll = true, page: wrap }) {
  const [failed, setFailed] = useState(Platform.OS === 'web');
  if (failed) return native;

  const page = (
    // The kind is checked at each caller (scripts/checkwebreports reads ParentWebPage's uses).
    <WebReport
      kind={kind}
      portal="parent"
      payload={payload || {}}
      fallback={native}
      onStateChange={(state) => {
        if (state === 'failed') setFailed(true);
      }}
    />
  );
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {page}
    </ScrollView>
  ) : (
    page
  );
  return wrap ? wrap(body) : body;
}

const styles = StyleSheet.create({
  content: { padding: SPACING.md, paddingBottom: SPACING.xl * 3 },
});
