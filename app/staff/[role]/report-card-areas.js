import { useLocalSearchParams } from 'expo-router';
import ReportCardAreasScreen from '../../../components/staff/admin/ReportCardAreasScreen';

/**
 * Report Card Areas — the report card's graded areas with no exam behind them, set up for every
 * section at once. On the website's School Admin and Principal sidebars; the menu in
 * constants/staffRoles.js decides who sees it here. /api/school-admin/grade-fields admits
 * SCHOOL_ADMIN, PRINCIPAL and VICE_PRINCIPAL.
 */
export default function ReportCardAreas() {
  const { role } = useLocalSearchParams();
  return <ReportCardAreasScreen homeRoute={`/staff/${String(role || '').toLowerCase()}`} />;
}
