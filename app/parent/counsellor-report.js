import { Redirect } from 'expo-router';

/**
 * Counsellor Report is the Counselling Report's third tab now. The route stays for the links that
 * still name it — the backend chatbot's page links, and any older app build's.
 */
export default function ParentCounsellorReport() {
  return <Redirect href="/parent/counselling-report?tab=report" />;
}
