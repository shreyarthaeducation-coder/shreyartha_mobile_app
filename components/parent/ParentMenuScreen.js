import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TOUCH, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { useTranslations } from '../../hooks/useTranslations';
import BrandBar from '../shared/home/BrandBar';
import IdentityCard from '../shared/home/IdentityCard';
import AssistantCard from '../shared/home/AssistantCard';
import SectionDivider from '../shared/home/SectionDivider';
import SearchEntry from '../shared/home/SearchEntry';
import QuickActions from './home/QuickActions';
import ChildReportCard from './home/ChildReportCard';
import { PARENT_MENU } from '../../constants/parentMenu';
import { fetchLinkedStudent } from '../../services/parent/dashboardService';
import { loadReportFigures, reportStats } from '../../services/parent/reportCardService';
import { defaultAcademicYear } from '../../services/parent/feeService';
import usePortalLogout from '../../hooks/usePortalLogout';
import ShreyaChatSheet from '../staff/ShreyaChatSheet';
import { PARENT_CHATBOT_CONFIG } from '../../constants/parentChatbotConfig';

/**
 * The parent dashboard.
 *
 * ── WHAT CHANGED ────────────────────────────────────────────────────────────
 * This was a sticky purple header band over a flat 2×4 grid — everything the portal offers, at the
 * same weight, with no sense of what it is about. The redesign puts the child at the centre: who
 * they are, four quick actions, a report card, one assistant, and a way to search.
 *
 * It stays LIGHT. Unlike the student panel there is no photographic background here and
 * `PORTALS.parent` carries no dark tokens, so every shared component is mounted `tone="light"` and
 * the eleven existing parent sub-screens keep matching the new home.
 *
 * ── NO FOOTER, AND THAT IS THE DECISION ─────────────────────────────────────
 * The design draws Home / Support / Profile tabs. The parent panel has none today and gains none:
 * a Profile tab would show the identity card that is already at the top of this screen, and a
 * Support tab would open the Shreya sheet that is already a card on it. The student's three tabs
 * stay, because its Profile is eight editable tabs and its Support is counsellor booking.
 *
 * Log Out therefore lives at the foot of this screen — the design's header has no room and there is
 * no fourth tab slot. `confirmLogout`, never bare `logout`: the bare call empties storage without
 * navigating, and this layout reads its token once on mount, so the parent would sit on a fully
 * rendered signed-out dashboard until some unrelated request happened to 401.
 *
 * ── THE EIGHT TILES SURVIVE ─────────────────────────────────────────────────
 * The design's four quick actions plus three drill rows come to seven entry points, and this portal
 * has eight sections. Building it literally would delete access to Assessment Results, Counselor
 * Notes, Counsellor Report, Attendance and Schedule. `PARENT_MENU` is therefore rendered intact as
 * a compact "All sections" grid lower down — which also keeps `checkparent.mjs` §1 and §2 honest,
 * since they assert the menu mirrors the web sidebar key-for-key and in order.
 *
 * ── THE ASSISTANT IS A CARD, NOT THE FLOATING LAUNCHER ──────────────────────
 * `ShreyaLauncher` used to be mounted here as a FAB. It was only ever on this one screen, so the
 * card has identical reach and matches the design. The sheet it opens is unchanged, and it is still
 * mounted BELOW the verification redirect so an unverified parent cannot reach the chat.
 */

const STRINGS = {
  changePassword: 'Change Password',
  dashTitle: 'Parent Dashboard',
  dashSubtitle: "Welcome! Here's an overview of your child's progress.",
  rowParentName: 'Parent Name',
  rowEmail: 'Email ID',
  rowStudentName: 'Student Name',
  rowGrade: 'Grade',
  rowStream: 'Stream',
  rowSchool: 'School',
  notSet: 'Not set',

  payFees: 'Pay Fees',
  payFeesBody: 'Secure and quick fee payments',
  history: 'Payment History',
  historyBody: 'View all your transactions',
  notifications: 'Notifications',
  notificationsBody: 'Stay updated with important alerts',
  reports: 'Download Reports',
  reportsBody: 'Student reports & documents',

  reportTitle: "My Child's Report",
  statOverall: 'Overall',
  statAttendance: 'Attendance',
  statHomework: 'Homework',
  statPsychometric: 'Psychometric',
  thisMonth: 'This month',
  setSoFar: 'Set so far',
  completed: 'Completed',
  academic: 'Academic Performance',
  academicBody: 'Syllabus, progress and insights',
  skills: 'Skill Development',
  skillsBody: 'Track skills & competencies',
  recommendations: 'Recommendations',
  recommendationsBody: 'Personalised suggestions for improvement',
  viewAnalytics: 'View Detailed Analytics',

  allSections: 'All sections',
  forSupport: 'For Support',
  shreyaRole: 'AI Support',
  shreyaBlurb: 'Get instant help, answers to your queries and 24/7 support.',
  shreyaCta: 'Chat with Shreya',
  searchPlaceholder: 'Search to explore resources, updates, announcements and more…',
  searchButton: 'Search',
  logOut: 'Log Out',
};

