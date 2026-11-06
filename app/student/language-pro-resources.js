import { Redirect, useLocalSearchParams } from 'expo-router';
import LanguageProResources from '../../components/student/languagepro/LanguageProResources';
import { LANGUAGE_PRO_RESOURCES_VISIBLE } from '../../components/student/LanguageProScreen';

export default function LanguageProResourcesRoute() {
  const { source } = useLocalSearchParams();
  // Hidden while their content is being added (5 Nov 2026) — back to Language Pro.
  if (!LANGUAGE_PRO_RESOURCES_VISIBLE) return <Redirect href="/student/language-pro" />;
  return <LanguageProResources source={source === 'personalized' ? 'personalized' : 'school'} />;
}
