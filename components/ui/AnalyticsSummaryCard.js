import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, TYPE } from '../../constants/theme';
import makeStyles from '../../utils/makeStyles';
import { usePalette } from './PaletteContext';

/**
 * The at-a-glance card that opens the student home and the parent home.
 *
 * ONE component for both portals, because the backend serves both from one method:
 * ParentDashboardService resolves the linked child and then calls the same
 * StudentAnalyticsService the student's own portal calls. The payload is identical, so the only
 * difference is who is being talked about — hence `subject`.
 *
 * `subject`:
 *   'you'       → "You are in Class 8 (Science)."          (student portal)
 *   'candidate' → "Your candidate is in Class 8 (Science)." (parent portal)
 *
 * The wording lives here rather than on the server for exactly that reason: a data payload should
 * not carry a grammatical person. Adding a third audience later is a case in this file, not a new
 * endpoint.
 *
 * NOTE ON WHAT IS NOT SHOWN. Coding Pro percentages and the Overall Readiness Index are absent by
 * design — both are hardcoded placeholders in StudentAnalyticsService (every student in the system
 * reads AI 80% / Robotics 60% / Coding 75%, Academic "High"). A placeholder in a chart is a known
 * gap; the same placeholder asserted in a sentence to a parent is a false statement about their
 * child. The backend summary omits them, and this card must never reintroduce them.
 */

const SUBJECTS = {
  you: {
    // "You are in Class 8 (Science)."
    lead: 'You are',
    possessive: 'Your',
    emptyTitle: 'Your journey starts here',
    emptyBody: 'Complete a topic or an assessment and your progress will show up here.',
    notLinked: null,
  },
  candidate: {
    lead: 'Your candidate is',
    possessive: 'Their',
    emptyTitle: 'No activity yet',
    emptyBody:
      'Once your candidate completes a topic or an assessment, a summary of their progress will appear here.',
    notLinked: 'No student is linked to your account yet.',
  },
};

/** "Class 8 (Science)" / "Class 8" / "Science" / null — whichever parts exist. */
function describeClass(summary) {
  const cls = summary?.currentClass ? `Class ${summary.currentClass}` : null;
  const stream = summary?.stream || null;
  if (cls && stream) return `${cls} (${stream})`;
  return cls || stream || null;
}

export default function AnalyticsSummaryCard({
  summary,
  subject = 'you',
  loading = false,
  error = null,
  onPress,
  style,
}) {
  const styles = useStyles();
  const palette = usePalette();
  const voice = SUBJECTS[subject] || SUBJECTS.you;

  // A card that cannot load must not push the real content down the screen — the home screens
  // below it are the point. Silent is the right failure here.
  if (error || (!loading && !summary)) return null;

  if (loading) {
    return (
      <View style={[styles.card, style]}>
        <View style={styles.skelLine} />
        <View style={[styles.skelLine, styles.skelShort]} />
      </View>
    );
  }

  const where = describeClass(summary);
  const sentence = where ? `${voice.lead} in ${where}.` : null;

  const body = summary.empty ? (
    <>
      <Text style={styles.title}>{voice.emptyTitle}</Text>
      <Text style={styles.note}>{voice.emptyBody}</Text>
    </>
  ) : (
    <>
      {sentence ? <Text style={styles.title}>{sentence}</Text> : null}
      <View style={styles.chips}>
        {(summary.highlights || []).map((h) => (
          <View key={h} style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {h}
            </Text>
          </View>
        ))}
      </View>
      {summary.strongestSkill && summary.weakestSkill ? (
        <Text style={styles.note}>
          {`${voice.possessive} strongest skill is ${summary.strongestSkill}; ${summary.weakestSkill} needs the most work.`}
        </Text>
      ) : null}
      {summary.careerInterest ? (
        <Text style={styles.note}>{`Career interest: ${summary.careerInterest}`}</Text>
      ) : null}
    </>
  );

  const inner = (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <Ionicons name="sparkles-outline" size={15} color={palette.primary} />
        <Text style={styles.eyebrow}>At a glance</Text>
        {onPress ? (
          <Ionicons name="chevron-forward" size={15} color={palette.primary} />
        ) : null}
      </View>
      {body}
    </View>
  );

  if (!onPress) return inner;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Open full analytics"
    >
      {inner}
    </Pressable>
  );
}

const useStyles = makeStyles((p) => ({
  // `glass`, not `card`: this sits at the very top of a screen whose background is a photograph,
  // alongside the header. `card` is near-opaque with DARK text and would read as a second header.
  card: {
    backgroundColor: p.glass || p.tint,
    borderWidth: 1,
    borderColor: p.glassBorder || p.cardBorder,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  eyebrow: {
    flex: 1,
    fontSize: TYPE.micro,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: p.primary,
  },
  title: { fontSize: TYPE.heading, fontWeight: '700', color: p.onDark },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: p.tint,
    borderWidth: 1,
    borderColor: p.glassBorder || p.cardBorder,
  },
  chipText: { fontSize: TYPE.caption, fontWeight: '600', color: p.onDark },
  note: { fontSize: TYPE.label, color: p.onDark, opacity: 0.85, marginTop: 6 },
  pressed: { opacity: 0.75 },

  // Placeholder bars while the request is in flight, so the card does not pop in and shove the
  // screen down once it resolves.
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: p.tint,
    marginBottom: 8,
  },
  skelShort: { width: '55%', marginBottom: 0 },
}));
