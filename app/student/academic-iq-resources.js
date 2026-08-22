import { useLocalSearchParams } from 'expo-router';
import ResourcesScreen from '../../components/student/academiciq/ResourcesScreen';

/**
 * Both resources screens share one component; `source` picks the tree endpoint.
 * Defaults to `school` so a malformed link lands on the safer of the two.
 */
export default function StudentResourcesRoute() {
  const { source } = useLocalSearchParams();
  return <ResourcesScreen source={source === 'personalized' ? 'personalized' : 'school'} />;
}
