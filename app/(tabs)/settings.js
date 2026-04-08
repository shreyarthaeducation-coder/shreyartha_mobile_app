import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { cacheService } from '../../services/cacheService';

const APP_VERSION = Constants.expoConfig?.version || '1.1.0';

export default function SettingsScreen() {
  const router = useRouter();
  const { userType, logout } = useAuth();

  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await logout();
            setLoggingOut(false);
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. The app will reload fresh data on next use.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setClearingCache(true);
            try {
              await cacheService.clearAll();
              Alert.alert('Done', 'Cache cleared successfully.');
            } catch {
              Alert.alert('Error', 'Failed to clear cache.');
            } finally {
              setClearingCache(false);
            }
          },
        },
      ]
    );
  };

  const handleLink = (url) => {
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link.'));
  };

  const isLoggedIn = !!userType;
  const role = userType ? userType.charAt(0).toUpperCase() + userType.slice(1) : null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Login prompt when not logged in */}
        {!isLoggedIn && (
          <TouchableOpacity
            style={[styles.loginPromptCard, SHADOWS.md]}
            onPress={() => router.push('/auth/login-select')}
          >
            <Text style={styles.loginPromptIcon}>🔑</Text>
            <View style={styles.loginPromptText}>
              <Text style={styles.loginPromptTitle}>Login to access all features</Text>
              <Text style={styles.loginPromptSub}>Manage your account, preferences, and more</Text>
            </View>
            <Text style={styles.loginPromptArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Account section — only when logged in */}
        {isLoggedIn && (
          <Section title="Account">
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>Logged in as</Text>
              <Text style={styles.accountRole}>{role}</Text>
            </View>

            <SettingsRow icon="🔒" label="Change Password" onPress={() => Alert.alert('Change Password', 'A password reset link will be sent to your registered email.')} />
            <SettingsSwitchRow icon="🔔" label="Push Notifications" value={notifications} onValueChange={setNotifications} />
            <SettingsSwitchRow icon="📧" label="Email Updates" value={emailUpdates} onValueChange={setEmailUpdates} />
            <SettingsRow
              icon={clearingCache ? '' : '🗑️'}
              label="Clear Cache"
              onPress={handleClearCache}
              right={clearingCache ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
            />
          </Section>
        )}

        {/* Support section */}
        <Section title="Support">
          <SettingsRow icon="📬" label="Contact Us" onPress={() => handleLink('mailto:info@the3cedge.com')} />
          <SettingsRow icon="❓" label="FAQ" onPress={() => handleLink('https://the3cedge.com/#faq')} />
          <SettingsRow icon="🔏" label="Privacy Policy" onPress={() => handleLink('https://the3cedge.com/privacy')} />
          <SettingsRow icon="📄" label="Terms & Conditions" onPress={() => handleLink('https://the3cedge.com/terms')} />
        </Section>

        {/* App info */}
        <Section title="About">
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App Version</Text>
            <Text style={styles.infoValue}>{APP_VERSION}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Powered by</Text>
            <Text style={styles.infoValue}>The 3C Edge — Shreyartha Education</Text>
          </View>
          <SettingsRow icon="🌐" label="Visit Website" onPress={() => handleLink('https://the3cedge.com')} />
        </Section>

        {/* Logout button */}
        {isLoggedIn && (
          <TouchableOpacity
            style={[styles.logoutBtn, SHADOWS.sm]}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.logoutText}>🚪  Logout</Text>
            }
          </TouchableOpacity>
        )}

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

function SettingsSwitchRow({ icon, label, value, onValueChange }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.icon}>{icon}</Text>
      <Text style={rowStyles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#d0d0d0', true: COLORS.primary + '80' }}
        thumbColor={value ? COLORS.primary : '#f4f3f4'}
      />
    </View>
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
  loginPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: 16,
    padding: SPACING.md,
  },
  loginPromptIcon: { fontSize: 28, marginRight: SPACING.sm },
  loginPromptText: { flex: 1 },
  loginPromptTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  loginPromptSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  loginPromptArrow: { color: '#fff', fontSize: 20 },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  accountLabel: { fontSize: 15, color: COLORS.textSecondary },
  accountRole: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  infoRow: {
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 2 },
  infoValue: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  logoutBtn: {
    backgroundColor: COLORS.error,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    borderRadius: 14,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
