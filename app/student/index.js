import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { studentService } from '../../services/studentService';
import { STUDENT } from '../../constants/theme';

const DEFAULT_STUDENT_NAME = 'Demo Student';
const FULLY_UPGRADED_PLAN_TOKENS = ['premium', 'fully upgraded', 'fully-upgraded', 'platinum', 'gold'];
const PAID_PLAN_TOKENS = ['paid', 'pro', 'subscribed', 'active'];

const DASHBOARD_CARDS = [
  {
    label: 'Student Profile',
    icon: require('../../assets/images/student-profile.png'),
    route: '/student/profile',
  },
  {
    label: 'Academic IQ',
    icon: require('../../assets/images/academiciq.png'),
    route: '/student/academic-iq',
  },
  {
    label: 'Psychometric Assessment',
    icon: require('../../assets/images/psychometric-assessment.png'),
    route: '/student/psychometric-assessment',
  },
  {
    label: 'Subject & Career',
    icon: require('../../assets/images/subject-career.png'),
    route: '/student/subject-career',
  },
  {
    label: 'Skill Edge',
    icon: require('../../assets/images/skill-edge.png'),
    route: '/student/skills-edge',
  },
  {
    label: 'Language Pro',
    icon: require('../../assets/images/language-pro.png'),
    route: '/student/language-pro',
  },
  {
    label: 'Coding',
    icon: require('../../assets/images/coding.png'),
    route: '/student/coding-pro',
  },
  {
    label: 'Events & Info',
    icon: require('../../assets/images/events-info.png'),
    route: '/student/events',
  },
];

function DashboardCard({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <Image source={item.icon} style={styles.cardIcon} resizeMode="contain" />
      <Text style={styles.cardLabel}>{item.label}</Text>
    </TouchableOpacity>
  );
}

export default function StudentDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { plan, isPremium, loading: subscriptionLoading } = useSubscription();
  const [dashData, setDashData] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError('');
    try {
      const [dashboard, profile] = await Promise.all([
        studentService.getDashboard(),
        studentService.getProfile().catch(() => null),
      ]);
      setDashData(dashboard);
      setProfileData(profile);
    } catch (error) {
      setDashData(null);
      setProfileData(null);
      setDashboardError(error?.message || 'Unable to load student dashboard.');
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const studentNameRaw = profileData?.fullName
    || profileData?.name
    || dashData?.student?.name
    || dashData?.name
    || user?.name
    || DEFAULT_STUDENT_NAME;
  const normalizedStudentName = String(studentNameRaw ?? '').trim();
  const studentName = normalizedStudentName || DEFAULT_STUDENT_NAME;

  const avatarUri = profileData?.profilePictureUrl
    || profileData?.pictureUrl
    || profileData?.avatar
    || dashData?.student?.avatar
    || dashData?.avatar
    || user?.profilePicture
    || user?.avatar;

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
      text: styles.planPillText,
    };
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />

      <View style={styles.headerRow}>
        <View style={styles.leftHeader}>
          <Image
            source={require('../../assets/images/ShreyarthaLogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{studentName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.analyticsBtn}
          activeOpacity={0.9}
          onPress={() => router.push('/student/academic')}
        >
          <Text style={styles.analyticsText}>My Analytics</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bgGlowOne: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(79, 70, 229, 0.25)',
    top: -80,
    right: -60,
  },
  bgGlowTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(6, 182, 212, 0.18)',
    bottom: -80,
    left: -70,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 6,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  logo: {
    width: 44,
    height: 34,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: '#1c2b45',
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: '#1c2b45',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#fff',
    fontWeight: '700',
  },
  analyticsBtn: {
    minHeight: 34,
    borderRadius: 18,
    backgroundColor: STUDENT.accent,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  analyticsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 20,
    flexGrow: 1,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  welcomeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  planPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '800',
  },
  planPillTextUpgrade: {
    color: '#fde68a',
  },
  planPillTextPending: {
    color: '#cbd5e1',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  card: {
    width: '48.6%',
    minHeight: 110,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e7eaf2',
  },
  cardIcon: {
    width: 34,
    height: 34,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 13,
    lineHeight: 16,
    color: '#0f172a',
    fontWeight: '700',
    textAlign: 'center',
  },
});
