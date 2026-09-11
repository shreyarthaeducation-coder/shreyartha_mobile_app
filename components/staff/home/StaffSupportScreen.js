import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { useTranslations } from '../../../hooks/useTranslations';
import { Card, ScreenScaffold } from '../../ui';
import { TAB_BAR_HEIGHT } from '../../shared/home/PortalTabBar';
import AssistantCard from '../../shared/home/AssistantCard';
import ShreyaChatSheet from '../ShreyaChatSheet';
import { shreyaConfigFor } from './shreyaConfigs';
import { resolveStaffMenus } from '../../../constants/staffRoles';
import { getStaffHome } from '../../../constants/staffHome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Support — the footer's middle tab, in two modes.
 *
 * ── WHY A SCREEN AND NOT A TAB THAT OPENS A MODAL ───────────────────────────
 * The tab needs a real route. A tab whose only job is to present a sheet has no back behaviour, no
 * deep link and nothing to render underneath, and it breaks the moment anything else wants to send
 * someone "to support".
 *
 * ── `shreya` VERSUS `help`, AND WHY MOST ROLES GET `help` ───────────────────
 * Only ONE of the four redesigned panels can have Shreya. `TeacherShreyaController` is
 * `hasAnyRole('TEACHER','SHREYARTHA_TEACHER')`, and the service behind it then compares
 * `SchoolUser.userType` against those same two literals — so:
 *
 *   shreyartha_teacher     works
 *   vice_principal         passes the endpoint guard via VICE_PRINCIPAL → TEACHER, then gets an
 *                          HTTP 400 about account types from the service. Worse than a 403: it
 *                          reads as a data bug rather than a permission.
 *   counselor              403 — COUNSELOR does not imply TEACHER
 *   shreyartha_councellor  403
 *
 * There is no counsellor Shreya controller and no counsellor context service anywhere, so this is
 * not a guard that can be widened. A card that renders, is tapped and fails is worse than an honest
 * help page, which is what `support: 'help'` renders.
 */

const STRINGS = {
  title: 'Support',
  introShreya: 'Ask Shreya about your classes, your students or the portal itself.',
  introHelp: 'Getting help with the portal.',
  shreyaRole: 'AI Support',
  shreyaBlurb: 'Get instant help, answers to your queries and 24/7 support.',
  shreyaCta: 'Chat with Shreya',
  helpTitle: 'Who to ask',
  helpAdmin: 'Your school administrator',
  helpAdminBody: 'Account access, verification, and anything about your classes or assignments.',
  helpEmail: 'Email The 3C Edge',
  helpEmailBody: 'Problems with the app itself — something not loading, or a screen behaving oddly.',
  helpPassword: 'Change your password',
  // The header lock icon this used to point at was removed when the school crest took the lead
  // position in BrandBar. This row is now the only way in, so the copy must not send anyone back
  // to a control that no longer exists.
  helpPasswordBody: 'Set a new password for your account.',
};

const SHREYA_AVATAR = require('../../../assets/images/Chatbot.png');

// Shreya's own blue, matched to the website and every other AI surface. Not the portal palette —
// she is a guest with one identity across every panel.
const SHREYA_ACCENT = '#2196f3';

const SUPPORT_EMAIL = 'support@shreyartha.com';

export default function StaffSupportScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslations(STRINGS);
  const [chatOpen, setChatOpen] = useState(false);

  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const config = resolveStaffMenus(roleKey);
  const home = getStaffHome(roleKey);

  if (!config || !home) return null;

  const isShreya = home.support === 'shreya';

  return (
    <ScreenScaffold
      title={t.title}
      fallbackRoute={`/staff/${roleKey}`}
      contentStyle={{ paddingBottom: TAB_BAR_HEIGHT + (insets.bottom || SPACING.sm) }}
    >
      <Text style={styles.intro}>{isShreya ? t.introShreya : t.introHelp}</Text>

      {isShreya ? (
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
      ) : (
        <Card>
          <Text style={styles.helpTitle}>{t.helpTitle}</Text>

          {/* Not a Pressable: there is no in-app route to a school administrator, and a row that
              looks tappable and does nothing is worse than a row that plainly does not. */}
          <View style={styles.row}>
            <View style={styles.icon}>
              <Ionicons name="business-outline" size={19} color={palette.primaryDark} />
            </View>
            <View style={styles.text}>
              <Text style={styles.label}>{t.helpAdmin}</Text>
              <Text style={styles.description}>{t.helpAdminBody}</Text>
            </View>
          </View>

          <Pressable
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
            style={({ pressed }) => [styles.row, styles.rowDivided, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${t.helpEmail}. ${t.helpEmailBody}`}
          >
            <View style={styles.icon}>
              <Ionicons name="mail-outline" size={19} color={palette.primaryDark} />
            </View>
            <View style={styles.text}>
              <Text style={styles.label}>{t.helpEmail}</Text>
              <Text style={styles.description}>{SUPPORT_EMAIL}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={SLATE[400]} />
          </Pressable>

          <Pressable
            onPress={() => router.push(config.routes.changePassword)}
            style={({ pressed }) => [styles.row, styles.rowDivided, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${t.helpPassword}. ${t.helpPasswordBody}`}
          >
            <View style={styles.icon}>
              <Ionicons name="lock-closed-outline" size={19} color={palette.primaryDark} />
            </View>
            <View style={styles.text}>
              <Text style={styles.label}>{t.helpPassword}</Text>
              <Text style={styles.description}>{t.helpPasswordBody}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={SLATE[400]} />
          </Pressable>
        </Card>
      )}

      {chatOpen ? (
        <ShreyaChatSheet
          config={shreyaConfigFor(home)}
          visible
          onClose={() => setChatOpen(false)}
          basePath={`/staff/${roleKey}`}
          isShreya01={!!config.chatbot?.isShreya01}
        />
      ) : null}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  intro: { fontSize: TYPE.label, color: SLATE[500], lineHeight: leading(TYPE.label), marginBottom: SPACING.md },

  helpTitle: {
    fontSize: TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: SLATE[500],
    marginBottom: SPACING.sm,
  },
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

  pressed: { opacity: 0.8 },
}));
