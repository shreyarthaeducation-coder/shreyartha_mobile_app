import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { useTranslations } from '../../hooks/useTranslations';
import { ScreenScaffold } from '../ui';
import AssistantCard from '../shared/home/AssistantCard';
import ChangePasswordRow from '../shared/home/ChangePasswordRow';
import ShreyaChatSheet from '../staff/ShreyaChatSheet';
import { TAB_BAR_HEIGHT } from '../shared/home/PortalTabBar';

/**
 * Support — the footer's middle tab.
 *
 * ── WHY A SCREEN RATHER THAN A TAB THAT OPENS A MODAL ───────────────────────
 * The tab needs a real route. A tab whose only job is to present a sheet has no back behaviour, no
 * deep link and nothing to render underneath, and it breaks the moment anything else wants to send
 * a teacher "to support". This is also where a help or contact block belongs when one exists.
 *
 * The dashboard's own Shreya card opens the same sheet directly, so the tab is a second door rather
 * than the only one.
 *
 * `ShreyaChatSheet` is imported BY PATH, not through components/staff/index.js — a barrel import
 * here is an app-wide import, and expo-router scans it.
 */

const STRINGS = {
  title: 'Support',
  intro: 'Ask Shreya about your classes, your students or the portal itself.',
  shreyaRole: 'AI Support',
  shreyaBlurb: 'Get instant help, answers to your queries and 24/7 support.',
  shreyaCta: 'Chat with Shreya',
  liveName: 'Live Classes',
  liveRole: 'Google Meet',
  liveBlurb: 'Schedule a session for a class, or join the one starting next.',
  liveCta: 'Open Live Classes',
};

const SHREYA_AVATAR = require('../../assets/images/Chatbot.png');
const SHREYA_ACCENT = '#2196f3';

export default function TeacherSupportScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const t = useTranslations(STRINGS);
  const insets = useSafeAreaInsets();
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <ScreenScaffold
      title={t.title}
      fallbackRoute="/teacher"
      contentStyle={{ paddingBottom: TAB_BAR_HEIGHT + (insets.bottom || SPACING.sm) }}
    >
      <Text style={styles.intro}>{t.intro}</Text>

      {/* The same pair as the dashboard's For Support block — see TeacherHomeScreen for why Live
          Classes sits beside Shreya rather than under her, and why only she keeps her own colour. */}
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

        <AssistantCard
          tone="light"
          name={t.liveName}
          role={t.liveRole}
          blurb={t.liveBlurb}
          cta={t.liveCta}
          icon="videocam"
          accent={palette.primary}
          onPress={() => router.push('/teacher/live-classes')}
        />
      </View>

      {/* The teacher's only route to change-password now that the header chip is gone — this screen
          previously had no password row at all. */}
      <View style={styles.account}>
        <ChangePasswordRow route="/teacher/change-password" />
      </View>

      {chatOpen ? (
        <ShreyaChatSheet visible onClose={() => setChatOpen(false)} basePath="/teacher" />
      ) : null}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  intro: { fontSize: TYPE.label, color: SLATE[500], lineHeight: leading(TYPE.label), marginBottom: SPACING.md },
  supportPair: { flexDirection: 'row', alignItems: 'stretch', gap: SPACING.sm },
  account: { marginTop: SPACING.md },
}));
