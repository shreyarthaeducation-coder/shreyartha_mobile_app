import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, GRADIENT, SLATE, SPACING, TOUCH, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { useTranslations } from '../../hooks/useTranslations';
import { STAFF_PHOTO_KEY } from '../../constants/storageKeys';
import BrandBar from '../shared/home/BrandBar';
import IdentityCard from '../shared/home/IdentityCard';
import HeroCard from '../shared/home/HeroCard';
import SectionDivider from '../shared/home/SectionDivider';
import AssistantCard from '../shared/home/AssistantCard';
import SearchEntry from '../shared/home/SearchEntry';
import { TAB_BAR_HEIGHT } from '../shared/home/PortalTabBar';
import ShreyaChatSheet from '../staff/ShreyaChatSheet';
import useStaffLogout from '../../hooks/useStaffLogout';
import {
  loadTeacherIdentity,
  photoOf,
  schoolLabel,
  subjectsTaught,
  teacherIdOf,
} from '../../services/teacher/dashboardService';
import { defaultAcademicYear, fetchAcademicYears } from '../../services/teacher/scopeService';

/**
 * The teacher dashboard.
 *
 * ── WHY THIS IS ITS OWN SCREEN ──────────────────────────────────────────────
 * The teacher home used to be `components/staff/StaffMenuScreen` with a config. That component also
 * renders the Principal (eighteen items, including Fee Management), the Vice-Principal, both
 * Counsellor portals and Shreyartha Admin — five menus that do not map onto Workspace / Attendance /
 * Analytics at all. Redesigning it in place would have invented a grouping for five roles nobody
 * asked about, so the teacher gets its own screen and the shared shell keeps serving the rest
 * untouched.
 *
 * ── THREE BEHAVIOURS THAT LIVED ONLY IN THAT SHELL ──────────────────────────
 * None of these is in `app/teacher/_layout.js`, and all three fail SILENTLY if you route around the
 * old shell — which is the whole risk of this change:
 *
 *   1. THE VERIFICATION GATE. The layout reads `verified` into state and never redirects on it.
 *      `/api/teacher/profile` is the ONLY endpoint on the entire teacher surface that admits
 *      `UNVERIFIED_TEACHER` — so a pending teacher can load this card while every destination 403s.
 *      Without the redirect they get a working-looking dashboard where nothing opens.
 *   2. THE HR PHOTO CACHE. `STAFF_PHOTO_KEY` is written here so the next cold start paints a face
 *      instead of initials. It is in `ALL_AUTH_KEYS`, which is what stops one staff member's photo
 *      appearing under the next one's name on a shared device.
 *   3. THE ANDROID BACK OVERRIDE. Back from the home screen exits to the landing tabs with the
 *      session intact, rather than popping to the login screen.
 *
 * ── SHREYA IS A CARD NOW, NOT THE FAB ───────────────────────────────────────
 * `config.chatbot` mounted `ShreyaLauncher` on this screen and no other, so the card has identical
 * reach. `ShreyaChatSheet` and `ShreyaLauncher` are untouched — `checkparent.mjs` pins both, and the
 * launcher still serves the Shreyartha Teacher portal.
 */

const STRINGS = {
  changePassword: 'Change Password',
  personalDetails: 'Personal Details',
  rowName: 'Teacher Name',
  rowEmail: 'Email ID',
  rowSubject: 'Subject I Teach',
  rowSchool: 'School',
  rowTeacherId: 'Teacher ID',
  notSet: 'Not set',

  workspaceTitle: 'My Workspace',
  // NOT the design's "lesson plans" — `TeacherResource.resourceType` is exactly HOMEWORK | RESOURCE
  // and there is no lesson-plan concept anywhere in the backend.
  workspaceBody: 'Teaching resources, homework, assessments and more.',
  attendanceTitle: 'My Attendance',
  attendanceBody: 'View and manage your attendance, leave and payroll.',
  analyticsTitle: 'My Students Analytics',
  analyticsBody: 'Track student performance, progress and insights.',

  forSupport: 'For Support',
  shreyaRole: 'AI Support',
  shreyaBlurb: 'Get instant help, answers to your queries and 24/7 support.',
  shreyaCta: 'Chat with Shreya',
  liveName: 'Live Classes',
  liveRole: 'Google Meet',
  liveBlurb: 'Schedule a session for a class, or join the one starting next.',
  liveCta: 'Open Live Classes',
  searchPlaceholder: 'Search resources, tools, students and more…',
  searchButton: 'Search',
  logOut: 'Log Out',
};

