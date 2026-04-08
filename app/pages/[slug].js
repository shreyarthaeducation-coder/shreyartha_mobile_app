import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { COLORS, SPACING, SHADOWS, FONTS } from '../../constants/theme';
import SearchBar from '../components/SearchBar';
import ChatbotWidget from '../components/ChatbotWidget';
import PageHero from '../components/PageHero';
import FeatureCard from '../components/FeatureCard';
import SectionHeader from '../components/SectionHeader';
import LoadingScreen from '../components/LoadingScreen';
import ErrorScreen from '../components/ErrorScreen';
import { pageContentService } from '../../services/pageContentService';

// One hero background colour per page slug for variety
const PAGE_COLORS = {
  'learning-assessment':       '#b0003a',
  'skills-learning':           '#1a1a2e',
  'students-profile':          '#4F46E5',
  'counselling':               '#0d7377',
  'psychometric-assessment':   '#6d28d9',
  'subject-career':            '#b45309',
  'competitive-examination':   '#b0003a',
  'coding-ai-robotics':        '#0369a1',
  'language-learning':         '#059669',
  'global-opportunities':      '#1a1a2e',
  'progress-tracking':         '#4F46E5',
  'store':                     '#b0003a',
};

export default function NativePageScreen() {
  const { slug } = useLocalSearchParams();
  const router = useRouter();

  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const data = await pageContentService.getPageContent(slug);
      if (!data) throw new Error('Page not found');
      setPageData(data);
    } catch (e) {
      setError(e?.message || 'Failed to load page content');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const heroColor = PAGE_COLORS[slug] || COLORS.primary;

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        {renderHeader(pageData?.title || 'Loading…', router)}
        <LoadingScreen message="Loading content…" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        {renderHeader('Error', router)}
        <ErrorScreen message={error} onRetry={() => load()} />
      </SafeAreaView>
    );
  }

  const { title, subtitle, icon, description, features = [], sections = [], cta } = pageData;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      {renderHeader(title, router)}

      {/* Search bar */}
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
        {/* Hero banner */}
        <PageHero
          title={title}
          subtitle={subtitle}
          icon={icon}
          backgroundColor={heroColor}
        />

        {/* Description */}
        {description ? (
          <View style={styles.descContainer}>
            <Text style={styles.desc}>{description}</Text>
          </View>
        ) : null}

        {/* Features grid */}
        {features.length > 0 ? (
          <>
            <SectionHeader title="Key Features" />
            <View style={styles.featuresGrid}>
              {features.map((feat, idx) => (
                <View key={idx} style={styles.featureCol}>
                  <FeatureCard
                    icon={feat.icon}
                    title={feat.title}
                    description={feat.description}
                    iconColor={heroColor}
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Content sections */}
        {sections.map((section, idx) => (
          <View key={idx} style={[styles.sectionCard, SHADOWS.sm]}>
            <View style={styles.sectionTitleRow}>
              {section.icon ? <Text style={styles.sectionIcon}>{section.icon}</Text> : null}
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        {/* CTA block */}
        {cta ? (
          <View style={[styles.ctaCard, { backgroundColor: heroColor }]}>
            <View style={[styles.ctaCircle, styles.ctaCircleLg]} />
            <View style={[styles.ctaCircle, styles.ctaCircleSm]} />
            <Text style={styles.ctaTitle}>{cta.title}</Text>
            {cta.subtitle ? <Text style={styles.ctaSubtitle}>{cta.subtitle}</Text> : null}
            <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/auth/login-select')}>
              <Text style={styles.ctaBtnText}>{cta.buttonText || 'Get Started'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      {/* Floating chatbot */}
      <ChatbotWidget />
    </SafeAreaView>
  );
}

function renderHeader(title, router) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 60 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backText: { color: COLORS.primary, fontWeight: '600', fontSize: 15 },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    flex: 1,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.xxl },
  descContainer: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  desc: {
    ...FONTS.regular,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  featureCol: { width: '50%' },
  sectionCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionIcon: { fontSize: 20, marginRight: SPACING.sm },
  sectionTitle: {
    ...FONTS.bold,
    fontSize: 16,
    color: COLORS.secondary,
    flex: 1,
  },
  sectionContent: {
    ...FONTS.regular,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  ctaCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    borderRadius: 20,
    padding: SPACING.xl,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  ctaCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  ctaCircleLg: { width: 180, height: 180, top: -60, right: -40 },
  ctaCircleSm: { width: 100, height: 100, bottom: -30, left: -20 },
  ctaTitle: {
    ...FONTS.bold,
    fontSize: 20,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  ctaSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  ctaBtn: {
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 24,
  },
  ctaBtnText: {
    fontWeight: '700',
    fontSize: 15,
    color: COLORS.primary,
  },
});
