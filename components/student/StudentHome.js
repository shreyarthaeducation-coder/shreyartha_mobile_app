import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GRADIENT, SPACING } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { useTranslations } from '../../hooks/useTranslations';
import BrandBar from '../shared/home/BrandBar';
import { TAB_BAR_HEIGHT } from '../shared/home/PortalTabBar';
import IdentityCard from '../shared/home/IdentityCard';
import HeroCard from '../shared/home/HeroCard';
import ProgressStrip from './home/ProgressStrip';
import AssistantCard from '../shared/home/AssistantCard';
import SectionDivider from '../shared/home/SectionDivider';
import SearchEntry from '../shared/home/SearchEntry';
import {
  fetchEntitlements,
  fetchStudentProfile,
  planBadge,
  planName,
} from '../../services/student/dashboardService';
import { fetchCareerPreferences } from '../../services/student/careerService';
import { loadWelcomeProgress, sectionRows } from '../../services/student/welcomeService';

/**
 * The student dashboard.
 *
 * ── WHAT CHANGED, AND WHY ───────────────────────────────────────────────────
 * This was a frosted header, one summary card and a 2×4 grid of white tiles — everything the panel
 * offers, flat, at the same weight. The redesign gives it a shape: who you are, the two places you
 * go, the two assistants who help, and a way to find anything. The eight tiles moved to My Workspace
 * (`WorkspaceScreen`), which is what the first hero card opens, and Student Profile became the
 * footer's Profile tab.
 *
 * ── DARK GLASS OVER THE PHOTOGRAPH ──────────────────────────────────────────
 * Every block here sits on `palette.glassDark`. `Background.png` still shows through and around
 * them — the layout paints it once behind the whole navigator — but no line of copy is ever printed
 * straight onto the image. That was the readability complaint: the old `glass` token is 10% WHITE,
 * so over a bright region of the photo it lightened the backing and the white text on it vanished.
 *
 * ── THE FAN-OUT IS TWO WAVES, NOT ONE ───────────────────────────────────────
 * Wave 1 is the four calls this screen cannot draw without, all through `Promise.allSettled` —
 * never `Promise.all`, because a free student legitimately 403s on entitlements and that must cost
 * a badge, not the whole dashboard.
 *
 * Wave 2 is `loadWelcomeProgress()`, which is six more requests feeding one strip of bars inside the
 * My Analytics card. It is deliberately NOT awaited before the first paint. Putting ten round trips
 * in front of a cold start to fill three progress bars would make the redesign feel slower than what
 * it replaced, which is the opposite of the point.
 */

/**
 * Every English string on this screen, in one place so `useTranslations` can batch them into a
 * single translate call and cache the result for 24 h.
 *
 * Module scope on purpose — the hook keeps the first object it sees as the English baseline, and a
 * map rebuilt per render would re-translate forever. "Jyora" and "Shreya" are absent because they
 * are names: a translation engine will happily transliterate them into something the student has
 * never seen on any other screen.
 */
const STRINGS = {
  changePassword: 'Change Password',
  rowName: "Student's Name",
  rowGrade: 'Grade',
  rowStream: 'Stream',
  rowCareers: 'Career Preferences',
  notSet: 'Not set',
  upgrade: 'Upgrade',
  workspaceTitle: 'My Workspace',
  workspaceBody: 'Access your learning resources, tools, courses and practice zone.',
  analyticsTitle: 'My Analytics',
  analyticsBody: 'Track your progress, performance and insights.',
  haveDoubt: 'Have doubt?',
  jyoraRole: 'Your Personal Tutor',
  jyoraBlurb: 'Get personalized guidance and clear your concepts with your tutor.',
  jyoraCta: 'Connect with Jyora',
  shreyaRole: 'AI Support',
  shreyaBlurb: 'Ask anything, get instant answers and 24/7 AI support.',
  shreyaCta: 'Connect with Shreya',
  searchPlaceholder: 'Search to explore topics, resources, courses and more…',
  searchButton: 'Search',
  progressEmpty: 'Start a topic to see your progress here.',
};

const JYORA_AVATAR = require('../../assets/images/Jyora.png');
const SHREYA_AVATAR = require('../../assets/images/Chatbot.png');

// Each assistant's own brand, matched to the website and to the AI action bars everywhere else in
// the panel. Not the portal palette — see AssistantCard's note.
const JYORA_ACCENT = '#7C3AED';
const SHREYA_ACCENT = '#2196f3';

/**
 * "Grade 10" from a bare "10", but "Class VIII" left exactly as it is.
 *
 * `currentClass` is a free-text column and both shapes are in the data. Prefixing unconditionally
 * produced "Grade Class VIII" for the roman-numeral schools, which is how you can tell a label was
 * never looked at on real rows.
 */
function gradeLabel(currentClass) {
  const raw = String(currentClass ?? '').trim();
  if (!raw) return '';
  return /^\d+$/.test(raw) ? `Grade ${raw}` : raw;
}

/**
 * The careers line: the structured preferences by priority, else the free-text field.
 *
 * `topicName` is the career — `CareerPreferenceService` names the cascade curriculum = stream,
 * chapter = major, topic = career, and its own validation messages say so. `priority` is 1-3 and
 * carries a unique constraint per student, so sorting on it is stable.
 */
