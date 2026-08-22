import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles } from '../../utils/makeStyles';
/**
 * The back-button header every staff sub-screen shares.
 * `fallbackRoute` is where Back lands when there is no history to pop (deep link).
 */
export default function StaffHeader({ title, fallbackRoute }) {
  const router = useRouter();
  const styles = useStyles();

  return (
    <View style={styles.header}>
      <Pressable
        style={styles.backBtn}
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackRoute))}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={18} color="#ffffff" />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: p.headerBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  backText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
    marginHorizontal: 8,
  },
  headerSpacer: { width: 62 },
}));
