import { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { useTranslations } from '../../../hooks/useTranslations';
import { STAFF_PHOTO_KEY } from '../../../constants/storageKeys';
import BrandBar from '../../shared/home/BrandBar';
import IdentityCard from '../../shared/home/IdentityCard';
import ProfileHeaderCard from '../../shared/home/ProfileHeaderCard';
import QuickActionGrid from '../../shared/home/QuickActionGrid';
import MetricRow from '../../shared/home/MetricRow';
import TodayList from '../../shared/home/TodayList';
import HeroCard from '../../shared/home/HeroCard';
import SearchEntry from '../../shared/home/SearchEntry';
import SectionDivider from '../../shared/home/SectionDivider';
import AssistantCard from '../../shared/home/AssistantCard';
import ShreyaChatSheet from '../ShreyaChatSheet';
import { shreyaConfigFor } from './shreyaConfigs';
import { TAB_BAR_HEIGHT } from '../../shared/home/PortalTabBar';
import StaffBanner from './StaffBanner';
import { resolveStaffMenus } from '../../../constants/staffRoles';
import { getStaffHome, heroRoute, itemsFor } from '../../../constants/staffHome';
import {
  classesSupported,
  designationOf,
  joinedOn,
  loadSchoolsCovered,
  liveVerified,
  loadStaffIdentity,
  photoOf,
  schoolLabel,
  schoolLogoOf,
  staffIdOf,
  uploadStaffPhoto,
} from '../../../services/staff/identityService';
import useSchoolLogo from '../../../hooks/useSchoolLogo';
import { fetchUnreadCount } from '../../../services/staff/notificationService';
import {
  fetchTodaySessions,
  fetchTodaySummary,
  sessionRow,
} from '../../../services/staff/counsellorSummaryService';
import { loadSalesMetrics } from '../../../services/sales/salesMetrics';
import { fetchDashboardStats } from '../../../services/admin/overviewService';
import { formatRupees } from '../../../utils/currency';
import { pickPhoto } from '../../../utils/filePicker';

/**
 * The redesigned staff dashboard — ONE screen for every role with a `constants/staffHome.js` entry.
 *
 * ── WHY ONE SCREEN AND NOT FOUR ─────────────────────────────────────────────
 * The teacher forked its own home because `StaffMenuScreen` served seven configs and the teacher's
 * grouping mapped onto none of them. That reasoning does not repeat here: after this redesign all
 * four panels have the SAME shape — three heroes, an assistant pair, a footer — and differ only in
 * data. The differences live in the descriptor; the behaviour lives here, once.
 *
 * `StaffMenuScreen` is untouched and still serves Principal and Shreyartha Admin. A role without a
 * descriptor never reaches this file — see app/staff/[role]/index.js.
 *
 * ── THE THREE BEHAVIOURS THAT MUST NOT BE LOST ──────────────────────────────
 * Moving a role off `StaffMenuScreen` means moving these with it. Each has a silent failure mode:
 *
 *   1. THE VERIFICATION GATE, including its `verified === null` blank frame. Without the null state
 *      the dashboard renders for an instant and then redirects, which reads as a crash.
 *   2. THE HR PHOTO CACHE WRITE — and this one has a downstream dependant. StaffProfileScreen READS
 *      `STAFF_PHOTO_KEY` rather than fetching, precisely because the home screen fills it. Drop the
 *      write and every staff profile page silently falls back to initials, with no error anywhere.
 *   3. THE ANDROID BACK OVERRIDE — back exits to the landing tabs with the session intact, instead
 *      of popping to the login screen.
 *
 * Two things this screen must NOT do, because the layout already does them:
 *   · the route guard and the group-wide verification redirect (app/staff/[role]/_layout.js)
 *   · the shreyartha_teacher `/api/shreya01/setup` ping, which lives in the layout as a raw fetch
 *     on purpose so it can never end a session. Re-firing it here would double it per navigation.
 */

const SHREYA_AVATAR = require('../../../assets/images/Chatbot.png');

// Shreya's own blue, matched to the website and every other AI surface in the app. Deliberately not
// the portal palette — she is a guest with one identity across every panel.
const SHREYA_ACCENT = '#2196f3';

const STRINGS = {
  changePassword: 'Change Password',
  personalDetails: 'Personal Details',
  rowName: 'Name',
  rowEmail: 'Email ID',
  rowRole: 'Designation',
  rowSchool: 'School',
  rowStaffId: 'Staff ID',
  notSet: 'Not set',
  forSupport: 'For Support',
  shreyaRole: 'AI Support',
  shreyaBlurb: 'Get instant help, answers to your queries and 24/7 support.',
  shreyaCta: 'Chat with Shreya',
  pairRole: 'Google Meet',
  pairBlurb: 'Schedule a session for a class, or join the one starting next.',
  pairCta: 'Open Live Classes',
  searchPlaceholder: 'Search sections, classes and more…',
  searchButton: 'Search',
};

/** Row-3 icons by source. A descriptor may override with its own `identityRow3.icon`. */
const ROW3_ICON = {
  assignedClasses: 'people-outline',
  schools: 'business-outline',
  designation: 'ribbon-outline',
};

export default function StaffHomeScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslations(STRINGS);

  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const config = resolveStaffMenus(roleKey);
  const home = getStaffHome(roleKey);

  const [identity, setIdentity] = useState({ profile: null, hr: null });
  const [stored, setStored] = useState({ name: '', email: '', code: '', photo: null });
  // null = unknown, so the dashboard never flashes before the gate resolves.
  const [verified, setVerified] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // Only ever non-empty for a role whose identityRow3 declares `source: 'schools'` — one role.
  const [schools, setSchools] = useState('');

  // ── THE THREE BLOCKS THE REDESIGNED PANELS ADD ────────────────────────────
  // All three are decoration on top of a dashboard that already works, so each loads independently
  // and each renders NOTHING when it has no data. None of them may delay or fail the verification
  // gate, which is why they are fired after it and never awaited alongside it.
  const [unread, setUnread] = useState(0);
  const [metrics, setMetrics] = useState(null);
  const [today, setToday] = useState([]);
  const [uploading, setUploading] = useState(false);

  // The principal's school identity, which does NOT come from a profile DTO — see below.
  const [adminSchool, setAdminSchool] = useState(null);

  // Called HERE, above the verification early-returns below, because it is a hook — reading it off
  // the destructured `profile` further down would put a hook after a conditional return.
  //
  // Two sources, declared per role in constants/staffRoles.js. The principal has
  // `profileEndpoints: []`, so `schoolLogoOf(identity.profile)` is structurally always null for it
  // — that role was rendering the prop while the value could never be anything but null. Its crest
  // comes from the school-admin dashboard stats instead, fetched in `load()`.
  const schoolLogo = useSchoolLogo(
    config?.schoolLogoSource === 'dashboardStats'
      ? adminSchool?.schoolLogo || null
      : schoolLogoOf(identity.profile),
  );

  const endpointsKey = (config?.profileEndpoints || []).join('|');

  // Read as primitives, not as the object: `home.identityRow3` is a fresh literal on every render
  // for no descriptor here, but depending on an object in a useCallback is how a load loop starts.
  const row3Source = home?.identityRow3?.source || 'designation';
  const row3Endpoint = home?.identityRow3?.endpoint || '';
  // Primitives again, for the same reason: depending on the descriptor object in a useCallback is
  // how a load loop starts.
  const metricsKind = home?.metrics || '';
  const wantsToday = !!home?.todayList;
  const wantsBell = !!home?.profileHeader;
  // Primitive, same reason as above.
  const wantsAdminSchool = config?.schoolLogoSource === 'dashboardStats';

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
      name: session.schoolUserName || '',
      email: session.schoolUserEmail || '',
      code: session.schoolCode || '',
      photo: session[STAFF_PHOTO_KEY] || null,
    });

    const storedVerified =
      session.schoolUserVerified === 'true' || session.schoolUserVerified === '1';

    const next = await loadStaffIdentity(endpointsKey ? endpointsKey.split('|') : []);
    setIdentity(next);

    // (1) THE GATE. A live answer wins; `null` means the profile could not be read, and the stored
    // flag is then the only source. Treating a failed read as "unverified" would lock out any role
    // whose profile endpoint refused — which was EVERY session for shreyartha_councellor until its
    // `profileEndpoints` was corrected from `[]`, and is still every session for any staff member
    // whose profile call happens to fail. The fallback is what makes that survivable.
    const live = liveVerified(next.profile);
    const resolved = live == null ? storedVerified : live;
    setVerified(resolved);

    // Persist a live answer, in the REVOCATION direction only. The layout gates all thirty-eight
    // routes on the stored flag, so an admin un-verifying someone mid-session takes effect on the
    // next navigation rather than at the next login. It cannot help in the granting direction and
    // is not meant to: a newly-verified staff member is on the pending screen, which this never
    // mounts behind.
    if (live != null && live !== storedVerified) {
      AsyncStorage.setItem('schoolUserVerified', String(live)).catch(() => {});
    }

    // (2) THE PHOTO CACHE. StaffProfileScreen reads this rather than making its own HR call.
    const url = photoOf(next.hr);
    if (url) AsyncStorage.setItem(STAFF_PHOTO_KEY, url).catch(() => {});

    // (3) THE ONE IDENTITY ROW THAT COSTS A REQUEST. Fired only for a descriptor that asks for it,
    // and deliberately AFTER the gate above rather than alongside it: it is decoration, and it must
    // never be able to delay or fail the verification decision.
    if (row3Source === 'schools' && row3Endpoint) {
      setSchools(await loadSchoolsCovered(row3Endpoint));
    }

    setRefreshing(false);

    // (4) THE REDESIGN'S OWN BLOCKS. Fired last and never awaited by anything above, for the same
    // reason the schools row is: they are decoration, and one of them failing must not be able to
    // hold up — or fail — the verification decision.
    //
    // Each swallows its own error inside its service and answers with an empty value, so a role
    // whose backend refuses it renders one block fewer rather than an error on a screen the user
    // opened to do something else.
    if (wantsBell) setUnread(await fetchUnreadCount());

    if (metricsKind === 'sales') {
      try {
        setMetrics(await loadSalesMetrics());
      } catch {
        setMetrics(null);
      }
    } else if (metricsKind === 'counsellor') {
      setMetrics(await fetchTodaySummary(roleKey));
    }

    // The principal's school crest and name. Swallowed like the calls above: a role whose backend
    // refuses this renders the 3C mark rather than an error on a screen opened to do something
    // else. The school-admin endpoints are authorised for PRINCIPAL through the role hierarchy.
    // (No glob written out here: a slash-star inside a line comment is read as the start of a block
    // comment by every comment-stripping tool in scripts/, which silently eats the rest of the file
    // and makes unrelated assertions fail.)
    if (wantsAdminSchool) {
      try {
        const stats = await fetchDashboardStats();
        setAdminSchool(stats || null);
      } catch {
        setAdminSchool(null);
      }
    }

    if (wantsToday) setToday(await fetchTodaySessions(roleKey));
  }, [endpointsKey, row3Source, row3Endpoint, metricsKind, wantsToday, wantsBell,
      wantsAdminSchool, roleKey]);

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

  // Belt and braces with the layout's own guard: a role reaching this screen without a descriptor
  // would render three heroes with no titles rather than fail loudly.
  if (!config || !home) return null;

  if (verified === null) return <View style={styles.blank} />;
  if (verified === false) return <Redirect href={config.routes.pending} />;

  const { profile, hr } = identity;
  // The tile paired with Shreya, resolved from the menu so its label and route cannot drift from
  // the one the Workspace grid shows for the same key.
  const pairItem = home.supportPairKey
    ? itemsFor(config.menu, [home.supportPairKey])[0]
    : null;

  const name = profile?.fullName || stored.name || config.label;
  const row3 = home.identityRow3 || { label: t.rowRole, source: 'designation' };
  // Three sources, and Designation is the FALLBACK for all of them rather than a fourth branch.
  // Every one of the other two can legitimately come back empty — a counsellor with no class
  // assignments yet, a schools call that refused — and an identity card with a blank row reads as
  // broken, where one showing Designation reads as complete. `config.label` is the last resort so
  // the row is never empty at all.
  const row3Value =
    (row3.source === 'assignedClasses' ? classesSupported(profile) : '')
    || (row3.source === 'schools' ? schools : '')
    || designationOf(profile)
    || config.label;

  // ── THE IDENTITY ROWS, KEYED AND THEN ORDERED ───────────────────────────────
  //
  // Built as a map and assembled by `identityRowOrder` because the panels do not agree on the
  // order. The first four show the role-specific row THIRD; the Principal's design shows it last,
  // under School and User ID. Hardcoding one order and calling the other a variant would mean the
  // next panel's design is a code change rather than a descriptor line.
  //
  // An order naming a row that does not exist is skipped rather than rendered blank, and the
  // default is the order the four shipped panels already use — so omitting the key changes nothing.
  const IDENTITY_ROWS = {
    name: { key: 'name', icon: 'person-outline', label: t.rowName, value: name, tint: 'violet' },
    email: {
      key: 'email',
      icon: 'mail-outline',
      label: t.rowEmail,
      value: profile?.email || stored.email,
      tint: 'blue',
    },
    // NOT "Subject I Teach", which is what the teacher panel shows here. Most of these roles have
    // no class assignments BY DESIGN — whole-school access is the premise of both Shreyartha roles,
    // a VP only has them if somebody used Assign Class, and a Principal never does — so that row
    // would read "Not set" forever. Designation is populated at signup and real for every staff
    // role, and it is the default.
    //
    // The school-bound counsellor is the exception and says so in its descriptor: its classes ARE
    // assigned, through the Academic Management tab on this very panel.
    row3: {
      key: 'row3',
      icon: row3.icon || ROW3_ICON[row3.source] || 'ribbon-outline',
      label: row3.label,
      value: row3Value,
      tint: 'green',
    },
    school: {
      key: 'school',
      icon: 'business-outline',
      label: t.rowSchool,
      value: schoolLabel(profile, stored.code),
      tint: 'amber',
    },
    staffId: {
      key: 'staffId',
      icon: 'card-outline',
      label: t.rowStaffId,
      value: staffIdOf(hr),
      tint: 'violet',
    },
  };

  // The banner resolves through the SAME `heroRoute` the cards do, so its CTA and a hero pointing
  // at the same tile can never disagree about where that tile lives. Null when the descriptor has
  // no banner, or names a tile this role does not carry.
  const bannerRoute = home.banner ? heroRoute(home.banner, roleKey, config.menu) : null;

  const identityRows = (home.identityRowOrder || ['name', 'email', 'row3', 'school', 'staffId'])
    .map((rowKey) => IDENTITY_ROWS[rowKey])
    .filter(Boolean);

  // ── THE PHOTO-LED HEADER'S CHIPS ───────────────────────────────────────────
  // Both come off the HR profile, not the role profile: `/api/counselor/profile` and
  // `/api/teacher/profile` carry neither an employee code nor a joining date, and the latter's
  // `schoolLogo` is the SCHOOL's crest rather than a person's photo. `loadStaffIdentity` already
  // fetches both DTOs in parallel, so this costs no extra request.
  //
  // Either can be null — a staff member who has never been through payroll setup has neither — and
  // ProfileHeaderCard omits an empty chip rather than printing "Not set" twice in a header.
  const headerChips = [
    { key: 'staffId', icon: 'card-outline', label: 'Employee ID', value: staffIdOf(hr), tint: 'violet' },
    { key: 'joined', icon: 'calendar-outline', label: 'Date of Joining', value: joinedOn(hr), tint: 'amber' },
  ];

  // Quick actions resolve through `heroRoute`, the SAME resolver the heroes and both checkers use,
  // so a card cannot render one destination and be verified against another. One naming a tile
  // this role does not carry resolves to null and is dropped rather than rendering a dead card.
  const quickActions = (home.quickActions || [])
    .map((action) => {
      const route = heroRoute(action, roleKey, config.menu);
      return route ? { ...action, onPress: () => router.push(route) } : null;
    })
    .filter(Boolean);

  const handlePickPhoto = async () => {
    const file = await pickPhoto();
    if (!file) return;
    if (file.denied) {
      Alert.alert('Permission needed', 'Allow photo access to change your profile picture.');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadStaffPhoto(file);
      if (url) {
        // Optimistic, and cached: StaffProfileScreen READS `STAFF_PHOTO_KEY` rather than making its
        // own HR call, so a new photo that never reaches the cache would show here and nowhere else.
        setStored((p) => ({ ...p, photo: url }));
        setIdentity((p) => ({ ...p, hr: { ...(p.hr || {}), profilePictureUrl: url } }));
        AsyncStorage.setItem(STAFF_PHOTO_KEY, url).catch(() => {});
      }
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Could not update your photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };


  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Change Password reaches these roles ONLY through here now. It used to be a chip in
          StaffMenuScreen's header-action row, injected by resolveStaffMenus — dropping that row
          without this bar would remove its single entry point. */}
      <BrandBar
        tone="light"
        // The school's own crest takes the lead position — but ONLY for a role that belongs to one
        // school. This shell also serves sales and the three Shreyartha HQ roles, which work across
        // schools or none, and `schoolBound` in constants/staffRoles.js is what tells them apart.
        // Gating on the descriptor rather than on whether a URL happened to arrive: sales was
        // previously safe only because its DTO omits `schoolLogo`, which is an accident, not a rule.
        schoolLogoUrl={config.schoolBound ? schoolLogo : null}
        // The NAME follows the same source as the logo. For the principal `profile` is null, so
        // `schoolLabel` would fall back to the school CODE ("SHREYA01") — correct as a last resort,
        // but the real name is right there in the stats this role already fetches, and the name is
        // what the header shows when no crest has been uploaded.
        schoolName={
          config.schoolBound
            ? (wantsAdminSchool ? adminSchool?.schoolName || '' : '')
              || schoolLabel(profile, stored.code)
            : ''
        }
        // Only the panels with a photo-led header carry a bell. Passing null leaves the other four
        // headers byte-for-byte as they were — this component is the header of six dashboards.
        bell={wantsBell ? { count: unread, route: `/staff/${roleKey}/notifications` } : null}
      />

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
        {/* TWO HEADERS, ONE PER DESIGN.

            `profileHeader` is the photo-led block from the approved sales and counsellor mockups:
            a big avatar with an upload badge, a greeting, and the two facts as chips. Everything
            else keeps `IdentityCard`'s labelled-rows layout, which is what those four panels' own
            designs show. Not a variant of one component: the two put every element in a different
            place, so a layout switch would be larger than a second component. */}
        {home.profileHeader ? (
          <ProfileHeaderCard
            name={name}
            role={designationOf(profile) || config.label}
            photoUrl={photoOf(hr) || stored.photo}
            chips={headerChips}
            onPressPhoto={handlePickPhoto}
            uploading={uploading}
          />
        ) : (
          <IdentityCard
            tone="light"
            strings={t}
            title={t.personalDetails}
            name={name}
            photoUrl={photoOf(hr) || stored.photo}
            badge={home.badge}
            rows={identityRows}
          />
        )}

        {/* The Quick Actions rail. Shortcuts to tiles the panel already reaches — which is why
            `assertArrangementCovers` validates them without counting them as placements. */}
        <QuickActionGrid actions={quickActions} />

        {/* THE METRIC BLOCK. Two shapes, chosen by the descriptor, and each renders nothing at all
            when its load failed — a dashboard that could not fetch must not be indistinguishable
            from a genuinely quiet month. */}
        {metricsKind === 'sales' && metrics ? (
          <MetricRow
            title="Sales Performance"
            subtitle="(This Month)"
            actionLabel="View Details"
            onPressAction={() => {
              const route = itemsFor(config.menu, ['dashboard'])[0]?.native;
              if (route) router.push(route);
            }}
            deltaNote="vs Last Month"
            stats={salesStats(metrics)}
          />
        ) : null}

        {metricsKind === 'counsellor' && metrics ? (
          <MetricRow title="Today's Summary" stats={counsellorStats(metrics)} />
        ) : null}

        {/* "Today's Sessions", not the design's "Today's Visits" — there is no counsellor visit
            backend anywhere. Kept mounted on an empty day, because a block that vanishes when
            nothing is scheduled reads as a screen that failed to load. */}
        {wantsToday ? (
          <TodayList
            title="Today's Sessions"
            items={today.map(sessionRow)}
            actionLabel="View All"
            onPressAction={() => {
              const route = itemsFor(config.menu, ['counselling'])[0]?.native;
              if (route) router.push(route);
            }}
            emptyLabel="No sessions scheduled for today."
          />
        ) : null}

        {/* THE HEROES, in descriptor order.

            Was three hardcoded blocks — Workspace, Attendance and a per-role third. It is a LIST
            now because the Principal's design has six, and because "which cards does this panel
            lead with" is per-role data rather than a shape every panel must share.

            Every destination goes through `heroRoute`, the same resolver the checker calls, so a
            card cannot render one route and be verified against another. A hero naming a tile the
            menu does not carry resolves to null and is skipped rather than rendering a dead card. */}
        {(home.heroes || []).map((hero) => {
          const route = heroRoute(hero, roleKey, config.menu);
          if (!route) return null;
          return (
            <HeroCard
              key={hero.key}
              title={hero.title}
              subtitle={hero.subtitle}
              icon={hero.icon}
              colors={hero.colors}
              onPress={() => router.push(route)}
            />
          );
        })}

        {/* The wide action strip. Descriptor-driven, so a panel without one renders nothing here
            rather than an empty gap, and the Shreyartha Admin panel gets it by adding a key. */}
        {bannerRoute ? (
          <StaffBanner
            title={home.banner.title}
            subtitle={home.banner.subtitle}
            icon={home.banner.icon}
            cta={home.banner.cta}
            onPress={() => router.push(bannerRoute)}
          />
        ) : null}

        {/* FOR SUPPORT — only for a role with a Shreya that actually answers it.

            TWO roles have one now, and they talk to different backends. Shreyartha Teacher uses
            `/api/teacher/shreya`; the Principal uses `/api/principal/shreya`, which exists because
            the teacher one refuses that role at the door — `TeacherShreyaController` is
            `hasAnyRole('TEACHER','SHREYARTHA_TEACHER')` and the hierarchy declares
            `PRINCIPAL implies SCHOOL_ADMIN`, not TEACHER. Which backend is decided by the
            descriptor's `shreyaConfig`, resolved once in shreyaConfigs.js so this card and the
            Support tab cannot disagree.

            The remaining three — both counsellors and the Vice Principal — still get the help page,
            and the reason is unchanged: a card here would render, be tapped, and fail. A 403 for the
            counsellors and, worse, a 400 about account types for the VP, which reads as a data bug
            rather than a permission.

            THE ROW IS A PAIR ONLY WHEN THERE IS A PAIR. `AssistantCard` is `flex: 1`, so with no
            `supportPairKey` Shreya fills the width on her own — which is what the Principal's design
            asks for, since Live Meeting already has its own banner above and would be duplicated
            beside her. Shreyartha Teacher names a pair and gets two ~48% cards.

            Shreya keeps her own blue across every panel; the tile beside her takes the portal's
            colour, because she is a guest and it is a section of this panel. `alignItems: stretch`
            on the row is what makes the two CTAs sit level. */}
        {home.support === 'shreya' ? (
          <>
            <SectionDivider label={t.forSupport} tone="light" />

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

              {pairItem ? (
                <AssistantCard
                  tone="light"
                  name={pairItem.label}
                  role={t.pairRole}
                  blurb={t.pairBlurb}
                  cta={t.pairCta}
                  icon="videocam"
                  accent={palette.primary}
                  onPress={() => router.push(pairItem.native)}
                />
              ) : null}
            </View>
          </>
        ) : null}

        {/* Gated on the descriptor rather than always shown: a role that has not opted into search
            would otherwise get a bar leading to a route that renders nothing. */}
        {home.search ? (
          <SearchEntry
            tone="light"
            placeholder={t.searchPlaceholder}
            buttonLabel={t.searchButton}
            onSearch={(q) => router.push({ pathname: `/staff/${roleKey}/search`, params: { q } })}
          />
        ) : null}
      </ScrollView>

      {/* Mounted only while open, and structurally below the verification gate above — so an
          unverified staff member can never reach the chat. */}
      {chatOpen ? (
        <ShreyaChatSheet
          config={shreyaConfigFor(home)}
          visible
          onClose={() => setChatOpen(false)}
          basePath={`/staff/${roleKey}`}
          isShreya01={!!config.chatbot?.isShreya01}
        />
      ) : null}
    </SafeAreaView>
  );
}

