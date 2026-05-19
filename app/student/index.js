import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { API_BASE_URL } from '../../services/apiService';
import { studentService } from '../../services/studentService';
import { STUDENT } from '../../constants/theme';

const DEFAULT_STUDENT_NAME = 'Demo Student';
const FULLY_UPGRADED_PLAN_TOKENS = ['premium', 'fully upgraded', 'fully-upgraded', 'platinum', 'gold'];
const PAID_PLAN_TOKENS = ['paid', 'pro', 'subscribed', 'active'];

const DASHBOARD_CARDS = [
  { label: 'Student Profile', icon: require('../../assets/images/student-profile.png'), route: '/student/profile' },
  { label: 'Academic IQ', icon: require('../../assets/images/academiciq.png'), route: '/student/academic-iq' },
  { label: 'Psychometric Assessment', icon: require('../../assets/images/psychometric-assessment.png'), route: '/student/psychometric-assessment' },
  { label: 'Subject & Career', icon: require('../../assets/images/subject-career.png'), route: '/student/subject-career' },
  { label: 'Skill Edge', icon: require('../../assets/images/skill-edge.png'), route: '/student/skills-edge' },
  { label: 'Language Pro', icon: require('../../assets/images/language-pro.png'), route: '/student/language-pro' },
  { label: 'Coding', icon: require('../../assets/images/coding.png'), route: '/student/coding-pro' },
  { label: 'Events & Info', icon: require('../../assets/images/events-info.png'), route: '/student/events' },
];

const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});

const getNestedProfile = (payload) => {
  const data = unwrap(payload);
  return {
    ...unwrap(data?.profile),
    ...unwrap(data?.student),
    ...unwrap(data?.user),
    ...data,
  };
};

const resolveMediaUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `${API_BASE_URL}${raw}`;
  return `${API_BASE_URL}/${raw.replace(/^\/+/, '')}`;
};

function DashboardCard({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.88} onPress={onPress}>
      <View style={styles.cardIconWrap}>
        <Image source={item.icon} style={styles.cardIcon} resizeMode="contain" />
      </View>
      <Text style={styles.cardLabel}>{item.label}</Text>
    </TouchableOpacity>
  );
}

function DefaultAvatar() {
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarFallbackIcon}>👤</Text>
    </View>
  );
}

