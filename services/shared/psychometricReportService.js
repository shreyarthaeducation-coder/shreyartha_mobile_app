import staffApi from '../staffApi';
import parentApi from '../parentApi';
import { getTopicType, processAssessmentResults } from '../../constants/psychometricScoring';
import { printPsychometricBatch } from '../../utils/psychometricPdf';

/**
 * Bulk psychometric printing (1 Oct 2026). The server returns answers, never scores — scoring stays
 * in the app's own engine, so a printed batch is exactly what each student's own report shows.
 *
 * Endpoint families (backend PsychometricReportController), one per panel:
 *   teacher, vice principal   /api/teacher/psychometric-reports
 *   counsellors               /api/counselor/psychometric-reports
 *   principal                 /api/school-admin/psychometric-reports
 *   parent                    /api/parent/psychometric-reports   (their one child)
 */

export const fetchPrintRoster = (apiBase, schoolCode, signal) =>
  staffApi.get(`${apiBase}/roster${schoolCode ? `?schoolCode=${encodeURIComponent(schoolCode)}` : ''}`, { signal });

export const fetchPrintStudents = (apiBase, { className, section, schoolCode }, signal) => {
  const q = new URLSearchParams({ className });
  if (section) q.set('section', section);
  if (schoolCode) q.set('schoolCode', schoolCode);
  return staffApi.get(`${apiBase}/students?${q.toString()}`, { signal });
};

/**
 * Scores a batch from the server into the items the PDF builder takes. Students with no answered
 * topic produce nothing and are returned by name, so the screen can say who was skipped.
 */
export function scoreBatch(students) {
  const items = [];
  const skipped = [];
  for (const s of students || []) {
    if (!s.topics || s.topics.length === 0) {
      skipped.push(s.name || `Student ${s.studentId}`);
      continue;
    }
    const studentInfo = {
      name: s.name || 'Student',
      class: [s.className, s.section].filter(Boolean).join(' - ') || 'N/A',
      school: s.schoolName || 'N/A',
    };
    for (const topic of s.topics) {
      const answers = {};
      (topic.answers || []).forEach((a) => {
        answers[a.questionId] = a.answer;
      });
      items.push({
        results: processAssessmentResults(topic.questions || [], answers, topic.topicName),
        topicType: getTopicType(topic.topicName),
        topicName: topic.topicName,
        studentInfo,
      });
    }
  }
  return { items, skipped };
}

/** Staff: print the chosen students. */
export async function printStudentsReports(apiBase, studentIds) {
  const batch = await staffApi.post(apiBase, { studentIds });
  const { items, skipped } = scoreBatch(batch);
  if (items.length === 0) return { printed: 0, skipped };
  await printPsychometricBatch(items);
  return { printed: items.length, skipped };
}

/** Parent: every completed report of their child. */
export async function printChildReports() {
  const batch = await parentApi.get('/api/parent/psychometric-reports');
  const { items } = scoreBatch(batch);
  if (items.length === 0) return { printed: 0 };
  await printPsychometricBatch(items);
  return { printed: items.length };
}