/**
 * The sales performance card's four figures.
 *
 * ══ TWO OF THE FOUR CARRY NO DELTA, AND THAT IS THE POINT ══════════════════
 * The design shows "vs Last Month" under all four. The backend supports two:
 *
 *   Total Sales      `monthlyRevenue` has twelve buckets, so last month is real.
 *   Schools Visited  real, via a second `/reports/visits` call for the prior month.
 *   Proposals Sent   `dealsSubmitted` is a CURRENT count. No history exists anywhere.
 *   Conversion       `pipeline` is a snapshot of open stages. Same.
 *
 * So the last two pass `delta: null` and `MetricRow` renders no change line for them. A
 * fabricated 0% would read as "flat this month" — a claim about a rep's performance that nothing
 * in the data supports.
 *
 * Conversion also renders "—" rather than "0%" on an empty pipeline: a rep with no leads has no
 * conversion rate, and 0% would say they are failing to convert leads they do not have.
 */
function salesStats(m) {
  return [
    {
      key: 'sales',
      label: 'Total Sales',
      icon: 'trending-up',
      tint: 'green',
      value: formatRupees(m.totalSalesInr, { decimals: 0 }),
      delta: m.totalSalesDelta,
    },
    {
      key: 'schools',
      label: 'Schools Visited',
      icon: 'business',
      tint: 'blue',
      value: String(m.schoolsVisited),
      delta: m.schoolsVisitedDelta,
    },
    {
      key: 'proposals',
      label: 'Proposals Sent',
      icon: 'document-text',
      tint: 'amber',
      value: String(m.proposalsSent),
      delta: null,
    },
    {
      key: 'conversion',
      label: 'Conversion',
      icon: 'flag',
      tint: 'violet',
      value: m.conversion == null ? '—' : `${m.conversion}%`,
      delta: null,
    },
  ];
}