const SHREYA_AVATAR = require('../../assets/images/Chatbot.png');

// Shreya's own blue, matched to the website and to every AI surface elsewhere in the app. Not the
// parent purple — she is a guest, not a section. Same reasoning as the student dashboard's pair.
const SHREYA_ACCENT = '#2196f3';

/** "Class 10" from a bare "10", but an already-worded class left exactly as it is. */
function gradeLabel(currentClass) {
  const raw = String(currentClass ?? '').trim();
  if (!raw) return '';
  return /^\d+$/.test(raw) ? `Grade ${raw}` : raw;
}

export default function ParentMenuScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const t = useTranslations(STRINGS);
  const { confirmLogout } = usePortalLogout({ loginRoute: '/auth/parent-login' });

  const [student, setStudent] = useState(null);
  const [parent, setParent] = useState({ name: 'Parent', email: '' });
  // null = unknown, so the dashboard never flashes before the gate resolves.
  const [verified, setVerified] = useState(null);
  const [figures, setFigures] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const load = useCallback(async () => {
    // Only written when the server gave a definite answer and it differs from what is stored, so a
    // flaky network never rewrites the flag and a steady state never writes at all.
    const persistVerified = (next, current) => {
      if (next !== current) {
        AsyncStorage.setItem('parentUserVerified', String(next)).catch(() => {});
      }
    };

    let stored = {};
    try {
      const entries = await AsyncStorage.multiGet([
        'parentUserName',
        'parentUserEmail',
        'parentUserVerified',
        'linkedStudentName',
      ]);
      stored = Object.fromEntries(entries);
    } catch {
      // Storage failure only costs the fallbacks below.
    }
    // The parent's own identity has NO endpoint — `ParentUserResponse` is returned by the login and
    // nowhere else, so storage is the only source. See app/auth/parent-login.js.
    setParent({ name: stored.parentUserName || 'Parent', email: stored.parentUserEmail || '' });

    // ── VERIFICATION: THE SIGNAL IS THE STATUS CODE, NOT THE FIELD ────────────
    // `LinkedStudentResponse.parentVerified` looks like the live flag and is not one:
    // `ParentDashboardService` hardcodes `response.setParentVerified(true)` — the single occurrence
    // in the backend — and throws `SecurityException` → **403** before reaching it when the account
    // is unverified. So the field can only ever say `true`, and a call that RETURNS AT ALL already
    // proves the parent is verified. Reading the field decided nothing; the 403 decides everything.
    const storedVerified =
      stored.parentUserVerified === 'true' || stored.parentUserVerified === '1';
    try {
      const child = await fetchLinkedStudent();
      setStudent(child);
      setVerified(true);
      persistVerified(true, storedVerified);
    } catch (e) {
      setStudent(stored.linkedStudentName ? { fullName: stored.linkedStudentName } : null);
      if (e?.isForbidden) {
        // A definite answer from the server: not verified. Persist it, so the layout's gate — which
        // reads the stored flag and covers all thirteen routes — stops trusting a stale 'true'.
        setVerified(false);
        persistVerified(false, storedVerified);
      } else {
        // A network failure says nothing about verification. Fall back to what login stored rather
        // than locking someone out over a flaky connection, and write nothing.
        setVerified(storedVerified);
      }
    }

    // Independently guarded, and deliberately not inside the try above: these three endpoints can
    // each fail for an unlinked child, which is a normal state — none of them may take the
    // verification gate or the rest of the dashboard down.
    try {
      setFigures(await loadReportFigures());
    } catch {
      setFigures(null);
    }

    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Back from the home screen exits to the landing tabs rather than the login screen — the session
  // stays alive. Same contract as the staff and student shells.
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

  const openItem = (item) => {
    if (item.native) {
      router.push(item.native);
      return;
    }
    router.push({
      pathname: '/parent/feature',
      params: { label: item.label, path: item.path },
    });
  };

  if (verified === null) return <View style={styles.blank} />;
  if (verified === false) return <Redirect href="/parent/pending-verification" />;

  const QUICK_ACTIONS = [
    {
      key: 'fees',
      label: t.payFees,
      description: t.payFeesBody,
      icon: 'wallet-outline',
      tint: 'green',
      color: '#059669',
      route: '/parent/fees',
    },
    {
      key: 'history',
      label: t.history,
      description: t.historyBody,
      icon: 'document-text-outline',
      tint: 'blue',
      color: '#2563eb',
      route: '/parent/fees?tab=history',
    },
    // No parent notifications endpoint exists — `/api/students/notifications` is student-role only
    // and a parent JWT gets a 403. See components/shared/ComingSoon.js.
    {
      key: 'notifications',
      label: t.notifications,
      description: t.notificationsBody,
      icon: 'notifications-outline',
      tint: 'amber',
      color: '#d97706',
      soon: true,
    },
    // Zero file or PDF endpoints exist for a parent anywhere in the backend.
    //
    // Written without a path wildcard on purpose. A slash-star sequence inside a LINE comment opens
    // a block comment as far as every comment-stripping tool in scripts/ is concerned, and the
    // earlier wording of this note silently ate all the JSX below it — the Shreya card included —
    // so checkparent reported a component that was plainly there as missing.
    {
      key: 'reports',
      label: t.reports,
      description: t.reportsBody,
      icon: 'download-outline',
      tint: 'violet',
      color: palette.primary,
      soon: true,
    },
  ];

  const REPORT_ROWS = [
    {
      key: 'academic',
      label: t.academic,
      // NOT the design's "Subject-wise marks & insights". Real exam marks live behind
      // /api/school-admin/reports and /api/teacher/reports and are unreachable by a parent —
      // promising marks would be a promise this screen cannot keep.
      description: t.academicBody,
      icon: 'bar-chart-outline',
      route: '/parent/academic-progress',
    },
    {
      key: 'skills',
      label: t.skills,
      description: t.skillsBody,
      icon: 'ribbon-outline',
      route: '/parent/academic-progress',
    },
    {
      // The design calls this "Recommendations" and no such endpoint exists — but personalised
      // resources genuinely ARE teacher-assigned suggestions for improvement, each carrying a
      // `learningGapLevel`. Backed by real data rather than marked coming soon.
      key: 'recommendations',
      label: t.recommendations,
      description: t.recommendationsBody,
      icon: 'locate-outline',
      route: '/parent/learning-activities?tab=personalisedResources',
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <BrandBar strings={t} changePasswordRoute="/parent/change-password" tone="light" />

      <ScrollView
        contentContainerStyle={styles.scroll}
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
          title={t.dashTitle}
          subtitle={t.dashSubtitle}
          name={parent.name}
          // A parent has NO photo field in the backend — no column on `ParentUser`, no upload
          // endpoint. Initials are the only case here, not a fallback. The child's real photo
          // belongs to the report card below.
          rows={[
            { key: 'parentName', icon: 'person-outline', label: t.rowParentName, value: parent.name, tint: 'violet' },
            { key: 'email', icon: 'mail-outline', label: t.rowEmail, value: parent.email, tint: 'blue' },
            { key: 'studentName', icon: 'people-outline', label: t.rowStudentName, value: student?.fullName, tint: 'green' },
            { key: 'grade', icon: 'school-outline', label: t.rowGrade, value: gradeLabel(student?.currentClass), tint: 'amber' },
            { key: 'stream', icon: 'book-outline', label: t.rowStream, value: student?.stream || student?.section, tint: 'blue' },
            { key: 'school', icon: 'business-outline', label: t.rowSchool, value: student?.schoolName, tint: 'violet' },
          ]}
        />

        <QuickActions actions={QUICK_ACTIONS} onPress={(a) => router.push(a.route)} />

        <ChildReportCard
          strings={t}
          childName={student?.fullName}
          childPhoto={student?.profilePicture}
          academicYear={defaultAcademicYear()}
          stats={reportStats(figures, t)}
          rows={REPORT_ROWS}
          onOpenRow={(row) => router.push(row.route)}
          onOpenAnalytics={() => router.push('/parent/academic-progress')}
        />

        <Text style={styles.sectionTitle}>{t.allSections}</Text>
        <View style={styles.grid}>
          {PARENT_MENU.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => openItem(item)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.tileIcon}>
                <Ionicons name={item.icon} size={19} color={palette.primaryDark} />
              </View>
              <Text style={styles.tileLabel} numberOfLines={2}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <SectionDivider label={t.forSupport} tone="light" />

        <AssistantCard
          tone="light"
          layout="row"
          name="Shreya"
          role={t.shreyaRole}
          blurb={t.shreyaBlurb}
          cta={t.shreyaCta}
          avatar={SHREYA_AVATAR}
          accent={SHREYA_ACCENT}
          onPress={() => setChatOpen(true)}
        />

        <SearchEntry
          tone="light"
          placeholder={t.searchPlaceholder}
          buttonLabel={t.searchButton}
          onSearch={(q) => router.push({ pathname: '/parent/search', params: { q } })}
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

      {/* Mounted only while open, and structurally below the `pending-verification` redirect above,
          so an unverified parent can never reach the chat. */}
      {chatOpen ? (
        <ShreyaChatSheet
          visible
          onClose={() => setChatOpen(false)}
          basePath="/parent"
          config={PARENT_CHATBOT_CONFIG}
        />
      ) : null}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((p) => ({
  safe: { flex: 1, backgroundColor: p.pageBg },
  blank: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },

  sectionTitle: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: SLATE[500],
    marginBottom: SPACING.sm,
  },

  // `space-between` for the horizontal gutter, `rowGap` for the vertical one — never `gap` with a
  // 48% width, which overflows and drops the grid to one tile per row.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tile: {
    width: '48.5%',
    minHeight: TOUCH.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 5,
    elevation: 1,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  tileLabel: { flex: 1, fontSize: TYPE.label, fontWeight: '600', color: SLATE[700] },

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
