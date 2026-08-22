import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { SHADOWS } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import ShreyaChatSheet from './ShreyaChatSheet';

/**
 * Floating Shreya launcher — ports TeacherChatbotLauncher.js.
 *
 * The web gates this on `isVerified`; here the gate is structural, because StaffMenuScreen
 * redirects unverified staff to the pending screen before this ever mounts.
 *
 * Mounted only where `config.chatbot` is set (the teacher shell) and on the parent home. The
 * counsellor, principal and VP panels have no chatbot on the web either.
 *
 * The FAB takes the surrounding portal palette, so it is teal on the teacher panel and purple on
 * the parent's — `usePalette()` defaults to PORTALS.school, which is exactly what the teacher
 * panel used to hardcode, so that panel is unchanged.
 */

const CHATBOT_AVATAR = require('../../assets/images/Chatbot.png');

export default function ShreyaLauncher({ basePath = '/teacher', isShreya01 = false, config }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);

  return (
    // A host View that always renders, so opening the sheet never unmounts a sibling of
    // whatever the menu screen has focused.
    <View collapsable={false} pointerEvents="box-none" style={styles.host}>
      {!open ? (
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Chat with Shreya"
        >
          <Image source={CHATBOT_AVATAR} style={styles.avatar} resizeMode="cover" />
        </Pressable>
      ) : null}

      <ShreyaChatSheet
        visible={open}
        onClose={() => setOpen(false)}
        basePath={basePath}
        isShreya01={isShreya01}
        config={config}
      />
    </View>
  );
}

const useStyles = makeStyles((p) => ({
  host: { ...StyleSheet.absoluteFillObject },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    backgroundColor: p.headerBg,
    borderWidth: 2,
    borderColor: '#ffffff',
    ...SHADOWS.lg,
  },
  avatar: { width: '100%', height: '100%' },
  pressed: { opacity: 0.85 },
}));
