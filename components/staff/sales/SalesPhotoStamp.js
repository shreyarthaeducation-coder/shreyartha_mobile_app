import { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

/**
 * The geo-stamped check-in photo, rendered so it can be screenshotted into a real file.
 *
 * `expo-image-manipulator` can only crop and resize — it has no drawing surface and cannot write
 * text — so the RN way to burn a stamp in is to *render* the composition and `captureRef` it, the
 * `utils/shareCapture.js` pattern.
 *
 * ── THREE RULES, EACH ONE LEARNED THE HARD WAY IN THIS REPO ─────────────────
 *  1. `collapsable={false}`. Without it RN flattens the wrapper out of the native view tree and
 *     `captureRef` has nothing to capture (utils/shareCapture.js).
 *  2. An explicit opaque `backgroundColor`. Capturing over a transparent view picks up whatever
 *     happened to be behind it (components/staff/adaptive/AdaptiveReport.js).
 *  3. It must be genuinely VISIBLE. `captureRef` on an `opacity: 0` view returns a blank bitmap on
 *     Android (components/staff/ai/ResourceViewerScreen.js) — so this is rendered as the sheet's
 *     own photo preview rather than hidden off to one side. The rep sees exactly what will be
 *     saved, which is the better design anyway.
 *
 * ── RESOLUTION, HONESTLY ───────────────────────────────────────────────────
 * `captureRef` grabs at on-screen pixel size, so the output is roughly the card's width times the
 * device pixel ratio — not the camera's full resolution. `utils/snipCapture.js` documents the same
 * trade-off for the same reason. A full-width 4:3 card keeps it legible; beating it would mean a
 * native module, and adding one forces a store release.
 */

const SalesPhotoStamp = forwardRef(function SalesPhotoStamp({ photoUri, stamp, mapUri }, ref) {
  if (!photoUri) return null;

  const lat = Number(stamp?.latitude);
  const lng = Number(stamp?.longitude);
  const hasFix = Number.isFinite(lat) && Number.isFinite(lng);

  const detail = [
    hasFix ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : 'No GPS fix',
    stamp?.accuracy ? `±${Math.round(stamp.accuracy)} m` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const when = [stamp?.pincode, formatWhen(stamp?.capturedAt)].filter(Boolean).join('  ·  ');

  return (
    <View ref={ref} collapsable={false} style={styles.frame}>
      <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />

      <View style={styles.panel}>
        {/* Drawn only when it arrived. The proxy returns 204 with no key, no quota or no network —
            and a rep checking in inside a school building is usually offline, so this is absent
            far more often than it is present. The row lays out correctly either way. */}
        {mapUri ? <Image source={{ uri: mapUri }} style={styles.thumb} /> : null}

        <View style={styles.text}>
          <Text style={styles.address} numberOfLines={2}>
            {stamp?.address || 'Location not resolved'}
          </Text>
          <Text style={styles.detail} numberOfLines={1}>{detail}</Text>
          <Text style={styles.detail} numberOfLines={1}>{when}</Text>
        </View>
      </View>
    </View>
  );
});

function formatWhen(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Plain StyleSheet, not makeStyles: these colours are baked into a photograph, so they must not
// change with the portal palette. A stamp that was teal on one panel and indigo on another would
// make the same evidence look like it came from two different systems.
const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    // Rule 2: opaque, or the capture picks up whatever is behind the sheet.
    backgroundColor: '#0f172a',
  },
  photo: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: '#1e293b',
  },
  text: { flex: 1 },
  address: { color: '#ffffff', fontSize: 12.5, fontWeight: '700', lineHeight: 16 },
  detail: { color: 'rgba(255,255,255,0.88)', fontSize: 11, lineHeight: 15, marginTop: 1 },
});

export default SalesPhotoStamp;
