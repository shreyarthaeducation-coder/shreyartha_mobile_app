import { useLocalSearchParams } from 'expo-router';
import { ClassManagementScreen } from '../../../components/staff';
import { getAdminPortal } from '../../../constants/schoolAdminPortals';

/**
 * Class Management — Academic Year → Class → Section → Subject.
 *
 * Needs the academic-year WRITE base as well as the classes base: reads come from
 * /api/school/academic-years but creates and imports live under /api/school-admin.
 */
export default function ClassManagement() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  // Guard on the KEY, not just the descriptor: SCHOOL_ADMIN_PORTALS now also holds a
  // vice_principal entry that carries HR only, so `portal` alone is truthy for a role that
  // has no classes base — and an undefined apiBase produces requests to "undefined/...".
  if (!portal?.classes) return null;

  return (
    <ClassManagementScreen
      homeRoute={`/staff/${roleKey}`}
      apiBase={portal.classes}
      academicYearWrites={portal.academicYearWrites}
    />
  );
}
