import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';

export default function SettingsScreen() {
  const handleLink = (url) => {
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link.'));
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>About Us</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Support section */}
        <Section title="Support">
          <SettingsRow icon="📬" label="Contact Us" onPress={() => handleLink('https://www.shreyartha.com/')} />
        </Section>

        {/* About section */}
        <Section title="About">
          <SettingsRow icon="🌐" label="Website" onPress={() => handleLink('https://www.shreyartha.com/')} />
          <SettingsRow icon="🔏" label="Privacy Policy" onPress={() => handleLink('https://www.shreyartha.com/privacy')} />
          <SettingsRow icon="📄" label="Terms and Conditions" onPress={() => handleLink('https://www.shreyartha.com/privacy')} />
        </Section>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={[sectionStyles.card, SHADOWS.sm]}>
        {children}
      </View>
    </View>
  );
}

function SettingsRow({ icon, label, onPress, right }) {
  return (
    <TouchableOpacity style={rowStyles.row} onPress={onPress}>
      <Text style={rowStyles.icon}>{icon}</Text>
      <Text style={rowStyles.label}>{label}</Text>
      {right || <Text style={rowStyles.arrow}>›</Text>}
    </TouchableOpacity>
  );
}

const sectionStyles = StyleSheet.create({
  container: { marginHorizontal: SPACING.md, marginTop: SPACING.md },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  icon: { fontSize: 20, width: 32 },
  label: { flex: 1, fontSize: 15, color: COLORS.text, marginLeft: 6 },
  arrow: { fontSize: 20, color: COLORS.textLight },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: SPACING.md, paddingBottom: SPACING.xxl },
});
