import { useLocalSearchParams } from 'expo-router';
import { ParentFeatureScreen } from '../../components/parent';

/**
 * Native header + WebView body, for parent tabs whose phase has not landed yet — and permanently
 * for the Razorpay fee checkout, which is browser-only.
 */
export default function ParentFeature() {
  const { label, path } = useLocalSearchParams();
  if (!path) return null;
  return <ParentFeatureScreen title={String(label || 'Shreyartha')} path={String(path)} />;
}
