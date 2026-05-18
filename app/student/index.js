import { useCallback, useEffect, useState } from 'react';
import {
  Image,
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
import { studentService } from '../../services/studentService';
import { STUDENT } from '../../constants/theme';

const DEFAULT_STUDENT_NAME = 'Demo Student';

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
    route: '/student/resources',
  },
  {
    label: 'Language Pro',
    icon: require('../../assets/images/language-pro.png'),
    route: '/student/resources',
  },
  {
    label: 'Coding Pro',
    icon: require('../../assets/images/coding.png'),
    route: '/student/coding-pro',
  },
  {
    label: 'Events & Info',
    icon: require('../../assets/images/events-info.png'),
    route: '/student/resources',
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
  const [dashData, setDashData] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await studentService.getDashboard();
      setDashData(data);
    } catch {
      setDashData(null);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const studentNameRaw = dashData?.student?.name || dashData?.name || user?.name || DEFAULT_STUDENT_NAME;
  const normalizedStudentName = String(studentNameRaw ?? '').trim();
  const studentName = normalizedStudentName || DEFAULT_STUDENT_NAME;

  const avatarUri = dashData?.student?.avatar || dashData?.avatar || user?.profilePicture || user?.avatar;

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

        <Pressable
          style={({ pressed }) => [
            styles.counsellorBtn,
            pressed && styles.counsellorBtnPressed,
          ]}
          onPress={() => router.push('/student/speak-to-counsellor')}
        >
          <Text style={styles.counsellorText}>Speak to Counsellor</Text>
        </Pressable>

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
        <Text style={styles.welcomeText}>{`WELCOME, ${studentName.toUpperCase()}`}</Text>

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
    backgroundColor: '#040816',
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
  counsellorBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: 18,
    backgroundColor: '#4caf50',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  counsellorBtnPressed: {
    backgroundColor: '#45a049',
  },
  counsellorText: {
    color: '#fff',
    fontSize: 11,
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
  },
  welcomeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  card: {
    width: '48.6%',
    minHeight: 88,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: '#e7eaf2',
  },
  cardIcon: {
    width: 34,
    height: 34,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 13,
    lineHeight: 17,
    color: '#0f172a',
    fontWeight: '700',
  },
});
