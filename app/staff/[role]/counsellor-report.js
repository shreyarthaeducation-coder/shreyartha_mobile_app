import { useLocalSearchParams } from 'expo-router';
import { CounsellorReportFormScreen, CounsellorReportScreen } from '../../../components/staff';
import { getCounsellorPortal } from '../../../constants/counsellorPortals';
import { SHREYA01_TEACHER } from '../../../constants/shreya01TeacherPortal';

/**
 * Counsellor Report — TWO different screens behind one route, because the role decides whether
 * this tab authors reports or only reads them.
 *
 *   counsellor shells   CounsellorReportFormScreen   the 10-section authoring form
 *   Shreyartha teacher  CounsellorReportScreen       read-only; the teacher reads what the
 *                                                    counsellor wrote, and there is no create or
 *                                                    edit anywhere in the teacher controllers
 *
 * The endpoints look alike and are not interchangeable:
 *   counsellor  /api/shreya01/counsellor-report
 *   teacher     /api/shreya01/counselling/counsellor-report   ← no `/reports` suffix either
 */
export default function StaffCounsellorReport() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();

  if (roleKey === SHREYA01_TEACHER.key) {
    return (
      <CounsellorReportScreen
        homeRoute={`/staff/${roleKey}`}
        apiBase={SHREYA01_TEACHER.counselling.base}
        reportsEndpoint={SHREYA01_TEACHER.counsellorReport}
        scopeKind={SHREYA01_TEACHER.scope}
        schoolsEndpoint={SHREYA01_TEACHER.counselling.schools}
      />
    );
  }

  const portal = getCounsellorPortal(roleKey);
  if (!portal) return null; // the layout guard has already redirected

  return <CounsellorReportFormScreen homeRoute={`/staff/${roleKey}`} apiBase={portal.report} />;
}
