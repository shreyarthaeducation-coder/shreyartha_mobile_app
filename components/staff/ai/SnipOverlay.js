import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PORTALS, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { Select } from '../../ui';
import { CANONICAL_BLOOMS } from '../../../services/teacher/aiContentService';
import { MIN_SNIP_PX } from '../../../utils/snipCapture';

/**
 * The drag-a-rectangle layer, ported from TeacherResourceViewer's pointer handlers.
 *
 * Behaviour kept from the web:
 *   • drag anywhere to draw a rect
 *   • release under MIN_SNIP_PX on either side → treated as an accidental tap, stays in snip mode
 *   • otherwise the rect FREEZES and a confirm bubble appears with Bloom's / Generate / 3D / Redraw
 *   • the bubble swallows its own touches so tapping a button never starts a new drag
 *
 * The coordinate space is this overlay's own layout, which is laid over the captured document
 * View at identical bounds — that is what lets utils/snipCapture map the rect straight onto the
 * screenshot with one scale factor.
 */

const PALETTE = PORTALS.school;

/** Roughly the bubble's height; used to flip it above the selection near the bottom edge. */
const BUBBLE_H = 132;

export default function SnipOverlay({ layout, busy, onGenerate, onView3D }) {
  const [sel, setSel] = useState(null);
  const [frozen, setFrozen] = useState(false);
  const [bloomsLevel, setBloomsLevel] = useState('');

  // PanResponder is created once, so its callbacks cannot close over fresh state — the frozen
  // flag and the drag origin both live in refs. Same reason the web holds selFrozen in a ref.
  const frozenRef = useRef(false);
  const startRef = useRef(null);

  const reset = () => {
    setSel(null);
    setFrozen(false);
    frozenRef.current = false;
    startRef.current = null;
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !frozenRef.current,
        onMoveShouldSetPanResponder: () => !frozenRef.current,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          startRef.current = { x: locationX, y: locationY };
          setSel({ x: locationX, y: locationY, w: 0, h: 0 });
        },
        onPanResponderMove: (evt, gesture) => {
          const start = startRef.current;
          if (!start || frozenRef.current) return;
          // dx/dy from the grant point, rather than locationX on a moving touch, which is
          // reported relative to whichever subview is under the finger.
          const x2 = start.x + gesture.dx;
          const y2 = start.y + gesture.dy;
          setSel({
            x: Math.min(start.x, x2),
            y: Math.min(start.y, y2),
            w: Math.abs(gesture.dx),
            h: Math.abs(gesture.dy),
          });
        },
        onPanResponderRelease: () => {
          startRef.current = null;
          setSel((current) => {
            if (!current || current.w < MIN_SNIP_PX || current.h < MIN_SNIP_PX) {
              return null; // accidental tap — stay in snip mode with nothing selected
            }
            frozenRef.current = true;
            setFrozen(true);
            return current;
          });
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  const run = (fn) => async () => {
    // The rect is handed over before the overlay clears, so the caller can crop from it.
    const snapshot = sel;
    await fn(snapshot, bloomsLevel);
    reset();
  };

  // Near the bottom of the page the bubble would fall off-screen; flip it above the selection.
  const below = sel ? sel.y + sel.h + 8 : 0;
  const bubbleTop =
    sel && layout?.height && below + BUBBLE_H > layout.height
      ? Math.max(4, sel.y - BUBBLE_H - 8)
      : below;

  return (
    <View style={styles.overlay} {...responder.panHandlers}>
      {sel ? (
        <View
          pointerEvents="none"
          style={[styles.rect, { left: sel.x, top: sel.y, width: sel.w, height: sel.h }]}
        />
      ) : (
        <View style={styles.hintWrap} pointerEvents="none">
          <Text style={styles.hint}>Drag to select the part you want to teach from</Text>
          <Text style={styles.hintSmall}>Zoom in first for a sharper read</Text>
        </View>
      )}

      {sel && frozen ? (
        <View
          style={[styles.bubble, { left: Math.max(4, Math.min(sel.x, (layout?.width || 0) - 260)), top: bubbleTop }]}
          // Stops a tap on the bubble from being read as the start of a new drag.
          onStartShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
        >
          <Select
            variant="field"
            label="Bloom's level"
            value={bloomsLevel}
            options={[
              { value: '', label: "Bloom's: auto" },
              ...CANONICAL_BLOOMS.map((b) => ({ value: b, label: b })),
            ]}
            onChange={setBloomsLevel}
            disabled={busy}
            style={styles.bloomsField}
          />
          <View style={styles.bubbleRow}>
            <Pressable
              onPress={run(onGenerate)}
              disabled={busy}
              style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="sparkles" size={16} color="#ffffff" />
              <Text style={styles.btnPrimaryText}>Generate</Text>
            </Pressable>
            <Pressable
              onPress={run(onView3D)}
              disabled={busy}
              style={({ pressed }) => [styles.btn, styles.btn3d, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.btn3dText}>🧊 3D</Text>
            </Pressable>
            <Pressable
              onPress={reset}
              disabled={busy}
              style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={16} color={SLATE[600]} />
              <Text style={styles.btnGhostText}>Redraw</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.18)' },
  rect: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: PALETTE.primary,
    backgroundColor: 'rgba(46,134,171,0.18)',
    borderRadius: 2,
  },
  hintWrap: { position: 'absolute', left: 0, right: 0, top: '45%', alignItems: 'center', gap: 4 },
  hint: {
    fontSize: TYPE.body,
    fontWeight: '700',
    color: '#ffffff',
    backgroundColor: 'rgba(15,23,42,0.78)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  hintSmall: {
    fontSize: TYPE.caption,
    color: '#ffffff',
    backgroundColor: 'rgba(15,23,42,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },

  bubble: {
    position: 'absolute',
    width: 256,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: SPACING.sm,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  bloomsField: { marginBottom: 4 },
  bubbleRow: { flexDirection: 'row', gap: 6 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 9,
  },
  btnPrimary: { flex: 1, backgroundColor: PALETTE.primaryDark },
  btnPrimaryText: { fontSize: TYPE.label, fontWeight: '700', color: '#ffffff' },
  btn3d: { backgroundColor: PALETTE.tint },
  btn3dText: { fontSize: TYPE.label, fontWeight: '700', color: PALETTE.primaryDark },
  btnGhost: { backgroundColor: SLATE[100] },
  btnGhostText: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[600] },
  pressed: { opacity: 0.75 },
});
