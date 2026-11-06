import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { initialsOf } from '../../staff/helpers';
import { hueOf } from '../../../constants/parentColours';

/**
 * "My Child's Report" — the centre of the parent dashboard.
 *
 * The child's photo, four headline figures, three drill-downs, and the button to the full analytics
 * screen.
 *
 * ── WHAT EACH OF THE FOUR FIGURES ACTUALLY IS ───────────────────────────────
 * The design labels these Overall Performance / Attendance / Assignments / Assessments and shows a
 * percentage under each. Three of those four percentages do not exist in the backend, so what is
 * shown here is what can be shown honestly:
 *
 *   Overall Performance   **COMING SOON.** `letterGrade` has zero hits in the entire codebase and
 *                         nothing computes an A/B/C. The nearest thing, `readinessIndex`, is a
 *                         hardcoded placeholder identical for every student on the platform — its
 *                         own DTO javadoc says so — and must never reach a parent's screen.
 *   Attendance            REAL, but only for ONE MONTH. `/attendance/calendar` takes a required
 *                         year+month and returns raw per-day statuses; there is no aggregate
 *                         endpoint and no term boundary to aggregate over. Labelled "This month"
 *                         rather than presented as an all-time figure.
 *   Homework              REAL, as a COUNT and never a percentage. `/learning-activities` returns
 *                         the assigned items; a parent cannot see submission state at all
 *                         (`HomeworkSubmission` is exposed only to the student), so "85% done"
 *                         would be invented. "12 set" is true.
 *   Psychometric          REAL. `/psychometric` returns `completedCount` / `totalTopics`. Shown as
 *                         "8 of 10", not converted to a percentage of a score it isn't.
 *
 * ── THE TERM CHIP DOES NOT FILTER ───────────────────────────────────────────
 * No parent endpoint accepts a term and `ExamType` has no TERM value, so the chip shows the real
 * current academic year and is inert. It is a `View`, not a `Pressable`.
 *
 * ── NOTHING SAYS "COMING SOON" (4 Nov 2026) ─────────────────────────────────
 * Every stat is a real figure or a dash with its reason (services/parent/reportCardService). Each
 * stat tile and row icon wears its area's hue (constants/parentColours), as it does elsewhere.
 */

export default function ChildReportCard({
  childName,
  childPhoto,
  academicYear,
  stats = [],
  rows = [],
  onOpenRow,
  onOpenAnalytics,
  strings = {},
}) {
  const styles = useStyles();
  const palette = usePalette();

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{strings.reportTitle || "My Child's Report"}</Text>
        {/* Inert: there is nothing to filter by. Real value, no dropdown affordance. */}
        {academicYear ? (
          <View style={styles.term}>
            <Text style={styles.termText}>{academicYear}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.avatar}>
          {childPhoto ? (
            <Image source={{ uri: childPhoto }} style={styles.avatarImg} resizeMode="cover" />
          ) : (
            <Text style={styles.initials}>{initialsOf(childName)}</Text>
          )}
        </View>

        <View style={styles.stats}>
          {stats.map((stat) => {
            const hue = hueOf(stat.key);
            return (
              <View key={stat.key} style={[styles.stat, { backgroundColor: hue.bg, borderColor: hue.border }]}>
                <Text style={[styles.statLabel, { color: hue.fg }]} numberOfLines={1}>
                  {stat.label}
                </Text>
                <Text style={[styles.statValue, { color: stat.empty ? SLATE[400] : hue.fg }]}>{stat.value}</Text>
                <Text style={styles.statNote} numberOfLines={2}>
                  {stat.note}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {rows.map((row, i) => (
        <Pressable
          key={row.key}
          onPress={() => onOpenRow?.(row)}
          style={({ pressed }) => [styles.row, i > 0 && styles.rowDivided, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${row.label}. ${row.description}`}
        >
          <View style={[styles.rowIcon, { backgroundColor: hueOf(row.key).bg }]}>
            <Ionicons name={row.icon} size={19} color={hueOf(row.key).fg} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowDescription} numberOfLines={1}>
              {row.description}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={SLATE[400]} />
        </Pressable>
      ))}

      <Pressable
        onPress={onOpenAnalytics}
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Ionicons name="stats-chart" size={18} color={palette.primaryDark} />
        <Text style={styles.ctaText}>{strings.viewAnalytics || 'View Detailed Analytics'}</Text>
        <Ionicons name="chevron-forward" size={17} color={palette.primaryDark} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 12,
    elevation: 3,
  },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  title: { flex: 1, fontSize: TYPE.title, fontWeight: '800', color: SLATE[800] },
  term: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  termText: { fontSize: TYPE.caption, fontWeight: '700', color: p.primaryDark },

  body: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: p.tint,
  },
  avatarImg: { width: '100%', height: '100%' },
  initials: { fontSize: TYPE.title, fontWeight: '800', color: p.primaryDark },

  // Two-up rather than the design's four-across: four stat tiles beside a photo on a 360dp phone
  // leaves under 60dp each, which cannot hold "Assessments".
  stats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stat: {
    flexGrow: 1,
    flexBasis: '46%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  statLabel: { fontSize: TYPE.micro, fontWeight: '800', textTransform: 'uppercase' },
  statValue: { fontSize: TYPE.headline, fontWeight: '800', marginTop: 1 },
  statNote: { fontSize: TYPE.micro, color: SLATE[600] },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    paddingVertical: 6,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: SLATE[200] },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  rowDescription: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 1 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    borderRadius: 14,
    backgroundColor: p.tint,
    marginTop: SPACING.sm,
  },
  ctaText: { fontSize: TYPE.heading, fontWeight: '700', color: p.primaryDark },

  pressed: { opacity: 0.8 },
}));
