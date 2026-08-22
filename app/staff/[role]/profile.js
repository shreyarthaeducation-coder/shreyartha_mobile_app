import { useLocalSearchParams } from 'expo-router';
import { StaffProfileScreen } from '../../../components/staff';
import ScopeBrowserTab from '../../../components/staff/profile/ScopeBrowserTab';
import { resolveStaffMenus } from '../../../constants/staffRoles';
import { getCounsellorPortal } from '../../../constants/counsellorPortals';
import { isVicePrincipal } from '../../../constants/vicePrincipalPortal';

/**
 * My Profile for the config-driven staff shells.
 *
 * Both counsellor portals get two segments named as the web names them — *Personalised Details*
 * and *Academic Management* — but the second tab is a different screen in each:
 *
 *   Portal A  the assign/remove class-subject editor (`AcademicTab`), over /api/counselor
 *   Portal B  a read-only School → Class → student browser; this portal has no assign-class
 *             endpoints at all, so there is nothing to edit
 *
 * The vice principal gets THREE tabs, because the web renders `TeacherProfile` unchanged for that
 * role and that component has Details / Classes / HR. Both are backed: the assign-class endpoints
 * are `hasRole('TEACHER')`, which VICE_PRINCIPAL implies, and StaffHrController names
 * VICE_PRINCIPAL explicitly at class level.
 *
 * Every other shell keeps the single read-only Details tab it already had.
 */
export default function StaffProfile() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const config = resolveStaffMenus(roleKey);
  if (!config) return null; // the layout guard has already redirected

  const portal = getCounsellorPortal(roleKey);
  const vicePrincipal = isVicePrincipal(roleKey);
  const canAssignClasses = !!portal?.profile || vicePrincipal;

  return (
    <StaffProfileScreen
      endpoints={config.profileEndpoints}
      homeRoute={config.routes.home}
      roleLabel={config.label}
      detailsLabel={portal ? 'Personalised Details' : 'Details'}
      // Undefined lets the VP take the screen's 'Academic' default, so its three tabs read exactly
      // like app/teacher/profile.js rather than inventing a third vocabulary for the same tabs.
      academicLabel={portal ? 'Academic Management' : undefined}
      showAcademic={canAssignClasses}
      showHr={vicePrincipal}
      // Undefined falls back to the screen's own '/api/teacher' default, which is what the VP uses.
      academicApiBase={portal?.profile || undefined}
      extraTab={
        portal && !canAssignClasses
          ? {
              label: 'Academic Management',
              icon: 'easel-outline',
              render: () => (
                <ScopeBrowserTab
                  schoolsEndpoint={portal.schoolsClasses}
                  studentsEndpoint={`${portal.attendance}/students`}
                />
              ),
            }
          : undefined
      }
    />
  );
}
