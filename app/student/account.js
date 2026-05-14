// app/student/account.js
// Native account / settings screen for the student panel.
// Covers: password change, notification preferences, and logout.

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { studentService } from '../../services/studentService';
import { cacheService } from '../../services/cacheService';
import { STUDENT } from '../../constants/theme';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SettingRow({ icon, label, sublabel, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.settingIconBg, danger && styles.settingIconBgDanger]}>
        <Text style={styles.settingIcon}>{icon}</Text>
      </View>
      <View style={styles.settingText}>
        <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>{label}</Text>
        {sublabel ? <Text style={styles.settingSublabel}>{sublabel}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function PasswordField({ label, value, onChange, show, onToggle }) {
  return (
    <View style={styles.pwdFieldWrap}>
      <Text style={styles.pwdLabel}>{label}</Text>
      <View style={styles.pwdInputRow}>
        <TextInput
          style={styles.pwdInput}
          value={value}
          onChangeText={onChange}
          placeholder={label}
          placeholderTextColor={STUDENT.textMuted}
          secureTextEntry={!show}
          selectionColor={STUDENT.accent}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={onToggle}>
          <Text style={styles.eyeIcon}>{show ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  // Password change form
  const [pwdForm, setPwdForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPwd, setShowPwd] = useState({ current: false, newPwd: false, confirm: false });
  const [pwdLoading, setPwdLoading] = useState(false);

  // Panel for which section is expanded
  const [expanded, setExpanded] = useState(null);

  const handlePasswordChange = async () => {
    if (!pwdForm.currentPassword || !pwdForm.newPassword || !pwdForm.confirmPassword) {
      Alert.alert('Validation', 'Please fill in all password fields.');
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      Alert.alert('Validation', 'New password and confirmation do not match.');
      return;
    }
    if (pwdForm.newPassword.length < 8) {
      Alert.alert('Validation', 'New password must be at least 8 characters.');
      return;
    }

    setPwdLoading(true);
    try {
      await studentService.changePassword({
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      Alert.alert('Success', 'Password changed successfully.');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setExpanded(null);
    } catch (err) {
      Alert.alert('Error', err?.message || 'Failed to change password. Please try again.');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await cacheService.clearAll();
            await logout();
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  const toggleExpand = (key) => setExpanded((v) => (v === key ? null : key));

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Account</Text>
        <Text style={styles.screenSub}>Settings & Preferences</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Security ── */}
          <SectionCard title="🔐  Security">
            <SettingRow
              icon="🔑"
              label="Change Password"
              sublabel="Update your account password"
              onPress={() => toggleExpand('password')}
            />
            {expanded === 'password' && (
              <View style={styles.expandedPanel}>
                <PasswordField
                  label="Current Password"
                  value={pwdForm.currentPassword}
                  onChange={(v) => setPwdForm((f) => ({ ...f, currentPassword: v }))}
                  show={showPwd.current}
                  onToggle={() => setShowPwd((s) => ({ ...s, current: !s.current }))}
                />
                <PasswordField
                  label="New Password"
                  value={pwdForm.newPassword}
                  onChange={(v) => setPwdForm((f) => ({ ...f, newPassword: v }))}
                  show={showPwd.newPwd}
                  onToggle={() => setShowPwd((s) => ({ ...s, newPwd: !s.newPwd }))}
                />
                <PasswordField
                  label="Confirm New Password"
                  value={pwdForm.confirmPassword}
                  onChange={(v) => setPwdForm((f) => ({ ...f, confirmPassword: v }))}
                  show={showPwd.confirm}
                  onToggle={() => setShowPwd((s) => ({ ...s, confirm: !s.confirm }))}
                />
                <TouchableOpacity
                  style={[styles.actionBtn, pwdLoading && styles.actionBtnDisabled]}
                  onPress={handlePasswordChange}
                  disabled={pwdLoading}
                >
                  {pwdLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.actionBtnText}>Update Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </SectionCard>

          {/* ── App Info ── */}
          <SectionCard title="ℹ️  About">
            <SettingRow
              icon="🏫"
              label="Shreyartha Education"
              sublabel="The 3C Edge — Curriculum, Counselling & Career"
              onPress={() => {}}
            />
            <SettingRow
              icon="📋"
              label="App Version"
              sublabel="1.1.0"
              onPress={() => {}}
            />
          </SectionCard>

          {/* ── Support ── */}
          <SectionCard title="🤝  Support">
            <SettingRow
              icon="💬"
              label="Contact Support"
              sublabel="Reach out to our team for help"
              onPress={() => router.push('/(tabs)')}
            />
          </SectionCard>

          {/* ── Logout ── */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: STUDENT.bg },

  screenHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: STUDENT.border,
  },
  screenTitle: { fontSize: 22, fontWeight: '800', color: STUDENT.textPrimary },
  screenSub: { fontSize: 13, color: STUDENT.textMuted, marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Section card
  sectionCard: {
    backgroundColor: STUDENT.bgCard,
    borderRadius: 16,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: STUDENT.textMuted,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Setting row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  settingIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: STUDENT.accent + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  settingIconBgDanger: { backgroundColor: 'rgba(244, 63, 94, 0.15)' },
  settingIcon: { fontSize: 18 },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: STUDENT.textPrimary, marginBottom: 1 },
  settingLabelDanger: { color: '#f43f5e' },
  settingSublabel: { fontSize: 12, color: STUDENT.textMuted },
  chevron: { fontSize: 22, color: STUDENT.textMuted, marginLeft: 8 },

  // Expanded panel
  expandedPanel: {
    backgroundColor: STUDENT.bgCardAlt,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },

  // Password fields
  pwdFieldWrap: { marginBottom: 12 },
  pwdLabel: { fontSize: 12, color: STUDENT.textMuted, marginBottom: 6, fontWeight: '600' },
  pwdInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: STUDENT.bg,
    borderWidth: 1,
    borderColor: STUDENT.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  pwdInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: STUDENT.textPrimary,
  },
  eyeBtn: { padding: 4 },
  eyeIcon: { fontSize: 18 },

  // Action button
  actionBtn: {
    backgroundColor: STUDENT.accent,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
    ...STUDENT.shadow,
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    marginBottom: 8,
  },
  logoutIcon: { fontSize: 20 },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#f43f5e' },
});
