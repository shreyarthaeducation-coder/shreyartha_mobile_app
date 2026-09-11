import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { SLATE, TYPE } from '../../constants/theme';

/**
 * The translucent dark header every student screen shares.
 *
 * Mirrors the web's `.student-platform-theme .header-container`: a nearly-opaque dark bar
 * (rgba(10,22,40,0.95)) with a light-blue hairline under it, sitting over the fixed background.
 * Deliberately not `StaffHeader` — that one is a solid teal bar and would punch a hole in the
 * background image.
 *
 * `fallbackRoute` is where Back lands when there is no history to pop (deep link).
 */
export default function StudentHeader({ title, fallbackRoute = '/student', right }) {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();

  return (
    <View style={styles.header}>
      <Pressable
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackRoute))}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={20} color={palette.primaryDark} />
      </Pressable>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.right}>{right}</View>
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: p.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: p.headerBorder,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  title: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 34, justifyContent: 'flex-end' },
  pressed: { opacity: 0.7 },
}));
