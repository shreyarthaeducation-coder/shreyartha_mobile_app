import { useLocalSearchParams } from 'expo-router';
import { StudentFeatureScreen } from '../../components/student';

/**
 * The WebView escape hatch for student areas that have not been ported yet.
 *
 * `constants/studentMenu.js` decides which tiles land here: an item with `native:` pushes a real
 * screen, an item with `path:` comes here. Porting an area is a one-line flip in that file.
 */
export default function StudentFeature() {
  const { path, title } = useLocalSearchParams();
  if (!path) return null;
  return <StudentFeatureScreen title={String(title || 'Shreyartha')} path={String(path)} />;
}
