import { View, Text, TouchableOpacity, StyleSheet, Image, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import ChatbotWidget from '../components/ChatbotWidget';

const LOGO_URL = 'https://the3cedge.com/images/The3CEdge.png';

export default function LoginSelectScreen() {
  const router = useRouter();

  const options = [
    { icon: '🎓', label: 'Student', sublabel: 'Access learning dashboard & assessments', route: '/auth/student-login', color: '#E3F2FD', iconColor: '#1565C0' },
    { icon: '🏫', label: 'School Staff', sublabel: 'Teacher, Counselor, Principal portal', route: '/auth/school-login', color: '#E8F5E9', iconColor: '#2E7D32' },
    { icon: '👨‍👩‍👧', label: 'Parent', sublabel: 'Monitor your child\'s progress', route: '/auth/parent-login', color: '#FFF3E0', iconColor: '#E65100' },
    { icon: '🔐', label: 'Admin', sublabel: 'Platform administration & management', route: '/auth/admin-login', color: '#F3E5F5', iconColor: '#6A1B9A' },
  ];

  return (
    <View style={styles.container}>
      {/* Branded header */}
      <View style={styles.headerBand}>
        <View style={styles.headerCircle1} />
        <View style={styles.headerCircle2} />
        <TouchableOpacity style={styles.backBtnHeader} onPress={() => router.back()}>
          <Text style={styles.backBtnHeaderText}>← Back</Text>
        </TouchableOpacity>
        <Image source={{ uri: LOGO_URL }} style={styles.headerLogo} resizeMode="contain" />
        <Text style={styles.headerTitle}>Welcome Back</Text>
        <Text style={styles.headerSubtitle}>Select your role to continue</Text>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {options.map((opt, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.option, SHADOWS.md]}
            onPress={() => router.push(opt.route)}
            activeOpacity={0.75}
          >
            <View style={[styles.optionIconBg, { backgroundColor: opt.color }]}>
              <Text style={styles.optionIcon}>{opt.icon}</Text>
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, { color: opt.iconColor }]}>{opt.label}</Text>
              <Text style={styles.optionSublabel}>{opt.sublabel}</Text>
            </View>
            <Text style={[styles.arrow, { color: opt.iconColor }]}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ChatbotWidget />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceAlt },

  // Header band
  headerBand: {
    backgroundColor: COLORS.secondary, paddingTop: 50, paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg, alignItems: 'center', overflow: 'hidden',
  },
  headerCircle1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(176,0,58,0.14)', top: -60, right: -40,
  },
  headerCircle2: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(176,0,58,0.08)', bottom: -30, left: -20,
  },
  backBtnHeader: {
    alignSelf: 'flex-start', marginBottom: SPACING.md,
  },
  backBtnHeaderText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
  headerLogo: { width: 120, height: 40, marginBottom: SPACING.md },
  headerTitle: { color: COLORS.white, fontSize: 26, fontWeight: '800', marginBottom: 4 },
  headerSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },

  // Options
  optionsContainer: {
    padding: SPACING.lg, gap: 12, flex: 1,
  },
  option: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.border,
  },
  optionIconBg: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
    flexShrink: 0,
  },
  optionIcon: { fontSize: 26 },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  optionSublabel: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  arrow: { fontSize: 26, marginLeft: 8 },
});