import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { COLORS, SPACING, SHADOWS, FONTS } from '../../../constants/theme';
import SearchBar from '../../components/SearchBar';
import ChatbotWidget from '../../components/ChatbotWidget';

const HERO_COLOR = '#b45309';

const FOOTER_LINKS = [
  'Learning & Assessment', 'Skills Learning', 'Students Profile', 'Counselling',
  'Psychometric Assessment', 'Subject & Career', 'Competitive Examination',
  'Coding AI & Robotics', 'Language Learning', 'Global Opportunities', 'Progress Tracking',
];

export default function SubjectCareerScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Subject & Career</Text>
        <View style={{ width: 60 }} />
      </View>

      <SearchBar />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={[styles.hero, { backgroundColor: HERO_COLOR }]}>
          <View style={styles.heroCircle1} />
          <View style={styles.heroCircle2} />
          <Text style={styles.heroIcon}>📋</Text>
          <Text style={styles.heroTitle}>Subject & Career</Text>
          <Text style={styles.heroSubtitle}>"Shreyratha Global Navigator"</Text>
          <Text style={styles.heroDesc}>
            Our intelligent Subject & Career navigation system helps students chart personalized
            pathways from current subjects to future careers using data-driven insights and global
            benchmarking.
          </Text>
          <View style={styles.heroBtns}>
            <TouchableOpacity style={styles.heroBtn} onPress={() => router.push('/auth/student-login')}>
              <Text style={styles.heroBtnText}>Get Started</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroBtn2}>
              <Text style={styles.heroBtn2Text}>Learn More</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Skills Match Meter */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Skills Match Meter</Text>
          <Text style={styles.sectionSubtitle}>How our system connects your subjects to your dream career</Text>
          <View style={styles.cardsRow}>
            {[
              { icon: '⚙️', title: 'How It Works', desc: 'Our AI analyzes your academic performance, psychometric profile, and interests to generate a personalized career compatibility score for hundreds of career paths.' },
              { icon: '📊', title: 'Your Results', desc: 'Receive detailed match percentages, gap analysis reports, and actionable recommendations to bridge the distance between where you are and where you want to be.' },
            ].map((card, i) => (
              <View key={i} style={[styles.card, { width: '95%' }]}>
                <Text style={styles.cardIcon}>{card.icon}</Text>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardDesc}>{card.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Career Horizons Table */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Career Horizons 2026</Text>
        </View>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Career Field</Text>
            <Text style={styles.tableHeaderText}>Key Subjects</Text>
            <Text style={[styles.tableHeaderText, { flex: 0.7 }]}>Growth</Text>
          </View>
          {[
            { field: 'Tech & AI', subjects: 'Mathematics, Computer Science, Physics', growth: '🚀 Excellent' },
            { field: 'Sustainability', subjects: 'Environmental Science, Geography, Chemistry', growth: '📈 High' },
            { field: 'New-Age Commerce', subjects: 'Economics, Mathematics, Business Studies', growth: '💼 Strong' },
            { field: 'Design & Media', subjects: 'Art, Media Studies, Psychology', growth: '🎨 Growing' },
            { field: 'Healthcare', subjects: 'Biology, Chemistry, Physics', growth: '❤️ Stable' },
          ].map((row, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
              <Text style={styles.tableCellBold}>{row.field}</Text>
              <Text style={styles.tableCell}>{row.subjects}</Text>
              <Text style={[styles.tableCell, { flex: 0.7 }]}>{row.growth}</Text>
            </View>
          ))}
        </View>

        {/* Scholarships */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Scholarship Opportunities</Text>
          <View style={styles.cardsRow}>
            {[
              { icon: '🌍', title: 'International Scholarships', desc: 'Access to 500+ international scholarship opportunities matched to your academic profile and career goals.' },
              { icon: '🏅', title: 'Domestic Scholarships', desc: 'Comprehensive database of national scholarships, government schemes, and institutional grants.' },
              { icon: '📈', title: 'Success Tracker', desc: 'Monitor your scholarship applications, track deadlines, and optimize your success rate.' },
            ].map((card, i) => (
              <View key={i} style={styles.card}>
                <Text style={styles.cardIcon}>{card.icon}</Text>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardDesc}>{card.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quote */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>"Every Subject is a Stepping Stone"</Text>
          <Text style={styles.sectionSubtitle}>
            "At Shreyartha, we see every subject as a gateway to unlimited possibilities. Our
            navigation system ensures that no academic interest goes unexplored and no career dream
            goes uncharted."
          </Text>
        </View>

        {/* CTA */}
        <View style={[styles.ctaSection, { backgroundColor: HERO_COLOR }]}>
          <View style={styles.ctaCircle1} />
          <View style={styles.ctaCircle2} />
          <Text style={styles.ctaTitle}>Navigate Your Future</Text>
          <Text style={styles.ctaSubtitle}>
            Discover the perfect intersection of your subjects, skills, and career aspirations with
            Shreyartha's intelligent navigation system.
          </Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/auth/student-login')}>
            <Text style={styles.ctaBtnText}>Get Started</Text>
          </TouchableOpacity>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>The 3C Edge</Text>
          <Text style={styles.footerTagline}>Empowering students with Curriculum, Counselling & Career guidance.</Text>
          <View style={styles.footerLinks}>
            {FOOTER_LINKS.map((link, i) => (
              <TouchableOpacity key={i} style={styles.footerLinkBtn}>
                <Text style={styles.footerLink}>{link}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.footerCopy}>© 2025 Shreyartha Education. All rights reserved.</Text>
        </View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      <ChatbotWidget />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backText: { color: COLORS.primary, fontWeight: '600', fontSize: 15 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.secondary, flex: 1, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.xxl },
  hero: { padding: SPACING.xl, alignItems: 'center', overflow: 'hidden', position: 'relative', minHeight: 280 },
  heroCircle1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.08)', top: -60, right: -60 },
  heroCircle2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -40, left: -30 },
  heroIcon: { fontSize: 56, marginBottom: 12 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  heroSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: 12, fontStyle: 'italic' },
  heroDesc: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  heroBtns: { flexDirection: 'row', gap: 12 },
  heroBtn: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 28 },
  heroBtnText: { fontWeight: '700', fontSize: 14, color: COLORS.primary },
  heroBtn2: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 28 },
  heroBtn2Text: { fontWeight: '600', fontSize: 14, color: '#fff' },
  sectionContainer: { padding: SPACING.md },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: COLORS.secondary, marginBottom: 8, textAlign: 'center' },
  sectionSubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  cardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  card: { width: '47%', backgroundColor: COLORS.white, borderRadius: 16, padding: SPACING.md, ...SHADOWS.sm },
  cardIcon: { fontSize: 28, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.secondary, marginBottom: 6 },
  cardDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  table: { marginHorizontal: SPACING.md, marginTop: SPACING.md, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.primary, padding: 12 },
  tableHeaderText: { flex: 1, fontWeight: '700', color: '#fff', fontSize: 13 },
  tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, alignItems: 'center' },
  tableRowAlt: { backgroundColor: COLORS.surface },
  tableCell: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 18 },
  tableCellBold: { flex: 1, fontSize: 13, color: COLORS.secondary, fontWeight: '600', lineHeight: 18 },
  ctaSection: { margin: SPACING.md, borderRadius: 20, padding: SPACING.xl, alignItems: 'center', overflow: 'hidden', position: 'relative' },
  ctaCircle1: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.1)', top: -60, right: -40 },
  ctaCircle2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.08)', bottom: -30, left: -20 },
  ctaTitle: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  ctaSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  ctaBtn: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 36, borderRadius: 24 },
  ctaBtnText: { fontWeight: '700', fontSize: 15, color: COLORS.primary },
  footer: { backgroundColor: '#1a1a2e', padding: SPACING.lg, marginTop: SPACING.lg },
  footerBrand: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  footerTagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 20, lineHeight: 20 },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  footerLinkBtn: { paddingVertical: 4, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  footerLink: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  footerCopy: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 8 },
});
