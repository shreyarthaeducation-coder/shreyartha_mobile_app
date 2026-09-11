import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TINTS, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { formatLongDateTime, parseLocalDateTime, toIsoDate } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';

/**
 * When and where one day's attendance was recorded, from the sheet's `details[date]`.
 *
 * Two separate lines, because they are two separate records:
 *   • the mark — who or what set the day's status, when, and where they were;
 *   • the sign-in — the session opened automatically when they signed in to the app or website.
 * A day can have either, both, or a status from before times were recorded, which is said plainly
 * rather than left blank. Shared by Self Attendance and My Calendar.
 *
 * Mirrors frontendmain/src/School/shared/AttendanceDayDetail.js.
 */

/** Status → words and colours. `color` is for white; `bg`/`onBg` are a tinted cell and its ink. */
export const STATUS_META = {
  PRESENT: {
    label: 'Present',
    color: FEEDBACK.successText,
    bg: FEEDBACK.successBg,
    onBg: FEEDBACK.successOnBg,
  },
  WORK_FROM_HOME: {
    label: 'Work from home',
    color: TINTS.teal.fg,
    bg: TINTS.teal.bg,
    onBg: TINTS.teal.fg,
  },
  ABSENT: {
    label: 'Absent',
    color: FEEDBACK.errorText,
    bg: FEEDBACK.errorBg,
    onBg: FEEDBACK.errorOnBg,
  },
};

const NO_FIX_TEXT = {
  denied: 'Location permission was refused',
  unavailable: 'Location services were off',
  error: 'Could not get a location fix',
};

/** Why a mark saved without a place, in words — for a toast. */
export const noFixReason = (status) => NO_FIX_TEXT[status] || 'No location was recorded';

/** "2026-09-10T10:42" -> "10:42 am" */
function clock(value) {
  const date = parseLocalDateTime(value);
  if (!date) return '';
  const hours = date.getHours();
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(date.getMinutes()).padStart(2, '0')} ${hours >= 12 ? 'pm' : 'am'}`;
}

/** Just the time when it happened on the day itself; the full date when it did not. */
function when(value, day) {
  const date = parseLocalDateTime(value);
  if (!date) return '';
  return day && toIsoDate(date) === day ? clock(value) : formatLongDateTime(value);
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function describePlace(place = {}) {
  const fix = isNum(place.latitude) && isNum(place.longitude);
  const parts = [];
  if (place.placeName) parts.push(place.placeName);
  if (place.resolvedAddress) parts.push(place.resolvedAddress);
  else if (fix) parts.push(`${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`);
  if (place.pincode && !String(place.resolvedAddress || '').includes(place.pincode)) {
    parts.push(`PIN ${place.pincode}`);
  }
  if (fix && isNum(place.accuracyMetres)) parts.push(`±${Math.round(place.accuracyMetres)} m`);

  if (parts.length) {
    return {
      found: true,
      text: parts.join(' · '),
      url: fix
        ? `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
        : null,
    };
  }
  return { found: false, text: noFixReason(place.locationStatus), url: null };
}

function Place({ place }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  return (
    <View style={styles.placeBlock}>
      <View style={styles.placeRow}>
        <Ionicons
          name="location-outline"
          size={17}
          color={place.found ? PALETTE.primaryDark : SLATE[500]}
        />
        <Text style={place.found ? styles.placeText : styles.muted}>{place.text}</Text>
      </View>
      {place.url ? (
        <Pressable
          onPress={() => Linking.openURL(place.url).catch(() => {})}
          hitSlop={8}
          style={({ pressed }) => [styles.mapLink, pressed && styles.pressed]}
          accessibilityRole="link"
          accessibilityLabel="Open this location in Maps"
        >
          <Text style={[styles.mapLinkText, { color: PALETTE.primaryDark }]}>Open in Maps</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function AttendanceDayDetail({ date, detail }) {
  const styles = useStyles();
  const status = detail?.status || null;
  const signedIn = !!detail?.loginAt;

  if (!status && !signedIn) {
    return <Text style={styles.muted}>Nothing recorded for this day.</Text>;
  }

  const meta = STATUS_META[status];
  const checkIn = detail?.source === 'CHECK_IN';

  return (
    <View style={styles.wrap}>
      {status ? (
        <View style={styles.row}>
          <Ionicons
            name={checkIn ? 'business-outline' : 'create-outline'}
            size={20}
            color={SLATE[500]}
            style={styles.rowIcon}
          />
          <View style={styles.body}>
            <Text style={styles.label}>{checkIn ? 'School check-in' : 'Marked'}</Text>
            <Text style={styles.main}>
              <Text style={{ color: meta?.color || SLATE[800] }}>{meta?.label || status}</Text>
              {detail.markedAt ? ` · ${when(detail.markedAt, date)}` : ''}
            </Text>
            {detail.markedAt ? (
              <Place place={describePlace(detail)} />
            ) : (
              <Text style={styles.muted}>Marked before times and places were recorded.</Text>
            )}
            {detail.locked ? (
              <Text style={styles.note}>
                Your school check-in marked this day present, so it can't be changed by hand.
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {signedIn ? (
        <View style={styles.row}>
          <Ionicons name="log-in-outline" size={20} color={SLATE[500]} style={styles.rowIcon} />
          <View style={styles.body}>
            <Text style={styles.label}>Signed in</Text>
            <Text style={styles.main}>
              {when(detail.loginAt, date)}
              {detail.logoutAt ? ` · signed out ${when(detail.logoutAt, date)}` : ''}
            </Text>
            <Place
              place={describePlace({
                latitude: detail.loginLatitude,
                longitude: detail.loginLongitude,
                accuracyMetres: detail.loginAccuracyMetres,
                locationStatus: detail.loginLocationStatus,
              })}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.sm },
  rowIcon: { marginTop: 2 },
  body: { flex: 1 },
  label: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: SLATE[600],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  main: {
    fontSize: TYPE.body,
    lineHeight: leading(TYPE.body),
    fontWeight: '700',
    color: SLATE[800],
    marginTop: 2,
  },
  placeBlock: { marginTop: 4 },
  placeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  placeText: { flex: 1, fontSize: TYPE.label, lineHeight: leading(TYPE.label), color: SLATE[700] },
  mapLink: { alignSelf: 'flex-start', marginTop: 4, marginLeft: 23, paddingVertical: 2 },
  mapLinkText: { fontSize: TYPE.label, fontWeight: '700', textDecorationLine: 'underline' },
  muted: { flex: 1, fontSize: TYPE.label, lineHeight: leading(TYPE.label), color: SLATE[600] },
  note: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 8,
    backgroundColor: FEEDBACK.successBg,
    borderWidth: 1,
    borderColor: FEEDBACK.successBorder,
    fontSize: TYPE.label,
    lineHeight: leading(TYPE.label),
    color: FEEDBACK.successOnBg,
  },
  pressed: { opacity: 0.7 },
}));
