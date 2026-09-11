import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { makeStyles } from '../../../utils/makeStyles';
import { tint, tintAt } from './tints';

/**
 * A short "what is happening today" list — the counsellor design's Today's Sessions block.
 *
 *   Today's Sessions                                    View All ›
 *   ┌──┐  DPS Noida                       10:30 AM  [Completed]  ›
 *   └──┘  Class 9 · 4 students
 *
 * ── IT IS SESSIONS, NOT VISITS ──────────────────────────────────────────────
 * The approved design says "Today's Visits". There is no counsellor visit entity, controller or
 * service anywhere in the backend — visits belong to the sales module and `SalesController` is
 * `hasRole('SHREYARTHA_SALES')` at class level with a second `requireSalesUser` check inside every
 * service method, so a counsellor cannot reach one even if the guard were widened. What a
 * counsellor genuinely has for today is face-to-face sessions
 * (`GET /api/counselor/f2f/sessions`), and that is what this renders. The component itself is
 * generic; only the caller's wording changes.
 *
 * ── AN EMPTY LIST RENDERS THE EMPTY STATE, NOT NOTHING ──────────────────────
 * Unlike the other blocks in this kit, a day with no sessions is the NORMAL case rather than a
 * failure, and a block that vanishes on a quiet day reads as a screen that failed to load. So it
 * keeps its heading and says so.
 *
 * @param {Array<{key, title, subtitle?, time?, status?, tone?, icon?, tint?, onPress?}>} items
 */
export default function TodayList({
  title,
  items = [],
  actionLabel,
  onPressAction,
  emptyLabel = 'Nothing scheduled for today.',
}) {
  const styles = useStyles();

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {actionLabel && onPressAction ? (
          <Pressable
            onPress={onPressAction}
            hitSlop={8}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
            <Ionicons name="chevron-forward" size={16} color={SLATE[500]} />
          </Pressable>
        ) : null}
      </View>

      {items.length === 0 ? (
        <Text style={styles.empty}>{emptyLabel}</Text>
      ) : (
        items.map((item, i) => {
          const hue = item.tint ? tint(item.tint) : tintAt(i);
          const body = (
            <>
              <View style={[styles.iconTile, { backgroundColor: hue.bg }]}>
                <Ionicons name={item.icon || 'business-outline'} size={20} color={hue.fg} />
              </View>

              <View style={styles.text}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text style={styles.itemSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>

              {item.time ? (
                <Text style={styles.time} numberOfLines={1}>
                  {item.time}
                </Text>
              ) : null}

              {item.status ? (
                <View style={[styles.chip, toneStyle(item.tone)]}>
                  <Text style={[styles.chipText, toneTextStyle(item.tone)]} numberOfLines={1}>
                    {item.status}
                  </Text>
                </View>
              ) : null}

              {item.onPress ? (
                <Ionicons name="chevron-forward" size={18} color={SLATE[400]} />
              ) : null}
            </>
          );

          // A row is a button only where the caller gave it somewhere to go — the same rule
          // IdentityCard applies to its rows, and for the same reason: a row that looks tappable
          // and does nothing is worse than one that plainly does not.
          return item.onPress ? (
            <Pressable
              key={item.key}
              onPress={item.onPress}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowDivided, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={[item.title, item.subtitle, item.time, item.status]
                .filter(Boolean)
                .join('. ')}
            >
              {body}
            </Pressable>
          ) : (
            <View key={item.key} style={[styles.row, i > 0 && styles.rowDivided]}>
              {body}
            </View>
          );
        })
      )}
    </View>
  );
}

/** `tone` is 'success' | 'warning' | 'neutral'; anything else falls to neutral. */
function toneStyle(tone) {
  if (tone === 'success') return { backgroundColor: FEEDBACK.successBg };
  if (tone === 'warning') return { backgroundColor: FEEDBACK.warningBg };
  return { backgroundColor: SLATE[100] };
}

/**
 * The `*OnBg` variants, not `successText`/`warningText`.
 *
 * theme.js is explicit about this: the plain variants are tuned for white and drop to roughly 3:1
 * on their own tint, which fails for text this small. Use the plain ones on a white card, these
 * inside a chip.
 */
function toneTextStyle(tone) {
  if (tone === 'success') return { color: FEEDBACK.successOnBg };
  if (tone === 'warning') return { color: FEEDBACK.warningOnBg };
  return { color: FEEDBACK.neutralText };
}

const useStyles = makeStyles(() => ({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },

  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  title: { flex: 1, fontSize: TYPE.title, fontWeight: '800', color: SLATE[900] },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[500] },

  empty: { fontSize: TYPE.body, color: SLATE[500], paddingVertical: SPACING.sm },

  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 10 },
  rowDivided: { borderTopWidth: 1, borderTopColor: SLATE[100] },

  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  itemSubtitle: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 1 },

  time: { fontSize: TYPE.caption, color: SLATE[500] },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: TYPE.micro, fontWeight: '700' },

  pressed: { opacity: 0.75 },
}));
