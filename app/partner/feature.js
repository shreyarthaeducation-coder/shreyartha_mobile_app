import { useLocalSearchParams } from 'expo-router';
import { PartnerFeatureScreen } from '../../components/partner';

/**
 * Native header + WebView body, addressed by params.
 *
 * The per-tile route files call PartnerFeatureScreen directly; this generic route exists for
 * anything reached by path rather than by key.
 *
 * Reads `label`, matching app/parent/feature.js. The STUDENT twin reads `title` — passing the wrong
 * one silently yields the "Shreyartha" fallback header.
 */
export default function PartnerFeature() {
  const { label, path } = useLocalSearchParams();
  if (!path) return null;
  return <PartnerFeatureScreen title={String(label || 'Shreyartha')} path={String(path)} />;
}
