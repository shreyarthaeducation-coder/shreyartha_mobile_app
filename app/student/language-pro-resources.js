import { useLocalSearchParams } from 'expo-router';
import LanguageProResources from '../../components/student/languagepro/LanguageProResources';

/**
 * Both Language Pro resource pages share one component; `source` picks the endpoint.
 * Defaults to `school` so a malformed link lands on the fuller of the two — same rule as
 * app/student/academic-iq-resources.js.
 */
export default function LanguageProResourcesRoute() {
  const { source } = useLocalSearchParams();
  return <LanguageProResources source={source === 'personalized' ? 'personalized' : 'school'} />;
}
