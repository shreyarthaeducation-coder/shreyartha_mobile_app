import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { useTranslations } from '../../../hooks/useTranslations';
import { Card, ScreenScaffold } from '../../ui';
import { resolveStaffMenus } from '../../../constants/staffRoles';
import { getStaffHome, itemsFor } from '../../../constants/staffHome';

/**
 * My Attendance — the staff member's OWN employment record: their attendance, their leave, their
 * payslips. A list of full-width rows rather than a grid, because three items each deserve a
 * sentence explaining which of two similarly-named things they are.
 *
 * ── THIS HUB IS NEVER THE APPROVER QUEUE ────────────────────────────────────
 * The Vice Principal is the one panel carrying both halves of HR, and they are one path segment
 * apart on the server: `/api/staff/hr` is yours, `/api/school-admin/hr` is everyone's. The approver
 * screens live in My Workspace under School Administration and must not be listed here — filing a
 * VP's approval queue under "My Attendance" is exactly the confusion the menu labels ("My …" versus
 * "… Management") exist to prevent.
 *
 * The descriptor enforces it structurally: this screen renders `attendanceItemKeys` and nothing
 * else, and `assertArrangementCovers` proves every other key went somewhere.
 */

const STRINGS = {
  title: 'My Attendance',
  intro: 'Your own attendance record, leave balance and payslips.',
};

/**
 * Keyed by menu key, not by role. Every redesigned panel uses the same three self-service screens,
 * so the copy is shared; a role that adds a fourth adds a line here.
 */
const DESCRIPTIONS = {
  selfAttendance: 'Your month-by-month present and absent record.',
  leave: 'Balances, requests and applying for leave.',
  payroll: 'Published payslips and their PDFs.',
  // The APPROVER pair, for the admin hub below. Worded to leave no doubt which side of the
  // /api/staff/hr vs /api/school-admin/hr split they sit on, because the tile labels alone
  // ("Leave Management" vs "My Leave") are one word apart.
  leaveManagement: "Other staff's leave requests, and approving or declining them.",
  payrollManagement: 'Salary structures and payroll runs for your staff.',
};

/**
 * @param {object} props
 * @param {string} [props.heroKey] when set, this hub renders the `itemKeys` of the descriptor hero
 *   with that key instead of `attendanceItemKeys` — which is how one screen serves both My
 *   Attendance and the Principal's Payroll & Leave Management card. Omitted = My Attendance, the
 *   behaviour every existing caller relies on.
 */
export default function StaffAttendanceHubScreen({ heroKey } = {}) {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const t = useTranslations(STRINGS);

  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const config = resolveStaffMenus(roleKey);
  const home = getStaffHome(roleKey);

  if (!config || !home) return null;

  // A hero-backed hub takes its list, title and subtitle from that hero, so the card the user
  // tapped and the page they land on cannot describe different things. Falls back to My Attendance
  // whole, which is what every caller but admin-hub.js wants.
  const hero = heroKey ? (home.heroes || []).find((h) => h.key === heroKey) : null;
  const items = itemsFor(config.menu, hero ? hero.itemKeys || [] : home.attendanceItemKeys);
  const title = hero ? hero.title : t.title;
  const intro = hero ? hero.subtitle : t.intro;

  // A hero hub with no resolvable items would render an empty card with a heading. Nothing is
  // better than a page that looks broken.
  if (hero && !items.length) return null;

  return (
    <ScreenScaffold title={title} fallbackRoute={`/staff/${roleKey}`}>
      <Text style={styles.intro}>{intro}</Text>

      <Card>
        {items.map((item, i) => (
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
              {DESCRIPTIONS[item.key] ? (
                <Text style={styles.description} numberOfLines={2}>
                  {DESCRIPTIONS[item.key]}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={17} color={SLATE[400]} />
          </Pressable>
        ))}
      </Card>

      {/* The one thing someone will look for here and not find. Said plainly rather than left to be
          discovered — the two attendances really are one path segment apart on the server. The
          wording is per-role because not every panel calls its grid "My Workspace". */}
      {!hero && home.attendanceNote ? <Text style={styles.note}>{home.attendanceNote}</Text> : null}
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
  label: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[800] },
  description: { fontSize: TYPE.caption, color: SLATE[500], lineHeight: leading(TYPE.caption), marginTop: 2 },
  note: {
    fontSize: TYPE.caption,
    color: SLATE[500],
    lineHeight: leading(TYPE.caption),
    marginTop: SPACING.md,
  },

  pressed: { opacity: 0.8 },
}));
