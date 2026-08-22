import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHADOWS, SLATE, SPACING } from '../../constants/theme';
import { usePalette } from './PaletteContext';

/**
 * Full-height sheet for create/edit forms — the native replacement for the web's `ResizableModal`.
 *
 * Two rules carried over from the auth-kit rebuild, both of which cost a session to find:
 *   - `KeyboardAvoidingView` on **iOS only**. On Android with edge-to-edge, KAV registers keyboard
 *     listeners and re-lays-out even with `behavior=undefined`, and the IME-show re-layout can hand
 *     focus to another attached EditText, which closes the keyboard. Android relies on
 *     `android.softwareKeyboardLayoutMode: "pan"` in app.json instead.
 *   - The backdrop is a `Pressable` wrapping a `Pressable` that swallows taps, rather than an
 *     onPress on the container — a touch that starts inside the card must never dismiss it.
 *
 * The body scrolls; the action row is pinned so Save is always reachable on a long form.
 */

export default function FormSheet({
  visible,
  title,
  subtitle,
  onClose,
  onSubmit,
  submitLabel = 'Save',
  submitting = false,
  submitDisabled = false,
  // Omit `onSubmit` and the action row disappears — that turns this into a plain read-only sheet,
  // which is what the report views need. `headerAction` ({ icon, label, onPress, busy }) then
  // carries whatever single action they do have, e.g. Share.
  headerAction,
  fullHeight = false,
  palette: paletteProp,
  children,
}) {
  const contextPalette = usePalette();
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  const Body = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const bodyProps = Platform.OS === 'ios' ? { behavior: 'padding' } : {};

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Body style={[styles.bodyWrap, fullHeight && styles.bodyWrapFull]} {...bodyProps}>
          {/* Swallows taps so a drag or tap inside the card never reaches the backdrop. */}
          <Pressable style={[styles.sheet, fullHeight && styles.sheetFull]} onPress={() => {}}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {headerAction ? (
                <Pressable
                  onPress={headerAction.onPress}
                  disabled={headerAction.busy}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.headerActionBtn,
                    { backgroundColor: palette.tint },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={headerAction.label}
                >
                  {headerAction.busy ? (
                    <ActivityIndicator size="small" color={palette.primaryDark} />
                  ) : (
                    <Ionicons
                      name={headerAction.icon || 'share-outline'}
                      size={18}
                      color={palette.primaryDark}
                    />
                  )}
                </Pressable>
              ) : null}
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={SLATE[600]} />
              </Pressable>
            </View>

            <ScrollView
              style={[styles.scroll, fullHeight && styles.scrollFull]}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {onSubmit ? (
            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                disabled={submitting}
                style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onSubmit}
                disabled={submitting || submitDisabled}
                style={({ pressed }) => [
                  styles.submitBtn,
                  { backgroundColor: palette.primaryDark },
                  (submitting || submitDisabled) && styles.submitDisabled,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitText}>{submitLabel}</Text>
                )}
              </Pressable>
            </View>
            ) : null}
          </Pressable>
        </Body>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  bodyWrap: { maxHeight: '92%' },
  bodyWrapFull: { flex: 1, marginTop: 40 },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetFull: { flex: 1 },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  headerText: { flex: 1 },
  title: { fontSize: 16.5, fontWeight: '700', color: SLATE[800] },
  subtitle: { fontSize: 12.5, color: SLATE[500], marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[100],
  },
  scroll: { flexGrow: 0 },
  scrollFull: { flex: 1, flexGrow: 1 },
  scrollContent: { padding: SPACING.md, paddingBottom: SPACING.sm },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: SLATE[200],
    backgroundColor: '#ffffff',
    ...SHADOWS.md,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: SLATE[600] },
  submitBtn: {
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
  },
  submitDisabled: { backgroundColor: SLATE[300] },
  submitText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  pressed: { opacity: 0.75 },
});