export default function StudentDashboardScreen() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const { language, supportedLanguages, setLanguage } = useLanguage();
  const { plan, isPremium, loading: subscriptionLoading } = useSubscription();
  const [profileData, setProfileData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError('');

    try {
      const [profileResult, dashboardResult] = await Promise.allSettled([
        studentService.getProfile(),
        studentService.getDashboard(),
      ]);

      const resolvedProfile =
        profileResult.status === 'fulfilled' ? getNestedProfile(profileResult.value) : null;
      const resolvedDashboard =
        dashboardResult.status === 'fulfilled' ? getNestedProfile(dashboardResult.value) : null;
      const mergedProfile = { ...(resolvedDashboard || {}), ...(resolvedProfile || {}) };

      if (!Object.keys(mergedProfile).length) {
        const profileError = profileResult.status === 'rejected' ? profileResult.reason : null;
        const dashboardErr = dashboardResult.status === 'rejected' ? dashboardResult.reason : null;
        throw profileError || dashboardErr || new Error('Unable to load student dashboard.');
      }

      setProfileData(mergedProfile);

      const resolvedName = String(
        mergedProfile.fullName
        || mergedProfile.name
        || mergedProfile.studentName
        || user?.name
        || DEFAULT_STUDENT_NAME
      ).trim() || DEFAULT_STUDENT_NAME;

      const resolvedEmail = String(
        mergedProfile.email
        || mergedProfile.username
        || user?.email
        || ''
      ).trim();

      const nextUserData = {
        ...(user || {}),
        name: resolvedName,
        email: resolvedEmail,
        avatar: resolveMediaUrl(
          mergedProfile.profilePictureUrl
          || mergedProfile.pictureUrl
          || mergedProfile.avatar
          || user?.avatar
        ),
      };

      if (
        nextUserData.name !== user?.name
        || nextUserData.email !== user?.email
        || nextUserData.avatar !== user?.avatar
      ) {
        setUser(nextUserData);
        await AsyncStorage.setItem('userData', JSON.stringify(nextUserData));
      }
    } catch (error) {
      setProfileData(null);
      setDashboardError(error?.message || 'Unable to load student dashboard.');
    } finally {
      setDashboardLoading(false);
    }
  }, [setUser, user]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const studentNameRaw = profileData?.fullName
    || profileData?.name
    || profileData?.studentName
    || user?.name
    || DEFAULT_STUDENT_NAME;
  const studentName = String(studentNameRaw ?? '').trim() || DEFAULT_STUDENT_NAME;
  const avatarUri = resolveMediaUrl(
    profileData?.profilePictureUrl
    || profileData?.pictureUrl
    || profileData?.avatar
    || user?.avatar
    || user?.profilePicture
  );

  const planText = String(plan || '').trim();
  const normalizedPlan = planText.toLowerCase();
  const isFullyUpgraded = FULLY_UPGRADED_PLAN_TOKENS.some((token) => normalizedPlan.includes(token));
  const isPaidPlan = isFullyUpgraded || isPremium || PAID_PLAN_TOKENS.some((token) => normalizedPlan.includes(token));
  let planPill = { label: 'Upgrade', style: styles.planPillUpgrade, text: styles.planPillTextUpgrade };
  if (subscriptionLoading) {
    planPill = { label: 'Checking…', style: styles.planPillPending, text: styles.planPillTextPending };
  } else if (isPaidPlan) {
    planPill = {
      label: planText || (isFullyUpgraded ? 'Premium' : 'Paid'),
      style: isFullyUpgraded ? styles.planPillPremium : styles.planPillPaid,
      text: styles.planPillTextPrimary,
    };
  }

  const activeLanguage = useMemo(
    () => supportedLanguages.find((item) => item.code === language.code) || supportedLanguages[0],
    [language.code, supportedLanguages],
  );

  const onSelectLanguage = async (nextLanguage) => {
    try {
      await setLanguage(nextLanguage);
      setLanguageModalVisible(false);
    } catch {
      setLanguageModalVisible(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.brandWrap}>
            <View style={styles.logoCard}>
              <Image
                source={require('../../assets/images/AppLogo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <DefaultAvatar />
            )}
          </View>

          <TouchableOpacity
            style={styles.languageButton}
            activeOpacity={0.84}
            onPress={() => setLanguageModalVisible(true)}
          >
            <Text style={styles.languageIcon}>🌐</Text>
            <Text style={styles.languageText}>{activeLanguage.code}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.analyticsWrap}>
          <TouchableOpacity
            style={styles.analyticsBtn}
            activeOpacity={0.88}
            onPress={() => router.push('/student/academic')}
          >
            <Text style={styles.analyticsText}>My Analytics</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.welcomeRow}>
          <Text style={styles.welcomeText}>{`WELCOME, ${studentName.toUpperCase()}`}</Text>
          <View style={[styles.planPill, planPill.style]}>
            <Text style={[styles.planPillText, planPill.text]}>{planPill.label}</Text>
          </View>
        </View>

        {!dashboardLoading && dashboardError ? <Text style={styles.errorText}>{dashboardError}</Text> : null}

        <View style={styles.grid}>
          {DASHBOARD_CARDS.map((item) => (
            <DashboardCard
              key={item.label}
              item={item}
              onPress={() => router.push(item.route)}
            />
          ))}
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={languageModalVisible}
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setLanguageModalVisible(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Language</Text>
            {supportedLanguages.map((item) => {
              const active = item.code === activeLanguage.code;
              return (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.languageOption, active && styles.languageOptionActive]}
                  onPress={() => onSelectLanguage(item)}
                >
                  <Text style={[styles.languageOptionText, active && styles.languageOptionTextActive]}>
                    {item.label}
                  </Text>
                  {active ? <Text style={styles.languageOptionTick}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoCard: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 8,
  },
  logo: {
    width: 52,
    height: 52,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: '#fff',
  },
  avatarFallback: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackIcon: {
    fontSize: 28,
  },
  languageButton: {
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  languageIcon: {
    fontSize: 13,
  },
  languageText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  analyticsWrap: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 18,
  },
  analyticsBtn: {
    minWidth: 160,
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 10,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 16,
    elevation: 8,
  },
  analyticsText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  welcomeText: {
    flex: 1,
    color: '#fff',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  planPill: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: 1,
  },
  planPillUpgrade: {
    backgroundColor: 'rgba(245, 158, 11, 0.24)',
    borderColor: 'rgba(245, 158, 11, 0.65)',
  },
  planPillPaid: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.55)',
  },
  planPillPremium: {
    backgroundColor: 'rgba(16, 185, 129, 0.24)',
    borderColor: 'rgba(16, 185, 129, 0.65)',
  },
  planPillPending: {
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    borderColor: 'rgba(148, 163, 184, 0.5)',
  },
  planPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  planPillTextPrimary: {
    color: '#e2e8f0',
  },
  planPillTextUpgrade: {
    color: '#fde68a',
  },
  planPillTextPending: {
    color: '#cbd5e1',
  },
  errorText: {
    color: '#fecaca',
    fontSize: 12,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  card: {
    width: '47.8%',
    minHeight: 126,
    borderRadius: 22,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 8,
  },
  cardIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    width: 30,
    height: 30,
  },
  cardLabel: {
    fontSize: 14,
    lineHeight: 18,
    color: '#111827',
    fontWeight: '800',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 18,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#f8fafc',
    marginTop: 10,
  },
  languageOptionActive: {
    backgroundColor: '#eef2ff',
  },
  languageOptionText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  languageOptionTextActive: {
    color: STUDENT.accent,
  },
  languageOptionTick: {
    color: STUDENT.accent,
    fontSize: 15,
    fontWeight: '900',
  },
});
