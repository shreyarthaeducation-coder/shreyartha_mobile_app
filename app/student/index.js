import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { studentService } from '../../services/studentService';
import { STUDENT } from '../../constants/theme';

const DASHBOARD_CARDS = [
  { label: 'Student Profile', icon: '👤', route: '/student/profile' },
  { label: 'Academic IQ', icon: '🧠', route: '/student/academic' },
  { label: 'Psychometric Assessment', icon: '🧩', route: '/student/academic' },
  { label: 'Subject & Career', icon: '🎯', route: '/student/resources' },
  { label: 'Skill Edge', icon: '🚀', route: '/student/resources' },
  { label: 'Language Pro', icon: '🌐', route: '/student/resources' },
  { label: 'Coding', icon: '💻', route: '/student/resources' },
  { label: 'Events & Info', icon: '📣', route: '/student/resources' },
];

function DashboardCard({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <Text style={styles.cardIcon}>{item.icon}</Text>
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

  const studentName = useMemo(() => {
    const name = dashData?.student?.name || dashData?.name || user?.name || 'Demo Student';
    return String(name).trim() || 'Demo Student';
  }, [dashData, user?.name]);

  const avatarUri = dashData?.student?.avatar || dashData?.avatar || user?.profilePicture || user?.avatar;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.bgGlowOne} />
      <View style={styles.bgGlowTwo} />

      <View style={styles.headerRow}>
        <View style={styles.leftHeader}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{studentName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.counsellorBtn} activeOpacity={0.9}>
          <Text style={styles.counsellorText}>Speak to Counsellor</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.analyticsBtn} activeOpacity={0.9}>
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
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 8,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
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
    paddingHorizontal: 14,
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
    rowGap: 12,
  },
  card: {
    width: '48%',
    minHeight: 102,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e7eaf2',
  },
  cardIcon: {
    fontSize: 26,
  },
  cardLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: '#0f172a',
    fontWeight: '700',
  },
});
