import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Counselling Report is View Report's second tab now (4 Nov 2026), not a section of its own. Old
 * links — notifications, Shreya, search — land on that tab, on the inner tab they named.
 */
export default function ParentCounsellingReport() {
  const { tab } = useLocalSearchParams();
  const sub = typeof tab === 'string' && tab ? `&sub=${tab}` : '';
  return <Redirect href={`/parent/view-report?tab=counselling${sub}`} />;
}
