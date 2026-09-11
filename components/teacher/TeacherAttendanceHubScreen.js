import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { useTranslations } from '../../hooks/useTranslations';
import { Card, ScreenScaffold } from '../ui';
import { TEACHER_ATTENDANCE_ITEMS } from '../../constants/teacherMenu';

/**
 * My Attendance — the teacher's own employment record: attendance, leave and payroll.
 *
 * ── THIS IS NOT "MARK ATTENDANCE" ───────────────────────────────────────────
 * `/api/teacher/attendance/mark` marks STUDENTS. `/api/teacher/self-attendance/mark` marks the
 * teacher. Same verb, one path segment apart, and the two screens sit in different destinations for
 * exactly that reason — Mark Attendance is a daily classroom task and stays in My Workspace under
 * Classroom, while these three are the teacher's own record and feed the same HR module.
 *
 * The route is `/teacher/my-attendance`, because `/teacher/attendance` is Mark Attendance and is one
 * of the nine routes the Shreya chatbot's `routeSuffix` values resolve to directly.
 *
 * ── NO SUMMARY FIGURE, DELIBERATELY ─────────────────────────────────────────
 * There are TWO unreconciled self-attendance systems. `/api/teacher/self-attendance/*` is a manual
 * month grid of PRESENT/ABSENT with no times — what `SelfAttendanceScreen` renders.
 * `/api/staff/attendance/*` is a separate check-in/check-out log with geolocation and a six-hour
 * PRESENT threshold, written automatically at login. They use different tables and neither reads the
 * other, so they can legitimately disagree. A single "attendance %" on this screen would have to
 * pick one and would be wrong against the other, so the hub reports nothing of its own and sends the
 * teacher to the screen that owns the number.
 */

const STRINGS = {
  title: 'My Attendance',
  intro: 'Your own attendance record, leave balance and payslips.',
  note:
    'Marking your students’ attendance lives under My Workspace → Classroom → Mark Attendance.',
};

const DESCRIPTIONS = {
  selfAttendance: 'Your month-by-month present and absent record.',
  leave: 'Balances, requests and applying for leave.',
  payroll: 'Published payslips and their PDFs.',
};

export default function TeacherAttendanceHubScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const t = useTranslations(STRINGS);

  return (
    <ScreenScaffold title={t.title} fallbackRoute="/teacher">
      <Text style={styles.intro}>{t.intro}</Text>

      <Card>
        {TEACHER_ATTENDANCE_ITEMS.map((item, i) => (
          <Pressable
            key={item.key}
            onPress={() => router.push(item.native)}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowDivided, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}. ${DESCRIPTIONS[item.key] || ''}`}
          >
            <View style={styles.icon}>
              <Ionicons name={item.icon} size={19} color={palette.primaryDark} />
            </View>
            <View style={styles.text}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.description} numberOfLines={2}>
                {DESCRIPTIONS[item.key]}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={SLATE[400]} />
          </Pressable>
        ))}
      </Card>

      {/* The one thing a teacher will look for here and not find. Said plainly rather than left to
          be discovered — the two attendances are one path segment apart on the server too. */}
      <Text style={styles.note}>{t.note}</Text>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  intro: { fontSize: TYPE.label, color: SLATE[500], lineHeight: leading(TYPE.label), marginBottom: SPACING.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: TOUCH.min,
    paddingVertical: SPACING.sm,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: SLATE[200] },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  text: { flex: 1 },
  label: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  description: { fontSize: TYPE.caption, color: SLATE[500], lineHeight: leading(TYPE.caption), marginTop: 1 },

  note: {
    fontSize: TYPE.caption,
    color: SLATE[500],
    lineHeight: leading(TYPE.caption),
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },

  pressed: { opacity: 0.8 },
}));
