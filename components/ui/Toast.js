import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SHADOWS, SPACING } from '../../constants/theme';

/**
 * Transient confirmation strip, the native counterpart of the web's `.action-message` block
 * ("✅ Attendance saved successfully!"). Floats above the content at the bottom of the screen.
 *
 * Two conventions carried over from the auth kit:
 *   - It always renders a host View (`collapsable={false}`). Returning null would change the
 *     native child list of whatever screen mounts it, and on Android that can detach a focused
 *     TextInput and close the keyboard. See components/auth/Banner.js.
 *   - It never re-renders on focus or timer ticks beyond the fade, so it is safe next to inputs.
 *
 * The 4 s default matches the web's setTimeout in TeacherSelfAttendance.js.
 */

const TONES = {
  success: {
    bg: FEEDBACK.successBg,
    border: FEEDBACK.successBorder,
    text: FEEDBACK.successText,
    icon: 'checkmark-circle',
  },
  error: {
    bg: FEEDBACK.errorBg,
    border: FEEDBACK.errorBorder,
    text: FEEDBACK.errorText,
    icon: 'alert-circle',
  },
  info: {
    bg: FEEDBACK.neutralBg,
    border: FEEDBACK.neutralBorder,
    text: FEEDBACK.neutralText,
    icon: 'information-circle',
  },
};

/**
 * Toast state for a screen.
 *
 * @returns {{ toast: {message: string, tone: string}, showToast: (msg: string, tone?: string) => void,
 *             hideToast: () => void }}
 */
export function useToast(durationMs = 4000) {
  const [toast, setToast] = useState({ message: '', tone: 'success' });
  const timer = useRef(null);

  const hideToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast((prev) => (prev.message ? { ...prev, message: '' } : prev));
  }, []);

  const showToast = useCallback(
    (message, tone = 'success') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message: String(message || ''), tone });
      timer.current = setTimeout(() => {
        timer.current = null;
        setToast((prev) => ({ ...prev, message: '' }));
      }, durationMs);
    },
    [durationMs],
  );

  // A screen dismissed while a toast is up would otherwise setState after unmount.
  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  return { toast, showToast, hideToast };
}

export default function Toast({ message, tone = 'success' }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: message ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [message, opacity]);

  if (!message) return <View collapsable={false} />;

  const colors = TONES[tone] || TONES.success;

  return (
    <Animated.View
      collapsable={false}
      pointerEvents="none"
      style={[styles.wrap, { opacity }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.toast, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <Ionicons name={colors.icon} size={17} color={colors.text} />
        <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    bottom: SPACING.lg,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    ...SHADOWS.md,
  },
  text: { flexShrink: 1, fontSize: 13.5, fontWeight: '600' },
});
