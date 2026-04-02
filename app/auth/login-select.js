import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SPACING } from '../../constants/theme';

export default function LoginSelectScreen() {
  const router = useRouter();

  const options = [
    { icon: '🎓', label: 'Student Login', route: '/auth/student-login', enabled: true },
    { icon: '🏫', label: 'School Staff Login', route: '/auth/school-login', enabled: true },
    { icon: '👨‍👩‍👧', label: 'Parents Login', route: '/auth/parent-login', enabled: true, badge: null },
    { icon: '🔐', label: 'Admin Login', route: '/auth/admin-login', enabled: true },
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Image source={{ uri: 'https://the3cedge.com/assets/img/logo.png' }} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Choose Login Type</Text>
      <Text style={styles.subtitle}>Select your role to continue</Text>

      {options.map((opt, idx) => (
        <TouchableOpacity
          key={idx}
          style={[styles.option, !opt.enabled && styles.optionDisabled]}
          onPress={() => opt.enabled && router.push(opt.route)}
          disabled={!opt.enabled}
        >
          <Text style={styles.optionIcon}>{opt.icon}</Text>
          <Text style={[styles.optionLabel, !opt.enabled && { color: '#aaa' }]}>{opt.label}</Text>
          {opt.badge && <Text style={styles.badge}>{opt.badge}</Text>}
          {opt.enabled && <Text style={styles.arrow}>›</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white, paddingHorizontal: SPACING.lg, paddingTop: 60 },
  backBtn: { marginBottom: SPACING.lg },
  backText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  logo: { width: 140, height: 50, alignSelf: 'center', marginBottom: SPACING.lg },
  title: { fontSize: 26, fontWeight: 'bold', color: COLORS.secondary, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.xl },
  option: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    padding: SPACING.lg, borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  optionDisabled: { opacity: 0.5 },
  optionIcon: { fontSize: 28, marginRight: SPACING.md },
  optionLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.secondary },
  badge: {
    backgroundColor: COLORS.primary, color: COLORS.white, fontSize: 10,
    fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    overflow: 'hidden', textTransform: 'uppercase',
  },
  arrow: { fontSize: 24, color: COLORS.textLight },
});