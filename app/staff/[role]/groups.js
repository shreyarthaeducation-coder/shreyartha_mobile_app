import { useLocalSearchParams } from 'expo-router';
import { StudentGroupsScreen, WellnessGroupsScreen } from '../../../components/staff';
import { getCounsellorPortal } from '../../../constants/counsellorPortals';
import { SHREYA01_TEACHER } from '../../../constants/shreya01TeacherPortal';
import { isVicePrincipal } from '../../../constants/vicePrincipalPortal';

/**
 * ONE ROUTE, TWO UNRELATED FEATURES — they share only a sidebar slot.
 *
 *   counsellor shells   "Wellness Groups"  the wellbeing-survey index screen
 *   Shreyartha teacher  "Create Group"     sorting a class into the four ability bands
 *   vice principal      "Create Group"     the same, on the teacher namespace
 *
 * Nothing is shared between the two features: different endpoints, different DTOs, different UI.
 * Reaching for the "other" screen here would render a plausible-looking page against the wrong API
 * — and note the counsellor branch is the FALLBACK, so any new role must be named explicitly
 * above it or it silently lands on Wellness Groups.
 */
export default function StaffGroups() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();

  // The web renders TeacherGroups unchanged for a VP, so every default here is already correct:
  // the teacher namespace and the year → class → section → subject picker.
  if (isVicePrincipal(roleKey)) {
    return <StudentGroupsScreen homeRoute={`/staff/${roleKey}`} />;
  }

  if (roleKey === SHREYA01_TEACHER.key) {
    return (
      <StudentGroupsScreen
        homeRoute={`/staff/${roleKey}`}
        scopeKind={SHREYA01_TEACHER.scope}
        schoolsEndpoint={SHREYA01_TEACHER.groups.schools}
      />
    );
  }

  const portal = getCounsellorPortal(roleKey);
  if (!portal) return null; // the layout guard has already redirected

  return (
    <WellnessGroupsScreen
      homeRoute={`/staff/${roleKey}`}
      indicesEndpoint={portal.surveyIndices}
      scopeKind={portal.scope}
      schoolsEndpoint={portal.schoolsClasses}
      // Portal A's scope comes from its own groups tree, not the attendance one — same shape,
      // different assignment source.
      classesBase={portal.scopeClasses ? portal.scopeClasses.replace(/\/classes$/, '') : undefined}
    />
  );
}
