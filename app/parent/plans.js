import { Redirect } from 'expo-router';

/**
 * Plans for my child is hidden from parents (4 Nov 2026), in the app and on the website. Nothing
 * links here any more; an old link lands on the dashboard. The website's plans page is unchanged,
 * so bringing it back is this file (a ParentFeatureScreen on `${PARENT_BASE}/plans`), the Fees
 * card and the pending screen's button.
 */
export default function ParentPlans() {
  return <Redirect href="/parent" />;
}
