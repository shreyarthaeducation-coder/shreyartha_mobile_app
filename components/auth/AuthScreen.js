import React from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS, SPACING } from '../../constants/theme';

// 'bottom' is deliberately excluded: it is the inset that changes when the keyboard opens, and
// feeding it into SafeAreaView padding re-lays-out the card mid-focus — on Android 15 that
// re-layout can detach the focused input and close the keyboard. Module-level so the native view
// never sees a "new" edges prop on re-render.
const EDGES = ['top', 'left', 'right'];

/**
 * The shell every portal login shares: gradient page, logo block, and a white card.
 *
 * Mirrors the web auth pages (gradient background + centred white card, radius 20) but built
 * for a phone — safe areas, keyboard avoidance, and a scroll view that keeps taps working while
 * the keyboard is up.
 *
 * Portal-agnostic: the caller passes a palette from constants/theme PORTALS, so the same shell
 * serves the school (teal), parent (purple) and student (dark) logins.
 */
export default function AuthScreen({
  palette,
  title,
  subtitle,
  onBack,
  children,
  footer,
}) {
  // iOS needs 'padding' because nothing else moves the content above the keyboard. Android must
  // NOT get a KeyboardAvoidingView at all: KAV subscribes to keyboardDidShow/Hide and setStates
  // on every toggle even with behavior=undefined, and on SDK 54 (edge-to-edge, adjustResize
  // inert) that churn plus the window re-layout is what detached the focused field and made the
  // keyboard open-then-instantly-close.
  const Avoider = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const avoiderProps = Platform.OS === 'ios' ? { behavior: 'padding' } : {};

  return (
    <LinearGradient
      colors={palette.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.flex}
    >
      <SafeAreaView style={styles.flex} edges={EDGES}>
        <Avoider style={styles.flex} {...avoiderProps}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {onBack ? (
              <Pressable
                onPress={onBack}
                style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={18} color="#ffffff" />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            ) : (
              <View style={styles.backSpacer} />
            )}

            <View style={styles.brand}>
              <Image
                source={require('../../assets/images/AppLogo.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="The 3C Edge"
              />
            </View>

            <View style={styles.card}>
              <View style={styles.titleBlock}>
                <Text style={[styles.title, { color: palette.primaryDark }]}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              {children}
            </View>

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </ScrollView>
        </Avoider>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: SPACING.md,
  },
  backBtnPressed: { backgroundColor: 'rgba(255,255,255,0.3)' },
  backText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  backSpacer: { height: SPACING.md },
  brand: { alignItems: 'center', marginBottom: SPACING.md },
  logo: { width: 150, height: 60 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  titleBlock: { alignItems: 'center', marginBottom: SPACING.lg },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  footer: { marginTop: SPACING.md, alignItems: 'center' },
});
