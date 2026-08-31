import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, TOUCH, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { useTranslations } from '../../hooks/useTranslations';
import StudentScaffold from './StudentScaffold';
import { STUDENT_MENU, STUDENT_TEACHER_LINKS } from '../../constants/studentMenu';
import {
  fetchEntitlements,
  fetchSchoolInfo,
  fetchStudentProfile,
  planBadge,
} from '../../services/student/dashboardService';

/**
 * My Workspace — everything the student can actually do, in two groups.
 *
 * This is where the dashboard's first hero card lands, and it is where the tile grid went when the
 * dashboard was redesigned around identity and destinations rather than a flat menu.
 *
 * ── GROUP TWO IS THE RESTORED FLOATING BUTTONS ──────────────────────────────
 * Teacher's Resources, Homework and Personalised Resources were the web's hover rail. They are rows
 * here rather than a floating cluster, per the product ask, and this is the right screen for them:
 * a student hunting for their homework opens their workspace, not their dashboard.
 *
 * ── THE SCHOOL BADGE AND THE PLAN BLOCK MOVED HERE ──────────────────────────
 * Both used to sit on the dashboard. The redesigned dashboard has no room and no reason for them —
 * the design puts identity at the top and destinations under it — but neither should disappear. The
 * school crest belongs above the school's own resources, and Upgrade belongs next to the things a
 * plan unlocks.
 */

const STRINGS = {
  title: 'My Workspace',
  intro: 'Your learning resources, tools, courses and practice zone.',
  learning: 'Learning',
  fromTeacher: 'From your teacher',
  upgradeTitle: 'Unlock more of the platform',
  upgradeBody: 'See what your plan includes and what you can add.',
  upgradeCta: 'View plans',
};

export default function WorkspaceScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const t = useTranslations(STRINGS);

  const [school, setSchool] = useState(null);
  const [entitlements, setEntitlements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Independently guarded: a free student has no school and may 403 on entitlements, and neither
    // costs them the tiles — the tiles are the point of the screen.
    const [profileRes, entRes] = await Promise.allSettled([
      fetchStudentProfile(),
      fetchEntitlements(),
    ]);

    const me = profileRes.status === 'fulfilled' ? profileRes.value : null;
    setEntitlements(entRes.status === 'fulfilled' ? entRes.value : null);

    if (me?.schoolId) {
      try {
        setSchool(await fetchSchoolInfo(me.schoolId));
      } catch {
        setSchool(null);
      }
    } else {
      setSchool(null);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const badge = planBadge(entitlements);

  return (
    <StudentScaffold
      title={t.title}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Text style={styles.intro}>{t.intro}</Text>

      {!loading && (school?.schoolLogo || school?.name) ? (
        <View style={styles.school}>
          {school.schoolLogo ? (
            <Image
              source={{ uri: school.schoolLogo }}
              style={styles.schoolLogo}
              // `.dashboard-school-logo` is object-fit:contain — the default 'cover' crops wide
              // school crests to a square.
              resizeMode="contain"
            />
          ) : null}
          {school.name ? (
            <Text style={styles.schoolName} numberOfLines={2}>
              {school.name}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.group}>{t.learning}</Text>
      <View style={styles.grid}>
        {STUDENT_MENU.map((item) => (
          <Pressable
            key={item.key}
            onPress={() =>
              item.native
                ? router.push(item.native)
                : router.push({
                    pathname: '/student/feature',
                    params: { path: item.path, title: item.label },
                  })
            }
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <Image source={item.image} style={styles.tileImg} resizeMode="contain" />
            <Text style={styles.tileLabel} numberOfLines={2}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.group}>{t.fromTeacher}</Text>
      {STUDENT_TEACHER_LINKS.map((link) => (
        <Pressable
          key={link.key}
          onPress={() => router.push(link.native)}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={link.label}
        >
          <View style={styles.linkIcon}>
            <Ionicons name={link.icon} size={19} color={palette.primary} />
          </View>
          <View style={styles.linkText}>
            <Text style={styles.linkLabel}>{link.label}</Text>
            <Text style={styles.linkDesc}>{link.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={palette.primary} />
        </Pressable>
      ))}

      {!loading && !badge.premium ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/student/feature',
              params: { path: '/student/platform/plans', title: 'My Plan' },
            })
          }
          style={({ pressed }) => [styles.plan, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={styles.linkText}>
            <Text style={styles.linkLabel}>{t.upgradeTitle}</Text>
            <Text style={styles.linkDesc}>{t.upgradeBody}</Text>
          </View>
          <View style={styles.planCta}>
            <Text style={styles.planCtaText}>{t.upgradeCta}</Text>
          </View>
        </Pressable>
      ) : null}
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  intro: { fontSize: TYPE.label, color: p.onDark, lineHeight: 19, marginBottom: SPACING.md },

  group: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: p.onDark,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },

  school: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: p.glassDark,
    borderWidth: 1,
    borderColor: p.glassDarkBorder,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  schoolLogo: { width: 46, height: 46, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.9)' },
  schoolName: { flex: 1, fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },

  // `rowGap` for the vertical gutter, `space-between` for the horizontal one. Deliberately NOT a
  // `gap` + `width: 48%` combination: 48+48 plus the gap exceeds 100% and drops the grid to one
  // tile per row.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  tile: {
    width: '48%',
    alignItems: 'center',
    // OPAQUE, and the one place in the redesign that stays light. `.dashboard-section-card` is
    // `background: #fff` and the tile artwork is white-boxed PNGs — on dark glass each one shows
    // its own rectangular edge, which looks like a bug rather than a style.
    backgroundColor: p.tile,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: p.cardBorder,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
    minHeight: 150,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 12,
    elevation: 3,
  },
  tilePressed: { opacity: 0.85, borderColor: p.accent },
  tileImg: { width: 70, height: 70, marginBottom: 14 },
  tileLabel: { fontSize: TYPE.body, fontWeight: '600', color: '#333333', textAlign: 'center' },

  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: TOUCH.min,
    padding: SPACING.md,
    borderRadius: 16,
    backgroundColor: p.glassDark,
    borderWidth: 1,
    borderColor: p.glassDarkBorder,
    marginBottom: SPACING.sm,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  linkText: { flex: 1 },
  linkLabel: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  linkDesc: { fontSize: TYPE.caption, color: p.onDark, lineHeight: 16, marginTop: 2 },

  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: TOUCH.min,
    padding: SPACING.md,
    borderRadius: 16,
    backgroundColor: p.glassDark,
    borderWidth: 1,
    borderColor: p.primary,
    marginTop: SPACING.sm,
  },
  planCta: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#facc15' },
  planCtaText: { fontSize: TYPE.caption, fontWeight: '800', color: '#1f2937' },

  pressed: { opacity: 0.8 },
}));
