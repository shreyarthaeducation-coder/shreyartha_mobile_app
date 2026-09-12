import { useLocalSearchParams } from 'expo-router';
import { ManageStudentsScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/**
 * Manage Students — the school's own roster, and the spreadsheet import that fills it.
 *
 * Needs the CLASSES base, not a roster base: the year → class → section chain is read from
 * /api/school-admin/classes, while the roster and the import live on fixed paths under
 * /api/school-admin/students that are the same for every role allowed to reach them.
 */
export default function ManageStudents() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  // Guard on the base itself: the vice_principal descriptor exists but carries HR only, and an
  // undefined apiBase would build requests to "undefined?academicYearId=…".
  if (!portal?.classes) return null;

  return <ManageStudentsScreen homeRoute={`/staff/${roleKey}`} apiBase={portal.classes} />;
}
