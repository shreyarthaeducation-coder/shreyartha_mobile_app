import { Redirect } from 'expo-router';

/** Now the Counselling Report's notes tab, inside View Report (4 Nov 2026); old links land on it. */
export default function ParentCounselorNotes() {
  return <Redirect href="/parent/view-report?tab=counselling&sub=notes" />;
}
