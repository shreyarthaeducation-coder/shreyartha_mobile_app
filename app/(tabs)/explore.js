import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import SearchBar from '../components/SearchBar';
import ChatbotWidget from '../components/ChatbotWidget';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.lg * 2 - SPACING.sm) / 2;

const ICON_BG = [
  '#FFF3E0', '#E8F5E9', '#E3F2FD', '#F3E5F5',
  '#FFF8E1', '#E0F7FA', '#FCE4EC', '#E8EAF6',
  '#F1F8E9', '#FBE9E7', '#E0F2F1', '#EDE7F6',
];

const SERVICES = [
  { icon: '📚', title: 'Learning & Assessment', description: 'Personalized learning paths tailored to your curriculum', slug: 'learning-assessment' },
  { icon: '🧠', title: 'Psychometric Assessment', description: 'Discover your strengths and ideal career paths', slug: 'psychometric-assessment' },
  { icon: '💼', title: 'Subject & Career', description: 'Expert counseling for informed career decisions', slug: 'subject-career' },
  { icon: '🌍', title: 'Global Opportunities', description: 'University placements in India and abroad', slug: 'global-opportunities' },
  { icon: '🛠️', title: 'Skills Learning', description: 'Coding, languages, and future-ready competencies', slug: 'skills-learning' },
  { icon: '📊', title: 'Progress Tracking', description: 'Real-time analytics and performance insights', slug: 'progress-tracking' },
  { icon: '👤', title: 'Students Profile', description: 'Build a comprehensive academic profile', slug: 'students-profile' },
  { icon: '🤝', title: 'Counselling', description: 'One-on-one guidance from expert counselors', slug: 'counselling' },
  { icon: '🏆', title: 'Competitive Exam', description: 'Prepare for national and international exams', slug: 'competitive-examination' },
  { icon: '🤖', title: 'AI/Robotics & Coding', description: 'Hands-on AI, robotics, and coding skills', slug: 'coding-ai-robotics' },
  { icon: '🌐', title: 'Language Learning', description: 'Master new languages with interactive tools', slug: 'language-learning' },
  { icon: '🛒', title: 'Shreyartha Store', description: 'Educational resources and premium content', slug: 'store' },
];

export default function ExploreScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore Services</Text>
        <Text style={styles.headerSubtitle}>Discover all 12 educational services</Text>
      </View>

      {/* Search */}
      <SearchBar />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        <Text style={styles.sectionTitle}>Our Services</Text>
        <Text style={styles.sectionSubtitle}>Tap any service to learn more</Text>

        <View style={styles.grid}>
          {SERVICES.map((service, i) => (
            <TouchableOpacity
              key={service.slug}
              style={[styles.card, SHADOWS.md, { backgroundColor: '#fff' }]}
              onPress={() => router.push(`/pages/${service.slug}`)}
              activeOpacity={0.85}
            >
              <View style={[styles.iconWrapper, { backgroundColor: ICON_BG[i % ICON_BG.length] }]}>
                <Text style={styles.cardIcon}>{service.icon}</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>{service.title}</Text>
              <Text style={styles.cardDesc} numberOfLines={3}>{service.description}</Text>
              <Text style={styles.cardArrow}>Explore →</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      <ChatbotWidget />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.xxl },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
  },
  card: {
    width: CARD_WIDTH,
    margin: SPACING.xs,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SPACING.md,
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  cardIcon: { fontSize: 28 },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 6,
    lineHeight: 20,
  },
  cardDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginBottom: SPACING.sm,
    flex: 1,
  },
  cardArrow: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
