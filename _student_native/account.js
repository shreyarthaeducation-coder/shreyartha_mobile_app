import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import { useLanguage } from '../../context/LanguageContext';
import { studentService } from '../../services/studentService';
import { cacheService } from '../../services/cacheService';
import { STUDENT } from '../../constants/theme';
import { useTranslations } from '../../hooks/useTranslations';

const UI_STRINGS = {
  support:             'Support',
  accountHelp:         'Account help & settings',
  needHelpFast:        'Need Help Fast?',
  speakToCounsellor:   'Speak to Counsellor',
  supportHeroSubtitle: 'Book the same counselling support flow from the dashboard here.',
  supportOptions:      'Support Options',
  changePassword:      'Change Password',
  updateAccountPwd:    'Update your account password',
  changeLanguage:      'Change Language',
  logOut:              'Log Out',
  signOut:             'Sign out from this device',
  selectLanguage:      'Select Language',
  cancel:              'Cancel',
  updatePassword:      'Update Password',
  submitting:          'Submitting…',
};


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

export default function AccountScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const {
    language,
    supportedLanguages,
    setLanguage,
  } = useLanguage();
  const t = useTranslations(UI_STRINGS);

  const [langModalVisible, setLangModalVisible] = useState(false);

  const [pwdForm, setPwdForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPwd, setShowPwd] = useState({ current: false, newPwd: false, confirm: false });
  const [pwdLoading, setPwdLoading] = useState(false);
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

  const handleLanguageChange = () => {
    setLangModalVisible(true);
  };

  const handleSelectLanguage = async (lang) => {
    setLangModalVisible(false);
    try {
      await setLanguage(lang);
    } catch {
      Alert.alert('Update Failed', 'Could not save language preference right now.');
    }
  };

  const handleSpeakToCounsellor = () => {
    router.push('/student/speak-to-counsellor');
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await cacheService.clearAll();
          await logout();
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const toggleExpand = (key) => setExpanded((v) => (v === key ? null : key));

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>{t.support}</Text>
        <Text style={styles.screenSub}>{t.accountHelp}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <SectionCard title={t.needHelpFast}>
            <TouchableOpacity
              style={styles.supportHeroButton}
              onPress={handleSpeakToCounsellor}
              activeOpacity={0.82}
            >
              <Text style={styles.supportHeroIcon}>🎓</Text>
              <View style={styles.supportHeroTextWrap}>
                <Text style={styles.supportHeroTitle}>{t.speakToCounsellor}</Text>
                <Text style={styles.supportHeroSubtitle}>{t.supportHeroSubtitle}</Text>
              </View>
              <Text style={styles.supportHeroChevron}>›</Text>
            </TouchableOpacity>
          </SectionCard>

          <SectionCard title={t.supportOptions}>
            <SettingRow
              icon="🔑"
              label={t.changePassword}
              sublabel={t.updateAccountPwd}
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
                    <Text style={styles.actionBtnText}>{t.updatePassword}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <SettingRow
              icon="🌐"
              label={t.changeLanguage}
              sublabel={`${language.nativeName ?? language.englishName ?? language.code}`}
              onPress={handleLanguageChange}
            />

            <SettingRow
              icon="🚪"
              label={t.logOut}
              sublabel={t.signOut}
              onPress={handleLogout}
              danger
            />
          </SectionCard>

          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={langModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <Pressable style={styles.langOverlay} onPress={() => setLangModalVisible(false)}>
          <Pressable style={styles.langCard} onPress={() => {}}>
            <Text style={styles.langCardTitle}>{t.selectLanguage}</Text>
            <ScrollView
              style={styles.langScrollView}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {supportedLanguages.map((lang) => {
                const active = language.code === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.langOption, active && styles.langOptionActive]}
                    onPress={() => handleSelectLanguage(lang)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.langOptionTextWrap}>
                      <Text style={[styles.langOptionNative, active && styles.langOptionNativeActive]}>
                        {lang.nativeName ?? lang.label}
                      </Text>
                      <Text style={styles.langOptionEnglish}>
                        {lang.englishName ?? lang.label}
                      </Text>
                    </View>
                    {active && <Text style={styles.langCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.langCancelBtn}
              onPress={() => setLangModalVisible(false)}
              activeOpacity={0.75}
            >
              <Text style={styles.langCancelText}>{t.cancel}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
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
  expandedPanel: {
    backgroundColor: STUDENT.bgCardAlt,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
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
  supportHeroButton: {
    margin: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(79, 70, 229, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.42)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  supportHeroIcon: { fontSize: 24 },
  supportHeroTextWrap: { flex: 1, gap: 3 },
  supportHeroTitle: { fontSize: 15, fontWeight: '800', color: STUDENT.textPrimary },
  supportHeroSubtitle: { fontSize: 12, lineHeight: 17, color: STUDENT.textSecondary },
  supportHeroChevron: { fontSize: 22, color: STUDENT.textPrimary },
  langOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  langCard: {
    width: '100%',
    backgroundColor: STUDENT.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: STUDENT.border,
    paddingTop: 20,
    paddingBottom: 4,
    maxHeight: '78%',
    overflow: 'hidden',
  },
  langCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: STUDENT.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  langScrollView: {
    maxHeight: 380,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  langOptionActive: {
    backgroundColor: 'rgba(79,70,229,0.12)',
  },
  langOptionTextWrap: {
    flex: 1,
  },
  langOptionNative: {
    fontSize: 15,
    fontWeight: '700',
    color: STUDENT.textPrimary,
  },
  langOptionNativeActive: {
    color: STUDENT.accent,
  },
  langOptionEnglish: {
    fontSize: 11,
    color: STUDENT.textMuted,
    marginTop: 2,
  },
  langOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: STUDENT.textPrimary,
  },
  langCheck: {
    fontSize: 17,
    color: STUDENT.accent,
    fontWeight: '700',
    marginLeft: 8,
  },
  langCancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 4,
  },
  langCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: STUDENT.accentRose,
  },
});
