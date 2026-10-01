import { Redirect } from 'expo-router';

/**
 * Counselor Notes is the Counselling Report's Counsellor Notes tab now. The route stays for the
 * links that still name it — the backend chatbot's page links, and any older app build's.
 */
export default function ParentCounselorNotes() {
  return <Redirect href="/parent/counselling-report?tab=notes" />;
}
