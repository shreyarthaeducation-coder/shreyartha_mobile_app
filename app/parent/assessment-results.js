import { Redirect } from 'expo-router';

/**
 * Assessment Results is the Counselling Report's Psychometric Result tab now. The route stays for
 * the links that still name it — the backend chatbot's page links, and any older app build's.
 */
export default function ParentAssessmentResults() {
  return <Redirect href="/parent/counselling-report?tab=psychometric" />;
}
