import { Redirect } from 'expo-router';

/** Now the Counselling Report's report tab, inside View Report (4 Nov 2026); old links land on it. */
export default function ParentCounsellorReport() {
  return <Redirect href="/parent/view-report?tab=counselling&sub=report" />;
}
