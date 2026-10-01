import { useLocalSearchParams } from 'expo-router';
// By path, not through a barrel: a barrel import here is an app-wide import.
import BulkPsychometricPrintScreen from '../../../components/shared/BulkPsychometricPrintScreen';
import { psychometricPrintApiBase } from '../../../constants/psychometricPrint';

/**
 * Print several students' psychometric reports as one PDF — for the roles whose server endpoints
 * allow it (constants/psychometricPrint.js). Any other role renders nothing; the layout guard has
 * already kept it on its own panel.
 */
export default function StaffPsychometricPrint() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const apiBase = psychometricPrintApiBase(roleKey);
  if (!apiBase) return null;
  return <BulkPsychometricPrintScreen apiBase={apiBase} homeRoute={`/staff/${roleKey}`} />;
}
