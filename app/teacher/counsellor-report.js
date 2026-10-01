import { Redirect } from 'expo-router';

/**
 * Counsellor Report is the Counselling Report's third tab now. The route stays for the links that
 * still name it, older app builds' included.
 */
export default function TeacherCounsellorReport() {
  return <Redirect href="/teacher/counselling-report?tab=report" />;
}
