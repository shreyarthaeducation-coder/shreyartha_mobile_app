import { Text, View } from 'react-native';
import { SLATE, TYPE } from '../../constants/theme';
import { makeStyles } from '../../utils/makeStyles';

/**
 * A small "not available yet" badge, for a surface the design calls for and the backend cannot feed.
 *
 * ── WHY THIS EXISTS RATHER THAN THE TILE JUST BEING DROPPED ─────────────────
 * The approved parent design draws four things nothing can fill — Notifications, Download Reports,
 * a term selector, and an "Overall Performance" letter grade. Each was checked against the backend
 * and each is genuinely absent, not merely unported:
 *
 *   Notifications      only `/api/students/notifications` exists, `hasRole('*_STUDENT')`, resolved
 *                      from the student's OWN jwt — a parent gets a 403. The model has no
 *                      read/unread column either; its `status` is a DELIVERY state.
 *   Download Reports   zero file/PDF endpoints under `/api/parent/**` in the entire backend.
 *   Term selector      no parent endpoint accepts a term, and `ExamType` has no TERM value.
 *   Letter grade       `letterGrade` has zero hits in the whole codebase. Nothing computes one.
 *
 * The product decision was to keep the layout and mark the gaps rather than hide them, so a parent
 * sees the shape of what is coming instead of a screen that quietly differs from the design.
 *
 * ── IT MUST NEVER BE ATTACHED TO SOMETHING TAPPABLE ─────────────────────────
 * A greyed tile that still navigates is worse than one that plainly does nothing — it promises
 * twice. Callers render the host as a plain `View`, not a `Pressable`.
 */

export default function ComingSoon({ label = 'Coming soon', style }) {
  const styles = useStyles();
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** The muted wash a whole tile takes while it is in this state. Pair with the badge, not instead. */
export function comingSoonSurface() {
  return { opacity: 0.55 };
}

const useStyles = makeStyles(() => ({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: SLATE[200],
  },
  text: {
    fontSize: TYPE.micro,
    fontWeight: '800',
    color: SLATE[600],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
}));
