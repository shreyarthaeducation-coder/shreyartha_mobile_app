// By path, not through a barrel: a barrel import here is an app-wide import.
import BulkPsychometricPrintScreen from '../../components/shared/BulkPsychometricPrintScreen';

/** Print several students' psychometric reports as one PDF (opened from the Psychometric Result tab). */
export default function TeacherPsychometricPrint() {
  return <BulkPsychometricPrintScreen apiBase="/api/teacher/psychometric-reports" homeRoute="/teacher" />;
}
