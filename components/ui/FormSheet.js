import { useContext } from 'react';
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
import { SHADOWS, SLATE, SPACING, TYPE } from '../../constants/theme';
import { usePalette } from './PaletteContext';
import SheetToastContext from './SheetToastContext';
import Toast from './Toast';

/**
 * Full-height sheet for create/edit forms — the native replacement for the web's `ResizableModal`.
 *
 * Two rules carried over from the auth-kit rebuild, both of which cost a session to find:
 *   - `KeyboardAvoidingView` on **iOS only**. On Android with edge-to-edge, KAV registers keyboard
 *     listeners and re-lays-out even with `behavior=undefined`, and the IME-show re-layout can hand
 *     focus to another attached EditText, which closes the keyboard. Android relies on
 *     `android.softwareKeyboardLayoutMode: "pan"` in app.json instead.
 *   - The backdrop is its own full-screen `Pressable` BEHIND the card, not a Pressable wrapped
 *     around it — a touch inside the card must never dismiss it. It used to be a Pressable
 *     wrapping a tap-swallowing Pressable wrapping the ScrollView; on Android's New Architecture
 *     that pair could keep the drag, and a long question list would not scroll.
 *
 * The body scrolls; the action row is pinned so Save is always reachable on a long form. The
 * screen's toast is shown in here too (SheetToastContext) — the screen's own is under the Modal.
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
  const toast = useContext(SheetToastContext);
  // Explicit prop wins; otherwise the surrounding portal palette (teal by default).
  const palette = paletteProp || contextPalette;
  const Body = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const bodyProps = Platform.OS === 'ios' ? { behavior: 'padding' } : {};

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Behind the card, so a tap or a drag inside the card never reaches it. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <Body style={[styles.bodyWrap, fullHeight && styles.bodyWrapFull]} {...bodyProps}>
          <View style={[styles.sheet, fullHeight && styles.sheetFull]}>
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
                      size={20}
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
              nestedScrollEnabled
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
          </View>
        </Body>
        {toast ? (
          <View style={styles.toastLayer} pointerEvents="none">
            <Toast message={toast.message} tone={toast.tone} />
          </View>
        ) : null}
      </View>
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
  title: { fontSize: TYPE.title, fontWeight: '700', color: SLATE[800] },
  subtitle: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[100],
  },
  // flexShrink: a sheet that is not full height is capped at 92% of the screen, and a ScrollView that
  // cannot shrink grows past the cap instead of scrolling, its end cut off.
  scroll: { flexGrow: 0, flexShrink: 1 },
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
  cancelText: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[600] },
  submitBtn: {
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 10,
  },
  submitDisabled: { backgroundColor: SLATE[300] },
  submitText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  pressed: { opacity: 0.75 },
  // Near the top of the screen, clear of the pinned Save row the keyboard pushes up.
  toastLayer: { position: 'absolute', left: 0, right: 0, top: 48, height: 96 },
});