function careersLabel(preferences, profile) {
  const list = Array.isArray(preferences) ? preferences : [];
  const names = [...list]
    .sort((a, b) => (a?.priority || 0) - (b?.priority || 0))
    .map((p) => p?.topicName)
    .filter(Boolean);
  if (names.length) return names.join(', ');
  return String(profile?.careerExplore || '').trim();
}

export default function StudentHome() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslations(STRINGS);

  const [profile, setProfile] = useState(null);
  const [careers, setCareers] = useState([]);
  const [entitlements, setEntitlements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [progress, setProgress] = useState({ rows: [], loading: true });

  /** Wave 1 — the identity block. Nothing here may be allowed to reject. */
  const load = useCallback(async () => {
    const [profileRes, careerRes, entRes] = await Promise.allSettled([
      fetchStudentProfile(),
      fetchCareerPreferences(),
      fetchEntitlements(),
    ]);

    setProfile(profileRes.status === 'fulfilled' ? profileRes.value : null);
    setCareers(careerRes.status === 'fulfilled' ? careerRes.value : []);
    setEntitlements(entRes.status === 'fulfilled' ? entRes.value : null);

    setLoading(false);
    setRefreshing(false);
  }, []);

  /** Wave 2 — the progress bars. Runs alongside, never gates the paint. */
  const loadProgress = useCallback(async () => {
    setProgress((p) => ({ ...p, loading: true }));
    const { analytics, parts } = await loadWelcomeProgress();
    setProgress({ rows: sectionRows(analytics, parts), loading: false });
  }, []);

  useEffect(() => {
    load();
    loadProgress();
  }, [load, loadProgress]);

  const badge = planBadge(entitlements);
  // Rendered under the photo. Unlike `badge.label` this is never null — see planName's javadoc.
  const plan = planName(entitlements);
  const name = profile?.fullName || profile?.name || profile?.email || 'Student';

  const openProfileTab = (rowKey) =>
    router.push({
      pathname: '/student/profile',
      params: { tab: rowKey === 'careers' ? 'career' : 'personal' },
    });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <BrandBar strings={t} changePasswordRoute="/student/change-password" />

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            // Clear the footer, which is absolutely positioned by the layout and would otherwise
            // sit on top of the search bar.
            { paddingBottom: TAB_BAR_HEIGHT + (insets.bottom || SPACING.sm) + SPACING.md },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
                loadProgress();
              }}
              tintColor={palette.primary}
              colors={[palette.primary]}
            />
          }
        >
          <IdentityCard
            strings={t}
            name={name}
            photoUrl={profile?.profilePicture}
            rows={[
              { key: 'name', icon: 'person-outline', label: t.rowName, value: name, tint: 'violet' },
              {
                key: 'grade',
                icon: 'school-outline',
                label: t.rowGrade,
                value: gradeLabel(profile?.currentClass),
                tint: 'blue',
              },
              {
                key: 'stream',
                icon: 'book-outline',
                label: t.rowStream,
                value: profile?.stream,
                tint: 'green',
              },
              {
                key: 'careers',
                icon: 'locate-outline',
                label: t.rowCareers,
                value: careersLabel(careers, profile),
                tint: 'amber',
              },
            ]}
            badge={badge}
            planName={plan}
            onPressPhoto={() => router.push('/student/profile')}
            onPressRow={openProfileTab}
            onPressBadge={() =>
              router.push({
                pathname: '/student/feature',
                params: { path: '/student/platform/plans', title: 'My Plan' },
              })
            }
          />

          <HeroCard
            title={t.workspaceTitle}
            subtitle={t.workspaceBody}
            icon="briefcase"
            colors={GRADIENT.violet}
            onPress={() => router.push('/student/workspace')}
          />

          <HeroCard
            title={t.analyticsTitle}
            subtitle={t.analyticsBody}
            icon="stats-chart"
            colors={GRADIENT.blue}
            onPress={() => router.push('/student/analytics')}
          >
            <ProgressStrip
              rows={progress.rows}
              loading={progress.loading}
              emptyLabel={t.progressEmpty}
            />
          </HeroCard>

          <SectionDivider label={t.haveDoubt} />

          <View style={styles.assistants}>
            <AssistantCard
              name="Jyora"
              role={t.jyoraRole}
              blurb={t.jyoraBlurb}
              cta={t.jyoraCta}
              avatar={JYORA_AVATAR}
              accent={JYORA_ACCENT}
              onPress={() => router.push('/student/jyora')}
            />
            <AssistantCard
              name="Shreya"
              role={t.shreyaRole}
              blurb={t.shreyaBlurb}
              cta={t.shreyaCta}
              avatar={SHREYA_AVATAR}
              accent={SHREYA_ACCENT}
              // `chat=1` opens the counsellor screen with its Shreya sheet already up, so the card
              // delivers the conversation it promises rather than another menu.
              onPress={() => router.push({ pathname: '/student/counselor', params: { chat: '1' } })}
            />
          </View>

          <SearchEntry
            placeholder={t.searchPlaceholder}
            buttonLabel={t.searchButton}
            onSearch={(q) => router.push({ pathname: '/student/search', params: { q } })}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeStyles(() => ({
  // Transparent: app/student/_layout.js paints the fixed background behind the whole navigator.
  safe: { flex: 1, backgroundColor: 'transparent' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SPACING.md },
  assistants: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
}));
