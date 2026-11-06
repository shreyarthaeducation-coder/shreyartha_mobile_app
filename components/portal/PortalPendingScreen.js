import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import usePortalLogout from '../../hooks/usePortalLogout';
import { makeStyles } from '../../utils/makeStyles';

/**
 * "Waiting for approval" for a portal carried over from the website (5 Nov 2026), in the words of
 * that portal's own pending page: who approves the account, and what opens once they do.
 */
export default function PortalPendingScreen({ title = 'Account pending approval', message, unlocks = [], children }) {
  const styles = useStyles();
  const palette = usePalette();
  const { confirmLogout } = usePortalLogout({ loginRoute: '/auth/sign-in' });
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <View style={[styles.icon, { backgroundColor: palette.tint }]}>
          <Ionicons name="hourglass-outline" size={34} color={palette.primaryDark} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.text}>{message}</Text> : null}
        {unlocks.length ? <Text style={styles.listTitle}>Once approved, you will be able to:</Text> : null}
        {unlocks.map((line) => (
          <View key={line} style={styles.listRow}>
            <Ionicons name="checkmark-circle" size={18} color={palette.primary} />
            <Text style={styles.listText}>{line}</Text>
          </View>
        ))}
        {children}
        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.outline, { borderColor: palette.primary }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={[styles.outlineText, { color: palette.primary }]}>Log Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: SLATE[50], justifyContent: 'center', padding: SPACING.md },
  card: { backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.lg },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: SPACING.md },
  title: { fontSize: TYPE.title, fontWeight: '800', color: SLATE[800], textAlign: 'center' },
  text: { fontSize: TYPE.body, color: SLATE[600], textAlign: 'center', marginTop: SPACING.sm, lineHeight: leading(TYPE.body) },
  listTitle: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[700], marginTop: SPACING.lg, marginBottom: SPACING.sm },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: 6 },
  listText: { flex: 1, fontSize: TYPE.body, color: SLATE[700], lineHeight: leading(TYPE.body) },
  outline: { minHeight: TOUCH.min, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.lg },
  outlineText: { fontSize: TYPE.heading, fontWeight: '800' },
  pressed: { opacity: 0.8 },
}));