/**
 * The counsellor's Today's Summary.
 *
 * No deltas at all: every figure is scoped to today, and "yesterday" is not a comparison anyone
 * asked for. Schools Visited from the design is absent — there is no counsellor visit backend, so
 * it could only be a fabricated zero.
 */
function counsellorStats(s) {
  return [
    {
      key: 'students',
      label: 'Students Counselled',
      icon: 'people',
      tint: 'violet',
      value: String(s.studentsCounselledToday ?? 0),
    },
    {
      key: 'sessions',
      label: 'Sessions Today',
      icon: 'chatbubbles',
      tint: 'blue',
      value: String(s.sessionsToday ?? 0),
    },
    {
      key: 'meetings',
      label: 'Meetings Done',
      icon: 'videocam',
      tint: 'green',
      value: String(s.meetingsDoneToday ?? 0),
    },
    {
      key: 'followUps',
      label: 'Follow-ups',
      icon: 'alarm',
      tint: 'amber',
      value: String(s.followUpsDueToday ?? 0),
    },
  ];
}

const useStyles = makeStyles(() => ({
  safe: { flex: 1, backgroundColor: SLATE[50] },
  // The frame shown while `verified` is unknown. White rather than the page background so the
  // transition into the dashboard is not a two-step colour change.
  blank: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { padding: SPACING.md },

  // `alignItems: 'stretch'` is what makes the two cards equal height — without it each sizes to its
  // own content and the shorter one's CTA floats mid-card.
  supportPair: { flexDirection: 'row', alignItems: 'stretch', gap: SPACING.sm },

  pressed: { opacity: 0.8 },
}));
