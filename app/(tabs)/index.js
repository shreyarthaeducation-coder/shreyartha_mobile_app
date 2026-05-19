import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Linking, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, SHADOWS } from '../../constants/theme';
import SearchBar from '../components/SearchBar';
import { api } from '../../services/apiService';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.lg * 2 - SPACING.sm) / 2;

const APP_LOGO = require('../../assets/images/AppLogo.png');

// Per-card icon background tints
const ICON_BG = [
  '#FFF3E0', '#E8F5E9', '#E3F2FD', '#F3E5F5',
  '#FFF8E1', '#E0F7FA', '#FCE4EC', '#E8EAF6',
  '#F1F8E9', '#FBE9E7', '#E0F2F1', '#EDE7F6',
];
const ICON_COLOR = [
  '#E65100', '#2E7D32', '#1565C0', '#6A1B9A',
  '#F57F17', '#00695C', '#C62828', '#283593',
  '#558B2F', '#BF360C', '#00695C', '#4527A0',
];

export default function LandingScreen() {
  const router = useRouter();
  const [loginDropdownVisible, setLoginDropdownVisible] = useState(false);

  // Contact form state
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [contactSubject, setContactSubject] = useState('General Inquiry');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState('');

  const features = [
    { icon: '🎯', title: 'Academic Excellence', description: 'Cambridge-aligned standards and Ivy League benchmarking', slug: 'learning-assessment' },
    { icon: '🧠', title: 'Psychometric Assessment', description: 'Discover your strengths and ideal career paths', slug: 'psychometric-assessment' },
    { icon: '💼', title: 'Subject & Career', description: 'Expert counseling for informed career decisions', slug: 'subject-career' },
    { icon: '🌍', title: 'Global Opportunities', description: 'University placements in India and abroad', slug: 'global-opportunities' },
    { icon: '🚀', title: 'Skills Learning', description: 'Future-ready skills aligned with NEP 2020 and WEF', slug: 'skills-learning' },
    { icon: '📊', title: 'Progress Tracking', description: 'Real-time analytics and performance insights', slug: 'progress-tracking' },
    { icon: '👤', title: 'Students Profile', description: 'Build a comprehensive academic profile', slug: 'students-profile' },
    { icon: '🤗', title: 'Counselling', description: '24/7 AI-empowered support and guidance', slug: 'counselling' },
    { icon: '🏆', title: 'Competitive Examination', description: 'Prepare for national and international exams', slug: 'competitive-examination' },
    { icon: '🤖', title: 'AI/Robotics & Coding', description: 'Hands-on AI, robotics, and coding skills', slug: 'coding-ai-robotics' },
    { icon: '🌐', title: 'Language Learning', description: 'Master new languages with interactive tools', slug: 'language-learning' },
  ];

  const stats = [
    { value: '10,000+', label: 'Students Guided', icon: '🎓' },
    { value: '500+', label: 'Partner Schools', icon: '🏫' },
    { value: '95%', label: 'Success Rate', icon: '📈' },
    { value: '50+', label: 'Countries Reached', icon: '🌍' },
  ];

  const steps = [
    { num: '01', title: 'Create Your Profile', desc: 'Sign up and complete your profile with interests, goals, and academic background.' },
    { num: '02', title: 'Get AI-Powered Insights', desc: 'Our system analyzes your profile and matches you with the right opportunities.' },
    { num: '03', title: 'Achieve Your Goals', desc: 'Follow your personalized learning path and unlock your full potential.' },
  ];

  const testimonials = [
    { name: 'Priya Sharma', role: 'Class 12, Delhi', text: 'The 3C Edge helped me understand my strengths and choose the right career path. I\'m now studying at my dream university!', avatar: 'PS', stars: 5 },
    { name: 'Rahul Mehta', role: 'Class 11, Mumbai', text: 'The personalized resources and practice tests significantly improved my board exam scores. Highly recommended!', avatar: 'RM', stars: 5 },
    { name: 'Ananya Reddy', role: 'Class 10, Bangalore', text: 'The counselors are amazing! They guided me through choosing subjects and planning for competitive exams.', avatar: 'AR', stars: 5 },
  ];

  const loginOptions = [
    { label: '🎓 Student Login', route: '/auth/student-login' },
    { label: '🏫 School Staff Login', route: '/auth/school-login' },
    { label: '👨‍👩‍👧 Parent Login', route: '/auth/parent-login' },
    { label: '🔒 Admin Login', route: '/auth/admin-login' },
  ];

  const contactSubjects = ['General Inquiry', 'Career Guidance', 'School Partnership', 'Technical Support'];

  const handleContactSubmit = async () => {
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setContactError('Please fill in Name, Email, and Message.');
      return;
    }
    setContactLoading(true);
    setContactError('');
    try {
      await api.post('/api/contact', { ...contactForm, subject: contactSubject });
      setContactSuccess(true);
      setContactForm({ name: '', email: '', phone: '', message: '' });
    } catch {
      setContactError('Failed to send message. Please try again or email us directly at info@the3cedge.com.');
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" accessible accessibilityLabel="The 3C Edge Logo" />
          </View>
          <TouchableOpacity style={styles.loginBtn} onPress={() => setLoginDropdownVisible(true)}>
            <Text style={styles.loginBtnText}>🔒 Login ▼</Text>
          </TouchableOpacity>
        </View>

        {/* Login Dropdown Modal */}
        <Modal visible={loginDropdownVisible} transparent animationType="fade" onRequestClose={() => setLoginDropdownVisible(false)}>
          <TouchableOpacity style={styles.loginModalOverlay} activeOpacity={1} onPress={() => setLoginDropdownVisible(false)}>
            <View style={styles.loginDropdown} accessibilityRole="menu">
              <Text style={styles.loginDropdownTitle}>Select Login Type</Text>
              {loginOptions.map((opt, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.loginDropdownItem, idx === loginOptions.length - 1 && { borderBottomWidth: 0 }]}
                  accessibilityRole="menuitem"
                  onPress={() => { setLoginDropdownVisible(false); router.push(opt.route); }}
                >
                  <Text style={styles.loginDropdownItemText}>{opt.label}</Text>
                  <Text style={{ color: COLORS.primary, fontSize: 16 }}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── SEARCH BAR ── */}
        <SearchBar />

        {/* ── TAGLINE ── */}
        <View style={styles.taglineSection}>
          <Text style={styles.taglineText}>
            Y<Text style={styles.taglineSpecial}>Ø</Text>UR L
            <Text style={styles.taglineSpecial}>E</Text>ARNING. OUR{' '}
            <Text style={styles.taglineAI}> AI </Text> INT
            <Text style={styles.taglineSpecial}>E</Text>LLIG
            <Text style={styles.taglineSpecial}>E</Text>NC
            <Text style={styles.taglineSpecial}>E</Text>.
          </Text>
        </View>

        {/* ── HERO ── */}
        <View style={styles.hero}>
          {/* Decorative circles */}
          <View style={styles.heroCircle1} />
          <View style={styles.heroCircle2} />

          <Text style={styles.heroTitle}>
            Unlock Your{'\n'}<Text style={styles.heroHighlight}>Potential</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Empowering Futures through AI-powered Counselling, Assessments & Skill Development — aligned with Cambridge & Princeton University, WEF, and IIT & IIM Alumni.
          </Text>
          <View style={styles.heroButtons}>
            <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/auth/student-login')}>
              <Text style={styles.ctaButtonText}>Get Started</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctaSecondary} onPress={() => router.push('/auth/login-select')}>
              <Text style={styles.ctaSecondaryText}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── STATS ── */}
        <View style={styles.statsSection}>
          {stats.map((stat, idx) => (
            <View key={idx} style={styles.statCard}>
              <Text style={styles.statIcon}>{stat.icon}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── FEATURES — 2-column grid ── */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>OUR PLATFORM</Text>
          <Text style={styles.sectionTitle}>Why Choose The 3C Edge?</Text>
          <Text style={styles.sectionSubtitle}>11 comprehensive tools and expert guidance to help you succeed.</Text>
          <View style={styles.featuresGrid}>
            {features.map((feature, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.featureCard, SHADOWS.md]}
                onPress={() => router.push(`/pages/${feature.slug}`)}
                activeOpacity={0.75}
              >
                <View style={[styles.featureIconBg, { backgroundColor: ICON_BG[idx] }]}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                </View>
                <Text style={[styles.featureTitle, { color: ICON_COLOR[idx] }]}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── HOW IT WORKS ── */}
        <View style={[styles.section, { backgroundColor: COLORS.secondary }]}>
          <Text style={[styles.sectionEyebrow, { color: COLORS.primaryLight }]}>THE PROCESS</Text>
          <Text style={[styles.sectionTitle, { color: COLORS.white }]}>How It Works</Text>
          {steps.map((step, idx) => (
            <View key={idx} style={styles.stepCard}>
              <View style={styles.stepNumBg}>
                <Text style={styles.stepNum}>{step.num}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── TESTIMONIALS ── */}
        <View style={[styles.section, { backgroundColor: COLORS.surfaceAlt }]}>
          <Text style={styles.sectionEyebrow}>STUDENT VOICES</Text>
          <Text style={styles.sectionTitle}>What Our Students Say</Text>
          {testimonials.map((t, idx) => (
            <View key={idx} style={[styles.testimonialCard, SHADOWS.sm]}>
              <View style={styles.testimonialTopBar} />
              <View style={styles.testimonialHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{t.avatar}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.testimonialName}>{t.name}</Text>
                  <Text style={styles.testimonialRole}>{t.role}</Text>
                </View>
                <Text style={styles.stars}>{'★'.repeat(t.stars)}</Text>
              </View>
              <Text style={styles.testimonialText}>"{t.text}"</Text>
            </View>
          ))}
        </View>

        {/* ── ABOUT ── */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>WHO WE ARE</Text>
          <Text style={styles.sectionTitle}>About The 3C Edge</Text>
          <Text style={styles.aboutText}>
            The 3C Edge is a comprehensive educational platform designed to bridge the gap between classroom learning and career success. We combine cutting-edge technology with expert guidance to provide students with personalized learning experiences.
          </Text>
          <Text style={styles.aboutText}>
            Our mission is to empower every student to discover their unique potential and achieve their academic and career goals.
          </Text>
          <View style={styles.highlightsList}>
            {[
              'Personalized Learning Paths',
              'Expert Career Counseling',
              'Psychometric Assessments',
              'University Placement Support',
              'AI-powered Progress Analytics',
              'Global Opportunities Network',
            ].map((item, idx) => (
              <View key={idx} style={styles.highlightItem}>
                <View style={styles.highlightCheckBg}>
                  <Text style={styles.highlightCheck}>✓</Text>
                </View>
                <Text style={styles.highlightText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── CTA BANNER ── */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaSectionTitle}>Ready to Start Your Journey?</Text>
          <Text style={styles.ctaSectionSubtitle}>Join thousands of students who have already discovered their potential with The 3C Edge.</Text>
          <View style={styles.ctaBannerButtons}>
            <TouchableOpacity style={styles.ctaSectionButton} onPress={() => router.push('/auth/student-login')}>
              <Text style={styles.ctaSectionButtonText}>Sign Up Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctaSectionSecondary} onPress={() => router.push('/auth/login-select')}>
              <Text style={styles.ctaSectionSecondaryText}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── CONTACT FORM ── */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>REACH OUT</Text>
          <Text style={styles.sectionTitle}>Get In Touch</Text>
          <Text style={styles.sectionSubtitle}>Have questions? We'd love to hear from you.</Text>

          {/* Contact Info */}
          <View style={styles.contactInfoRow}>
            <View style={styles.contactInfoItem}>
              <Text style={styles.contactInfoIcon}>📧</Text>
              <Text style={styles.contactInfoText}>info@the3cedge.com</Text>
            </View>
            <View style={styles.contactInfoItem}>
              <Text style={styles.contactInfoIcon}>📞</Text>
              <Text style={styles.contactInfoText}>+91 98765 43210</Text>
            </View>
            <View style={styles.contactInfoItem}>
              <Text style={styles.contactInfoIcon}>📍</Text>
              <Text style={styles.contactInfoText}>New Delhi, India</Text>
            </View>
          </View>

          {/* Contact Form */}
          {contactSuccess ? (
            <View style={styles.contactSuccessBox}>
              <Text style={styles.contactSuccessIcon}>✅</Text>
              <Text style={styles.contactSuccessTitle}>Message Sent!</Text>
              <Text style={styles.contactSuccessText}>Thank you for reaching out. We'll get back to you within 24 hours.</Text>
              <TouchableOpacity onPress={() => setContactSuccess(false)}>
                <Text style={styles.contactSuccessReset}>Send another message</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.contactForm, SHADOWS.md]}>
              <Text style={styles.contactFormTitle}>Send Us a Message</Text>

              {contactError ? <Text style={styles.contactFormError}>{contactError}</Text> : null}

              <Text style={styles.contactLabel}>Full Name *</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="Your name"
                placeholderTextColor="#bbb"
                value={contactForm.name}
                onChangeText={(v) => { setContactError(''); setContactForm({ ...contactForm, name: v }); }}
              />

              <Text style={styles.contactLabel}>Email Address *</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="your@email.com"
                placeholderTextColor="#bbb"
                keyboardType="email-address"
                autoCapitalize="none"
                value={contactForm.email}
                onChangeText={(v) => { setContactError(''); setContactForm({ ...contactForm, email: v }); }}
              />

              <Text style={styles.contactLabel}>Phone (optional)</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="+91 XXXXX XXXXX"
                placeholderTextColor="#bbb"
                keyboardType="phone-pad"
                value={contactForm.phone}
                onChangeText={(v) => setContactForm({ ...contactForm, phone: v })}
              />

              <Text style={styles.contactLabel}>Subject</Text>
              <View style={styles.subjectRow}>
                {contactSubjects.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.subjectChip, contactSubject === s && styles.subjectChipActive]}
                    onPress={() => setContactSubject(s)}
                  >
                    <Text style={[styles.subjectChipText, contactSubject === s && styles.subjectChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.contactLabel}>Message *</Text>
              <TextInput
                style={[styles.contactInput, styles.contactTextarea]}
                placeholder="How can we help you?"
                placeholderTextColor="#bbb"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={contactForm.message}
                onChangeText={(v) => { setContactError(''); setContactForm({ ...contactForm, message: v }); }}
              />

              <TouchableOpacity style={styles.contactSubmitBtn} onPress={handleContactSubmit} disabled={contactLoading}>
                {contactLoading
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.contactSubmitText}>Send Message 📤</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── FOOTER ── */}
        <View style={styles.footer}>
          {/* Brand */}
          <View style={styles.footerBrand}>
            <Text style={styles.footerLogoText}>The <Text style={styles.footerLogoHighlight}>3C</Text> Edge</Text>
            <Text style={styles.footerDesc}>Empowering students to achieve their full potential through personalized education and career guidance.</Text>
            <View style={styles.socialRow}>
              {[
                { icon: '📘', url: 'https://www.facebook.com/share/1FKwumKTsB/' },
                { icon: '📸', url: 'https://www.instagram.com/shreyarthaeducation?igsh=MnhrYWRjOWxtNndn' },
                { icon: '💼', url: 'https://www.linkedin.com/company/the-3c-edge/' },
                { icon: '▶️', url: 'https://youtube.com/@shreyarthaeducation?si=asHvya8dQG61NBxB' },
                { icon: '🌐', url: 'https://shreyartha.com' },
              ].map((s, idx) => (
                <TouchableOpacity key={idx} style={styles.socialBtn} onPress={() => Linking.openURL(s.url)}>
                  <Text style={styles.socialIcon}>{s.icon}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Divider */}
          <View style={styles.footerDivider} />

          {/* Links columns */}
          <View style={styles.footerColumns}>
            <View style={styles.footerCol}>
              <Text style={styles.footerColTitle}>Services</Text>
              {features.map((f) => (
                <TouchableOpacity key={f.slug} onPress={() => router.push(`/pages/${f.slug}`)}>
                  <Text style={styles.footerLink}>{f.title}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.footerCol}>
              <Text style={styles.footerColTitle}>Quick Links</Text>
              {[
                { label: 'Home', action: () => router.replace('/(tabs)') },
                { label: 'Student Login', action: () => router.push('/auth/student-login') },
                { label: 'School Staff', action: () => router.push('/auth/school-login') },
                { label: 'Parent Portal', action: () => router.push('/auth/parent-login') },
              ].map((l, idx) => (
                <TouchableOpacity key={idx} onPress={l.action}>
                  <Text style={styles.footerLink}>{l.label}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.footerColTitle, { marginTop: SPACING.lg }]}>Contact</Text>
              <Text style={styles.footerContactText}>📧 info@the3cedge.com</Text>
              <Text style={styles.footerContactText}>📞 +91 98765 43210</Text>
              <Text style={styles.footerContactText}>📍 New Delhi, India</Text>
            </View>
          </View>

          <View style={styles.footerDivider} />
          <Text style={styles.footerCopy}>© 2026 The 3C Edge · Shreyartha Education Pvt. Ltd. All rights reserved.</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },

  // ── Header ──
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingTop: 50, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logoImage: { width: 200, height: 64 },
  loginBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: 32,
  },
  loginBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

  // Login Modal
  loginModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingTop: 92, paddingRight: SPACING.lg,
  },
  loginDropdown: {
    backgroundColor: COLORS.white, borderRadius: 16,
    width: 230, overflow: 'hidden',
    ...SHADOWS.lg,
  },
  loginDropdownTitle: {
    fontSize: 11, fontWeight: '800', color: COLORS.textLight,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#eee',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  loginDropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  loginDropdownItemText: { fontSize: 14, color: COLORS.secondary, fontWeight: '600' },

  // ── Tagline ──
  taglineSection: {
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.white, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  taglineText: {
    fontSize: 14, fontWeight: '800', color: COLORS.secondary,
    textAlign: 'center', letterSpacing: 2.5,
  },
  taglineSpecial: { color: COLORS.primary, fontSize: 16 },
  taglineAI: {
    color: COLORS.white, backgroundColor: COLORS.primary,
    paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden', fontSize: 14,
  },

  // ── Hero ──
  hero: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xxl,
    backgroundColor: COLORS.secondary, alignItems: 'center',
    overflow: 'hidden',
  },
  heroCircle1: {
    position: 'absolute', width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(176,0,58,0.12)', top: -80, right: -60,
  },
  heroCircle2: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(176,0,58,0.08)', bottom: -40, left: -40,
  },
  heroTitle: {
    color: COLORS.white, fontSize: 34, fontWeight: '800',
    textAlign: 'center', marginBottom: 16, lineHeight: 42,
  },
  heroHighlight: { color: COLORS.primaryLight },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.72)', fontSize: 14,
    textAlign: 'center', marginBottom: 28, lineHeight: 22, maxWidth: 320,
  },
  heroButtons: { flexDirection: 'row', gap: 12 },
  ctaButton: {
    backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: 32,
  },
  ctaButtonText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  ctaSecondary: {
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: 32,
  },
  ctaSecondaryText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },

  // ── Stats ──
  statsSection: {
    flexDirection: 'row', flexWrap: 'wrap', backgroundColor: COLORS.white,
    paddingVertical: SPACING.xl, paddingHorizontal: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  statCard: {
    width: '50%', alignItems: 'center', paddingVertical: SPACING.md,
  },
  statIcon: { fontSize: 24, marginBottom: 4 },
  statValue: { fontSize: 26, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },

  // ── Shared Section ──
  section: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xl },
  sectionEyebrow: {
    fontSize: 11, fontWeight: '800', color: COLORS.primary,
    textAlign: 'center', letterSpacing: 2, textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 24, fontWeight: '800', color: COLORS.secondary,
    textAlign: 'center', marginBottom: 8, lineHeight: 30,
  },
  sectionSubtitle: {
    fontSize: 14, color: COLORS.textSecondary, textAlign: 'center',
    marginBottom: SPACING.xl, lineHeight: 21,
  },

  // ── Feature Grid ──
  featuresGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm,
  },
  featureCard: {
    width: CARD_WIDTH, backgroundColor: COLORS.white,
    borderRadius: 16, padding: SPACING.md, marginBottom: 0,
    borderWidth: 1, borderColor: COLORS.border,
  },
  featureIconBg: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  featureIcon: { fontSize: 24 },
  featureTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4, lineHeight: 18 },
  featureDesc: { fontSize: 11, color: COLORS.textSecondary, lineHeight: 16 },

  // ── How It Works ──
  stepCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: SPACING.lg, gap: SPACING.md,
  },
  stepNumBg: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNum: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  stepContent: { flex: 1 },
  stepTitle: { color: COLORS.white, fontWeight: '700', fontSize: 16, marginBottom: 4 },
  stepDesc: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 20 },

  // ── Testimonials ──
  testimonialCard: {
    backgroundColor: COLORS.white, borderRadius: 16,
    marginBottom: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  testimonialTopBar: { height: 4, backgroundColor: COLORS.primary },
  testimonialHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.md, paddingBottom: 8,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
  testimonialName: { fontWeight: '700', fontSize: 15, color: COLORS.secondary },
  testimonialRole: { fontSize: 12, color: COLORS.textSecondary },
  stars: { fontSize: 14, color: '#f5a623', letterSpacing: 1 },
  testimonialText: {
    fontSize: 14, color: COLORS.textSecondary, fontStyle: 'italic',
    lineHeight: 22, paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
  },

  // ── About ──
  aboutText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 24, marginBottom: 16 },
  highlightsList: { marginTop: 8 },
  highlightItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  highlightCheckBg: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#fce4ec',
    alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0,
  },
  highlightCheck: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  highlightText: { fontSize: 14, color: COLORS.text, fontWeight: '500' },

  // ── CTA Banner ──
  ctaSection: {
    backgroundColor: COLORS.primary, paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg, alignItems: 'center',
  },
  ctaSectionTitle: {
    fontSize: 24, fontWeight: '800', color: COLORS.white,
    textAlign: 'center', marginBottom: 10, lineHeight: 30,
  },
  ctaSectionSubtitle: {
    fontSize: 14, color: 'rgba(255,255,255,0.8)',
    textAlign: 'center', marginBottom: 24, lineHeight: 22,
  },
  ctaBannerButtons: { flexDirection: 'row', gap: 12 },
  ctaSectionButton: {
    backgroundColor: COLORS.white, paddingVertical: 14,
    paddingHorizontal: 32, borderRadius: 32,
  },
  ctaSectionButtonText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  ctaSectionSecondary: {
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)',
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: 32,
  },
  ctaSectionSecondaryText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },

  // ── Contact Info ──
  contactInfoRow: { marginBottom: SPACING.lg },
  contactInfoItem: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
    backgroundColor: COLORS.surface, padding: 12, borderRadius: 12,
  },
  contactInfoIcon: { fontSize: 20, marginRight: 12 },
  contactInfoText: { fontSize: 14, color: COLORS.text, fontWeight: '500' },

  // ── Contact Form ──
  contactForm: {
    backgroundColor: COLORS.white, borderRadius: 18,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  contactFormTitle: {
    fontSize: 18, fontWeight: '700', color: COLORS.secondary, marginBottom: SPACING.md,
  },
  contactFormError: {
    backgroundColor: '#fce4ec', color: COLORS.error, fontSize: 13,
    padding: 10, borderRadius: 8, marginBottom: SPACING.sm,
  },
  contactLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.secondary,
    marginBottom: 6, marginTop: SPACING.sm,
  },
  contactInput: {
    borderWidth: 1, borderColor: COLORS.borderDark, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14,
    backgroundColor: COLORS.surface, color: COLORS.text,
  },
  contactTextarea: { height: 100, marginBottom: 0 },
  subjectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  subjectChip: {
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.borderDark, backgroundColor: COLORS.surface,
  },
  subjectChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  subjectChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  subjectChipTextActive: { color: COLORS.white },
  contactSubmitBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', marginTop: SPACING.lg,
  },
  contactSubmitText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },

  // Contact Success
  contactSuccessBox: {
    alignItems: 'center', padding: SPACING.xl,
    backgroundColor: '#e8f5e9', borderRadius: 18, borderWidth: 1, borderColor: '#c8e6c9',
  },
  contactSuccessIcon: { fontSize: 40, marginBottom: 12 },
  contactSuccessTitle: { fontSize: 20, fontWeight: '800', color: '#2e7d32', marginBottom: 8 },
  contactSuccessText: { fontSize: 14, color: '#388e3c', textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  contactSuccessReset: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },

  // ── Footer ──
  footer: { backgroundColor: COLORS.secondary, padding: SPACING.xl },
  footerBrand: { alignItems: 'center', marginBottom: SPACING.lg },
  footerLogoText: { fontSize: 20, fontWeight: '800', color: COLORS.white, marginBottom: 12 },
  footerLogoHighlight: { color: COLORS.primaryLight },
  footerLogo: { width: 110, height: 38, marginBottom: 12 },
  footerDesc: {
    color: 'rgba(255,255,255,0.55)', fontSize: 13,
    textAlign: 'center', marginBottom: 16, lineHeight: 20, maxWidth: 300,
  },
  socialRow: { flexDirection: 'row', gap: 10 },
  socialBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  socialIcon: { fontSize: 18 },
  footerDivider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: SPACING.lg,
  },
  footerColumns: { flexDirection: 'row', gap: SPACING.lg },
  footerCol: { flex: 1 },
  footerColTitle: {
    color: COLORS.white, fontWeight: '700', fontSize: 13,
    marginBottom: 10, letterSpacing: 0.5,
  },
  footerLink: {
    color: 'rgba(255,255,255,0.55)', fontSize: 12,
    marginBottom: 8, lineHeight: 18,
  },
  footerContactText: {
    color: 'rgba(255,255,255,0.55)', fontSize: 12,
    marginBottom: 6, lineHeight: 18,
  },
  footerCopy: {
    color: 'rgba(255,255,255,0.35)', fontSize: 11,
    textAlign: 'center', lineHeight: 18,
  },
});