import { useLocalSearchParams } from 'expo-router';
import SchoolResourcesScreen from '../../../components/teacher/SchoolResourcesScreen';
import { isVicePrincipal } from '../../../constants/vicePrincipalPortal';

/** School Resources — the vice principal's, as on the website (their own assigned subjects). */
export default function StaffSchoolResources() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  if (!isVicePrincipal(roleKey)) return null; // the layout guard has already redirected
  return <SchoolResourcesScreen homeRoute={`/staff/${roleKey}`} />;
}
