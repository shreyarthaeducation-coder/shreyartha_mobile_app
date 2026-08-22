import { useLocalSearchParams } from 'expo-router';
import { TeacherResourcesScreen } from '../../../components/staff';
import { SHREYA01_TEACHER } from '../../../constants/shreya01TeacherPortal';
import { isVicePrincipal } from '../../../constants/vicePrincipalPortal';

/**
 * Homework — the same screen as Resources, switched by `group`; the web serves both from one
 * AssignHomework component with a `group` prop too.
 *
 * TWO PORTALS, TWO TAB SETS:
 *
 *   Shreyartha teacher   `homework`  — Assign + Submitted, with a separate Resources tile
 *   vice principal       `all`       — all four tabs behind one tile
 *
 * The VP case is a DELIBERATE DIVERGENCE FROM THE WEB, agreed with the user. VicePrincipalSidebar
 * has a single entry labelled "Assign Home Work, My Resources", but VicePrincipalDashboard renders
 * `<AssignHomework profile={profile} />` with no `group` prop — so the default `"homework"` wins
 * and "My Resources"/"Mark Completed" are unreachable on the website despite the label. VP
 * inherits TEACHER, so every resource endpoint already admits it; here the label is honoured.
 */
export default function StaffHomework() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();

  if (isVicePrincipal(roleKey)) {
    return <TeacherResourcesScreen group="all" homeRoute={`/staff/${roleKey}`} />;
  }

  if (roleKey !== SHREYA01_TEACHER.key) return null; // the layout guard has already redirected

  return (
    <TeacherResourcesScreen
      group="homework"
      homeRoute={`/staff/${roleKey}`}
      scopeKind={SHREYA01_TEACHER.scope}
      schoolsEndpoint={SHREYA01_TEACHER.homework.schools}
    />
  );
}