const SHREYA_AVATAR = require('../../assets/images/Chatbot.png');

// Shreya's own blue, matched to the website and to every other AI surface in the app. Not the
// portal palette — she is a guest, not a section.
const SHREYA_ACCENT = '#2196f3';

export default function TeacherHomeScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslations(STRINGS);
  // Fires the staff attendance end-ping BEFORE clearing the keys — that ordering is not incidental,
  // the ping is authenticated. See hooks/useStaffLogout.js.
  const { confirmLogout } = useStaffLogout();

  const [identity, setIdentity] = useState({ profile: null, hr: null });
  const [stored, setStored] = useState({ name: 'Teacher', email: '', code: '' });
  const [yearId, setYearId] = useState(null);
  // null = unknown, so the dashboard never flashes before the gate resolves.
  const [verified, setVerified] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const load = useCallback(async () => {
    let session = {};
    try {
      const entries = await AsyncStorage.multiGet([
        'schoolUserName',
        'schoolUserEmail',
        'schoolCode',
        'schoolUserVerified',
        STAFF_PHOTO_KEY,
      ]);
      session = Object.fromEntries(entries);
    } catch {
      // Storage failure only costs the first-frame fallbacks below.
    }
    setStored({
      name: session.schoolUserName || 'Teacher',
      email: session.schoolUserEmail || '',
      code: session.schoolCode || '',
      photo: session[STAFF_PHOTO_KEY] || null,
    });

    const storedVerified =
      session.schoolUserVerified === 'true' || session.schoolUserVerified === '1';

    const next = await loadTeacherIdentity();
    setIdentity(next);

    // (1) THE GATE. Live flag wins; the stored one is the fallback for a failed read.
    const liveVerified = next.profile?.verified != null ? !!next.profile.verified : storedVerified;
    setVerified(liveVerified);

    // Write the live answer back: `schoolUserVerified` is otherwise only ever set at login, and the
    // layout now gates all 25 teacher routes on that stored flag.
    //
    // This matters in the REVOCATION direction. If an admin un-verifies a teacher mid-session, the
    // live profile says so, this persists it, and the layout locks the whole group on the next
    // navigation instead of trusting a stale 'true' until logout.
    //
    // It cannot help in the other direction, and is not meant to: a teacher verified while sitting
    // on the pending screen is redirected away from this screen before it can mount, so the flag
    // never refreshes. That is the existing designed flow — `StaffPendingScreen` says outright
    // "Log in again once your administrator has verified your account", and it has no refresh
    // action on purpose because `verified` only comes back on a fresh login response.
    if (liveVerified !== storedVerified) {
      AsyncStorage.setItem('schoolUserVerified', String(liveVerified)).catch(() => {});
    }

    // (2) THE PHOTO CACHE, refreshed for the next cold start.
    const url = photoOf(next.hr);
    if (url) {
      AsyncStorage.setItem(STAFF_PHOTO_KEY, url).catch(() => {});
    }

    // The academic year, purely so the subject row can drop last year's assignments. Guarded on its
    // own: without it the subjects are shown unfiltered, which is better than showing none.
    try {
      const years = await fetchAcademicYears();
      setYearId(defaultAcademicYear(years)?.id ?? null);
    } catch {
      setYearId(null);
    }

    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // (3) THE ANDROID BACK OVERRIDE — exits to the landing tabs, session alive.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        router.replace('/(tabs)');
        return true;
      });
      return () => sub.remove();
    }, [router]),
  );

  if (verified === null) return <View style={styles.blank} />;
  if (verified === false) return <Redirect href="/teacher/pending-verification" />;

  const { profile, hr } = identity;
  const name = profile?.fullName || stored.name;
  const teacherId = teacherIdOf(hr);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <BrandBar strings={t} changePasswordRoute="/teacher/change-password" tone="light" />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
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
            }}
            tintColor={palette.primary}
            colors={[palette.primary]}
          />
        }
      >
        <IdentityCard
          tone="light"
          strings={t}
          title={t.personalDetails}
          name={name}
          // The photo lives on the HR employee profile, never on TeacherProfileResponse — whose
          // `schoolLogo` is the school's crest, not the person. Falls back to what the last session
          // cached, then to initials.
          photoUrl={photoOf(hr) || stored.photo}
          rows={[
            { key: 'name', icon: 'person-outline', label: t.rowName, value: name, tint: 'violet' },
            {
              key: 'email',
              icon: 'mail-outline',
              label: t.rowEmail,
              value: profile?.email || stored.email,
              tint: 'blue',
            },
            {
              key: 'subject',
              icon: 'book-outline',
              label: t.rowSubject,
              // Distinct AND year-filtered — see subjectsTaught. Raw, this row reads
              // "Mathematics, Mathematics, Mathematics" for a teacher with three sections.
              value: subjectsTaught(profile, yearId),
              tint: 'green',
            },
            {
              key: 'school',
              icon: 'business-outline',
              label: t.rowSchool,
              value: schoolLabel(profile, stored.code),
              tint: 'amber',
            },
            {
              key: 'teacherId',
              icon: 'card-outline',
              label: t.rowTeacherId,
              // Real values read SHREYA01-EMP-0007, not TCH10245 — the design's format does not
              // exist. Null when an admin has not assigned one.
              value: teacherId,
              tint: 'violet',
            },
          ]}
        />

        <HeroCard
          title={t.workspaceTitle}
          subtitle={t.workspaceBody}
          icon="briefcase"
          colors={GRADIENT.violet}
          onPress={() => router.push('/teacher/workspace')}
        />

        <HeroCard
          title={t.attendanceTitle}
          subtitle={t.attendanceBody}
          icon="calendar"
          colors={GRADIENT.blue}
          onPress={() => router.push('/teacher/my-attendance')}
        />

        <HeroCard
          title={t.analyticsTitle}
          subtitle={t.analyticsBody}
          icon="stats-chart"
          colors={GRADIENT.teal}
          onPress={() => router.push('/teacher/student-analytics')}
        />

        <SectionDivider label={t.forSupport} tone="light" />

        {/* A PAIR, NOT ONE WIDE CARD. Shreya used to be `layout="row"` across the full width; Live
            Classes now sits beside her, so both switch to the column shape the pair layout was
            written for — equal `flex: 1`, a three-line blurb floor, CTAs pinned level.

            Live Classes takes the PORTAL palette while Shreya keeps her own blue: she is a guest
            with an identity of her own across every panel, and this is a section of the teacher's
            own panel. The route already exists — /teacher/live-classes, also reachable from My
            Workspace — so this is a second door, not a second screen. */}
        <View style={styles.supportPair}>
          <AssistantCard
            tone="light"
            name="Shreya"
            role={t.shreyaRole}
            blurb={t.shreyaBlurb}
            cta={t.shreyaCta}
            avatar={SHREYA_AVATAR}
            accent={SHREYA_ACCENT}
            onPress={() => setChatOpen(true)}
          />

          <AssistantCard
            tone="light"
            name={t.liveName}
            role={t.liveRole}
            blurb={t.liveBlurb}
            cta={t.liveCta}
            icon="videocam"
            accent={palette.primary}
            onPress={() => router.push('/teacher/live-classes')}
          />
        </View>

        <SearchEntry
          tone="light"
          placeholder={t.searchPlaceholder}
          buttonLabel={t.searchButton}
          onSearch={(q) => router.push({ pathname: '/teacher/search', params: { q } })}
        />

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Ionicons name="log-out-outline" size={18} color={FEEDBACK.errorText} />
          <Text style={styles.logoutText}>{t.logOut}</Text>
        </Pressable>
      </ScrollView>

      {/* Mounted only while open, and structurally below the pending-verification redirect above —
          so an unverified teacher can never reach the chat. */}
      {chatOpen ? (
        <ShreyaChatSheet visible onClose={() => setChatOpen(false)} basePath="/teacher" />
      ) : null}
    </SafeAreaView>
  );
}

const useStyles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: SLATE[50] },
  blank: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { padding: SPACING.md },

  // `alignItems: 'stretch'` is what makes the two cards equal height — without it each sizes to its
  // own content and the shorter one's CTA floats mid-card, which is the exact failure the column
  // layout's blurb floor exists to prevent.
  supportPair: { flexDirection: 'row', alignItems: 'stretch', gap: SPACING.sm },

  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    borderRadius: 14,
    backgroundColor: FEEDBACK.errorBg,
    borderWidth: 1,
    borderColor: FEEDBACK.errorBorder,
    marginTop: SPACING.md,
  },
  logoutText: { fontSize: TYPE.heading, fontWeight: '700', color: FEEDBACK.errorText },

  pressed: { opacity: 0.8 },
}));
